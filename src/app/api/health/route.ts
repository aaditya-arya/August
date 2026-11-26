import { withAccount } from '@/lib/auth-server';
import { readServerStatus } from '@/lib/server-status';

export const GET = withAccount(async () => {
  try { return Response.json(await readServerStatus()); }
  catch { return Response.json({ error: 'Server checks could not finish. Check the deployed Supabase configuration and try again.' }, { status: 503 }); }
}, { storage: false });
