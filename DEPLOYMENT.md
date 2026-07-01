# C100 Operations Platform — Deployment Targets

Four deployment targets. No changes to business logic between them.
All targets consume the same Express API at `artifacts/api-server`.

---

## Target 1 — Local Development

Runs entirely on localhost. No cloud services required.

```bash
# Start both services (two terminals, or use the Replit workflow buttons)
pnpm --filter @workspace/api-server run dev   # API on :8080 → proxied at /api
pnpm --filter @workspace/c100 run dev         # Web on :23873 → proxied at /
```

The shared proxy at `localhost:80` routes `/api` to the API server and `/` to the web app.

---

## Target 2 — Cloud Web Deployment (Replit)

Deploy via Replit's publish button. The API server runs as an Express service;
the React frontend is served as static files.

**Build:**
```bash
PORT=23873 BASE_PATH=/ pnpm --filter @workspace/c100 run build
# Output: artifacts/c100/dist/public/
```

**Environment variables required in production:**
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — session signing key (≥32 random bytes)

---

## Target 3 — Native Desktop Packaging (Tauri 2.0)

Produces signed native installers for macOS and Windows via GitHub Actions CI.
No Rust toolchain is required in the Replit development environment.

### Prerequisites (one-time setup)

#### 1. Generate a Tauri signing key pair

```bash
# Install Tauri CLI locally (requires Rust)
cargo install tauri-cli --version "^2"

# Generate key pair — save the output
tauri signer generate -w ~/.tauri/c100-operations.key
```

#### 2. Configure GitHub repository secrets

| Secret | Description |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of the generated `.key` file |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password chosen during key generation |
| `APPLE_CERTIFICATE` | Base64-encoded Developer ID Application .p12 |
| `APPLE_CERTIFICATE_PASSWORD` | .p12 export password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: FVSU (TEAMID)` |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_ID_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID |

Windows signing is optional for internal distribution. Add a code-signing
certificate via `WINDOWS_CERTIFICATE` + `WINDOWS_CERTIFICATE_PASSWORD` if required.

#### 3. Configure the updater endpoint

Update `tauri.conf.json` → `plugins.updater.endpoints` with your update server URL,
and set `plugins.updater.pubkey` to the public key output from step 1.

A Cloudflare R2 bucket or GitHub Releases JSON are both valid update endpoints.
`tauri-apps/tauri-action` generates the updater JSON automatically on each release.

#### 4. Generate app icons

Provide a single 1024×1024 source PNG and run:

```bash
cd artifacts/c100-desktop
pnpm tauri icon path/to/icon-1024.png
```

This populates `src-tauri/icons/` with all required sizes.

### Releasing

Tag the commit and push:

```bash
git tag v0.2.0
git push --tags
```

GitHub Actions (`desktop-release.yml`) triggers automatically and publishes:
- `C100-Operations_0.2.0_universal.dmg` (macOS — Intel + Apple Silicon)
- `C100-Operations_0.2.0_x64-setup.exe` / `.msi` (Windows)
- `latest.json` updater manifest (auto-update endpoint)

Releases land as **draft** by default. Review and publish from the GitHub Releases page.

### Local desktop development (requires Rust on your machine)

```bash
# Install Rust: https://rustup.rs
cd artifacts/c100-desktop

# Start Vite dev server first (in a separate terminal)
pnpm --filter @workspace/c100 run dev

# Then launch the Tauri desktop shell (points to localhost:23873)
pnpm dev
```

DevTools open automatically in debug builds.

---

## Target 4 — Future Mobile Client

Two paths are available without any business logic changes.

### Path A — Tauri Mobile (iOS + Android) — recommended

Tauri 2.0 ships iOS and Android targets from the same `c100-desktop` package.

```bash
# Add iOS target (macOS only)
rustup target add aarch64-apple-ios

# Add Android targets
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

# iOS development
pnpm --filter @workspace/c100-desktop run tauri ios dev

# Android development
pnpm --filter @workspace/c100-desktop run tauri android dev
```

The same React frontend (`artifacts/c100`) renders inside the mobile WebView.
Native capabilities (notifications, deep links) work identically on mobile.

### Path B — Expo React Native (separate codebase)

Use the Replit Expo artifact scaffold for a fully native React Native app.
Shares the same API server; requires a separate frontend codebase.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                    Shared API Layer                      │
│          artifacts/api-server  (Express 5 + Drizzle)    │
│           Business logic lives here and only here.      │
└─────────────────┬───────────────────────────────────────┘
                  │  HTTP (same endpoints, all targets)
       ┌──────────┼──────────┬──────────────────┐
       │          │          │                  │
  ┌────▼────┐ ┌───▼────┐ ┌──▼──────┐  ┌───────▼──────┐
  │  Web    │ │Desktop │ │  iOS    │  │   Android    │
  │ (Vite)  │ │(Tauri) │ │(Tauri)  │  │  (Tauri)     │
  │artifacts│ │wraps   │ │wraps    │  │  wraps       │
  │  /c100  │ │ /c100  │ │  /c100  │  │    /c100     │
  └─────────┘ └────────┘ └─────────┘  └──────────────┘
      ↕            ↕
  Replit       GitHub Actions
  Deploy       CI/CD Pipeline
```

One frontend codebase. One API. Four distribution channels.
