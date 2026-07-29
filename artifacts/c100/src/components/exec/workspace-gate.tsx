import { AppShell, PageHeader } from "@/components/app-shell";
import { ErrorBlock } from "@/components/page-states";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import type { ExecWorkspaceConfig } from "@/lib/exec-workspaces";

/**
 * Gates an Executive Suite workspace behind the matching org role (or, for
 * Technology, the Technology Chair / Platform Admin system role).
 *
 * Non-technology workspaces require the exact officer position.
 * Platform Admin (isAdmin) does NOT get automatic access to executive-content
 * workspaces (treasurer, secretary, etc.) — those hold confidential records.
 * Tech Chair retains oversight access to all workspaces for technical support.
 */
export function useExecWorkspaceAccess(workspace: ExecWorkspaceConfig) {
  const me = useMe();
  if (workspace.orgRole === null) {
    // Technology workspace: Tech Chair and Platform Admin both qualify
    return me.isTechChair || me.isAdmin;
  }
  // All other workspaces: only the specific position holder or Tech Chair
  return me.orgRoles.includes(workspace.orgRole) || me.isTechChair;
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
          message={`Only the ${workspace.label} officer, or an administrator, can view this workspace.`}
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
