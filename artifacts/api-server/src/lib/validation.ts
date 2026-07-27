/**
 * Input sanitisation and format-validation helpers shared across routes.
 *
 * These complement the Zod schema constraints (min/max length, enum membership)
 * with checks that are easier to express in code than in an OpenAPI spec:
 *   • Email format validation (Zod v3 has no built-in `zod.email()`)
 *   • Control-character rejection (U+0000–U+001F, U+007F–U+009F)
 */

/**
 * Validate an email address with a pragmatic pattern that:
 *   - Accepts real-world addresses including `+`, `.`, `-`, `_`, apostrophes
 *   - Rejects clearly invalid forms (no @, no domain, bare TLD)
 *   - Does NOT try to be RFC-5322-perfect (unnecessary for this use case)
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || trimmed.length > 254) return false;
  // local@domain.tld — domain must have at least one dot and a 2+ char TLD.
  return /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(
    trimmed,
  );
}

export type SanitizeResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * Trim outer whitespace from `value` and reject control characters
 * (U+0000–U+001F, U+007F–U+009F). Legitimate names and titles that contain
 * apostrophes, hyphens, spaces, and accented characters pass through unchanged.
 *
 * Does NOT silently truncate — callers are expected to enforce length via the
 * Zod schema before calling this.
 */
export function sanitizeText(value: string): SanitizeResult {
  const trimmed = value.trim();
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f-\x9f]/.test(trimmed)) {
    return { ok: false, error: "Field contains invalid control characters." };
  }
  return { ok: true, value: trimmed };
}

/**
 * Sanitize every string value in a parsed-data object in-place.
 * Returns a map of { fieldName → errorMessage } for any fields that fail.
 * Fields that are `null`, `undefined`, or non-string are skipped.
 */
export function sanitizeStringFields(
  data: Record<string, unknown>,
  fieldNames: string[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const key of fieldNames) {
    const val = data[key];
    if (typeof val !== "string") continue;
    const result = sanitizeText(val);
    if (!result.ok) {
      fieldErrors[key] = result.error;
    } else {
      data[key] = result.value; // mutate in-place with trimmed value
    }
  }
  return fieldErrors;
}
