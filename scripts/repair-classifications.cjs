// Compile first: npm run repair:classifications. Preview is the default; --apply consumes that exact saved plan.
const fs = require('node:fs');
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');
const { classifyExistingItems } = require('../.test-build/gemini.js');
const { CATEGORIES, isObligation } = require('../.test-build/ledger.js');

loadEnvConfig(process.cwd());
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/, ''), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const applyIndex = process.argv.indexOf('--apply');
  if (applyIndex !== -1) {
    const filename = process.argv[applyIndex + 1];
    if (!filename) throw new Error('--apply requires a saved plan filename.');
    const plan = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (!Array.isArray(plan.changes)) throw new Error('Invalid repair plan.');
    for (const change of plan.changes) {
      if (!CATEGORIES.includes(change.to)) throw new Error('Unknown category in repair plan.');
      const update = { category: change.to };
      if (!isObligation(change.to)) {
        update.calendar_action = { is_actionable: false };
        update.calendar_status = 'none';
      }
      const { data, error } = await db.from('extracted_items').update(update)
        .eq('id', change.id).eq('category', change.from).eq('content', change.content).select('id');
      if (error || data?.length !== 1) throw new Error(`Repair stopped at ${change.id}: ${error?.message || 'item changed since preview'}. Earlier updates remain applied; see backup.`);
      console.log(`${change.id}: ${change.from} -> ${change.to}`);
    }
    console.log(`Applied ${plan.changes.length} category repairs. Original data: ${plan.backup}`);
    return;
  }

  const items = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('extracted_items').select('*').order('id').range(offset, offset + 499);
    if (error) throw new Error(error.message);
    items.push(...data);
    if (data.length < 500) break;
  }
  const outputDir = path.join(process.cwd(), '.local', 'classification-repair');
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(outputDir, `${stamp}-backup.json`);
  fs.writeFileSync(backup, JSON.stringify(items, null, 2), { flag: 'wx' });
  const proposals = [];
  for (let i = 0; i < items.length; i += 40) {
    proposals.push(...await classifyExistingItems(items.slice(i, i + 40).map(({ id, content, created_at }) => ({ id, content, created_at }))));
  }
  const changes = proposals.flatMap((proposal) => {
    const item = items.find((entry) => entry.id === proposal.id);
    return item.category === proposal.category ? [] : [{ id: item.id, content: item.content, from: item.category, to: proposal.category, reason: proposal.reason }];
  });
  const filename = path.join(outputDir, `${stamp}-plan.json`);
  fs.writeFileSync(filename, JSON.stringify({ backup, reviewedItems: items.length, changes }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ plan: filename, reviewedItems: items.length, changes }, null, 2));
  console.log('Preview only. Apply the reviewed plan with: npm run repair:classifications -- --apply <plan-file>');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
