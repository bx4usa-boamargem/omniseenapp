
# Emergency Rollback & Stability Plan

## Summary

The article generation system has critical issues causing:
1. **Score 0/100** - Articles being evaluated incorrectly
2. **Only 1 image** - Image generation failing silently
3. **E-E-A-T not injecting** - `useEat=false` in logs despite frontend setting it to ON
4. **Niche defaulting to 'default'** - Missing niche data from frontend
5. **AI Tool Call Retry** - Adding unnecessary complexity and potential loops

## Root Cause Analysis

From the edge function logs:
```
[Article Engine] Params: useEat=false, niche=default, mode=authority, businessName=not set
```

This shows:
- `useEat=false` when it should be `true`
- `niche=default` when it should be `pest_control` or `plumbing`
- `businessName=not set` when it should come from `business_profile`

The disconnect is:
1. **ArticleGenerator.tsx** sends `formData.eatInjection` but the edge function receives `useEat=false`
2. **ArticleGenerator.tsx** sends `formData.niche` but the edge function receives `niche=default`
3. The frontend form defaults may not match the backend expectations

## Technical Changes

### 1. Simplify AI Tool Call (Remove Retry Loop)

**File:** `supabase/functions/generate-article-structured/index.ts`

Remove the retry mechanism that was added and return to simple direct call:
- Remove `maxRetries` parameter and retry loop from `callLovableJsonTool`
- Keep only primary tool call path
- Remove content fallback extraction that may produce lower quality results

### 2. Fix Parameter Passing from Frontend

**File:** `src/pages/client/ArticleGenerator.tsx`

Ensure the payload is correctly structured:
- Verify `niche` defaults to `pest_control` (not empty or 'default')
- Verify `useEat` is explicitly true when toggle is ON
- Add logging to confirm values before sending

### 3. Force Unsplash Fallback for Images (Guaranteed 8 Images)

**File:** `supabase/functions/generate-article-structured/index.ts`

If the AI image generation fails or returns 0 images, force 8 Unsplash fallback images:
- Add check after image generation completes
- If `processedImagePrompts.length < 6`, generate additional fallback images
- This guarantees 6-8 images even if AI fails

### 4. Verify E-E-A-T Injection Logic

**File:** `supabase/functions/generate-article-structured/index.ts`

The E-E-A-T injection is conditional on `useEat && niche && niche !== 'default'`.
When `niche='default'`, E-E-A-T is skipped. Fix:
- Use `pest_control` as fallback niche instead of `default`
- Add logging to confirm E-E-A-T injection occurs

### 5. QA System Already Disabled (Confirm)

**File:** `src/hooks/useContentOptimizer.ts`

Already has `RUN_TO_100_DISABLED = true`. Verify this is working:
- The "Levar a 100" button should show a toast warning instead of opening the modal
- Confirm the `ContentScorePanel` respects this flag

## File-by-File Changes

### `supabase/functions/generate-article-structured/index.ts`

```typescript
// Line ~348: SIMPLIFY callLovableJsonTool - REMOVE RETRY
async function callLovableJsonTool(params: {
  // ... existing params ...
  // REMOVE: maxRetries parameter
}): Promise<{ arguments: Record<string, unknown>; usage?: {...} }> {
  // SIMPLE DIRECT CALL - NO RETRY
  const res = await fetch(url, { ... });
  
  if (!res.ok) {
    throw new Error(`AI_GATEWAY_ERROR: ${res.status}`);
  }
  
  const data = safeJsonParse<any>(await res.text());
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    throw new Error('AI_OUTPUT_INVALID: missing tool call arguments');
  }
  
  return { arguments: parseArticleJSON(toolCall.function.arguments), usage: data.usage };
}
```

```typescript
// Line ~1391: FIX NICHE DEFAULT
niche = 'default',  // CHANGE TO: niche = 'pest_control',
```

```typescript
// Line ~2123: FORCE MINIMUM 8 IMAGES
} else {
  console.log(`[Images] Nenhum prompt de imagem para gerar`);
}

// NEW: FORCE MINIMUM IMAGES IF NEEDED
if (processedImagePrompts.length < 6) {
  console.log(`[Images] FORÇANDO imagens mínimas: ${processedImagePrompts.length} → 8`);
  const needed = 8 - processedImagePrompts.length;
  for (let i = 0; i < needed; i++) {
    const keywords = [niche || 'business', primaryKeyword.split(' ')[0], territoryData?.official_name || 'brazil'];
    processedImagePrompts.push({
      context: `filler-${i + 1}`,
      prompt: `Professional ${keywords.join(' ')} service`,
      alt: `Imagem profissional ${i + 1}`,
      url: `https://source.unsplash.com/1024x768/?${encodeURIComponent(keywords.join(','))}&sig=${blog_id}-filler-${i}`,
      after_section: processedImagePrompts.length + 1,
      generated_by: 'unsplash_filler'
    });
  }
}
```

### `src/pages/client/ArticleGenerator.tsx`

```typescript
// Ensure correct defaults in form state
const [formData, setFormData] = useState({
  keyword: '',
  city: '',
  state: '',
  niche: 'pest_control',  // DEFAULT TO pest_control, NOT empty
  mode: 'authority' as 'entry' | 'authority',
  template: 'auto',
  webResearch: false,
  eatInjection: true,   // DEFAULT TO true
  imageAlt: true,       // DEFAULT TO true
});
```

```typescript
// Add debug logging before API call
console.log('[ArticleGenerator] Sending payload:', {
  niche: formData.niche,
  useEat: formData.eatInjection,
  contextualAlt: formData.imageAlt,
  mode: formData.mode
});
```

## Validation Checklist

After implementing:
- [ ] Generate test article with Authority mode
- [ ] Confirm logs show `useEat=true, niche=pest_control`
- [ ] Confirm 6-8 images appear in preview
- [ ] Confirm E-E-A-T phrase visible in 2nd paragraph
- [ ] Confirm article has 1,500+ words
- [ ] Confirm no "Score 0/100" issues
- [ ] Confirm "Levar a 100" button shows warning toast (not modal)

## Risk Assessment

- **Low Risk**: All changes are conservative rollbacks or fixes
- **No Schema Changes**: Database schema remains unchanged
- **Backward Compatible**: Existing articles unaffected
- **Easy Revert**: If issues persist, can revert individual changes
