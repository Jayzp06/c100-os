import { Link, useLocation } from "wouter";
import { useGetOrgSettings } from "@workspace/api-client-react";
import { useMe } from "@/lib/me";
import { EXEC_WORKSPACES } from "@/lib/exec-workspaces";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IS_TAURI, desktopLogout } from "@/lib/desktop-auth";
import {
  LayoutDashboard,
  UserCircle2,
  Users,
  Layers3,
  Trophy,
  CalendarDays,
  ClipboardCheck,
  LogOut,
  Menu,
  ChevronRight,
  Settings2,
  X,
  ArrowLeftRight,
  RefreshCw,
  Briefcase,
  Info,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEndImpersonation,
  getGetMyProfileQueryKey,
  type Member,
} from "@workspace/api-client-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const EXPERIENCE_LABELS: Record<Member["experience"], string> = {
  operations_console: "Operations Console",
  committee_portal: "Committee Portal",
  member_portal: "Member View",
};

/**
 * Lets a member holding more than one experience tier (e.g. an exec board
 * member who is also a committee chair) jump between the views they
 * legitimately hold. Hidden entirely when a member only holds one experience.
 * Distinct from Tech Chair impersonation, which simulates a role NOT held.
 */
function ExperienceSwitcher({ className }: { className?: string }) {
  const me = useMe();

  if (me.impersonating) return null;
  if (me.availableExperiences.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5 text-xs", className)}
          data-testid="button-experience-switcher"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {me.experience ? EXPERIENCE_LABELS[me.experience] : "Switch view"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Switch view
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {me.availableExperiences.map((exp) => (
          <DropdownMenuItem
            key={exp}
            disabled={exp === me.experience || me.isSwitchingExperience}
            onClick={() => me.switchExperience(exp)}
            data-testid={`option-experience-${exp}`}
          >
            {EXPERIENCE_LABELS[exp]}
            {exp === me.experience && (
              <span className="ml-auto text-[10px] text-muted-foreground">
                Current
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Manual refresh affordance for the 30s staleTime / 24h offline cache. Some
 * users (chairs at a live event, admins right after an edit elsewhere) need
 * to force a refetch of everything on screen rather than wait for the
 * background staleTime to elapse or the page to remount.
 */
function RefreshButton({ className }: { className?: string }) {
  const qc = useQueryClient();
  const [spinning, setSpinning] = useState(false);

  async function handleRefresh() {
    setSpinning(true);
    try {
      await qc.invalidateQueries();
    } finally {
      window.setTimeout(() => setSpinning(false), 400);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleRefresh}
      className={className}
      aria-label="Refresh data"
      data-testid="button-refresh"
    >
      <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} />
    </Button>
  );
}

function LogoutButton({ className }: { className?: string }) {
  if (IS_TAURI) {
    return (
      <button
        onClick={() => desktopLogout()}
        className={className}
        data-testid="button-logout"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    );
  }
  return (
    <a href="/api/logout" className={className} data-testid="button-logout">
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </a>
  );
}

type NavContext = {
  isLeader: boolean;
  isExecOrAdmin: boolean;
  isTechChair: boolean;
  isChair: boolean;
  hasExecWorkspace: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show: (ctx: NavContext) => boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, show: () => true },
  { href: "/events", label: "Events", icon: CalendarDays, show: () => true },
  {
    href: "/committees",
    label: "Committees",
    icon: Layers3,
    show: () => true,
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    show: () => true,
  },
  {
    href: "/members",
    label: "Members",
    icon: Users,
    show: ({ isLeader }) => isLeader,
  },
  {
    href: "/reports",
    label: "Reports",
    icon: ClipboardCheck,
    show: ({ isExecOrAdmin, isChair }) => isExecOrAdmin || isChair,
  },
  {
    href: "/exec",
    label: "Executive Suite",
    icon: Briefcase,
    show: ({ hasExecWorkspace }) => hasExecWorkspace,
  },
  {
    href: "/tech",
    label: "System",
    icon: Settings2,
    show: ({ isTechChair }) => isTechChair,
  },
  {
    href: "/about",
    label: "About",
    icon: Info,
    show: () => true,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: UserCircle2,
    show: () => true,
  },
];

export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  const { data: org } = useGetOrgSettings();
  return (
    <Link href="/" className="flex items-center gap-2.5 group min-w-0">
      <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] shadow-sm">
        <span className="font-display text-sm font-bold tracking-tight leading-none">
          C
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-3 w-3.5 items-center justify-center rounded-sm bg-[hsl(var(--sidebar))] border border-[hsl(var(--sidebar-border))] text-[7px] font-bold text-[hsl(var(--sidebar-primary))]">
          100
        </span>
      </span>
      {!collapsed && (
        <span className="flex flex-col leading-tight min-w-0">
          <span className="font-display text-sm font-semibold text-[hsl(var(--sidebar-foreground))] truncate">
            {org?.chapterName ?? "Chapter"}
          </span>
          <span className="text-[9px] uppercase tracking-[0.2em] text-[hsl(var(--sidebar-accent-foreground))] truncate">
            Collegiate 100 · {org?.universityName ?? ""}
          </span>
        </span>
      )}
    </Link>
  );
}

function SidebarNavItem({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  const active =
    item.href === "/"
      ? location === "/"
      : location === item.href || location.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[hsl(var(--sidebar-primary)/0.15)] text-[hsl(var(--sidebar-primary))]"
          : "text-[hsl(var(--sidebar-accent-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active
            ? "text-[hsl(var(--sidebar-primary))]"
            : "text-[hsl(var(--sidebar-accent-foreground))]",
        )}
      />
      <span className="truncate">{item.label}</span>
      {active && (
        <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-[hsl(var(--sidebar-primary))]" />
      )}
    </Link>
  );
}

function SidebarUserPanel() {
  const me = useMe();
  if (!me.isAuthenticated || !me.member) return null;

  return (
    <div className="border-t border-[hsl(var(--sidebar-border))] p-3 space-y-1">
      <div className="flex items-center gap-2.5 px-2.5 py-1.5">
        <div className="h-7 w-7 shrink-0 rounded-full bg-[hsl(var(--sidebar-accent))] flex items-center justify-center">
          <span className="text-xs font-semibold text-[hsl(var(--sidebar-foreground))]">
            {me.member.fullName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </span>
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-medium text-[hsl(var(--sidebar-foreground))] truncate">
            {me.member.fullName}
          </span>
          <span className="text-[10px] text-[hsl(var(--sidebar-accent-foreground))] truncate">
            {me.member.role}
          </span>
        </div>
      </div>
      <LogoutButton className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[hsl(var(--sidebar-accent-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))] transition-colors" />
    </div>
  );
}

function ImpersonationBanner() {
  const me = useMe();
  const queryClient = useQueryClient();
  const endMutation = useEndImpersonation({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetMyProfileQueryKey(), data);
      },
    },
  });

  if (!me.impersonating) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 bg-amber-400 px-4 py-1.5 text-amber-950">
      <span className="text-xs font-medium">
        Viewing as <strong>{me.impersonating.viewAs}</strong> — view only, real permissions unchanged
      </span>
      <button
        onClick={() => endMutation.mutate()}
        disabled={endMutation.isPending}
        className="flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold hover:bg-amber-500 disabled:opacity-50 transition-colors"
      >
        <X className="h-3 w-3" />
        {endMutation.isPending ? "Exiting…" : "Exit view"}
      </button>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const me = useMe();
  const ctx: NavContext = {
    isLeader: me.isLeader,
    isExecOrAdmin: me.isExecOrAdmin,
    isTechChair: me.isTechChair,
    isChair: me.isChair,
    // Show Executive Suite nav only when the member holds a qualifying position:
    // a specific exec/appointed-officer org role, or is Tech Chair / Platform Admin
    // (both of whom can access the Technology workspace).
    // "general_member" alone must NOT qualify — every member has that role.
    hasExecWorkspace:
      me.isTechChair ||
      me.isAdmin ||
      EXEC_WORKSPACES.some((w) => w.orgRole !== null && me.orgRoles.includes(w.orgRole)),
  };
  const items = NAV.filter((n) => n.show(ctx));

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--sidebar))]">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-[hsl(var(--sidebar-border))]">
        <Brand />
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {items.map((item) => (
          <SidebarNavItem key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <SidebarUserPanel />
    </div>
  );
}

export function OperationsConsoleShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[hsl(var(--background))]">
      <ImpersonationBanner />
      <div className="flex flex-1 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 lg:w-60 shrink-0 flex-col border-r border-[hsl(var(--sidebar-border))]">
        <Sidebar />
      </aside>

      {/* Mobile sheet sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0 bg-[hsl(var(--sidebar))] border-r border-[hsl(var(--sidebar-border))]">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex md:hidden items-center justify-between h-14 px-4 border-b bg-[hsl(var(--sidebar))]">
          <Brand />
          <div className="flex items-center gap-2">
            <ExperienceSwitcher />
            <RefreshButton className="text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]" />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                  data-testid="button-mobile-menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
            </Sheet>
          </div>
        </header>

        {/* Desktop switcher bar — only rendered when it has something to show */}
        <div className="hidden md:flex items-center justify-end gap-2 px-4 py-2 lg:px-8 border-b border-[hsl(var(--sidebar-border))]">
          <ExperienceSwitcher />
          <RefreshButton />
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
      </div>
    </div>
  );
}

export function CommitteePortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const me = useMe();
  const { data: org } = useGetOrgSettings();

  const CHAIR_NAV: NavItem[] = [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
      show: () => true,
    },
    {
      href: "/events",
      label: "Events",
      icon: CalendarDays,
      show: () => true,
    },
    {
      href: "/my-committee",
      label: "My Committee",
      icon: Layers3,
      show: () => true,
    },
    {
      href: "/profile",
      label: "Profile",
      icon: UserCircle2,
      show: () => true,
    },
  ];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <header className="sticky top-0 z-40 border-b bg-[hsl(var(--card))]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--card))]/80">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
              <span className="font-display text-xs font-bold">C</span>
            </span>
            <span className="font-display text-sm font-semibold hidden sm:block">
              {org?.chapterName ?? "Chapter"}
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-0.5">
            {CHAIR_NAV.map((item) => {
              const active =
                item.href === "/"
                  ? location === "/"
                  : location === item.href ||
                    location.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]"
                      : "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--accent))]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ExperienceSwitcher />
            <RefreshButton />
            <LogoutButton className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden"
                  data-testid="button-mobile-menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 p-0">
                <SheetHeader className="px-4 py-4 border-b">
                  <SheetTitle className="font-display text-sm text-left">
                    Navigation
                  </SheetTitle>
                </SheetHeader>
                <nav className="p-3 space-y-0.5">
                  {CHAIR_NAV.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                  <LogoutButton className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent" />
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main>
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export function MemberPortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  const me = useMe();

  const MEMBER_TABS = [
    { href: "/", label: "Home", icon: LayoutDashboard },
    { href: "/events", label: "Events", icon: CalendarDays },
    { href: "/leaderboard", label: "Leaders", icon: Trophy },
    { href: "/profile", label: "Profile", icon: UserCircle2 },
  ];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] pb-16 sm:pb-0">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b bg-[hsl(var(--card))]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--card))]/80">
        {/* Brand row */}
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="relative inline-flex h-7 w-7 items-center justify-center rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
              <span className="font-display text-xs font-bold">C</span>
            </span>
            <span className="font-display text-sm font-semibold">
              C100 Trailblazers
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ExperienceSwitcher />
            <RefreshButton />
            <LogoutButton className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" />
          </div>
        </div>

        {/* Desktop tab nav — hidden on mobile (bottom bar handles it) */}
        <nav className="hidden sm:flex border-t px-2 h-10 items-stretch gap-0.5">
          {MEMBER_TABS.map((tab) => {
            const active =
              tab.href === "/"
                ? location === "/"
                : location === tab.href || location.startsWith(tab.href + "/");
            const Icon = tab.icon;
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 text-xs font-medium transition-colors",
                  active
                    ? "text-[hsl(var(--foreground))]"
                    : "text-muted-foreground hover:text-[hsl(var(--foreground))]",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", active && "text-[hsl(var(--secondary))]")} />
                {tab.label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-[hsl(var(--secondary))]" />
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      <main>
        <div className="mx-auto w-full max-w-2xl px-4 py-5">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-[hsl(var(--card))]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--card))]/80 sm:hidden">
        <div className="grid grid-cols-4 h-16">
          {MEMBER_TABS.map((tab) => {
            const active =
              tab.href === "/"
                ? location === "/"
                : location === tab.href ||
                  location.startsWith(tab.href + "/");
            const Icon = tab.icon;
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  active
                    ? "text-[hsl(var(--foreground))]"
                    : "text-muted-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    active && "text-[hsl(var(--secondary))]",
                  )}
                />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const me = useMe();

  if (me.isOpsConsole) {
    return <OperationsConsoleShell>{children}</OperationsConsoleShell>;
  }
  if (me.isCommitteePortal) {
    return <CommitteePortalShell>{children}</CommitteePortalShell>;
  }
  return <MemberPortalShell>{children}</MemberPortalShell>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--secondary))]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
