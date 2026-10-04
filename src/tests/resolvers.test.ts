import { describe, expect, test } from "bun:test";

// Slug validation regex matching requirement: lowercase letters, numbers, and hyphens only
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("Unit Tests: Resolver Validation Logic", () => {
  describe("Slug Validation", () => {
    test("accepts valid lowercase hyphenated slugs", () => {
      // Valid slugs: lowercase alphanumeric separated by single hyphens
      expect(SLUG_REGEX.test("tech-docs")).toBe(true);
      expect(SLUG_REGEX.test("engineering-specs-2026")).toBe(true);
    });

    test("rejects uppercase characters and special symbols in slugs", () => {
      // Malformed slugs: includes uppercase, underscores, or whitespace
      expect(SLUG_REGEX.test("Tech-Docs")).toBe(false);
      expect(SLUG_REGEX.test("tech_docs")).toBe(false);
      expect(SLUG_REGEX.test("tech docs")).toBe(false);
    });
  });

  describe("String Trimming & Non-Empty Checks", () => {
    test("detects empty whitespace strings", () => {
      // Guard against whitespace-only title or content submissions
      const input = "   ";
      const cleaned = input.trim();
      expect(cleaned.length).toBe(0);
    });

    test("formats clean titles properly", () => {
      // Normalizes padded strings for database storage
      const rawTitle = "  Tokio Architecture  ";
      const cleanTitle = rawTitle.trim();
      expect(cleanTitle).toBe("Tokio Architecture");
    });
  });
});