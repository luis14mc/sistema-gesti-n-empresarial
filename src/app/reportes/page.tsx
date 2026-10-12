'use client';

import { useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useReportsCatalog } from '@/hooks/useReportsCatalog';
import { hasModuleAccess } from '@/lib/permissions';
import {
  groupReportsByUiSection,
  REPORT_UI_GROUPS,
} from '@/lib/reportes/report-ui';
import type { ReportDefinition } from '@/modules/reporting/domain/report-types';
import { ReportExportDialog } from '@/app/reportes/_components/ReportExportDialog';

export default function ReportesPage() {
  const { user } = useAuth();
  const { data: reports = [], isLoading, isError, refetch } = useReportsCatalog();
  const [selected, setSelected] = useState<ReportDefinition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const grouped = useMemo(() => groupReportsByUiSection(reports), [reports]);

  if (!user) return null;

  if (!hasModuleAccess(user.role, 'reports')) {
    return (
      <MainLayout>
        <PageHeader title="Reportes" description="Centro de exportación institucional" />
        <p className="text-muted-foreground">No tiene permiso para acceder a los reportes.</p>
      </MainLayout>
    );
  }

  function openExport(report: ReportDefinition) {
    setSelected(report);
    setDialogOpen(true);
  }

  const hasAnyReport = reports.length > 0;

  return (
    <MainLayout>
      <PageHeader
        title="Reportes"
        description="Exporte datos operativos por módulo. Solo se muestran reportes disponibles para su rol."
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Cargando catálogo…
        </div>
      ) : null}

      {isError ? (
        <div className="space-y-2">
          <p className="text-destructive">No se pudo cargar el catálogo de reportes.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {!isLoading && !isError && !hasAnyReport ? (
        <p className="text-muted-foreground">
          No hay reportes disponibles para su rol en este momento.
        </p>
      ) : null}

      {!isLoading && !isError && hasAnyReport ? (
        <div className="space-y-8 max-w-6xl">
          {REPORT_UI_GROUPS.map((section) => {
            const sectionReports = grouped.get(section.key) ?? [];
            if (sectionReports.length === 0) return null;

            return (
              <section key={section.key} aria-labelledby={`report-section-${section.key}`}>
                <h2
                  id={`report-section-${section.key}`}
                  className="mb-3 text-lg font-semibold tracking-tight"
                >
                  {section.label}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
                  {sectionReports.map((report) => (
                    <li key={report.code} className="min-w-0">
                      <Card className="h-full flex flex-col">
                        <CardHeader className="pb-2">
                          <div className="flex items-start gap-2">
                            <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
                            <div className="min-w-0">
                              <CardTitle className="text-base leading-snug">{report.name}</CardTitle>
                              <CardDescription className="mt-1 line-clamp-3">
                                {report.description}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="mt-auto pt-0">
                          <Button
                            type="button"
                            className="w-full sm:w-auto"
                            data-testid={`report-card-${report.code}`}
                            onClick={() => openExport(report)}
                          >
                            Exportar
                          </Button>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      <ReportExportDialog
        report={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </MainLayout>
  );
}
