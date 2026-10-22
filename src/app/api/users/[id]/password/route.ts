import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { hashPassword } from '@/platform/security/authentication/auth';
import { adminResetUserPassword } from '@/modules/users/application/user-password-admin-service';
import { handleUsersApiError } from '@/modules/users/presentation/http';
import { adminPasswordResetSchema } from '@/modules/users/presentation/schemas/users';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function postHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { id: targetUserId } = await ctx.params;
    const actor = await authorizeOrganization(req, requestId, 'users.update');
    const body = adminPasswordResetSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ error: body.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }
    const result = await adminResetUserPassword({
      organizationId: actor.organizationId,
      actorUserId: req.user!.userId,
      actorRole: actor.role,
      targetUserId,
      input: body.data,
      hashPassword,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Admin password reset failed:', error);
    return handleUsersApiError(error, requestId, 'No se pudo restablecer la contraseña');
  }
}

export const POST = withAuth(postHandler);

// Contract: PASSWORD_RESET_BY_ADMIN; audit newData: { mustChangePassword, targetUserId }; accessVersion bump en application.
