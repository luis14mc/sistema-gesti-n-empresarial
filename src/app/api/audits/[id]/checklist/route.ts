import { NextResponse } from 'next/server';

const stub = () => NextResponse.json({ error: 'Module not yet migrated to new schema' }, { status: 501 });

export const POST = stub;
export const PATCH = stub;
