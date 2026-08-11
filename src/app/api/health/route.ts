import { GET as readiness } from './ready/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return readiness();
}
