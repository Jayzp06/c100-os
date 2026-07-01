import { Link, useLocation } from "wouter";
import { useGetOrgSettings } from "@workspace/api-client-react";
import { useMe } from "@/lib/me";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  UserCircle2,
  Users,
  Layers3,
  Trophy,
  CalendarDays,
  Bell,
  ClipboardCheck,
  LogOut,
  Menu,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show: (ctx: { isLeader: boolean; isExecOrAdmin: boolean }) => boolean;
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
  { href: "/nudges", label: "Nudges", icon: Bell, show: () => true },
  {
    href: "/reports",
    label: "Reports",
    icon: ClipboardCheck,
    show: ({ isExecOrAdmin }) => isExecOrAdmin,
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
      <a
        href="/api/logout"
        className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[hsl(var(--sidebar-accent-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))] transition-colors"
        data-testid="button-logout"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </a>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const me = useMe();
  const items = NAV.filter((n) =>
    n.show({ isLeader: me.isLeader, isExecOrAdmin: me.isExecOrAdmin }),
  );

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
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
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
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
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
      href: me.committeeChairId
        ? `/committees/${me.committeeChairId}`
        : "/committees",
      label: "My Committee",
      icon: Layers3,
      show: () => true,
    },
    {
      href: "/nudges",
      label: "Nudges",
      icon: Bell,
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
            <a
              href="/api/logout"
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              data-testid="button-logout"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </a>
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
                  <a
                    href="/api/logout"
                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </a>
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
    {
      href: me.member?.committeeId
        ? `/committees/${me.member.committeeId}`
        : "/committees",
      label: "Committee",
      icon: Layers3,
    },
    { href: "/profile", label: "Profile", icon: UserCircle2 },
  ];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] pb-16 sm:pb-0">
      {/* Simple top header */}
      <header className="sticky top-0 z-40 border-b bg-[hsl(var(--card))]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--card))]/80">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="relative inline-flex h-7 w-7 items-center justify-center rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
              <span className="font-display text-xs font-bold">C</span>
            </span>
            <span className="font-display text-sm font-semibold">
              C100 Trailblazers
            </span>
          </Link>
          <a
            href="/api/logout"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            data-testid="button-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </a>
        </div>
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
