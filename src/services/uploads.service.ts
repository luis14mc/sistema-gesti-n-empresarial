import { getToken } from '@/utils/api';
import type { OficioAttachment } from '@/types';
import type { EquipmentDocumentMeta } from '@/lib/equipment-storage';
import type { EquipmentDocumentType } from '@/lib/equipment-document-types';

const OFICIOS_UPLOAD_URL = '/api/uploads/oficios';
const EQUIPMENT_UPLOAD_URL = '/api/uploads/equipment';

export interface OficioUploadResponse {
  attachment: OficioAttachment;
}

export interface EquipmentUploadResponse {
  document: EquipmentDocumentMeta;
}

export const uploadsService = {
  uploadOficioDocument: async (file: File): Promise<OficioAttachment> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = getToken();
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(OFICIOS_UPLOAD_URL, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'No se pudo subir el documento');
    }

    const data: OficioUploadResponse = await response.json();
    return data.attachment;
  },

  uploadEquipmentDocument: async (
    file: File,
    tipoDocumento: EquipmentDocumentType
  ): Promise<EquipmentDocumentMeta> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipoDocumento', tipoDocumento);

    const token = getToken();
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(EQUIPMENT_UPLOAD_URL, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'No se pudo subir el documento');
    }

    const data: EquipmentUploadResponse = await response.json();
    return data.document;
  },
};
