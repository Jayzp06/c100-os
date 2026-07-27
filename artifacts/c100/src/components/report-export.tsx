import { Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IS_TAURI, DESKTOP_API_URL } from "@/lib/desktop-auth";

const DESKTOP_TOKEN_KEY = "c100-desktop-token";

/**
 * Downloads a report file in the Tauri desktop app by fetching it with the
 * stored Bearer token and triggering a blob download — plain `<a href>` links
 * don't carry auth headers or resolve against the production API in Tauri.
 */
async function downloadInTauri(url: string, format: string) {
  const token = localStorage.getItem(DESKTOP_TOKEN_KEY);
  const fullUrl = `${DESKTOP_API_URL}${url}`;
  try {
    const resp = await fetch(fullUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) {
      console.error(`[C100 Export] Download failed: ${resp.status} ${resp.statusText}`);
      return;
    }
    const blob = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    const disp = resp.headers.get("Content-Disposition") ?? "";
    const match = disp.match(/filename[^;=\n]*=(["']?)([^"'\n;]+)\1/);
    a.download = match?.[2] ?? `report.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (err) {
    console.error("[C100 Export] Download error:", err);
  }
}

/**
 * Reusable export menu for any report endpoint that supports
 * `?format=csv|xlsx|pdf` (see artifacts/api-server/src/lib/export.ts).
 *
 * On the web the browser handles downloads natively via the server's
 * `Content-Disposition: attachment` header. In the Tauri desktop app, plain
 * anchor tags won't carry the Bearer token and resolve against the wrong
 * origin, so we fetch manually and create a blob download URL.
 */
export function ReportExportMenu({
  endpoint,
  label = "Export",
}: {
  endpoint: string;
  label?: string;
}) {
  const withFormat = (format: "csv" | "xlsx" | "pdf") => {
    const sep = endpoint.includes("?") ? "&" : "?";
    return `${endpoint}${sep}format=${format}`;
  };

  const handleDownload = (format: "csv" | "xlsx" | "pdf") => {
    if (IS_TAURI) {
      downloadInTauri(withFormat(format), format);
    } else {
      // Web: anchor navigation — session cookie is sent automatically and the
      // server streams the file with Content-Disposition: attachment.
      const a = document.createElement("a");
      a.href = withFormat(format);
      a.click();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-export-report">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleDownload("csv")}
          data-testid="link-export-csv"
        >
          <Table2 className="mr-2 h-4 w-4" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleDownload("xlsx")}
          data-testid="link-export-xlsx"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleDownload("pdf")}
          data-testid="link-export-pdf"
        >
          <FileText className="mr-2 h-4 w-4" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
