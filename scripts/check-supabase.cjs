// Read-only diagnostics. Never print keys, connection strings, or journal content.
require('@next/env').loadEnvConfig(process.cwd());
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { timeout: 10_000 } });
  let healthy = true;
  for (const [table, columns] of [
    ['notes', 'id,content,created_at'],
    ['extracted_items', 'id,note_id,category,content,tags,sentiment_or_mood,event_timestamp,created_at,calendar_action,calendar_status,google_event_id,embedding'],
    ['graph_edges', 'id,source_node_id,target_node_id,weight,link_type'],
  ]) {
    let { status, error } = await client.from(table).select(columns, { head: true }).limit(1).abortSignal(AbortSignal.timeout(15_000));
    // HEAD responses contain no error body. Ask for zero rows to distinguish an
    // expected permission denial from an invalid key without reading any data.
    if ((status === 401 || status === 403) && !error?.code) {
      ({ status, error } = await client.from(table).select(columns).limit(0).abortSignal(AbortSignal.timeout(15_000)));
    }
    const blocked = (status === 401 || status === 403) && error?.code === '42501';
    if (!blocked) healthy = false;
    console.log(JSON.stringify({ check: table, status, code: error?.code || null, message: blocked ? 'Anonymous table access denied as expected.' : !error ? 'Anonymous table access is still allowed. Apply the account ownership migration before using personal data.' : error.message }));
  }
  const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(15_000) });
  const googleEnabled = settings.ok && Boolean((await settings.json()).external?.google);
  console.log(JSON.stringify({ check: 'google-sign-in', enabled: googleEnabled }));
  if (!googleEnabled) healthy = false;
  if (process.argv.includes('--realtime')) {
    const result = await new Promise(resolve => {
      const timer = setTimeout(() => resolve('TIMED_OUT'), 15_000);
      client.channel('august-connectivity-diagnostic').subscribe(status => {
        if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) { clearTimeout(timer); resolve(status); }
      });
    });
    console.log(JSON.stringify({ check: 'realtime', status: result }));
    healthy = healthy && result === 'SUBSCRIBED';
    await client.removeAllChannels();
    client.realtime.disconnect();
  }
  if (!healthy) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
