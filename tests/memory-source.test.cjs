const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sourceBlocks, sourceChunks, groundExtraction, memorySource } = require('../.test-build/memory-source.js');
const now = '2026-10-31T10:00:00Z';
const diary = '[9:22 am, 7/7/2026] Writer: Subhe station pe ek insaan se baat hui. Pehle maine kuch aur socha tha.\n[9:28 am, 7/7/2026] Writer: Phir unki baat suni toh apni pehli soch par sawaal aaya. Shayad mera andaaza galat tha.\n[3:30 pm, 7/7/2026] Writer: Aaj ka project submit kar diya aur ab aaram se chai pi.';
const blocks = () => sourceBlocks(diary, now, 'Asia/Kolkata');
const whole = id => ({ block_id: id, start_quote: null, end_quote: null });

test('WhatsApp timestamps and continuation lines preserve original dates, script and absolute source offsets', () => {
  const result = blocks();
  assert.equal(result.length, 3);
  assert.equal(result[0].recorded_at, '2026-07-07T03:52:00.000Z');
  assert.equal(result[2].recorded_at, '2026-07-07T10:00:00.000Z');
  for (const block of result) assert.equal(diary.slice(block.start, block.end), block.text);
});

test('connected messages can stay one memory; AI-written content is discarded rather than saved as the writer’s words', () => {
  const result = groundExtraction({ items: [
    { title: 'Apne andaaze par sawaal', content: 'A fabricated medical diagnosis', source_spans: [whole('b1'), whole('b2')] },
    { title: 'Project submit kiya', source_spans: [whole('b3')] },
  ] }, blocks());
  assert.equal(result[0].content, `${blocks()[0].text}\n\n${blocks()[1].text}`);
  assert.equal(result[0].event_timestamp, '2026-07-07T03:52:00.000Z');
  assert.ok(!result[0].content.includes('diagnosis'));
  assert.deepEqual(result[0].memory.spans.map(span => diary.slice(span.start, span.end)), blocks().slice(0, 2).map(block => block.text));
});

test('changed or missing quotes, lost scenes and duplicated passages cannot be persisted', () => {
  assert.throws(() => groundExtraction({items:[{source_spans:[{block_id:'b1',start_quote:'Invented sentence',end_quote:'Invented sentence'}]}]}, blocks()), /changed or ambiguous/);
  assert.throws(() => groundExtraction({items:[{source_spans:[whole('b1')]}]}, blocks()), /without enough context/);
  assert.throws(() => groundExtraction({items:[{source_spans:[whole('b1'),whole('b1')]}]}, blocks()), /duplicated/);
  assert.throws(() => groundExtraction({items:[{content:'not the original'}]}, blocks()), /missing verifiable/);
});

test('a mixed block can be split at exact anchors without dropping money or negation', () => {
  const text = 'The ride was peaceful and I was glad to have that quiet. My trade was down ₹2000, not a profit.';
  const result = groundExtraction({items:[
    { source_spans:[{block_id:'b1', start_quote:'The ride was peaceful',end_quote:'that quiet.'}] },
    { source_spans:[{block_id:'b1', start_quote:'My trade was down',end_quote:'not a profit.'}] },
  ]}, sourceBlocks(text,now,'UTC'));
  assert.equal(result[0].content, 'The ride was peaceful and I was glad to have that quiet.');
  assert.equal(result[1].content, 'My trade was down ₹2000, not a profit.');
});

test('chunking follows large time gaps and bounds long inputs while retaining adjacent context', () => {
  const result = sourceChunks(blocks());
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].blocks.map(block => block.id), ['b1','b2']);
  assert.ok(result[1].before.includes('andaaza'));
  const long = sourceBlocks('A long diary passage. '.repeat(1100),now,'UTC');
  assert.ok(long.every(block => block.text.length <= 4000));
  assert.ok(sourceChunks(long).every(chunk => chunk.blocks.reduce((size,block) => size+block.text.length,0)<=6500));
});

test('numbered fixtures remain separate source units and a date header alone is not a memory', () => {
  assert.equal(sourceBlocks('1. Paid the bill.\n2. Want a new book.\n3. Finished the essay.',now,'UTC').length, 3);
  assert.equal(sourceBlocks('[9:19 am, 7/7/2026] Writer: 7/7/2026',now,'Asia/Kolkata').length, 0);
});

test('invalid pasted dates and malformed provenance are rejected', () => {
  assert.throws(() => sourceBlocks('[9:00 am, 31/2/2026] Writer: Some text',now,'UTC'), /invalid date/);
  assert.equal(memorySource({version:1,title:'x',recorded_at:now,spans:[{start:-1,end:8}]}),null);
});
