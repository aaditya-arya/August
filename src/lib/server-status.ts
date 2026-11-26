import { supabase } from './supabase';

type Check = { ready: boolean; message: string };
export type ServerStatus = { journal: Check; graph: Check; review: Check };

export async function readServerStatus(): Promise<ServerStatus> {
  const migration = await supabase.rpc('account_security_version');
  if (migration.error || migration.data !== 1) {
    const storage = { ready: false, message: 'Account storage setup is incomplete. Apply the account-storage migration to this Supabase project.' };
    return { journal: storage, graph: storage, review: storage };
  }
  // Requests use the verified account's database client and RLS. Only service
  // readiness is returned, never journal contents or credentials.
  const [items, edges] = await Promise.all([
    supabase.from('extracted_items').select('id', { head: true }).limit(1),
    supabase.from('graph_edges').select('id', { head: true }).limit(1),
  ]);
  const journal = { ready: !items.error, message: items.error ? 'Journal storage could not be read. Check the Supabase schema and account policies.' : 'Journal storage is reachable.' };
  const graph = { ready: journal.ready && !edges.error, message: !journal.ready || edges.error ? 'Connections storage could not be read. Check the graph_edges table and account policies.' : 'Connections storage is reachable. Connections appear as you save moments.' };
  const review = !journal.ready ? journal : process.env.GEMINI_API_KEY?.trim()
    ? { ready: true, message: 'AI key is configured. Reflections also require an available Gemini model and quota.' }
    : { ready: false, message: 'Add GEMINI_API_KEY to the August Vercel project\'s Production environment, then redeploy.' };
  return { journal, graph, review };
}
