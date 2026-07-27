/**
 * Desktop-only helpers for the About, Release Notes, Updates, and Diagnostics
 * pages. All Tauri plugin imports are dynamic so this module is safe to
 * import from web builds — every export just no-ops or returns null when
 * `IS_TAURI` is false.
 */

import { IS_TAURI } from "@/lib/desktop-auth";

export type AppMetadata = {
  appVersion: string | null;
  tauriVersion: string | null;
  osType: string | null;
  osVersion: string | null;
  arch: string | null;
};

export async function getDesktopMetadata(): Promise<AppMetadata> {
  if (!IS_TAURI) {
    return {
      appVersion: null,
      tauriVersion: null,
      osType: null,
      osVersion: null,
      arch: null,
    };
  }

  try {
    const [{ getVersion, getTauriVersion }, os] = await Promise.all([
      import("@tauri-apps/api/app"),
      import("@tauri-apps/plugin-os"),
    ]);

    const [appVersion, tauriVersion] = await Promise.all([
      getVersion(),
      getTauriVersion(),
    ]);

    return {
      appVersion,
      tauriVersion,
      osType: os.type(),
      osVersion: os.version(),
      arch: os.arch(),
    };
  } catch (err) {
    console.error("[C100 Desktop] Failed to read app metadata:", err);
    return {
      appVersion: null,
      tauriVersion: null,
      osType: null,
      osVersion: null,
      arch: null,
    };
  }
}

export type UpdateCheckResult =
  | { status: "up-to-date" }
  | { status: "available"; version: string; date?: string; body?: string }
  /**
   * The updater reached the endpoint but found no published (non-draft) release.
   * This is not an error — it means the server responded and there is simply
   * nothing to install yet.
   */
  | { status: "release-not-configured"; message: string }
  /**
   * A network, DNS, TLS, timeout, or remote availability failure prevented the
   * check from completing. Do NOT treat this as "up-to-date".
   */
  | { status: "connection-error"; message: string }
  /**
   * The manifest was retrieved but failed signature or parse validation.
   */
  | { status: "verification-error"; message: string }
  /** Any other unexpected error during the update check. */
  | { status: "error"; message: string };

/**
 * Wraps `@tauri-apps/plugin-updater`'s `check()`. Returns a discriminated
 * result instead of throwing so the Updates page can render every outcome
 * (no update / update available / error) without a try/catch at the call
 * site.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!IS_TAURI) {
    return { status: "error", message: "Updates are only available in the desktop app." };
  }
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return { status: "up-to-date" };
    return {
      status: "available",
      version: update.version,
      date: update.date,
      body: update.body,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // --- Connection / network failure ----------------------------------------
    // These mean we never reached the update server, so we do NOT know whether
    // the installed version is current. Never return "up-to-date" here.
    if (
      /failed to fetch|network\s+error|net::|timeout|ECONNREFUSED|ECONNRESET|ERR_INTERNET|ERR_NAME_NOT_RESOLVED|dns|tls\b|ssl\b|certificate/i.test(
        msg,
      )
    ) {
      return {
        status: "connection-error",
        message:
          "Could not reach the update server. Check your internet connection and try again.",
      };
    }

    // --- No published release (manifest 404) ---------------------------------
    // The Tauri updater throws when the manifest URL returns a 4xx, which
    // happens when no non-draft GitHub release has been published yet.
    // The server responded successfully — there is simply nothing to install.
    if (
      /\b404\b|no release|no published|not found|does not exist|resource not found/i.test(
        msg,
      )
    ) {
      return {
        status: "release-not-configured",
        message:
          "No release has been published for this channel yet. You are on the latest build.",
      };
    }

    // --- Manifest signature or parse failure ----------------------------------
    if (
      /signature|invalid manifest|malformed|deserializ|failed to parse|json\s+parse/i.test(
        msg,
      )
    ) {
      return {
        status: "verification-error",
        message:
          "The update manifest could not be verified. Contact your system administrator.",
      };
    }

    // --- Everything else -----------------------------------------------------
    return {
      status: "error",
      message: msg || "Could not check for updates.",
    };
  }
}

export type InstallProgress = {
  phase: "idle" | "downloading" | "installing" | "done" | "error";
  downloaded: number;
  total: number | null;
  message?: string;
};

/**
 * Downloads and installs the pending update, reporting byte-level progress
 * via `onProgress`. Caller is responsible for relaunching the app afterwards
 * (see `relaunchApp`) — installing does not restart automatically so the
 * user can be shown a confirmation step first.
 */
export async function downloadAndInstallUpdate(
  onProgress: (progress: InstallProgress) => void,
): Promise<void> {
  if (!IS_TAURI) throw new Error("Updates are only available in the desktop app.");
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) throw new Error("No update is currently available.");

  let downloaded = 0;
  let total: number | null = null;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? null;
        onProgress({ phase: "downloading", downloaded: 0, total });
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress({ phase: "downloading", downloaded, total });
        break;
      case "Finished":
        onProgress({ phase: "installing", downloaded, total });
        break;
    }
  });

  onProgress({ phase: "done", downloaded, total });
}

export async function relaunchApp(): Promise<void> {
  if (!IS_TAURI) return;
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
