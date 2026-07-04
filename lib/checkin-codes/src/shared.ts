// ─── Client-safe check-in code helpers ──────────────────────────────────────
// No Node built-ins here — this module is imported by the browser bundle.
// Server-only generation/validation (which needs a secret + crypto) lives in
// ./server.ts.

/**
 * Confusion-safe alphabet: uppercase letters and digits with visually
 * ambiguous characters removed (O/0, I/1) so a code can be read off a
 * projector and typed without transcription errors.
 */
export const CHECKIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const CHECKIN_CODE_LENGTH = 6;

export const CHECKIN_ROTATE_SECONDS = 60;

/**
 * Strip whitespace, uppercase, and drop any characters outside the
 * confusion-safe alphabet. Applied to user-typed input before comparison so
 * stray spaces, lowercase input, or a mistaken "O" instead of "0" (etc.)
 * don't cause spurious check-in failures.
 */
export function normalizeCheckInCode(raw: string): string {
  return raw
    .toUpperCase()
    .split("")
    .filter((ch) => CHECKIN_CODE_ALPHABET.includes(ch))
    .join("");
}

/**
 * Build the HTTPS URL encoded into the presenter's QR code. A plain HTTPS
 * URL is used (not a custom `c100ops://` scheme) because most phone camera
 * apps only auto-open http(s) links from a scanned QR code. The page itself
 * handles routing a desktop-app user into the native shell if applicable.
 */
export function buildCheckInUrl(
  origin: string,
  eventId: number,
  code: string,
): string {
  return `${origin}/events/${eventId}?code=${encodeURIComponent(code)}`;
}
