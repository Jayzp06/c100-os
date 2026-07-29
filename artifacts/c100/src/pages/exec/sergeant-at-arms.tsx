import { ExecWorkspaceShell } from "@/components/exec/workspace-gate";
import { ComingSoonCard } from "@/components/exec/shared";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";

const workspace = EXEC_WORKSPACES.find((w) => w.slug === "sergeant-at-arms")!;

export default function SergeantAtArmsWorkspacePage() {
  return (
    <ExecWorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        <ComingSoonCard
          title="Formal Conduct Records"
          description="Log and track formal conduct proceedings and meeting-order enforcement for the chapter."
        />
        <ComingSoonCard
          title="Meeting Order Log"
          description="Record procedural rulings, points of order, and meeting-order enforcement actions."
        />
      </div>
    </ExecWorkspaceShell>
  );
}
