import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import {
  ensureDefaultTemplate,
  getActiveTemplate,
} from '@/modules/purchases/infrastructure/purchase-order-template';

export interface InstitutionSettings {
  name: string;
  address: string;
  phone: string;
  website: string;
  /** Clave de storage, URL https, ruta pública legacy o data URI */
  logoPath: string;
}

const SEED_SETTINGS_PATH = path.join(process.cwd(), 'data', 'compras-institution.json');

export const DEFAULT_INSTITUTION_SETTINGS: InstitutionSettings = {
  name: process.env.INSTITUTION_NAME ?? 'Consejo Nacional de Inversiones',
  address:
    process.env.INSTITUTION_ADDRESS ??
    'Colonia Palmira, Avenida República de Chile, Tegucigalpa, M.D.C., Honduras',
  phone: process.env.INSTITUTION_PHONE ?? '(504) 2239-6900',
  website: process.env.INSTITUTION_WEBSITE ?? 'www.cni.hn',
  logoPath: process.env.INSTITUTION_LOGO_PATH ?? '/Logo_CNI.png',
};

async function readSeedSettings(): Promise<Partial<InstitutionSettings> | null> {
  try {
    const raw = await readFile(SEED_SETTINGS_PATH, 'utf-8');
    return JSON.parse(raw) as Partial<InstitutionSettings>;
  } catch {
    return null;
  }
}

function templateToSettings(template: {
  institutionName: string;
  institutionAddress: string | null;
  institutionPhone: string | null;
  institutionWebsite: string | null;
  logoUrl: string | null;
}): InstitutionSettings {
  return {
    name: template.institutionName,
    address: template.institutionAddress ?? DEFAULT_INSTITUTION_SETTINGS.address,
    phone: template.institutionPhone ?? DEFAULT_INSTITUTION_SETTINGS.phone,
    website: template.institutionWebsite ?? DEFAULT_INSTITUTION_SETTINGS.website,
    logoPath: template.logoUrl ?? DEFAULT_INSTITUTION_SETTINGS.logoPath,
  };
}

export async function getInstitutionSettings(organizationId: string): Promise<InstitutionSettings> {
  const template = await getActiveTemplate(organizationId);
  if (template) {
    return templateToSettings(template);
  }

  const seed = await readSeedSettings();
  return { ...DEFAULT_INSTITUTION_SETTINGS, ...seed };
}

export async function saveInstitutionSettings(
  organizationId: string,
  actorUserId: string,
  data: Partial<InstitutionSettings>,
): Promise<InstitutionSettings> {
  let template = await getActiveTemplate(organizationId);
  if (!template) {
    template = await ensureDefaultTemplate(organizationId, actorUserId);
  }

  const current = await getInstitutionSettings(organizationId);
  const merged = { ...current, ...data };

  await prisma.compraOrdenTemplate.update({
    where: { id: template.id },
    data: {
      institutionName: merged.name,
      institutionAddress: merged.address,
      institutionPhone: merged.phone,
      institutionWebsite: merged.website,
      ...(data.logoPath !== undefined ? { logoUrl: merged.logoPath } : {}),
    },
  });

  return merged;
}
