import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';

// ============================================
// GET /api/health — Liveness + readiness
// - 200 si DB y Storage responden
// - 503 si alguna dependencia crítica falla
// No requiere autenticación (usado por healthcheck / AWS ALB / Prometheus)
// ============================================

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

export async function GET() {
    const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};
    let allOk = true;

    // 1) Database
    const dbStart = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.db = { ok: true, latencyMs: Date.now() - dbStart };
    } catch (err) {
        allOk = false;
        checks.db = { ok: false, error: err instanceof Error ? err.message : 'unknown' };
    }

    // 2) Storage
    try {
        const storage = getStorage();
        checks.storage = { ok: true, latencyMs: 0 };
        if (storage.ping) await storage.ping();
    } catch (err) {
        allOk = false;
        checks.storage = { ok: false, error: err instanceof Error ? err.message : 'unknown' };
    }

    return NextResponse.json(
        {
            status: allOk ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            checks,
        },
        { status: allOk ? 200 : 503 }
    );
}
