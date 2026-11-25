import { NextResponse } from 'next/server';
import { verifiedAccount } from '@/lib/auth-server';

export async function GET(request: Request) {
  const account = await verifiedAccount(request).catch(() => null);
  return NextResponse.json({ user: account ? { id: account.userId, email: account.user.email } : null }, { status: account ? 200 : 401, headers: { 'Cache-Control': 'private, no-store' } });
}
