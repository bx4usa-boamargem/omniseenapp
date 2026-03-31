/**
 * Pure validation for generation job input (testable without Deno/Supabase).
 */

export interface GenerationJobInputValidation {
  validated: boolean;
  keyword: string;
  city?: string;
  niche: string;
}

export function validateGenerationJobInput(jobInput: Record<string, unknown>): GenerationJobInputValidation {
  const errors: string[] = [];
  const keyword = typeof jobInput?.keyword === "string" ? jobInput.keyword.trim() : "";
  const niche = typeof jobInput?.niche === "string" ? jobInput.niche.trim() : "";
  const city = typeof jobInput?.city === "string" ? jobInput.city.trim() : undefined;

  if (keyword.length < 2) errors.push("keyword obrigatório (min 2 chars)");
  if (niche.length < 2) errors.push("niche obrigatório");
  if (errors.length > 0) {
    throw new Error(`Input validation failed: ${errors.join("; ")}`);
  }

  return { validated: true, keyword, niche, city };
}
