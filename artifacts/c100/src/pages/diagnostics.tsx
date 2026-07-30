import { useEffect, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/me";
import { IS_TAURI, DESKTOP_API_URL, getStoredToken } from "@/lib/desktop-auth";
import { getDesktopMetadata, type AppMetadata } from "@/lib/desktop-info";
import { LoadingBlock } from "@/components/page-states";
import { Pill } from "@/components/badges";
import LoginPage from "@/pages/login";
import { RefreshCw, Monitor, CheckCircle2, AlertCircle, WifiOff, ShieldOff, ServerCrash, FileWarning, Lock } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EndpointCategory =
  | "healthy"
  | "network_unreachable"
  | "not_found"
  | "unauthenticated"
  | "forbidden"
  | "server_error"
  | "schema_mismatch";

interface ProbeResult {
  path: string;
  fullUrl: string;
  status: number | null;
  durationMs: number;
  receivedResponse: boolean;
  category: EndpointCategory;
  timestamp: string;
  /** Non-sensitive context to help diagnose the issue */
  detail?: string;
}

// ---------------------------------------------------------------------------
// Probe logic
// ---------------------------------------------------------------------------

/** Return the API base URL with no trailing slash, or "" for relative (web). */
function getApiBase(): string {
  return DESKTOP_API_URL ?? "";
}

/** Fields required for each endpoint to be considered schema-valid */
const REQUIRED_FIELDS: Record<string, string[]> = {
  "/api/health":               ["status"],
  "/api/system/info":          ["version", "environment"],
  "/api/system/diagnostics":   ["api", "database"],
  "/api/me":                   ["id"],
};

/**
 * Endpoints that require authentication.
 * /api/health is intentionally excluded — it is always unauthenticated.
 */
const AUTHENTICATED_PATHS = new Set([
  "/api/me",
  "/api/system/info",
  "/api/system/diagnostics",
]);

function classifyStatus(status: number): EndpointCategory {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status >= 500) return "server_error";
  return "healthy"; // 2xx/3xx that didn't meet schema — caller upgrades to schema_mismatch
}

async function probeEndpoint(path: string): Promise<ProbeResult> {
  const base = getApiBase();
  const fullUrl = `${base}${path}`;
  const timestamp = new Date().toISOString();
  const t0 = performance.now();

  let status: number | null = null;
  let receivedResponse = false;
  let category: EndpointCategory = "network_unreachable";
  let detail: string | undefined;

  // Build request headers — authenticated endpoints attach the desktop bearer
  // token when running in Tauri. Web sessions rely on cookies (credentials:include).
  const headers: Record<string, string> = {};
  if (AUTHENTICATED_PATHS.has(path) && IS_TAURI) {
    const token = getStoredToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  try {
    const res = await fetch(fullUrl, {
      method: "GET",
      credentials: "include",
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    const durationMs = Math.round(performance.now() - t0);
    receivedResponse = true;
    status = res.status;
    category = classifyStatus(res.status);

    // For healthy responses, validate expected shape
    if (category === "healthy") {
      const required = REQUIRED_FIELDS[path];
      if (required && required.length > 0) {
        try {
          const body = await res.json();
          const missing = required.filter(
            (k) => body == null || typeof body !== "object" || !(k in body),
          );
          if (missing.length > 0) {
            category = "schema_mismatch";
            detail = `Missing expected fields: ${missing.join(", ")}`;
          }
        } catch {
          category = "schema_mismatch";
          detail = "Response body is not valid JSON";
        }
      }
    } else {
      // For non-2xx, try to extract a safe server message (no stack traces)
      try {
        const body = await res.json();
        if (body && typeof body === "object") {
          const msg =
            (body as Record<string, unknown>).message ??
            (body as Record<string, unknown>).error ??
            (body as Record<string, unknown>).detail;
          if (typeof msg === "string") {
            detail = msg.slice(0, 200);
          }
        }
      } catch {
        // ignore parse failures on error responses
      }
    }

    return { path, fullUrl, status, durationMs, receivedResponse, category, timestamp, detail };
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - t0);
    if (err instanceof DOMException && err.name === "TimeoutError") {
      detail = "Request timed out (10 s)";
    } else if (err instanceof TypeError) {
      // Network/CORS/DNS error — safe to surface the message type, not full stack
      detail = "Network error — DNS, connection refused, or CORS";
    }
    return {
      path,
      fullUrl,
      status: null,
      durationMs,
      receivedResponse: false,
      category: "network_unreachable",
      timestamp,
      detail,
    };
  }
}

async function runAllProbes(): Promise<ProbeResult[]> {
  return Promise.all([
    probeEndpoint("/api/health"),
    probeEndpoint("/api/system/info"),
    probeEndpoint("/api/system/diagnostics"),
    probeEndpoint("/api/me"),
  ]);
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABEL: Record<EndpointCategory, string> = {
  healthy:           "Healthy",
  network_unreachable: "Unreachable",
  not_found:         "Not Found",
  unauthenticated:   "Unauthenticated",
  forbidden:         "Forbidden",
  server_error:      "Server Error",
  schema_mismatch:   "Schema Mismatch",
};

const CATEGORY_TONE: Record<EndpointCategory, "success" | "warning" | "danger" | "neutral"> = {
  healthy:           "success",
  network_unreachable: "danger",
  not_found:         "danger",
  unauthenticated:   "warning",
  forbidden:         "warning",
  server_error:      "danger",
  schema_mismatch:   "warning",
};

const CATEGORY_ICON: Record<EndpointCategory, React.ReactNode> = {
  healthy:           <CheckCircle2 className="h-4 w-4 text-green-500" />,
  network_unreachable: <WifiOff className="h-4 w-4 text-red-500" />,
  not_found:         <AlertCircle className="h-4 w-4 text-red-500" />,
  unauthenticated:   <Lock className="h-4 w-4 text-amber-500" />,
  forbidden:         <ShieldOff className="h-4 w-4 text-amber-500" />,
  server_error:      <ServerCrash className="h-4 w-4 text-red-500" />,
  schema_mismatch:   <FileWarning className="h-4 w-4 text-amber-500" />,
};

const ENDPOINT_DESCRIPTION: Record<string, string> = {
  "/api/health":             "Unauthenticated health check — verifies server is reachable",
  "/api/system/info":        "Application metadata — requires authentication",
  "/api/system/diagnostics": "API + database status — requires tech-chair or admin role",
  "/api/me":                 "Session profile — verifies authentication (bearer token on desktop, cookie on web)",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-all">{value}</dd>
    </div>
  );
}

function ProbeCard({ result }: { result: ProbeResult }) {
  const tone = CATEGORY_TONE[result.category];
  const icon = CATEGORY_ICON[result.category];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {icon}
          <code className="font-mono text-sm">{result.path}</code>
          <Pill tone={tone}>{CATEGORY_LABEL[result.category]}</Pill>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          {ENDPOINT_DESCRIPTION[result.path]}
        </p>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row label="URL" value={result.fullUrl || "(relative)"} />
          <Row
            label="HTTP Status"
            value={
              result.status != null
                ? String(result.status)
                : "No response"
            }
          />
          <Row label="Duration" value={`${result.durationMs} ms`} />
          <Row
            label="Response received"
            value={result.receivedResponse ? "Yes" : "No"}
          />
          <Row label="Checked at" value={new Date(result.timestamp).toLocaleTimeString()} />
          {result.detail && (
            <div className="sm:col-span-2">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Detail
              </dt>
              <dd className="text-sm text-muted-foreground">{result.detail}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DiagnosticsPage() {
  const me = useMe();
  const [results, setResults] = useState<ProbeResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [meta, setMeta] = useState<AppMetadata | null>(null);
  const runIdRef = useRef(0);

  const runProbes = () => {
    const runId = ++runIdRef.current;
    setRunning(true);
    runAllProbes().then((probes) => {
      if (runIdRef.current === runId) {
        setResults(probes);
        setRunning(false);
      }
    });
  };

  useEffect(() => {
    runProbes();
    getDesktopMetadata().then(setMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (me.isLoading) return null;
  if (!me.isAuthenticated) return <LoginPage />;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Desktop"
        title="Diagnostics"
        description="Independent connectivity check for each API endpoint."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={runProbes}
            disabled={running}
          >
            <RefreshCw
              className={"mr-1.5 h-3.5 w-3.5" + (running ? " animate-spin" : "")}
            />
            Re-run checks
          </Button>
        }
      />

      <div className="space-y-4">
        {running && !results ? (
          <LoadingBlock label="Running diagnostics" />
        ) : results ? (
          results.map((r) => <ProbeCard key={r.path} result={r} />)
        ) : null}

        {/* Show spinner overlay on subsequent runs without hiding existing results */}
        {running && results && (
          <p className="text-xs text-muted-foreground text-center py-1 animate-pulse">
            Re-running checks…
          </p>
        )}

        {IS_TAURI && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                Local Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meta ? (
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <Row label="App version" value={meta.appVersion ?? "Unknown"} />
                  <Row
                    label="Operating system"
                    value={`${meta.osType ?? "Unknown"} ${meta.osVersion ?? ""}`}
                  />
                  <Row label="Architecture" value={meta.arch ?? "Unknown"} />
                  <Row
                    label="API base URL"
                    value={DESKTOP_API_URL ?? "(relative — not set)"}
                  />
                </dl>
              ) : (
                <LoadingBlock label="Reading local system info" />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
