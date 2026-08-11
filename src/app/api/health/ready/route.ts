import { NextResponse } from 'next/server';
import { runReadinessChecks } from '@/platform/health/health';
import { defaultReadinessDependencies } from '@/platform/health/default-dependencies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await runReadinessChecks(defaultReadinessDependencies());
    return NextResponse.json(result, {
      status: result.status === 'ready' ? 200 : 503,
      headers: { 'cache-control': 'no-store' },
    });
  } catch {
    return NextResponse.json({
      status: 'not_ready',
      checks: { configuration: 'unavailable' },
      timestamp: new Date().toISOString(),
    }, {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    });
  }
}
