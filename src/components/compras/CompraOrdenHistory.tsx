'use client';

import { useCompraOrdenHistorial } from '@/hooks/useCompraOrden';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CompraOrdenHistory({ ordenId }: { ordenId: string }) {
  const { data: historial = [], isLoading } = useCompraOrdenHistorial(ordenId);

  return (
    <Card>
      <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando historial…</p>
        ) : historial.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin registros.</p>
        ) : (
          <ul className="space-y-3">
            {historial.map((entry) => (
              <li key={entry.id} className="border rounded-md p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{entry.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString('es-HN')}
                  </span>
                </div>
                {entry.description && <p className="text-muted-foreground mt-1">{entry.description}</p>}
                {entry.performedBy && (
                  <p className="text-xs mt-1">
                    {entry.performedBy.firstName} {entry.performedBy.lastName}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
