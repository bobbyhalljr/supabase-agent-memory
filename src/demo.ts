import { openLocal, asUser, ALICE, BOB } from './local.js';
const cmd = process.argv[2];
if (!['write', 'recall', 'other-user', 'forget'].includes(cmd)) throw new Error('Use write | recall | other-user | forget');
const db = await openLocal('.local-memory');
try {
  if (cmd === 'write') {
    await asUser(db, ALICE, tx => tx.query(`insert into public.agent_memories
      (user_id,agent_id,memory_key,content,source)
      values ($1,'writer','writing.style','Use concise TypeScript examples.','user:demo')
      on conflict (user_id,agent_id,memory_key) do update set content=excluded.content, source=excluded.source, expires_at=excluded.expires_at`, [ALICE]));
    console.log('saved: writing.style');
  } else if (cmd === 'forget') {
    await asUser(db, ALICE, tx => tx.query("delete from public.agent_memories where agent_id='writer' and memory_key='writing.style'"));
    console.log('forgotten: writing.style');
  } else {
    const result = await asUser(db, cmd === 'other-user' ? BOB : ALICE,
      tx => tx.query("select * from public.recall_memories('writer', 5)"));
    console.log('recalled: ' + JSON.stringify(result.rows));
  }
} finally { await db.close(); }
