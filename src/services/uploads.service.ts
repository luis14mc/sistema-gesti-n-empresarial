import { getToken } from '@/utils/api';
import type { OficioAttachment } from '@/types';

const UPLOAD_URL = '/api/uploads/oficios';

export interface OficioUploadResponse {
  attachment: OficioAttachment;
}

export const uploadsService = {
  uploadOficioDocument: async (file: File): Promise<OficioAttachment> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = getToken();
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(UPLOAD_URL, {
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
};
