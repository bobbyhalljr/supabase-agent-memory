import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export const ALICE = '11111111-1111-4111-8111-111111111111';
export const BOB = '22222222-2222-4222-8222-222222222222';
export async function openLocal(path: string) {
  const db = new PGlite(path);
  const { rows } = await db.query<{ exists: boolean }>(
    "select to_regclass('public.agent_memories') is not null as exists");
  if (!rows[0].exists) {
    // Test-only Auth shim. Never run this bootstrap against a Supabase project.
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to authenticated;
      grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('${ALICE}'), ('${BOB}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261011090000_memory.sql', import.meta.url), 'utf8'));
  }
  return db;
}
export async function asUser<T>(db: PGlite, user: string, fn: (tx: Parameters<Parameters<PGlite['transaction']>[0]>[0]) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
    return fn(tx);
  });
}
