import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { openLocal, asUser, ALICE, BOB } from './local.js';
await rm('.test-memory', { recursive: true, force: true });
let db = await openLocal('.test-memory');
let checks = 0;
function ok(value: unknown, name: string) { assert.ok(value, name); checks++; console.log('PASS ' + name); }
async function rejected(fn: () => Promise<unknown>, code: string, name: string) {
  let caught = false;
  try { await fn(); } catch (e) { assert.equal((e as { code: string }).code, code); caught = true; }
  ok(caught, name);
}
const save = (user: string, owner: string, key: string, content='Use TypeScript.', agent='writer', expiry: string | null=null) => asUser(db, user, tx => tx.query(`
  insert into public.agent_memories (user_id,agent_id,memory_key,content,source,expires_at)
  values ($1,$2,$3,$4,'user:fixture',$5)
  on conflict (user_id,agent_id,memory_key) do update
  set content=excluded.content,source=excluded.source,expires_at=excluded.expires_at`, [owner,agent,key,content,expiry]));
const recall = (user: string, agent='writer', limit=5) => asUser(db,user,tx => tx.query<{memory_key:string;content:string;source:string}>('select * from public.recall_memories($1,$2)',[agent,limit]));
await save(ALICE,ALICE,'style');
ok((await recall(ALICE)).rows[0].content === 'Use TypeScript.', 'owner recalls saved fact');
ok((await recall(BOB)).rows.length === 0, 'other user cannot recall fact');
ok((await asUser(db, BOB, tx => tx.query('select * from public.agent_memories'))).rows.length === 0, 'unfiltered select still isolated');
await rejected(() => save(BOB,ALICE,'spoof'), '42501', 'forged owner insert denied');
await save(BOB,BOB,'style','Use Python.');
ok((await recall(ALICE)).rows[0].content === 'Use TypeScript.', 'same key across users stays separate');
await save(ALICE,ALICE,'style','Use concise TypeScript examples.');
ok((await recall(ALICE)).rows.length === 1, 'upsert replaces instead of duplicating');
ok((await recall(ALICE)).rows[0].content === 'Use concise TypeScript examples.', 'upsert persists correction');
await rejected(() => asUser(db,ALICE,tx => tx.query('update public.agent_memories set user_id=$1 where memory_key=$2',[BOB,'style'])), '42501', 'owner reassignment denied');
ok((await asUser(db,BOB,tx => tx.query('update public.agent_memories set content=$1 where user_id=$2 returning memory_key',['Hacked',ALICE]))).rows.length === 0, 'other user update affects zero rows');
ok((await asUser(db,BOB,tx => tx.query('delete from public.agent_memories where user_id=$1 returning memory_key',[ALICE]))).rows.length === 0, 'other user delete affects zero rows');
await save(ALICE,ALICE,'private','Different agent context.','planner');
ok((await recall(ALICE)).rows.every(r => r.memory_key !== 'private'), 'agent scope applied during recall');
await save(ALICE,ALICE,'expired','Old preference.','writer','2000-01-01T00:00:00Z');
ok((await recall(ALICE)).rows.every(r => r.memory_key !== 'expired'), 'expired fact excluded by database clock');
await rejected(() => save(ALICE,ALICE,'empty',''), '23514', 'empty content rejected');
await rejected(() => save(ALICE,ALICE,'huge','x'.repeat(1001)), '23514', 'oversized content rejected');
await rejected(() => save(ALICE,ALICE,'x'.repeat(65)), '23514', 'oversized key rejected');
await rejected(() => save(ALICE,ALICE,'agent','ok',''), '23514', 'empty agent rejected');
await rejected(() => asUser(db,ALICE,tx => tx.query("insert into public.agent_memories(user_id,agent_id,memory_key,content,source) values ($1,'writer','source','ok','')",[ALICE])), '23514', 'empty source rejected');
await rejected(() => db.transaction(async tx => { await tx.exec('set local role anon'); await tx.query('select * from public.agent_memories'); }), '42501', 'anonymous table read denied');
await rejected(() => db.transaction(async tx => { await tx.exec('set local role anon'); await tx.query("select * from public.recall_memories('writer',5)"); }), '42501', 'anonymous RPC denied');
ok((await recall('')).rows.length === 0, 'missing user claim returns no memory');
for (let i=0;i<7;i++) await save(ALICE,ALICE,'fact.'+i,'Fact '+i);
ok((await recall(ALICE,'writer',100)).rows.length === 5, 'recall clamps oversized request to five');
ok((await recall(ALICE,'writer',0)).rows.length === 1, 'recall clamps zero request to one');
await asUser(db,ALICE,tx => tx.query("update public.agent_memories set updated_at='2000-01-01' where memory_key='style'"));
ok((await asUser(db,ALICE,tx => tx.query<{stamped:boolean}>("select updated_at > '2020-01-01'::timestamptz as stamped from public.agent_memories where memory_key='style' and agent_id='writer'"))).rows[0].stamped, 'database owns update timestamp');
await db.close(); db = await openLocal('.test-memory');
ok((await asUser(db,ALICE,tx=>tx.query<{content:string}>("select content from public.agent_memories where memory_key='style' and agent_id='writer'"))).rows[0].content === 'Use concise TypeScript examples.', 'fact survives database close and reopen');
await asUser(db,ALICE,tx=>tx.query("delete from public.agent_memories where memory_key='style' and agent_id='writer'"));
ok((await asUser(db,ALICE,tx=>tx.query("select * from public.agent_memories where memory_key='style' and agent_id='writer'"))).rows.length===0, 'forget removes stored fact');
ok((await recall(BOB)).rows[0].content==='Use Python.', 'forget leaves other user intact');
await db.close();
console.log(`${checks}/${checks} checks passed`);
