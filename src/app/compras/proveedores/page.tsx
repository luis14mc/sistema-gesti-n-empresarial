'use client';

import { useState } from 'react';
import { sileo } from 'sileo';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useCreateProveedor, useProveedores } from '@/hooks/useCompras';
import { useAuth } from '@/hooks/useAuth';

export default function ComprasProveedoresPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const { data: proveedores = [], isLoading } = useProveedores(search);
  const createProveedor = useCreateProveedor();
  const [form, setForm] = useState({
    nombreRazonSocial: '',
    rtn: '',
    telefono: '',
    email: '',
    personaContacto: '',
    direccion: '',
  });

  if (!user) return null;

  const handleCreate = async () => {
    try {
      await createProveedor.mutateAsync(form);
      sileo.success({ title: 'Proveedor registrado' });
      setForm({
        nombreRazonSocial: '',
        rtn: '',
        telefono: '',
        email: '',
        personaContacto: '',
        direccion: '',
      });
    } catch (error) {
      sileo.error({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear el proveedor',
      });
    }
  };

  return (
    <MainLayout>
      <PageHeader title="Proveedores" description="Gestión de proveedores para órdenes de compra" />

      <Card className="mb-6">
        <CardContent className="pt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Razón social</Label>
            <Input value={form.nombreRazonSocial} onChange={(e) => setForm({ ...form, nombreRazonSocial: e.target.value })} />
          </div>
          <div className="space-y-2"><Label>RTN</Label><Input value={form.rtn} onChange={(e) => setForm({ ...form, rtn: e.target.value })} /></div>
          <div className="space-y-2"><Label>Teléfono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
          <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-2"><Label>Contacto</Label><Input value={form.personaContacto} onChange={(e) => setForm({ ...form, personaContacto: e.target.value })} /></div>
          <div className="space-y-2 md:col-span-2"><Label>Dirección</Label><Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></div>
          <Button onClick={handleCreate} disabled={createProveedor.isPending}>Registrar proveedor</Button>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <Input placeholder="Buscar proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razón social</TableHead>
                <TableHead>RTN</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4}>Cargando...</TableCell></TableRow>
              ) : proveedores.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.nombreRazonSocial}</TableCell>
                  <TableCell>{p.rtn ?? '—'}</TableCell>
                  <TableCell>{p.telefono ?? '—'}</TableCell>
                  <TableCell>{p.email ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
