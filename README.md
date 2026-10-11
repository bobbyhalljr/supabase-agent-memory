# Supabase Agent Memory

A small TypeScript preference store for an AI agent: save, correct, recall after restart, and forget, with Postgres ownership policies.

Article: https://dev.to/bobbyhalljr/how-to-give-an-ai-agent-persistent-memory-using-supabase-113i

## Run the database build without a Supabase account

Prerequisite: Node.js 22 or newer, plus npm. The dependency versions are pinned in the lockfile.

```bash
git clone https://github.com/bobbyhalljr/supabase-agent-memory.git
cd supabase-agent-memory
npm ci
npm run check
npm test

npm run demo -- write
npm run demo -- recall
npm run demo -- other-user
npm run demo -- forget
npm run demo -- recall
```

Each demo command starts a new process. [PGlite supports filesystem persistence](https://pglite.dev/docs/); the local database lives in `.local-memory/`, which is excluded from Git.

Exact application output, with npm's command headers omitted:

```text
saved: writing.style
recalled: [{"memory_key":"writing.style","content":"Use concise TypeScript examples.","source":"user:demo"}]
recalled: []
forgotten: writing.style
recalled: []
```

The test suite finished with:

```text
26/26 checks passed
```

It checks persistence after closing and reopening the database, owner isolation on unfiltered reads, forged-owner inserts, owner reassignment, cross-user updates and deletes, correction by upsert, agent-scoped recall, expiry, bounds, and anonymous access.

The local harness supplies synthetic users and a test-only `auth.uid()` function. It switches to a non-owner `authenticated` role before running client operations. These are real database policy checks, but the harness does not verify JWT signatures or emulate Supabase Auth.

## Connect the same code to local Supabase

Use a fresh local project. The documented Docker path requires the [Supabase CLI and a compatible container runtime](https://supabase.com/docs/guides/local-development).

Install the CLI using a supported method, then from the repository:

```bash
supabase init
supabase start
supabase migration up --local
cp .env.example .env
```

In local Studio, create a confirmed test user under Authentication. Fill `.env` with the local URL, the local publishable key, and that test user's email and password. Keep the file local and ignored. Use the low-privilege publishable key; an older local CLI may provide the legacy `anon` equivalent.

Run the Supabase client in separate processes:

```bash
node --env-file=.env ./node_modules/tsx/dist/cli.mjs src/supabase-demo.ts write
node --env-file=.env ./node_modules/tsx/dist/cli.mjs src/supabase-demo.ts recall
node --env-file=.env ./node_modules/tsx/dist/cli.mjs src/supabase-demo.ts forget
node --env-file=.env ./node_modules/tsx/dist/cli.mjs src/supabase-demo.ts recall
```

The script signs in with [`signInWithPassword`](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), uses the same adapter, then signs out. It prints application results without printing credentials.

Verify this path in your own local stack before deploying it. For production, use your application's existing session flow, regenerate database types, and add integration tests against the actual Auth and API configuration.

## What this build does not promise

This is a small preference store, with last-writer-wins updates. It has no revision history, semantic search, shared team memory, production secret management, or concurrent-write conflict resolution. Two authorized clients updating the same key can overwrite each other.

Its authorization boundary is a user, not an organization. An `agent_id` string is not an agent permission system. Its database test harness is not a deployed Supabase service. Its JSON wrapper is not a prompt-injection defense. Its row limit is not a precise token budget.

Those are useful next layers. They are also easier to build after the basic lifecycle works.


## Source map

- `supabase/migrations/20261011090000_memory.sql`: deployable Supabase migration
- `src/memory.ts`: Supabase client adapter and context serializer
- `src/supabase-demo.ts`: signed-in Supabase integration path
- `src/local.ts`: test-only synthetic Auth bootstrap
- `src/demo.ts`: persistent database demo
- `src/test.ts`: adversarial ownership/lifecycle checks
- `test-output.txt`: tested fixture output
- `assets/`: cover and diagrams

## Primary references

- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: API keys and database roles](https://supabase.com/docs/guides/api/api-keys)
- [Supabase JavaScript: upsert](https://supabase.com/docs/reference/javascript/upsert)
- [Supabase JavaScript: getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Supabase JavaScript: signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
- [Supabase: Local Development & CLI](https://supabase.com/docs/guides/local-development)
- [PGlite: Getting started and filesystem persistence](https://pglite.dev/docs/)
