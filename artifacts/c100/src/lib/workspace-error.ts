/**
 * queryErrorMessage — turn a workspace query error into a safe, user-facing message.
 *
 * Workspace queryFns should throw `new Error(String(r.status))` on failure and
 * also call `console.warn('[C100 Workspace]', path, 'HTTP', r.status)` for
 * diagnostics.  This function decodes the numeric status into a phrase suitable
 * for display in an ErrorBlock.
 *
 * Never surfaces stack traces, SQL, tokens, or internal paths.
 */
export function queryErrorMessage(error: unknown, context?: string): string {
  if (error instanceof Error) {
    const status = Number(error.message);
    if (Number.isFinite(status) && status >= 100) {
      switch (status) {
        case 401:
          return "Your session has expired. Please sign in again.";
        case 403:
          return context
            ? `You don't have permission to access this ${context}.`
            : "You don't have permission to perform this action.";
        case 404:
          return "This data is unavailable — the server may need to be updated.";
        case 409:
          return "A conflict occurred — this record may have already changed.";
        case 422:
          return "The server could not process this data. Please contact an administrator.";
        default:
          if (status >= 500) {
            return "A server error occurred. Please try again in a moment.";
          }
      }
    }
  }
  return context ? `Could not load ${context}.` : "Could not load data.";
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * workspaceApiError — turn a failed API Response into a safe, user-facing message.
 *
 * Priority:
 *  1. Structured `{ error: string }` body from the API — if present and safe to display
 *  2. HTTP-status-specific fallback phrase
 *
 * Never exposes stack traces, SQL, internal storage paths, or bearer tokens.
 */
export async function workspaceApiError(
  resp: Response,
  fallback?: string,
): Promise<string> {
  try {
    const body = (await resp.clone().json()) as { error?: unknown };
    if (
      typeof body.error === "string" &&
      body.error.length > 0 &&
      body.error.length < 300 &&
      // Reject messages that look like stack traces or SQL queries
      !/at Object\.|at async |Error:\s|SELECT\s|INSERT\s|UPDATE\s|DELETE\s/i.test(body.error)
    ) {
      return body.error;
    }
  } catch {
    // Non-JSON body — fall through to status-based message
  }

  switch (resp.status) {
    case 400:
      return "The submitted data was invalid — please check all required fields.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return "The requested record no longer exists.";
    case 409:
      return "A conflict occurred — this record may have already been changed.";
    case 413:
      return "The file is too large for this workspace.";
    case 415:
      return "This file type is not supported for this workspace.";
    case 422:
      return "The submitted data could not be processed — please check all required fields.";
    default:
      if (resp.status >= 500) {
        return "A server error occurred. Please try again in a moment.";
      }
      return fallback ?? `Request failed (HTTP ${resp.status}).`;
  }
}
