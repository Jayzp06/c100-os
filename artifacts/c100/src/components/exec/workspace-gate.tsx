import { AppShell, PageHeader } from "@/components/app-shell";
import { ErrorBlock } from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import type { ExecWorkspaceConfig } from "@/lib/exec-workspaces";

/**
 * Gates an Executive Suite workspace using the permission-group declared on
 * the workspace config (`workspace.requiredPermission`).
 *
 * Access is granted if and only if the member's resolved permission set
 * contains the required permission. No role-name bypasses, no `orgRole`
 * string comparisons, no `isTechChair` / `isAdmin` special-cases.
 *
 * The President holds every officer permission explicitly in the RBAC matrix,
 * so he receives access to all officer workspaces through the union of his
 * permission set — without any dedicated bypass.
 *
 * The Technology workspace requires `view_system_diagnostics`, which is granted
 * only to the Technology Chair system role. Platform Admin does not hold this
 * permission and therefore cannot access the Executive Suite.
 */
export function useExecWorkspaceAccess(workspace: ExecWorkspaceConfig) {
  const me = useMe();
  return me.can(workspace.requiredPermission);
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
