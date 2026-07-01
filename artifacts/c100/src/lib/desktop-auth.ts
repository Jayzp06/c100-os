/**
 * Desktop-specific auth for the Tauri build.
 *
 * Detection: Tauri 2 always injects `__TAURI_INTERNALS__` into `window`, so
 * `IS_TAURI` is the reliable runtime check.
 *
 * Flow:
 *   1. App startup  → initDesktop() sets setBaseUrl + setAuthTokenGetter.
 *   2. No token     → login page calls startDesktopLogin(), system browser opens.
 *   3. Server OIDC  → /api/desktop-auth/login → Replit OIDC → /api/desktop-auth/callback
 *                     → redirects to c100ops://auth?token=<session_id>
 *   4. Deep-link    → listenForDesktopAuthCallback() stores token, reloads app.
 *   5. Next launch  → initDesktop() re-registers getter; useAuth fetches /api/auth/user
 *                     with Bearer token, sees existing session.
 *   6. Logout       → desktopLogout() clears token, calls /api/mobile-auth/logout, reloads.
 */

import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

export const IS_TAURI =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const DESKTOP_API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ??
  null;

const TOKEN_KEY = "c100-desktop-token";

// ---------------------------------------------------------------------------
// Token storage (localStorage, cleared on explicit logout only)
// ---------------------------------------------------------------------------

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveDesktopToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearDesktopToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Initialisation — call once at module scope in App.tsx before any renders
// ---------------------------------------------------------------------------

export function initDesktop(): void {
  if (!IS_TAURI) return;

  if (!DESKTOP_API_URL) {
    throw new Error(
      "[C100 Desktop] VITE_API_URL is required in desktop builds.\n" +
        "Add it to GitHub Actions repository secrets and rebuild the installer.",
    );
  }

  setBaseUrl(DESKTOP_API_URL);
  setAuthTokenGetter(getStoredToken);
}

// ---------------------------------------------------------------------------
// Login — open the system browser to start the server-side OIDC + PKCE flow
// ---------------------------------------------------------------------------

export async function startDesktopLogin(): Promise<void> {
  if (!DESKTOP_API_URL) return;
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(`${DESKTOP_API_URL}/api/desktop-auth/login`);
}

// ---------------------------------------------------------------------------
// Deep-link callback listener
// After successful OIDC, the server redirects to c100ops://auth?token=<sid>.
// This listener captures that token, stores it, and reloads the app so the
// normal useAuth flow picks it up with the Bearer token attached.
// ---------------------------------------------------------------------------

export async function listenForDesktopAuthCallback(): Promise<() => void> {
  const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
  return onOpenUrl((urls) => {
    for (const url of urls) {
      try {
        const parsed = new URL(url);
        if (!url.startsWith("c100ops://auth")) continue;
        const token = parsed.searchParams.get("token");
        if (token) {
          saveDesktopToken(token);
          setAuthTokenGetter(getStoredToken);
          window.location.reload();
          return;
        }
        const error = parsed.searchParams.get("error");
        if (error) {
          console.error("[C100 Desktop] Auth error:", error);
          return;
        }
      } catch {
        // ignore malformed URLs
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Logout — clear token, notify server, reload
// ---------------------------------------------------------------------------

export async function desktopLogout(): Promise<void> {
  const token = getStoredToken();
  clearDesktopToken();

  if (token && DESKTOP_API_URL) {
    try {
      await fetch(`${DESKTOP_API_URL}/api/mobile-auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // best-effort — clear locally regardless
    }
  }

  window.location.reload();
}
