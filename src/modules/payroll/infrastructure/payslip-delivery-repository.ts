import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function claimQueuedDelivery(deliveryId: string): Promise<boolean> {
  const result = await prisma.payslipEmailDelivery.updateMany({
    where: { id: deliveryId, status: 'QUEUED' },
    data: { status: 'SENDING', attempts: { increment: 1 }, claimedAt: new Date() },
  });
  return result.count === 1;
}

export function listPayslipsForEmail(input: {
  organizationId: string;
  year: number;
  month: number;
  employeeIds?: string[];
}) {
  return prisma.payslip.findMany({
    where: {
      organizationId: input.organizationId,
      year: input.year,
      month: input.month,
      ...(input.employeeIds?.length ? { employeeId: { in: input.employeeIds } } : {}),
    },
    include: {
      employee: {
        select: { id: true, fullName: true, email: true, monthlySalary: true },
      },
    },
    orderBy: { employee: { fullName: 'asc' } },
  });
}

export function findSentDelivery(payslipId: string) {
  return prisma.payslipEmailDelivery.findFirst({
    where: { payslipId, status: 'SENT' },
  });
}

export function findLatestFailedDeliveryTo(payslipId: string, toEmail: string) {
  return prisma.payslipEmailDelivery.findFirst({
    where: { payslipId, status: 'FAILED', toEmail },
    orderBy: { queuedAt: 'desc' },
  });
}

export function findLatestPendingDelivery(payslipId: string) {
  return prisma.payslipEmailDelivery.findFirst({
    where: {
      payslipId,
      status: { in: ['QUEUED', 'FAILED', 'SENDING'] },
    },
    orderBy: { queuedAt: 'desc' },
  });
}

export function createDelivery(data: Prisma.PayslipEmailDeliveryUncheckedCreateInput) {
  return prisma.payslipEmailDelivery.create({ data });
}

export function requeueDelivery(deliveryId: string, toEmail: string) {
  return prisma.payslipEmailDelivery.update({
    where: { id: deliveryId },
    data: { status: 'QUEUED', claimedAt: null, lastError: null, toEmail },
  });
}

export async function markPayslipEmailFailed(payslipId: string, emailError: string) {
  await prisma.payslip.update({
    where: { id: payslipId },
    data: { emailStatus: 'FAILED', emailError },
  });
}

export async function recordDeliverySent(deliveryId: string, payslipId: string, messageId: string | undefined) {
  await prisma.$transaction([
    prisma.payslipEmailDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'SENT',
        messageId,
        sentAt: new Date(),
        lastError: null,
      },
    }),
    prisma.payslip.update({
      where: { id: payslipId },
      data: {
        emailStatus: 'SENT',
        emailError: null,
        deliveryType: 'PDF_EMAIL',
      },
    }),
  ]);
}

export async function recordDeliveryFailed(deliveryId: string, payslipId: string, message: string) {
  await prisma.$transaction([
    prisma.payslipEmailDelivery.update({
      where: { id: deliveryId },
      data: { status: 'FAILED', lastError: message },
    }),
    prisma.payslip.update({
      where: { id: payslipId },
      data: { emailStatus: 'FAILED', emailError: message },
    }),
  ]);
}
