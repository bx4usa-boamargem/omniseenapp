

# Engine Start Hard Guard — Top-Level Safety Net

## Problem

If `orchestrate-generation` crashes before reaching the pipeline's `try/catch` block (e.g., during job loading, lock acquisition, or step loading on lines 1399-1496), the job stays frozen at 5% because:
- No `INPUT_VALIDATION` step is created (so `create-generation-job` verification fails)
- The job status remains `running` with no error message
- Locks are never released

## Root Cause

The `orchestrate()` function has a `try/catch/finally` block starting at line 1497, but lines 1399-1496 (job load, lock acquisition, heartbeat/watchdog setup, step loading) are **outside** this safety net. Any crash there silently abandons the job.

## Changes

### File: `supabase/functions/orchestrate-generation/index.ts`

#### 1. Add INITIALIZING status update (after job load, line 1404)

Right after validating the job exists and is not completed/failed/cancelled, immediately update:

```typescript
// Immediately signal that orchestrator has booted
await supabase.from('generation_jobs').update({
  public_stage: 'INITIALIZING',
  public_progress: 3,
  public_message: 'Inicializando motor de geracao...',
  public_updated_at: new Date().toISOString(),
}).eq('id', jobId);
console.log('[ORCHESTRATOR_BOOT]', jobId);
```

This gives the frontend a signal before lock acquisition even starts.

#### 2. Wrap entire `orchestrate()` body in top-level try/catch

Move the existing content of `orchestrate()` (lines 1400-2018) inside a new outer try/catch that catches ANY crash and marks the job as failed:

```typescript
async function orchestrate(...): Promise<void> {
  try {
    // ... entire existing body (job load, lock, heartbeat, pipeline, finally)
  } catch (fatalErr) {
    console.error('[ORCHESTRATOR_FATAL]', jobId, fatalErr);
    try {
      await supabase.from('generation_jobs').update({
        status: 'failed',
        error_message: 'ENGINE_FATAL_CRASH',
        public_message: 'Falha interna ao iniciar o gerador.',
        locked_by: null,
        locked_at: null,
        completed_at: new Date().toISOString(),
        public_updated_at: new Date().toISOString(),
      }).eq('id', jobId);
    } catch (e) { console.error('[FATAL_CLEANUP_FAILED]', e); }
    throw fatalErr;
  }
}
```

This ensures that even if the crash happens before the heartbeat/watchdog setup or before the inner try/catch, the job is marked as `failed` with a clear error and the lock is released.

#### 3. Add boot log to the HTTP handler (line 2034)

Add a console.log at the very first line of the handler's try block:

```typescript
try {
  const { job_id } = await req.json();
  console.log('[ORCHESTRATOR_HANDLER_ENTRY]', job_id);
  // ... rest
```

This confirms the function was actually invoked.

## What changes

| Area | Change |
|------|--------|
| `orchestrate()` function | Outer try/catch wrapping entire body |
| After job load (line ~1404) | INITIALIZING status update |
| HTTP handler (line ~2034) | Boot log |

## What does NOT change

- `create-generation-job` (no changes)
- Frontend (no changes)
- `ai-router` (no changes)
- Pipeline logic (no changes)
- Heartbeat/watchdog (unchanged, now inside the outer try/catch)

## Deploy

Redeploy only `orchestrate-generation`.

