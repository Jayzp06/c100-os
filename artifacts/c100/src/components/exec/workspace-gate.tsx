import { AppShell, PageHeader } from "@/components/app-shell";
import { ErrorBlock } from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import type { ExecWorkspaceConfig } from "@/lib/exec-workspaces";

/**
 * Gates an Executive Suite workspace behind the exact org role required for
 * that workspace, or the Technology Chair system role for the Technology workspace.
 *
 * Rules enforced here:
 *  - Technology workspace (orgRole === null): only Technology Chair qualifies.
 *    Platform Admin does NOT get automatic access to any executive workspace.
 *  - All other workspaces: only the holder of the exact officer org-role qualifies.
 *    No blanket bypass for Tech Chair, Platform Admin, or any other system role.
 *
 * These rules mirror the RBAC matrix in rbac-matrix.ts: every tool is locked to
 * the position that holds the corresponding permission group.
 */
export function useExecWorkspaceAccess(workspace: ExecWorkspaceConfig) {
  const me = useMe();
  if (workspace.orgRole === null) {
    // Technology workspace: Technology Chair only.
    return me.isTechChair;
  }
  // All other workspaces: the exact position holder only.
  return me.orgRoles.includes(workspace.orgRole);
}

export function ExecWorkspaceShell({
  workspace,
  children,
}: {
  workspace: ExecWorkspaceConfig;
  children: React.ReactNode;
}) {
  const me = useMe();
  const hasAccess = useExecWorkspaceAccess(workspace);

  if (me.isLoading) return null;
  if (!me.isAuthenticated) return <LoginPage />;

  if (!hasAccess) {
    return (
      <AppShell>
        <PageHeader eyebrow={workspace.eyebrow} title={workspace.label} />
        <ErrorBlock
          title="Restricted workspace"
          message={`This workspace is reserved for the ${workspace.label} officer. Contact an administrator if you believe this is an error.`}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow={workspace.eyebrow}
        title={`${workspace.label} Workspace`}
        description={workspace.description}
      />
      {children}
    </AppShell>
  );
}
