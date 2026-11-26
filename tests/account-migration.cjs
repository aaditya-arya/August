const { PGlite } = require('../.local/sql-validation/node_modules/@electric-sql/pglite');
const { vector } = require('../.local/sql-validation/node_modules/@electric-sql/pglite-pgvector');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const db = await PGlite.create({ extensions: { vector } });
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      insert into auth.users values ('11111111-1111-4111-8111-111111111111','a@example.test'),('22222222-2222-4222-8222-222222222222','b@example.test');`);
    await db.exec(fs.readFileSync('supabase_schema.sql', 'utf8'));
    await db.exec(`insert into notes(content) values ('Preserved legacy note');
      grant all on notes, extracted_items, graph_edges to anon,authenticated;
      create policy old_demo_notes on notes for all to public using(true) with check(true);
      create policy old_demo_items on extracted_items for all to public using(true) with check(true);
      create policy old_demo_edges on graph_edges for all to public using(true) with check(true);`);
    const sql = fs.readFileSync('supabase/migrations/202611120001_account_ownership.sql','utf8');
    // Do not let the test setup's grants conceal a missing schema/table grant.
    await db.exec('revoke usage on schema public from authenticated; revoke all on notes, extracted_items, graph_edges from authenticated;');
    await db.exec(sql);
    await db.exec(sql); // Reapplying the migration must be safe.
    assert.equal((await db.query('select count(*)::int as n from notes where user_id is null')).rows[0].n,1);
    async function as(id) { await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${id}';`); }
    const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
    await as(a);
    assert.equal((await db.query('select public.account_security_version() as v')).rows[0].v,1);
    assert.equal((await db.query('select * from notes')).rows.length,0);
    const noteA = (await db.query("insert into notes(content) values ('Account A note') returning id,user_id")).rows[0];
    assert.equal(noteA.user_id,a);
    const itemA = (await db.query("insert into extracted_items(note_id, category,content) values ($1,'Idea','Private A') returning id",[noteA.id])).rows[0].id;
    const itemA2 = (await db.query("insert into extracted_items(note_id, category,content) values ($1,'Idea','Another A') returning id",[noteA.id])).rows[0].id;
    await db.query('update extracted_items set calendar_action=$1::jsonb where id=$2', [JSON.stringify({ is_actionable: false, task: { version: 1, title: 'Build A website', due_at: null } }), itemA]);
    await db.query("insert into graph_edges(source_node_id,target_node_id,link_type) values ($1,$2,'semantic')",[itemA,itemA2]);
    await as(b);
    for(const table of ['notes','extracted_items','graph_edges']) assert.equal((await db.query(`select * from ${table}`)).rows.length,0);
    assert.equal((await db.query("update notes set content='intrusion' where id=$1 returning id",[noteA.id])).rows.length,0);
    assert.equal((await db.query("update extracted_items set calendar_action=jsonb_build_object('review_state',jsonb_build_object('status','completed')) where id=$1 returning id", [itemA])).rows.length, 0, 'Account B cannot complete account A task');
    await assert.rejects(db.query("insert into notes(content,user_id) values('Spoofed owner',$1)",[a]),e=>e.code==='42501');
    await assert.rejects(db.query("insert into extracted_items(note_id,category,content) values($1,'Idea','Wrong parent')",[noteA.id]),e=>e.code==='42501');
    await assert.rejects(db.query("insert into graph_edges(source_node_id,target_node_id,link_type) values($1,$2,'semantic')",[itemA,itemA2]),e=>e.code==='42501');
    const noteB = (await db.query("insert into notes(content) values ('Account B note') returning id")).rows[0].id;
    const itemB = (await db.query("insert into extracted_items(note_id,category,content) values($1,'Idea','Private B') returning id",[noteB])).rows[0].id;
    await assert.rejects(db.query("insert into graph_edges(source_node_id,target_node_id,link_type) values($1,$2,'semantic')",[itemB,itemA]),e=>e.code==='42501');
    await assert.rejects(db.query('update notes set user_id=$1 where id=$2',[a,noteB]),/ownership cannot be changed/);
    const embedding = `[${[1,...Array(767).fill(0)].join(',')}]`;
    await db.query('update extracted_items set embedding=$1::vector where id=$2',[embedding,itemB]);
    await as(a);
    await db.query('update extracted_items set embedding=$1::vector where id=$2',[embedding,itemA]);
    await as(b);
    const matches = await db.query('select * from match_similar_nodes($1::vector,$2::uuid,0.7,10)',[embedding,itemA2]);
    assert.deepEqual(matches.rows.map(r=>r.id),[itemB]);
    await db.exec('reset role; set role anon;');
    for(const table of ['notes','extracted_items','graph_edges']) await assert.rejects(db.query(`select * from ${table}`),e=>e.code==='42501');
    await assert.rejects(db.query('select account_security_version()'),e=>e.code==='42501');
    await assert.rejects(db.query('select * from match_similar_nodes($1::vector,$2::uuid,0.7,10)',[embedding,itemB]),e=>e.code==='42501');
    console.log('PostgreSQL + pgvector: migration reapply, legacy preservation, anonymous denial, two-account isolation, spoofed ownership, cross-account parents/edges, immutable ownership, and vector RLS all passed.');
  } finally { await db.close(); }
})().catch(e=>{ console.error(e.message); process.exitCode=1; });
