import { Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Reusable export menu for any report endpoint that supports
 * `?format=csv|xlsx|pdf` (see artifacts/api-server/src/lib/export.ts).
 * Uses plain anchor tags so the browser handles the download natively
 * from the server's `Content-Disposition: attachment` header.
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-export-report">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={withFormat("csv")} data-testid="link-export-csv">
            <Table2 className="mr-2 h-4 w-4" />
            CSV
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={withFormat("xlsx")} data-testid="link-export-xlsx">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel (.xlsx)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={withFormat("pdf")} data-testid="link-export-pdf">
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
