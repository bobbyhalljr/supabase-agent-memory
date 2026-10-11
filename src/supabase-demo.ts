import { createClient } from '@supabase/supabase-js';
import { memoryStore, memoryContext } from './memory.js';
function env(key: string) { const v = process.env[key]; if (!v) throw new Error('Missing ' + key); return v; }
const cmd = process.argv[2];
if (!['write','recall','forget'].includes(cmd)) throw new Error('Use write | recall | forget');
const client = createClient(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { error } = await client.auth.signInWithPassword({ email: env('DEMO_EMAIL'), password: env('DEMO_PASSWORD') });
if (error) throw new Error('Demo sign-in failed; check the confirmed local test user');
try {
  const memory = memoryStore(client);
  if (cmd === 'write') {
    await memory.save({ agentId:'writer', key:'writing.style', content:'Use concise TypeScript examples.', source:'user:demo' });
    console.log('saved: writing.style');
  } else if (cmd === 'forget') {
    await memory.forget('writer','writing.style'); console.log('forgotten: writing.style');
  } else { console.log(memoryContext(await memory.recall('writer'))); }
} finally { await client.auth.signOut(); }
