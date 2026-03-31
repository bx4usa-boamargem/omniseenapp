import { describe, it, expect } from "vitest";
import {
  getMinWordCount,
  QUALITY_GATE,
} from "../supabase/functions/_shared/superPageEngine.ts";

describe("superPageEngine", () => {
  it("getMinWordCount matches QUALITY_GATE for article", () => {
    expect(getMinWordCount("article")).toBe(QUALITY_GATE.WORD_COUNT_MIN_ARTICLE);
  });

  it("getMinWordCount matches QUALITY_GATE for super_page", () => {
    expect(getMinWordCount("super_page")).toBe(QUALITY_GATE.WORD_COUNT_MIN_SUPER_PAGE);
  });
});
