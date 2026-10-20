import { prisma } from '@/lib/prisma';
import { createAuditRecord } from '@/lib/audit';
import { createEmailTransport } from '@/platform/email/factory';
import { EmailNotConfiguredError } from '@/platform/email/errors';
import { getPublicSmtpStatus, getSmtpRuntimeConfig } from '@/platform/email/smtp-config';
import type { EmailTransport } from '@/platform/email/types';
import { monthLabelFromNumber } from '@/modules/payroll/application/payslip-email-format';
import { sendEmailWithRetries } from '@/modules/payroll/application/payslip-email-retry';
import { truncateDeliveryError } from '@/modules/payroll/application/payslip-delivery-error';
import { getPayslipPdfBuffer } from '@/modules/payroll/application/payroll-service';
import { escapeHtml, formatPayrollDateHn } from '@/modules/payroll/infrastructure/payslip-pdf';

const MAX_CONCURRENT = 5;
const DEFAULT_TIME_BUDGET_MS = 25_000;
export const STUCK_SENDING_MS = 10 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isValidEmployeeEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAIL_RE.test(email.trim());
}

export { truncateDeliveryError };

export async function claimPayslipEmailDeliveryForSend(deliveryId: string): Promise<boolean> {
  const result = await prisma.payslipEmailDelivery.updateMany({
    where: { id: deliveryId, status: 'QUEUED' },
    data: { status: 'SENDING', attempts: { increment: 1 }, claimedAt: new Date() },
  });
  return result.count === 1;
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

async function buildPayslipEmailContent(input: {
  employeeName: string;
  month: number;
  year: number;
  periodStart: Date;
  periodEnd: Date;
  neto: number;
  replyTo?: string | null;
}) {
  const monthName = monthLabelFromNumber(input.month);
  const subject = `Boleta de pago – ${monthName} ${input.year} – Consejo Nacional de Inversiones`;
  const periodStartLabel = formatPayrollDateHn(input.periodStart);
  const periodEndLabel = formatPayrollDateHn(input.periodEnd);
  const period = `${periodStartLabel} al ${periodEndLabel}`;
  const netoLabel = input.neto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const safeName = escapeHtml(input.employeeName);
  const text = [
    `Estimado/a ${input.employeeName},`,
    '',
    `Adjuntamos su boleta de pago correspondiente a ${monthName} ${input.year}.`,
    `Periodo: ${period}. Salario neto: L. ${netoLabel}.`,
    '',
    input.replyTo ? '' : 'Este es un correo automático; por favor no responda a este mensaje.',
  ].filter(Boolean).join('\n');
  const html = `<p>Estimado/a ${safeName},</p>
<p>Adjuntamos su boleta de pago correspondiente a <strong>${escapeHtml(monthName)} ${input.year}</strong>.</p>
<p>Periodo: ${escapeHtml(periodStartLabel)} al ${escapeHtml(periodEndLabel)}<br/>Salario neto: <strong>L. ${escapeHtml(netoLabel)}</strong></p>
${input.replyTo ? '' : '<p><em>Este es un correo automático; por favor no responda a este mensaje.</em></p>'}`;
  return { subject, text, html, attachmentName: `Boleta_${monthName}_${input.year}.pdf` };
}

export async function verifySmtpAndSendTestEmail(toEmail: string, transport?: EmailTransport) {
  getSmtpRuntimeConfig();
  const ownedTransport = !transport;
  const sender = transport ?? createEmailTransport();
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
  getSmtpRuntimeConfig();
  const ownedTransport = !input.transport;
  const transport = input.transport ?? createEmailTransport();
  const smtp = getPublicSmtpStatus();
  const stuckBefore = new Date(Date.now() - STUCK_SENDING_MS);

  try {
    const payslips = await prisma.payslip.findMany({
      where: {
        organizationId: input.organizationId,
        year: input.year,
        month: input.month,
        ...(input.employeeIds?.length ? { employeeId: { in: input.employeeIds } } : {}),
      },
      include: {
        employee: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { employee: { fullName: 'asc' } },
    });

    const queue: WorkItem[] = [];
    let skipped = 0;

    for (const payslip of payslips) {
      if (input.failedOnly && payslip.emailStatus !== 'FAILED') {
        skipped += 1;
        continue;
      }

      if (!input.force) {
        const sent = await prisma.payslipEmailDelivery.findFirst({
          where: { payslipId: payslip.id, status: 'SENT' },
        });
        if (sent) {
          skipped += 1;
          continue;
        }
      }

      const email = payslip.employee.email?.trim() ?? '';
      if (!isValidEmployeeEmail(email)) {
        const existingFailed = await prisma.payslipEmailDelivery.findFirst({
          where: { payslipId: payslip.id, status: 'FAILED', toEmail: email || '(sin correo)' },
          orderBy: { queuedAt: 'desc' },
        });
        if (!existingFailed) {
          await prisma.payslipEmailDelivery.create({
            data: {
              organizationId: input.organizationId,
              payslipId: payslip.id,
              toEmail: email || '(sin correo)',
              status: 'FAILED',
              attempts: 1,
              lastError: truncateDeliveryError('Empleado sin correo válido'),
              createdById: input.userId,
            },
          });
        }
        await prisma.payslip.update({
          where: { id: payslip.id },
          data: { emailStatus: 'FAILED', emailError: 'Empleado sin correo válido' },
        });
        continue;
      }

      let delivery = await prisma.payslipEmailDelivery.findFirst({
        where: {
          payslipId: payslip.id,
          status: { in: ['QUEUED', 'FAILED', 'SENDING'] },
        },
        orderBy: { queuedAt: 'desc' },
      });

      if (input.force && payslip.emailStatus === 'SENT') {
        delivery = null;
      }

      if (delivery?.status === 'SENDING') {
        const claimedAt = delivery.claimedAt;
        if (claimedAt && claimedAt > stuckBefore) {
          skipped += 1;
          continue;
        }
        delivery = await prisma.payslipEmailDelivery.update({
          where: { id: delivery.id },
          data: { status: 'QUEUED', claimedAt: null, lastError: null, toEmail: email },
        });
      } else if (delivery?.status === 'FAILED') {
        delivery = await prisma.payslipEmailDelivery.update({
          where: { id: delivery.id },
          data: { status: 'QUEUED', claimedAt: null, lastError: null, toEmail: email },
        });
      } else if (!delivery) {
        delivery = await prisma.payslipEmailDelivery.create({
          data: {
            organizationId: input.organizationId,
            payslipId: payslip.id,
            toEmail: email,
            status: 'QUEUED',
            createdById: input.userId,
          },
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
        const content = await buildPayslipEmailContent({
          employeeName: payslip.employee.fullName,
          month: payslip.month,
          year: payslip.year,
          periodStart: payslip.periodStart,
          periodEnd: payslip.periodEnd,
          neto: Number(payslip.neto.toString()),
          replyTo: smtp.replyTo,
        });
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
        await prisma.$transaction([
          prisma.payslipEmailDelivery.update({
            where: { id: item.deliveryId },
            data: {
              status: 'SENT',
              messageId: result.messageId,
              sentAt: new Date(),
              lastError: null,
            },
          }),
          prisma.payslip.update({
            where: { id: payslip.id },
            data: {
              emailStatus: 'SENT',
              emailError: null,
              deliveryType: 'PDF_EMAIL',
            },
          }),
        ]);
        sent += 1;
      } catch (error) {
        const message = truncateDeliveryError(
          error instanceof EmailNotConfiguredError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Error de envío',
        );
        await prisma.$transaction([
          prisma.payslipEmailDelivery.update({
            where: { id: item.deliveryId },
            data: { status: 'FAILED', lastError: message },
          }),
          prisma.payslip.update({
            where: { id: payslip.id },
            data: { emailStatus: 'FAILED', emailError: message },
          }),
        ]);
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

export { getPublicSmtpStatus };
