import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { ComingSoonCard, StatGrid } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { useListMembers, useGetOrgSettings } from "@workspace/api-client-react";
import { LoadingBlock, ErrorBlock } from "@/components/page-states";
import { Users, UserCheck, DollarSign } from "lucide-react";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "treasurer")!;

export default function TreasurerWorkspacePage() {
  const { data: members, isLoading, error } = useListMembers();
  const { data: org } = useGetOrgSettings();

  const list = Array.isArray(members) ? members : [];
  const activeCount = list.filter((m) => m.membershipStatus === "Active").length;
  const duesAmount = org ? (org.duesAmountCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  }) : "—";

  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message="Could not load membership roster." />
        ) : (
          <StatGrid
            stats={[
              { label: "Active Members", value: activeCount, icon: UserCheck },
              { label: "Total Members", value: list.length, icon: Users },
              { label: "Dues Amount", value: duesAmount, icon: DollarSign },
            ]}
          />
        )}

        <ComingSoonCard
          title="Dues Tracking & Financial Ledger"
          description="Track member dues payments, chapter expenses, and budget line items. Will integrate with chapter payment records once finance infrastructure ships."
        />
        <ComingSoonCard
          title="Financial Reports"
          description="Generate treasurer's reports for executive board and university financial review."
        />
      </div>
    </ExecWorkspaceShell>
  );
}
