import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export interface InstitutionSettings {
  name: string;
  address: string;
  phone: string;
  website: string;
  /** Ruta pública del logo oficial CNI */
  logoPath: string;
}

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'compras-institution.json');

export const DEFAULT_INSTITUTION_SETTINGS: InstitutionSettings = {
  name: process.env.INSTITUTION_NAME ?? 'Consejo Nacional de Inversiones',
  address:
    process.env.INSTITUTION_ADDRESS ??
    'Colonia Palmira, Avenida República de Chile, Tegucigalpa, M.D.C., Honduras',
  phone: process.env.INSTITUTION_PHONE ?? '(504) 2239-6900',
  website: process.env.INSTITUTION_WEBSITE ?? 'www.cni.hn',
  logoPath: process.env.INSTITUTION_LOGO_PATH ?? '/Logo_CNI.png',
};

export async function getInstitutionSettings(): Promise<InstitutionSettings> {
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<InstitutionSettings>;
    return { ...DEFAULT_INSTITUTION_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_INSTITUTION_SETTINGS };
  }
}

export async function saveInstitutionSettings(
  data: Partial<InstitutionSettings>
): Promise<InstitutionSettings> {
  await mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  const current = await getInstitutionSettings();
  const merged = { ...current, ...data };
  await writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}
