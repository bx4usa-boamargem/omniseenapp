

# Engine Hard Reset — Remove Legacy Engine Completely

## Summary

Audit confirms the Engine V1 architecture is already mostly clean. The single entry point (`create-generation-job` -> `orchestrate-generation`) is working correctly with lock-based idempotency. However, several legacy edge functions still exist as deployed code and need to be removed or fully blocked.

## Current State

| Component | Status | Action |
|-----------|--------|--------|
| `create-generation-job` | Active, correct | Keep |
| `orchestrate-generation` | Active, correct | Keep + add hard guard |
| `ai-router` | Active, correct | Keep |
| `generate-article-core` | Returns HTTP 410 (blocked) | Delete function |
| `generate-article-structured` | Returns HTTP 410 for direct calls | Delete function |
| `generate-article` | Legacy standalone generator, NOT called from frontend | Delete function |
| `process-queue` | Already delegates to `create-generation-job` | Keep (queue system uses Engine V1) |
| `article-chat` | Already delegates to `create-generation-job` | Keep |
| `convert-opportunity-to-article` | Already delegates to `create-generation-job` | Keep |

**Frontend:** No code calls legacy engines directly. All generation goes through `create-generation-job`.

## Changes

### 1. Delete Legacy Edge Functions (3 functions)

Remove completely from codebase and deployed functions:

- `supabase/functions/generate-article-core/` — deprecated stub (HTTP 410)
- `supabase/functions/generate-article-structured/` — deprecated stub (HTTP 410)
- `supabase/functions/generate-article/` — legacy standalone generator, no frontend references

### 2. Add Hard Guard to Orchestrator

In `supabase/functions/orchestrate-generation/index.ts`, the lock guard already exists at line 1333-1358 (checks `locked_by`, uses atomic CAS via `.is('locked_by', null)`). Enhance it with explicit legacy block log:

```text
// After lock acquisition succeeds, add:
console.log(`[ENGINE] LOCK_ACQUIRED job_id=${jobId} lockId=${lockId}`);
```

If lock acquisition fails (another orchestrator already running), log:
```text
console.log(`[ENGINE] LEGACY_EXECUTION_BLOCKED job_id=${jobId} — another orchestrator holds the lock`);
```

### 3. Cancel Zombie Jobs (Database)

Run SQL to clean up stuck jobs:

```sql
UPDATE generation_jobs
SET status = 'cancelled', locked_by = NULL, locked_at = NULL
WHERE status = 'running';

DELETE FROM generation_steps WHERE status = 'running';
```

### 4. Redeploy Clean

After deleting legacy functions and updating the orchestrator:
- Delete deployed functions: `generate-article-core`, `generate-article-structured`, `generate-article`
- Redeploy: `orchestrate-generation`, `ai-router`, `create-generation-job`

## What Does NOT Change

- `process-queue` stays (it correctly delegates to `create-generation-job`)
- `article-chat` stays (it correctly delegates to `create-generation-job`)
- `convert-opportunity-to-article` stays (it correctly delegates to `create-generation-job`)
- Multi-provider routing, soft timeouts, sequential inserts, lock heartbeat — all preserved
- `locked_by` column stays as-is (already TEXT, already used for CAS locking)

## Validation

After deploy, logs must show:
- `[ENGINE] LOCK_ACQUIRED` (exactly once per job)
- No `generate-article-core`, `generate-article-structured`, or `generate-article` in active function list
- API calls increment past 0
- Pipeline progresses past SERP_ANALYSIS

