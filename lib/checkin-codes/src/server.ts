import { createHmac } from "node:crypto";
import {
  CHECKIN_CODE_ALPHABET,
  CHECKIN_CODE_LENGTH,
  CHECKIN_ROTATE_SECONDS,
  normalizeCheckInCode,
} from "./shared";

// ─── Server-only check-in code generation/validation ────────────────────────
// Requires a server-only secret and Node's crypto module — never import this
// from browser-bundled code. The client only needs ./shared.ts.

function currentWindow(rotateSeconds: number, at: number = Date.now()): number {
  return Math.floor(at / (rotateSeconds * 1000));
}

function codeForWindow(
  eventId: number,
  window: number,
  secret: string,
): string {
  const digest = createHmac("sha256", secret)
    .update(`${eventId}.${window}`)
    .digest();

  let code = "";
  for (let i = 0; i < CHECKIN_CODE_LENGTH; i++) {
    code += CHECKIN_CODE_ALPHABET[digest[i]! % CHECKIN_CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Generate the current rotating code for an event, plus when it expires.
 * `secret` should be the server's session secret (or any stable server-only
 * value) — never expose it to the client.
 */
export function generateCheckInCode(
  eventId: number,
  secret: string,
  rotateSeconds: number = CHECKIN_ROTATE_SECONDS,
): { code: string; expiresAt: Date } {
  const window = currentWindow(rotateSeconds);
  const code = codeForWindow(eventId, window, secret);
  const expiresAt = new Date((window + 1) * rotateSeconds * 1000);
  return { code, expiresAt };
}

/**
 * Validate a (normalized) candidate code against the current window and the
 * immediately preceding one, giving members up to `rotateSeconds` extra
 * grace after a code rotates off the display.
 */
export function isValidCheckInCode(
  eventId: number,
  candidate: string,
  secret: string,
  rotateSeconds: number = CHECKIN_ROTATE_SECONDS,
): boolean {
  const normalized = normalizeCheckInCode(candidate);
  if (normalized.length !== CHECKIN_CODE_LENGTH) return false;
  const window = currentWindow(rotateSeconds);
  for (const w of [window, window - 1]) {
    if (normalized === codeForWindow(eventId, w, secret)) return true;
  }
  return false;
}
