
# Auto-Redirect on Completion + Progress Visualization Fix

## Problem
When article generation completes, the user stays on the pipeline page with no automatic navigation. They must manually find and click "Editar" to reach the article editor. The progress bar also shows "0/15" (wrong for Engine V2 which has 5 steps).

## Changes

### 1. Auto-redirect to article editor on job completion (`GenerationDetail.tsx`)

Add a `useEffect` that watches `job.status` and `job.article_id`. When the job reaches `completed` status with a valid `article_id`, automatically navigate to the editor after a brief 2-second delay (so the user sees "100% - Concluido!" before redirecting):

```typescript
useEffect(() => {
  if (job?.status === 'completed' && job?.article_id) {
    const timer = setTimeout(() => {
      navigate(`/client/articles/${job.article_id}/edit`, { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }
}, [job?.status, job?.article_id, navigate]);
```

This applies to BOTH client and admin views -- once the article is ready, the user goes straight to the editor where they can publish or save as draft.

### 2. Fix "API Calls 0/15" label (admin view)

Change the hardcoded `/15` on line 481 to `/5` to reflect Engine V2's actual step count:
```
{job.total_api_calls || 0}/5
```

### 3. Add completion state UI before redirect

When `job.status === 'completed'`, show a brief "Article ready! Redirecting to editor..." message with a success animation, so the user understands what's happening during the 2-second delay.

### 4. Enable Realtime for `generation_steps` (database migration)

Add `generation_steps` to the `supabase_realtime` publication so the admin pipeline view actually receives step updates in real-time (currently it's not in the publication, which is why steps show "0/5").

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_steps;
```

## Files Modified
- `src/pages/client/GenerationDetail.tsx` -- auto-redirect + API calls label fix + completion UI
- New migration SQL -- add `generation_steps` to realtime publication

## Expected Result
1. User starts article generation
2. Pipeline steps update in real-time (progress bar advances)
3. On completion, user sees "Artigo pronto!" for 2 seconds
4. Auto-redirect to `/client/articles/{id}/edit` (editor page)
5. User can publish or save as draft from the editor
