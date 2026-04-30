import { Link, useLocation } from "wouter";
import { useMe } from "@/lib/me";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/badges";
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
  { href: "/committees", label: "Committees", icon: Layers3, show: () => true },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, show: () => true },
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
  { href: "/profile", label: "Profile", icon: UserCircle2, show: () => true },
];

function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 group"
      data-testid="brand-link"
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm transition-transform group-hover:scale-105">
        <span className="font-serif text-base font-bold tracking-tight">C</span>
        <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-[hsl(var(--secondary))] text-[8px] font-bold text-[hsl(var(--secondary-foreground))]">
          100
        </span>
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-serif text-sm font-semibold text-[hsl(var(--foreground))]">
          Trailblazing Chapter
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Collegiate 100 · FVSU
        </span>
      </span>
    </Link>
  );
}

function NavLinks({
  onNavigate,
  layout,
}: {
  onNavigate?: () => void;
  layout: "horizontal" | "vertical";
}) {
  const [location] = useLocation();
  const me = useMe();
  const items = NAV.filter((n) =>
    n.show({ isLeader: me.isLeader, isExecOrAdmin: me.isExecOrAdmin }),
  );
  return (
    <nav
      className={cn(
        layout === "horizontal"
          ? "hidden md:flex items-center gap-1"
          : "flex flex-col gap-1",
      )}
    >
      {items.map((item) => {
        const active =
          item.href === "/"
            ? location === "/"
            : location === item.href || location.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
                : "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--muted))]",
              layout === "vertical" && "w-full justify-start",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const me = useMe();
  if (!me.isAuthenticated || !me.member) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="hidden lg:flex flex-col text-right leading-tight">
        <span className="text-sm font-medium">{me.member.fullName}</span>
        <div className="flex justify-end">
          <RoleBadge role={me.member.role} />
        </div>
      </div>
      <Button
        asChild
        variant="ghost"
        size="sm"
        data-testid="button-logout"
        className="text-muted-foreground hover:text-foreground"
      >
        <a href="/api/logout">
          <LogOut className="h-4 w-4" />
          <span className="sr-only md:not-sr-only md:ml-1.5">Sign out</span>
        </a>
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen w-full bg-[hsl(var(--background))] text-[hsl(var(--foreground))] flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-[hsl(var(--card))]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--card))]/80">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Brand />
            <NavLinks layout="horizontal" />
          </div>
          <div className="flex items-center gap-2">
            <UserMenu />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  data-testid="button-mobile-menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="px-4 py-4 border-b">
                  <SheetTitle asChild>
                    <Brand />
                  </SheetTitle>
                </SheetHeader>
                <div className="p-3">
                  <NavLinks
                    layout="vertical"
                    onNavigate={() => setMobileOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </div>
      </main>
      <footer className="border-t bg-[hsl(var(--card))]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 text-xs text-muted-foreground">
          <span>
            C100 System · Fort Valley State University Trailblazing Chapter
          </span>
          <span className="font-serif">Educate · Mentor · Empower · Engage</span>
        </div>
      </footer>
    </div>
  );
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--primary))]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
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
