/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RolePermissionsEditor } from '@/components/permissions/RolePermissionsEditor';
import { MODULE_IDS } from '@/platform/security/modules';

vi.mock('@/components/layout/MainLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/permissions/ModulePermissionMatrix', () => ({
  ModulePermissionMatrix: () => <div data-testid="matrix" />,
}));

vi.mock('@/lib/swal', () => ({
  swalConfirm: vi.fn(async () => ({ isConfirmed: false })),
}));

vi.mock('sileo', () => ({
  sileo: { success: vi.fn(), error: vi.fn() },
}));

function matrixPayload() {
  const moduleAccess = Object.fromEntries(
    MODULE_IDS.map((id) => [
      id,
      {
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        extras: [],
        origin: 'official' as const,
      },
    ]),
  );
  return {
    memberCount: 0,
    modified: false,
    moduleAccess,
  };
}

describe('RolePermissionsEditor', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows readable message on 403 apiFailure (not [object Object])', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/permissions')) {
        return new Response(
          JSON.stringify({
            success: false,
            requestId: 'req-403',
            error: { code: 'PERMISSION_DENIED', message: 'No permitido' },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ displayName: 'X', assignable: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    render(<RolePermissionsEditor role="ADMINISTRACION" roleLabel="Administración" />);

    await waitFor(() => {
      expect(screen.getByText(/roles\.manage/)).toBeTruthy();
    });
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
  });

  it('does not show unsaved changes on load failure and disables Guardar', async () => {
    fetchMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { message: 'denied' },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<RolePermissionsEditor role="PROCUREMENT" roleLabel="Compras" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    });

    const saveButton = screen.getByRole('button', { name: 'Guardar' });
    expect(saveButton.hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText(/cambios sin guardar/i)).toBeNull();
  });
});
