'use client';

import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { sileo } from 'sileo';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ReportDefinition } from '@/modules/reporting/domain/report-types';
import {
  FILTER_NONE,
  filterValueForExport,
  isReportFilterSelectKey,
  reportFilterOptions,
  resolveDatePreset,
  type ReportDatePreset,
} from '@/modules/reporting/presentation/report-ui';
import { downloadReportExport, triggerBrowserDownload } from '@/services/reports.service';

const exportFormSchema = z
  .object({
    preset: z.enum(['this_month', 'last_month', 'this_year', 'custom']),
    from: z.string().min(1, 'Indique la fecha inicial'),
    to: z.string().min(1, 'Indique la fecha final'),
    format: z.enum(['csv', 'xlsx']),
    status: z.string().optional(),
    category: z.string().optional(),
    type: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.from > values.to) {
      ctx.addIssue({
        code: 'custom',
        message: 'La fecha inicial no puede ser posterior a la final',
        path: ['to'],
      });
    }
  });

type ExportFormValues = z.infer<typeof exportFormSchema>;

const PRESET_LABELS: Record<Exclude<ReportDatePreset, 'custom'>, string> = {
  this_month: 'Este mes',
  last_month: 'Mes anterior',
  this_year: 'Este año',
};

function toastForExportError(error: unknown): void {
  const err = error as Error & { status?: number; code?: string };
  const status = err.status;
  if (status === 403) {
    sileo.error({
      title: 'Sin permiso',
      description: 'No tiene autorización para exportar este reporte.',
    });
    return;
  }
  if (status === 413 || err.code === 'EXPORT_ROW_LIMIT_EXCEEDED') {
    sileo.error({
      title: 'Demasiadas filas',
      description: err.message || 'El reporte supera el límite permitido. Acorte el rango de fechas o aplique filtros.',
    });
    return;
  }
  if (status === 400) {
    sileo.error({
      title: 'Parámetros inválidos',
      description: err.message || 'Revise las fechas y los filtros e intente de nuevo.',
    });
    return;
  }
  sileo.error({
    title: 'Error al exportar',
    description: err.message || 'No se pudo completar la descarga.',
  });
}

type ReportExportDialogProps = {
  report: ReportDefinition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ReportExportDialog({ report, open, onOpenChange }: ReportExportDialogProps) {
  const [downloading, setDownloading] = useState(false);

  const defaultRange = useMemo(() => resolveDatePreset('this_month'), []);

  const form = useForm<ExportFormValues>({
    resolver: zodResolver(exportFormSchema),
    defaultValues: {
      preset: 'this_month',
      from: defaultRange.from,
      to: defaultRange.to,
      format: 'xlsx',
      status: FILTER_NONE,
      category: FILTER_NONE,
      type: FILTER_NONE,
    },
  });

  const preset = useWatch({ control: form.control, name: 'preset' });
  const fromError = form.formState.errors.from?.message;
  const toError = form.formState.errors.to?.message;
  const formInstanceKey = open && report ? `${report.code}-open` : 'closed';

  function applyPreset(preset: ReportDatePreset) {
    if (preset === 'custom') {
      form.setValue('preset', preset, { shouldValidate: true });
      return;
    }
    const range = resolveDatePreset(preset);
    form.setValue('preset', preset, { shouldValidate: true });
    form.setValue('from', range.from, { shouldValidate: true });
    form.setValue('to', range.to, { shouldValidate: true });
  }

  const selectFilters = useMemo(() => {
    if (!report) return [];
    return report.filters.filter(
      (f) => f.type === 'select' && isReportFilterSelectKey(f.key),
    );
  }, [report]);

  async function onSubmit(values: ExportFormValues) {
    if (!report) return;
    setDownloading(true);
    try {
      const { blob, filename } = await downloadReportExport(report.code, {
        from: values.from,
        to: values.to,
        format: values.format,
        status: filterValueForExport(values.status),
        category: filterValueForExport(values.category),
        type: filterValueForExport(values.type),
      });
      triggerBrowserDownload(blob, filename);
      sileo.success({ title: 'Descarga iniciada', description: filename });
      onOpenChange(false);
    } catch (error) {
      toastForExportError(error);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md" aria-describedby="report-export-description">
        <DialogHeader>
          <DialogTitle>{report?.name ?? 'Exportar reporte'}</DialogTitle>
          <DialogDescription id="report-export-description">
            {report?.description ?? 'Seleccione el período y el formato de exportación.'}
          </DialogDescription>
        </DialogHeader>

        <form
          key={formInstanceKey}
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Período</legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Presets de fecha">
              {(Object.keys(PRESET_LABELS) as Array<Exclude<ReportDatePreset, 'custom'>>).map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={preset === key ? 'default' : 'outline'}
                  onClick={() => applyPreset(key)}
                >
                  {PRESET_LABELS[key]}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={preset === 'custom' ? 'default' : 'outline'}
                onClick={() => applyPreset('custom')}
              >
                Personalizado
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-from">Desde</Label>
                <Input
                  id="report-from"
                  type="date"
                  aria-invalid={Boolean(fromError)}
                  {...form.register('from', {
                    onChange: () => form.setValue('preset', 'custom'),
                  })}
                />
                {fromError ? (
                  <p className="text-destructive text-xs" role="alert">{fromError}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-to">Hasta</Label>
                <Input
                  id="report-to"
                  type="date"
                  aria-invalid={Boolean(toError)}
                  {...form.register('to', {
                    onChange: () => form.setValue('preset', 'custom'),
                  })}
                />
                {toError ? (
                  <p className="text-destructive text-xs" role="alert">{toError}</p>
                ) : null}
              </div>
            </div>
          </fieldset>

          {selectFilters.map((filter) => {
            const key = filter.key as 'status' | 'category' | 'type';
            const options = report ? reportFilterOptions(key, report.code) : [];
            return (
              <div key={filter.key} className="space-y-1.5">
                <Label htmlFor={`report-filter-${filter.key}`}>{filter.label}</Label>
                <Select
                  value={form.watch(key) ?? FILTER_NONE}
                  onValueChange={(value) => form.setValue(key, value)}
                >
                  <SelectTrigger id={`report-filter-${filter.key}`} className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Formato</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Formato de archivo">
              {(['csv', 'xlsx'] as const).map((fmt) => (
                <Button
                  key={fmt}
                  type="button"
                  size="sm"
                  variant={form.watch('format') === fmt ? 'default' : 'outline'}
                  role="radio"
                  aria-checked={form.watch('format') === fmt}
                  onClick={() => form.setValue('format', fmt)}
                >
                  {fmt.toUpperCase()}
                </Button>
              ))}
            </div>
          </fieldset>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={downloading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={downloading || !report}>
              {downloading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Descargando…
                </>
              ) : (
                'Descargar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
