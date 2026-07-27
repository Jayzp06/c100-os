/**
 * Regression tests for Zod schema validation constraints and the
 * server-side isValidEmail / sanitizeText utilities.
 *
 * Run with:
 *   cd artifacts/api-server && pnpm exec tsx --test src/__tests__/validation.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CreateMemberBody,
  UpdateMyProfileBody,
  CreateEventBody,
  UpdateOrgSettingsBody,
} from "@workspace/api-zod";
import { isValidEmail, sanitizeText } from "../lib/validation.js";

// ---------------------------------------------------------------------------
// isValidEmail
// ---------------------------------------------------------------------------
describe("isValidEmail", () => {
  const valid = [
    "alice@example.com",
    "bob+tag@university.edu",
    "name.with.dots@domain.co.uk",
    "o'reilly@domain.ie",
    "user-name_123@sub.domain.org",
  ];
  const invalid = [
    "",
    "notanemail",
    "@nodomain.com",
    "noDotInTld@domain",
    "space in@email.com",
    "a".repeat(255) + "@x.com",
  ];

  for (const addr of valid) {
    test(`accepts "${addr}"`, () => {
      assert.equal(isValidEmail(addr), true);
    });
  }
  for (const addr of invalid) {
    test(`rejects "${addr.slice(0, 40)}"`, () => {
      assert.equal(isValidEmail(addr), false);
    });
  }
});

// ---------------------------------------------------------------------------
// sanitizeText
// ---------------------------------------------------------------------------
describe("sanitizeText", () => {
  test("trims outer whitespace", () => {
    const r = sanitizeText("  hello  ");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value, "hello");
  });
  test("accepts names with apostrophes and hyphens", () => {
    assert.equal(sanitizeText("O'Brien-Smith").ok, true);
  });
  test("accepts accented characters", () => {
    assert.equal(sanitizeText("Résumé Académique").ok, true);
  });
  test("rejects ASCII control characters", () => {
    assert.equal(sanitizeText("hello\x00world").ok, false);
    assert.equal(sanitizeText("line\nbreak").ok, false);
    assert.equal(sanitizeText("tab\there").ok, false);
  });
  test("rejects DEL character", () => {
    assert.equal(sanitizeText("del\x7fchar").ok, false);
  });
});

// ---------------------------------------------------------------------------
// CreateMemberBody
// ---------------------------------------------------------------------------
describe("CreateMemberBody", () => {
  const base = { fullName: "Alice Johnson", email: "alice@test.com" };

  test("accepts valid input", () => {
    assert.equal(CreateMemberBody.safeParse(base).success, true);
  });
  test("rejects missing fullName", () => {
    assert.equal(CreateMemberBody.safeParse({ email: "a@b.com" }).success, false);
  });
  test("rejects fullName shorter than 2 chars", () => {
    assert.equal(CreateMemberBody.safeParse({ ...base, fullName: "A" }).success, false);
  });
  test("rejects fullName longer than 100 chars", () => {
    assert.equal(
      CreateMemberBody.safeParse({ ...base, fullName: "A".repeat(101) }).success,
      false,
    );
  });
  test("rejects missing email", () => {
    assert.equal(CreateMemberBody.safeParse({ fullName: "Alice Johnson" }).success, false);
  });
});

// ---------------------------------------------------------------------------
// UpdateMyProfileBody
// ---------------------------------------------------------------------------
describe("UpdateMyProfileBody", () => {
  test("accepts empty object (all optional)", () => {
    assert.equal(UpdateMyProfileBody.safeParse({}).success, true);
  });
  test("rejects fullName shorter than 2 chars when provided", () => {
    assert.equal(
      UpdateMyProfileBody.safeParse({ fullName: "X" }).success,
      false,
    );
  });
  test("rejects fullName longer than 100 chars", () => {
    assert.equal(
      UpdateMyProfileBody.safeParse({ fullName: "X".repeat(101) }).success,
      false,
    );
  });
  test("rejects gpa > 4.5", () => {
    assert.equal(UpdateMyProfileBody.safeParse({ gpa: 5.0 }).success, false);
  });
  test("rejects gpa < 0", () => {
    assert.equal(UpdateMyProfileBody.safeParse({ gpa: -0.1 }).success, false);
  });
  test("rejects graduationYear < 2000", () => {
    assert.equal(UpdateMyProfileBody.safeParse({ graduationYear: 1999 }).success, false);
  });
  test("rejects graduationYear > 2100", () => {
    assert.equal(UpdateMyProfileBody.safeParse({ graduationYear: 2101 }).success, false);
  });
  test("accepts valid GPA and year", () => {
    assert.equal(
      UpdateMyProfileBody.safeParse({ gpa: 3.85, graduationYear: 2026 }).success,
      true,
    );
  });
  test("rejects phone longer than 20 chars", () => {
    assert.equal(
      UpdateMyProfileBody.safeParse({ phone: "1".repeat(21) }).success,
      false,
    );
  });
  test("rejects studentId longer than 30 chars", () => {
    assert.equal(
      UpdateMyProfileBody.safeParse({ studentId: "X".repeat(31) }).success,
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// CreateEventBody
// ---------------------------------------------------------------------------
describe("CreateEventBody", () => {
  const base = {
    title: "Spring General Body Meeting",
    description: "Agenda and voting for the spring semester initiatives.",
    eventType: "GeneralBodyMeeting",
    date: "2027-03-15",
    startTime: "18:00",
    endTime: "19:30",
    location: "Student Center Room 101",
  };

  test("accepts valid event", () => {
    assert.equal(CreateEventBody.safeParse(base).success, true);
  });
  test("rejects title shorter than 3 chars", () => {
    assert.equal(CreateEventBody.safeParse({ ...base, title: "AB" }).success, false);
  });
  test("rejects title longer than 150 chars", () => {
    assert.equal(
      CreateEventBody.safeParse({ ...base, title: "A".repeat(151) }).success,
      false,
    );
  });
  test("rejects description shorter than 10 chars", () => {
    assert.equal(
      CreateEventBody.safeParse({ ...base, description: "Too short" }).success,
      false,
    );
  });
  test("rejects description longer than 2000 chars", () => {
    assert.equal(
      CreateEventBody.safeParse({ ...base, description: "A".repeat(2001) }).success,
      false,
    );
  });
  test("rejects location shorter than 2 chars", () => {
    assert.equal(CreateEventBody.safeParse({ ...base, location: "X" }).success, false);
  });
  test("rejects location longer than 200 chars", () => {
    assert.equal(
      CreateEventBody.safeParse({ ...base, location: "A".repeat(201) }).success,
      false,
    );
  });
  test("rejects invalid startTime format", () => {
    assert.equal(
      CreateEventBody.safeParse({ ...base, startTime: "6pm" }).success,
      false,
    );
  });
  test("rejects invalid endTime format", () => {
    assert.equal(
      CreateEventBody.safeParse({ ...base, endTime: "25:00" }).success,
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// UpdateOrgSettingsBody — name length and color pattern
// ---------------------------------------------------------------------------
describe("UpdateOrgSettingsBody", () => {
  test("accepts valid hex colors", () => {
    assert.equal(
      UpdateOrgSettingsBody.safeParse({
        primaryColor: "#1A3A8F",
        secondaryColor: "#C9A227",
      }).success,
      true,
    );
  });
  test("rejects non-hex primary color", () => {
    assert.equal(
      UpdateOrgSettingsBody.safeParse({ primaryColor: "blue" }).success,
      false,
    );
  });
  test("rejects chapterName longer than 100 chars", () => {
    assert.equal(
      UpdateOrgSettingsBody.safeParse({ chapterName: "X".repeat(101) }).success,
      false,
    );
  });
  test("rejects empty chapterIdentifier", () => {
    assert.equal(
      UpdateOrgSettingsBody.safeParse({ chapterIdentifier: "" }).success,
      false,
    );
  });
});
