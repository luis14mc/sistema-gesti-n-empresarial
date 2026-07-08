import { NextResponse } from 'next/server';

const stub = () => NextResponse.json(
  { error: 'PurchaseItem model not available in current schema' },
  { status: 501 }
);

export const POST = stub;
