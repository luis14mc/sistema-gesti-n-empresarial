'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

type RoleRow = {
  role: string;
  label: string;
  memberCount: number;
  modified: boolean;
};

export default function RolesSettingsPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/roles');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? 'No autorizado');
        }
        const data = await res.json();
        setRoles(data.roles ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar roles');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles y permisos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Matriz rol × módulo configurable. Los usuarios heredan el rol y pueden tener excepciones
          individuales.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roles de la organización</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Usuarios</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((row) => (
                  <TableRow key={row.role}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right">{row.memberCount}</TableCell>
                    <TableCell>
                      {row.modified ? (
                        <Badge variant="secondary">Modificado</Badge>
                      ) : (
                        <Badge variant="outline">Oficial</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/settings/roles/${row.role}`}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Editar permisos
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
