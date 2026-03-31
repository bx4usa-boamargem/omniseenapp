import { describe, it, expect } from "vitest";
import { validateGenerationJobInput } from "../supabase/functions/_shared/pipelineInputValidation.ts";

describe("validateGenerationJobInput", () => {
  it("accepts valid keyword and niche", () => {
    const r = validateGenerationJobInput({
      keyword: "  cozinha planejada  ",
      niche: "  móveis  ",
      city: " São Paulo ",
    });
    expect(r.validated).toBe(true);
    expect(r.keyword).toBe("cozinha planejada");
    expect(r.niche).toBe("móveis");
    expect(r.city).toBe("São Paulo");
  });

  it("throws when keyword too short", () => {
    expect(() =>
      validateGenerationJobInput({ keyword: "a", niche: "ok" }),
    ).toThrow(/keyword obrigatório/);
  });

  it("throws when niche too short", () => {
    expect(() =>
      validateGenerationJobInput({ keyword: "ok keyword", niche: "x" }),
    ).toThrow(/niche obrigatório/);
  });
});
