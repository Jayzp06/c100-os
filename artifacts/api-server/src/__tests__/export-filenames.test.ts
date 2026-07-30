/**
 * Export filename tests — buildFilenameBase() format and sanitization.
 *
 * Verifies the helper in lib/export.ts produces the canonical format:
 *   C100_Trailblazing_<ReportType>_<YYYY-MM-DD>[_<Suffix>]
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildFilenameBase } from "../lib/export.js";

// ── Format ────────────────────────────────────────────────────────────────────

describe("buildFilenameBase — canonical format", () => {
  test("produces C100_Trailblazing prefix", () => {
    const result = buildFilenameBase("Chapter Overview");
    assert.ok(result.startsWith("C100_Trailblazing_"), `Expected C100_Trailblazing_ prefix, got: ${result}`);
  });

  test("appends YYYY-MM-DD date", () => {
    const result = buildFilenameBase("Chapter Overview");
    assert.match(result, /_\d{4}-\d{2}-\d{2}$/, `Expected date suffix, got: ${result}`);
  });

  test("full format matches C100_Trailblazing_Chapter_Overview_YYYY-MM-DD", () => {
    const result = buildFilenameBase("Chapter Overview");
    assert.match(result, /^C100_Trailblazing_Chapter_Overview_\d{4}-\d{2}-\d{2}$/);
  });

  test("scholarship eligibility format", () => {
    const result = buildFilenameBase("Scholarship Eligibility");
    assert.match(result, /^C100_Trailblazing_Scholarship_Eligibility_\d{4}-\d{2}-\d{2}$/);
  });

  test("conference eligibility format", () => {
    const result = buildFilenameBase("Conference Eligibility");
    assert.match(result, /^C100_Trailblazing_Conference_Eligibility_\d{4}-\d{2}-\d{2}$/);
  });

  test("dues report format", () => {
    const result = buildFilenameBase("Dues Ledger");
    assert.match(result, /^C100_Trailblazing_Dues_Ledger_\d{4}-\d{2}-\d{2}$/);
  });

  test("financial transactions format", () => {
    const result = buildFilenameBase("Financial Transactions");
    assert.match(result, /^C100_Trailblazing_Financial_Transactions_\d{4}-\d{2}-\d{2}$/);
  });
});

// ── Suffix ────────────────────────────────────────────────────────────────────

describe("buildFilenameBase — suffix appended after date", () => {
  test("member name suffix appears after date", () => {
    const result = buildFilenameBase("Member Report", "Jaylin Phillips");
    assert.match(result, /^C100_Trailblazing_Member_Report_\d{4}-\d{2}-\d{2}_Jaylin_Phillips$/);
  });

  test("committee name suffix appears after date", () => {
    const result = buildFilenameBase("Committee Report", "Economic Empowerment");
    assert.match(result, /^C100_Trailblazing_Committee_Report_\d{4}-\d{2}-\d{2}_Economic_Empowerment$/);
  });

  test("empty suffix is omitted from result", () => {
    const withEmpty = buildFilenameBase("Chapter Overview", "");
    const withNone  = buildFilenameBase("Chapter Overview");
    assert.strictEqual(withEmpty, withNone, "Empty suffix must produce same result as no suffix");
  });
});

// ── Sanitization ──────────────────────────────────────────────────────────────

describe("buildFilenameBase — character sanitization", () => {
  test("spaces are replaced with underscores", () => {
    const result = buildFilenameBase("Chapter Overview");
    assert.ok(!result.includes(" "), `Result must not contain spaces: ${result}`);
    assert.ok(result.includes("Chapter_Overview"), `Expected underscores, got: ${result}`);
  });

  test("special characters are removed", () => {
    const result = buildFilenameBase("Report: With/Slash & Symbols!");
    assert.match(result, /^[A-Za-z0-9_-]+$/, `Invalid characters found in: ${result}`);
  });

  test("ampersand in committee suffix is sanitized", () => {
    const result = buildFilenameBase("Committee Report", "Tech & Innovation");
    assert.ok(!result.includes("&"), `Ampersand must be removed: ${result}`);
    assert.match(result, /^[A-Za-z0-9_-]+$/);
  });

  test("double spaces do not produce double underscores", () => {
    const result = buildFilenameBase("Chapter  Overview");
    assert.ok(!result.includes("__"), `Double underscores found in: ${result}`);
  });

  test("result does not start with an underscore", () => {
    const result = buildFilenameBase("Chapter Overview");
    assert.ok(!result.startsWith("_"), `Result must not start with underscore: ${result}`);
  });

  test("result does not end with an underscore", () => {
    const result = buildFilenameBase("Chapter Overview");
    assert.ok(!result.endsWith("_"), `Result must not end with underscore: ${result}`);
  });

  test("result contains only filesystem-safe characters", () => {
    const result = buildFilenameBase("Member Report", "O'Brien, Jr.");
    assert.match(result, /^[A-Za-z0-9_-]+$/, `Unsafe characters in: ${result}`);
  });
});

// ── Length ────────────────────────────────────────────────────────────────────

describe("buildFilenameBase — reasonable length", () => {
  test("standard report types produce short filenames (≤ 80 chars)", () => {
    const types = [
      "Chapter Overview",
      "Scholarship Eligibility",
      "Conference Eligibility",
      "Dues Ledger",
      "Financial Transactions",
    ];
    for (const type of types) {
      const result = buildFilenameBase(type);
      assert.ok(result.length <= 80, `Filename too long for "${type}": ${result.length} chars`);
    }
  });
});
