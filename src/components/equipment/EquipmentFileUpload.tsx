'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileText, ExternalLink } from 'lucide-react';
import { sileo } from 'sileo';
import {
  EQUIPMENT_DOCUMENT_TYPE_LABELS,
  type EquipmentDocumentType,
} from '@/lib/equipment-document-types';

interface EquipmentFileUploadProps {
  tipoDocumento: EquipmentDocumentType;
  /** @deprecated Usar tipoDocumento */
  subfolder?: never;
  label?: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  disabled?: boolean;
}

export function EquipmentFileUpload({
  tipoDocumento,
  label,
  currentUrl,
  onUploaded,
  disabled,
}: EquipmentFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const resolvedLabel =
    label ?? `Subir ${EQUIPMENT_DOCUMENT_TYPE_LABELS[tipoDocumento]} (PDF o imagen)`;

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tipoDocumento', tipoDocumento);

      const res = await fetch('/api/uploads/equipment', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir');

      onUploaded(data.document.url);
      sileo.success({ title: 'Documento subido' });
    } catch (err) {
      sileo.error({
        title: 'Error al subir',
        description: err instanceof Error ? err.message : 'Intenta de nuevo',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{resolvedLabel}</p>
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="max-w-xs"
          disabled={disabled || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-1" />
          {uploading ? 'Subiendo...' : 'Seleccionar'}
        </Button>
        {currentUrl && (
          <Button type="button" variant="ghost" size="sm" asChild>
            <a href={currentUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Ver documento
            </a>
          </Button>
        )}
      </div>
      {currentUrl && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <FileText className="h-3 w-3" />
          Documento registrado
        </p>
      )}
    </div>
  );
}
