import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordOrdenAudit } from './historial';
import {
  buildTemplateSnapshot,
  parseTemplateSnapshot,
  templateToConfig,
  type PurchaseOrderTemplateConfig,
} from './template-config';

export async function getActiveTemplate(tx: Prisma.TransactionClient = prisma) {
  return tx.compraOrdenTemplate.findFirst({ where: { isActive: true } });
}

export async function ensureDefaultTemplate(userId: string) {
  const existing = await prisma.compraOrdenTemplate.findFirst({ where: { isActive: true } });
  if (existing) return existing;

  return prisma.compraOrdenTemplate.create({
    data: {
      name: 'Plantilla CNI predeterminada',
      isActive: true,
      logoUrl: '/Logo_CNI.png',
      createdById: userId,
    },
  });
}

export async function savePurchaseOrderTemplate(
  input: {
    name: string;
    logoUrl?: string | null;
    institutionName: string;
    institutionAddress?: string | null;
    institutionPhone?: string | null;
    institutionWebsite?: string | null;
    institutionRtn?: string | null;
    documentTitle: string;
    orderPrefix: string;
    footerText?: string | null;
    signatureTitle: string;
    additionalNote?: string | null;
    primaryColor: string;
    secondaryColor: string;
    showInstitutionAddress: boolean;
    showInstitutionPhone: boolean;
    showInstitutionWebsite: boolean;
    showInstitutionRtn: boolean;
    showReference: boolean;
    showRequiredDate: boolean;
  },
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.compraOrdenTemplate.findFirst({ where: { isActive: true } });
    if (current) {
      await tx.compraOrdenTemplate.update({
        where: { id: current.id },
        data: { isActive: false },
      });
    }

    const version = (current?.version ?? 0) + 1;
    const template = await tx.compraOrdenTemplate.create({
      data: {
        ...input,
        isActive: true,
        version,
        createdById: userId,
      },
    });

    await recordOrdenAudit({
      orderId: template.id,
      category: 'TEMPLATE_CHANGED',
      title: 'Plantilla de orden actualizada',
      description: `Versión ${version}`,
      userId,
      newData: template,
    });

    return template;
  });
}

export async function getActiveTemplateConfig(
  tx: Prisma.TransactionClient = prisma
): Promise<PurchaseOrderTemplateConfig> {
  const template = await getActiveTemplate(tx);
  if (!template) throw new Error('No hay plantilla activa configurada');
  return templateToConfig(template);
}

export async function resolveTemplateForOrder(order: {
  status?: string;
  templateId?: string | null;
  templateVersion?: number | null;
  templateSnapshot?: unknown;
}): Promise<PurchaseOrderTemplateConfig> {
  if (order.status !== 'DRAFT' && order.templateSnapshot) {
    const snapshot = parseTemplateSnapshot(order.templateSnapshot);
    if (snapshot) return snapshot;
  }
  if (order.templateId) {
    const stored = await prisma.compraOrdenTemplate.findUnique({ where: { id: order.templateId } });
    if (stored) return templateToConfig(stored);
  }
  return getActiveTemplateConfig();
}

export async function getTemplateForOrder(order: {
  status?: string;
  templateId?: string | null;
  templateVersion?: number | null;
  templateSnapshot?: unknown;
}) {
  if (order.status !== 'DRAFT' && order.templateSnapshot) {
    const snapshot = parseTemplateSnapshot(order.templateSnapshot);
    if (snapshot) {
      return {
        id: snapshot.id,
        version: snapshot.version,
        logoUrl: snapshot.logoUrl ?? null,
        institutionName: snapshot.institutionName,
        institutionAddress: snapshot.institutionAddress ?? null,
        institutionPhone: snapshot.institutionPhone ?? null,
        institutionWebsite: snapshot.institutionWebsite ?? null,
        institutionRtn: snapshot.institutionRtn ?? null,
        documentTitle: snapshot.documentTitle,
        orderPrefix: snapshot.orderPrefix,
        footerText: snapshot.footerText ?? null,
        signatureTitle: snapshot.signatureTitle,
        additionalNote: snapshot.additionalNote ?? null,
        primaryColor: snapshot.primaryColor,
        secondaryColor: snapshot.secondaryColor,
        showInstitutionAddress: snapshot.showInstitutionAddress,
        showInstitutionPhone: snapshot.showInstitutionPhone,
        showInstitutionWebsite: snapshot.showInstitutionWebsite,
        showInstitutionRtn: snapshot.showInstitutionRtn,
        showReference: snapshot.showReference,
        showRequiredDate: snapshot.showRequiredDate,
      };
    }
  }
  if (order.templateId) {
    const stored = await prisma.compraOrdenTemplate.findUnique({ where: { id: order.templateId } });
    if (stored) return stored;
  }
  return getActiveTemplate();
}

export { buildTemplateSnapshot };
