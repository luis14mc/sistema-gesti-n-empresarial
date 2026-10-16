import { describe, expect, it, vi, beforeEach } from 'vitest';

const count = vi.fn(async () => 0);
const prismaMock = {
  auditRecord: { count },
  audit: { count },
  oficio: { count },
  oficioDocument: { count },
  oficioTracking: { count },
  oficioImportBatch: { count },
  equipmentAssignment: { count },
  equipmentHistory: { count },
  equipmentMaintenance: { count },
  equipmentDisposal: { count },
  disposalDocument: { count },
  equipmentDisposalHistory: { count },
  compraOrden: { count },
  compraOrdenHistorial: { count },
  compraOrdenDocumento: { count },
  compraSolicitud: { count },
  payslip: { count },
  correctiveAction: { count },
  ticket: { count },
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

describe('countBlockingUserReferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    count.mockResolvedValue(0);
  });

  it('returns sum of all reference counts', async () => {
    count.mockResolvedValueOnce(2);
    const { countBlockingUserReferences } = await import(
      '@/modules/users/application/user-reference-counts'
    );
    const total = await countBlockingUserReferences('user-1');
    expect(total).toBeGreaterThanOrEqual(2);
    expect(count).toHaveBeenCalled();
  });
});
