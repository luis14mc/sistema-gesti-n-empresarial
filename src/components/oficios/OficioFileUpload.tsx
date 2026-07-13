'use client';

import { useRef, useState } from 'react';
import { FileUp, X, Loader2, FileText, ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  OFICIO_UPLOAD_MAX_BYTES,
  formatFileSize,
  getFileExtension,
} from '@/lib/oficios-attachments';
import { cn } from '@/lib/utils';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

interface OficioFileUploadProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  error?: string | null;
  className?: string;
}

export function OficioFileUpload({
  file,
  onFileChange,
  disabled = false,
  error,
  className,
}: OficioFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSelect = (selected: File | null) => {
    setLocalError(null);
    if (!selected) {
      onFileChange(null);
      return;
    }

    const ext = getFileExtension(selected.name);
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (!allowed.includes(ext)) {
      setLocalError('Solo se permiten archivos PDF, JPG, JPEG y PNG.');
      onFileChange(null);
      return;
    }

    if (selected.size > OFICIO_UPLOAD_MAX_BYTES) {
      setLocalError('El archivo supera el tamaño máximo de 10 MB.');
      onFileChange(null);
      return;
    }

    onFileChange(selected);
  };

  const displayError = error || localError;
  const isPdf = file && getFileExtension(file.name) === '.pdf';

  return (
    <div className={cn('space-y-2', className)}>
      <Label>Documento oficial *</Label>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
      />

      {!file ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'w-full rounded-xl border-2 border-dashed border-border/80 bg-muted/20 p-6',
            'flex flex-col items-center gap-2 text-center transition-colors',
            'hover:border-primary/50 hover:bg-muted/40',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {disabled ? (
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          ) : (
            <FileUp className="h-8 w-8 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">Seleccionar archivo</span>
          <span className="text-xs text-muted-foreground">
            PDF, JPG, JPEG o PNG — máximo 10 MB
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {isPdf ? (
              <FileText className="h-5 w-5 text-primary" />
            ) : (
              <ImageIcon className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-[10px] uppercase">
                {getFileExtension(file.name).replace('.', '') || 'archivo'}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={disabled}
            onClick={() => {
              onFileChange(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input visible como fallback accesible */}
      <Input
        type="file"
        accept={ACCEPT}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
      />

      {displayError && (
        <p className="text-xs text-destructive">{displayError}</p>
      )}
    </div>
  );
}
