'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { UserPermissionsMatrix } from '@/components/users/UserPermissionsMatrix';
import { useUsers } from '@/hooks/useUsers';
import { ChevronLeft } from 'lucide-react';
import type { SessionRole } from '@/lib/session-roles';

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const { users, isLoading } = useUsers();
  const user = users.find((u) => u.id === userId);

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/users">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Usuarios
            </Link>
          </Button>
        </div>
        <PageHeader
          title={user ? `${user.firstName} ${user.lastName}` : 'Usuario'}
          description="Permisos por módulo"
        />
        <Tabs defaultValue="permisos">
          <TabsList>
            <TabsTrigger value="permisos">Permisos</TabsTrigger>
          </TabsList>
          <TabsContent value="permisos" className="mt-4">
            {!isLoading && user ? (
              <UserPermissionsMatrix userId={userId} />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
