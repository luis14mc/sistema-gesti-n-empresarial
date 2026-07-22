import type { CompraOrdenTemplate } from '@prisma/client';

export type PurchaseOrderTemplateConfig = {
  id: string;
  version: number;
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
};

export function templateToConfig(template: CompraOrdenTemplate): PurchaseOrderTemplateConfig {
  return {
    id: template.id,
    version: template.version,
    logoUrl: template.logoUrl,
    institutionName: template.institutionName,
    institutionAddress: template.institutionAddress,
    institutionPhone: template.institutionPhone,
    institutionWebsite: template.institutionWebsite,
    institutionRtn: template.institutionRtn,
    documentTitle: template.documentTitle,
    orderPrefix: template.orderPrefix,
    footerText: template.footerText,
    signatureTitle: template.signatureTitle,
    additionalNote: template.additionalNote,
    primaryColor: template.primaryColor,
    secondaryColor: template.secondaryColor,
    showInstitutionAddress: template.showInstitutionAddress,
    showInstitutionPhone: template.showInstitutionPhone,
    showInstitutionWebsite: template.showInstitutionWebsite,
    showInstitutionRtn: template.showInstitutionRtn,
    showReference: template.showReference,
    showRequiredDate: template.showRequiredDate,
  };
}

export function configToTemplateShape(config: PurchaseOrderTemplateConfig) {
  return {
    logoUrl: config.logoUrl ?? null,
    institutionName: config.institutionName,
    institutionAddress: config.institutionAddress ?? null,
    institutionPhone: config.institutionPhone ?? null,
    institutionWebsite: config.institutionWebsite ?? null,
    institutionRtn: config.institutionRtn ?? null,
    documentTitle: config.documentTitle,
    orderPrefix: config.orderPrefix,
    footerText: config.footerText ?? null,
    signatureTitle: config.signatureTitle,
    additionalNote: config.additionalNote ?? null,
    primaryColor: config.primaryColor,
    secondaryColor: config.secondaryColor,
    showInstitutionAddress: config.showInstitutionAddress,
    showInstitutionPhone: config.showInstitutionPhone,
    showInstitutionWebsite: config.showInstitutionWebsite,
    showInstitutionRtn: config.showInstitutionRtn,
    showReference: config.showReference,
    showRequiredDate: config.showRequiredDate,
  };
}

export function parseTemplateSnapshot(value: unknown): PurchaseOrderTemplateConfig | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<PurchaseOrderTemplateConfig>;
  if (!v.institutionName || !v.documentTitle || !v.signatureTitle) return null;
  return {
    id: v.id ?? 'snapshot',
    version: v.version ?? 1,
    logoUrl: v.logoUrl ?? null,
    institutionName: v.institutionName,
    institutionAddress: v.institutionAddress ?? null,
    institutionPhone: v.institutionPhone ?? null,
    institutionWebsite: v.institutionWebsite ?? null,
    institutionRtn: v.institutionRtn ?? null,
    documentTitle: v.documentTitle,
    orderPrefix: v.orderPrefix ?? 'COM-CNI',
    footerText: v.footerText ?? null,
    signatureTitle: v.signatureTitle,
    additionalNote: v.additionalNote ?? null,
    primaryColor: v.primaryColor ?? '#334E88',
    secondaryColor: v.secondaryColor ?? '#32B372',
    showInstitutionAddress: v.showInstitutionAddress ?? true,
    showInstitutionPhone: v.showInstitutionPhone ?? true,
    showInstitutionWebsite: v.showInstitutionWebsite ?? true,
    showInstitutionRtn: v.showInstitutionRtn ?? false,
    showReference: v.showReference ?? true,
    showRequiredDate: v.showRequiredDate ?? true,
  };
}

export function buildTemplateSnapshot(template: CompraOrdenTemplate): PurchaseOrderTemplateConfig {
  return templateToConfig(template);
}
