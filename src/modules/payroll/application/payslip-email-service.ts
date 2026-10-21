import {
  claimQueuedDelivery,
  createDelivery,
  findLatestFailedDeliveryTo,
  findLatestPendingDelivery,
  findSentDelivery,
  listPayslipsForEmail,
  markPayslipEmailFailed,
  recordDeliveryFailed,
  recordDeliverySent,
  requeueDelivery,
} from '@/modules/payroll/infrastructure/payslip-delivery-repository';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { createEmailTransportForOrganization } from '@/platform/email/factory';
import { EmailNotConfiguredError } from '@/platform/email/errors';
import { getOrganizationPublicSmtpStatus } from '@/modules/payroll/application/payroll-smtp-settings-service';
import type { EmailTransport } from '@/platform/email/types';
import { monthLabelFromNumber } from '@/modules/payroll/application/payslip-email-format';
import { sendEmailWithRetries } from '@/modules/payroll/application/payslip-email-retry';
import { truncateDeliveryError } from '@/modules/payroll/application/payslip-delivery-error';
import { getPayslipPdfBuffer } from '@/modules/payroll/application/payroll-service';
import { buildPayslipEmail } from '@/modules/payroll/infrastructure/payslip-email-html';

const MAX_CONCURRENT = 5;
const DEFAULT_TIME_BUDGET_MS = 25_000;
export const STUCK_SENDING_MS = 10 * 60 * 1000;

function decimalToNumber(value: { toString(): string } | null | undefined): number {
  return value == null ? 0 : Number(value.toString());
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isValidEmployeeEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAIL_RE.test(email.trim());
}

export { truncateDeliveryError };

export async function claimPayslipEmailDeliveryForSend(deliveryId: string): Promise<boolean> {
  return claimQueuedDelivery(deliveryId);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

export async function verifySmtpAndSendTestEmail(
  organizationId: string,
  toEmail: string,
  transport?: EmailTransport,
) {
  const ownedTransport = !transport;
  const sender = transport ?? await createEmailTransportForOrganization(organizationId);
  try {
    if (sender.verifyConnection) await sender.verifyConnection();
    await sender.send({
      to: toEmail,
      subject: 'Prueba SMTP — SGE Planilla',
      text: 'Correo de prueba del módulo de planilla (SGE).',
      html: '<p>Correo de prueba del módulo de planilla (SGE).</p>',
    });
    return { ok: true as const };
  } finally {
    if (ownedTransport && sender.close) await sender.close();
  }
}

type WorkItem = { payslipId: string; deliveryId: string; toEmail: string };

export async function sendPayslipEmails(input: {
  organizationId: string;
  userId: string;
  year: number;
  month: number;
  employeeIds?: string[];
  force?: boolean;
  failedOnly?: boolean;
  timeBudgetMs?: number;
  transport?: EmailTransport;
  requestId?: string;
}) {
  const timeBudgetMs = input.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const started = Date.now();
  const ownedTransport = !input.transport;
  const transport = input.transport ?? await createEmailTransportForOrganization(input.organizationId);
  const smtp = await getOrganizationPublicSmtpStatus(input.organizationId);
  const stuckBefore = new Date(Date.now() - STUCK_SENDING_MS);

  try {
    const payslips = await listPayslipsForEmail({
      organizationId: input.organizationId,
      year: input.year,
      month: input.month,
      employeeIds: input.employeeIds,
    });

    const queue: WorkItem[] = [];
    let skipped = 0;

    for (const payslip of payslips) {
      if (input.failedOnly && payslip.emailStatus !== 'FAILED') {
        skipped += 1;
        continue;
      }

      if (!input.force) {
        const sent = await findSentDelivery(payslip.id);
        if (sent) {
          skipped += 1;
          continue;
        }
      }

      const email = payslip.employee.email?.trim() ?? '';
      if (!isValidEmployeeEmail(email)) {
        const existingFailed = await findLatestFailedDeliveryTo(payslip.id, email || '(sin correo)');
        if (!existingFailed) {
          await createDelivery({
            organizationId: input.organizationId,
            payslipId: payslip.id,
            toEmail: email || '(sin correo)',
            status: 'FAILED',
            attempts: 1,
            lastError: truncateDeliveryError('Empleado sin correo válido'),
            createdById: input.userId,
          });
        }
        await markPayslipEmailFailed(payslip.id, 'Empleado sin correo válido');
        continue;
      }

      let delivery = await findLatestPendingDelivery(payslip.id);

      if (input.force && payslip.emailStatus === 'SENT') {
        delivery = null;
      }

      if (delivery?.status === 'SENDING') {
        const claimedAt = delivery.claimedAt;
        if (claimedAt && claimedAt > stuckBefore) {
          skipped += 1;
          continue;
        }
        delivery = await requeueDelivery(delivery.id, email);
      } else if (delivery?.status === 'FAILED') {
        delivery = await requeueDelivery(delivery.id, email);
      } else if (!delivery) {
        delivery = await createDelivery({
          organizationId: input.organizationId,
          payslipId: payslip.id,
          toEmail: email,
          status: 'QUEUED',
          createdById: input.userId,
        });
      }

      queue.push({ payslipId: payslip.id, deliveryId: delivery.id, toEmail: email });
    }

    let sent = 0;
    let failed = 0;

    const processItem = async (item: WorkItem) => {
      const claimed = await claimPayslipEmailDeliveryForSend(item.deliveryId);
      if (!claimed) return;

      const payslip = payslips.find((p) => p.id === item.payslipId);
      if (!payslip) return;
      try {
        const { buffer, filename } = await getPayslipPdfBuffer(input.organizationId, payslip.id);
        const salarioPeriodo = decimalToNumber(payslip.salarioPeriodo);
        const monthlySalary = payslip.employee.monthlySalary == null
          ? null
          : decimalToNumber(payslip.employee.monthlySalary);
        const mail = buildPayslipEmail({
          employeeName: payslip.employee.fullName,
          periodStart: payslip.periodStart,
          periodEnd: payslip.periodEnd,
          salarioPeriodo,
          isProrated: monthlySalary !== null && salarioPeriodo !== monthlySalary,
          ihss: decimalToNumber(payslip.ihss),
          isr: decimalToNumber(payslip.isr),
          otro: decimalToNumber(payslip.otro),
          otroConcepto: payslip.otroConcepto,
          totalDeducciones: decimalToNumber(payslip.totalDeducciones),
          neto: decimalToNumber(payslip.neto),
          year: payslip.year,
        });
        const content = {
          ...mail,
          attachmentName: `Boleta_${monthLabelFromNumber(payslip.month)}_${payslip.year}.pdf`,
        };
        const result = await sendEmailWithRetries(transport, {
          to: item.toEmail,
          subject: content.subject,
          text: content.text,
          html: content.html,
          replyTo: smtp.replyTo ?? undefined,
          attachments: [{
            filename: content.attachmentName || filename,
            content: buffer,
            contentType: 'application/pdf',
          }],
        });
        await recordDeliverySent(item.deliveryId, payslip.id, result.messageId);
        sent += 1;
      } catch (error) {
        const message = truncateDeliveryError(
          error instanceof EmailNotConfiguredError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Error de envío',
        );
        await recordDeliveryFailed(item.deliveryId, payslip.id, message);
        failed += 1;
      }
    };

    let processed = 0;
    for (let offset = 0; offset < queue.length; offset += MAX_CONCURRENT) {
      if (Date.now() - started > timeBudgetMs) break;
      const batch = queue.slice(offset, offset + MAX_CONCURRENT);
      await mapWithConcurrency(batch, MAX_CONCURRENT, processItem);
      processed += batch.length;
    }

    const pending = queue.length - processed;
    const summary = {
      year: input.year,
      month: input.month,
      queued: queue.length,
      sent,
      failed,
      skipped,
      pending,
      completed: pending === 0,
    };

    await createAuditRecord({
      title: 'Envío de boletas por correo',
      description: `Lote planilla ${input.month}/${input.year}: ${sent} enviados, ${failed} fallidos, ${pending} pendientes.`,
      module: 'MANUAL',
      category: 'PAYROLL',
      userId: input.userId,
      organizationId: input.organizationId,
      action: input.force ? 'PAYROLL_EMAIL_RESEND' : 'PAYROLL_EMAIL_SEND',
      requestId: input.requestId,
      metadata: {
        year: input.year,
        month: input.month,
        sent,
        failed,
        pending,
        skipped,
      },
    });

    return summary;
  } finally {
    if (ownedTransport && transport.close) await transport.close();
  }
}

