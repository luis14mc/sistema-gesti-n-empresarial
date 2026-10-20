import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AuthenticatedRequest } from '@/lib/middleware';

const authorizeOrganization = vi.fn();
const getStorage = vi.fn();

vi.mock('@/platform/security/authorization/http', () => ({
  authorizeOrganization,
}));

vi.mock('@/lib/storage', () => ({
  getStorage,
}));

vi.mock('@/lib/middleware', () => ({
  withAuth: (handler: (req: AuthenticatedRequest) => Promise<Response>) => handler,
}));

const ORG = 'org-cni-default';
const KEY = `organizations/${ORG}/equipment/documents/abc.pdf`;

function buildRequest(key: string): AuthenticatedRequest {
  return {
    user: { userId: 'u1', email: 'u@test', role: 'ADMIN' },
    url: `http://localhost/api/equipment/documents/file?key=${encodeURIComponent(key)}`,
  } as unknown as AuthenticatedRequest;
}

describe('GET /api/equipment/documents/file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeOrganization.mockResolvedValue({ organizationId: ORG });
    getStorage.mockReturnValue({
      get: vi.fn(async () => ({ buffer: Buffer.from('%PDF-1.4'), mimeType: 'application/pdf' })),
    });
  });

  it('does not set CSP sandbox headers (Chrome inline PDF viewer)', async () => {
    const { GET } = await import('@/app/api/equipment/documents/file/route');
    const res = await GET(buildRequest(KEY));
    expect(res.status).toBe(200);
    const csp = res.headers.get('Content-Security-Policy') ?? '';
    const allHeaders = [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n');
    expect(csp).not.toMatch(/sandbox/i);
    expect(allHeaders).not.toMatch(/sandbox/i);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });
});
