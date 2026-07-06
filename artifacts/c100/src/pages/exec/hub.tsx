import { Link } from "wouter";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/lib/me";
import LoginPage from "@/pages/login";
import { ErrorBlock } from "@/components/page-states";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { useExecWorkspaceAccess } from "@/components/exec/workspace-gate";
import { Lock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ExecutiveSuiteHubPage() {
  const me = useMe();

  if (me.isLoading) return null;
  if (!me.isAuthenticated) return <LoginPage />;

  const hasAnyAccess = EXEC_WORKSPACES.some((w) =>
    w.orgRole ? me.orgRoles.includes(w.orgRole) : me.isTechChair,
  );

  if (!hasAnyAccess && !me.isAdmin && !me.isTechChair) {
    return (
      <AppShell>
        <PageHeader eyebrow="Executive Suite" title="Executive Suite" />
        <ErrorBlock
          title="No executive workspace assigned"
          message="You don't currently hold an executive board or appointed officer position. Contact an administrator if this seems wrong."
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Executive Suite"
        title="Executive Board Platform"
        description="Role-based workspaces for each executive board and appointed officer position."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXEC_WORKSPACES.map((w) => (
          <WorkspaceCard key={w.slug} workspace={w} />
        ))}
      </div>
    </AppShell>
  );
}

function WorkspaceCard({ workspace }: { workspace: (typeof EXEC_WORKSPACES)[number] }) {
  const hasAccess = useExecWorkspaceAccess(workspace);
  const Icon = workspace.icon;

  const content = (
    <Card
      className={cn(
        "h-full transition-colors",
        hasAccess ? "hover:border-[hsl(var(--primary)/0.4)]" : "opacity-60",
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--accent))]">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </span>
          {workspace.label}
          {hasAccess ? (
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          ) : (
            <Lock className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--secondary))]">
          {workspace.eyebrow}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{workspace.description}</p>
      </CardContent>
    </Card>
  );

  if (!hasAccess) {
    return <div data-testid={`exec-card-${workspace.slug}`}>{content}</div>;
  }

  return (
    <Link href={`/exec/${workspace.slug}`} data-testid={`exec-card-${workspace.slug}`}>
      {content}
    </Link>
  );
}
