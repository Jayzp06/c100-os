import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetOrgSettings } from "@workspace/api-client-react";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ShieldCheck, Trophy, Users } from "lucide-react";

export default function LoginPage() {
  const me = useMe();
  const [, setLocation] = useLocation();
  const { data: org } = useGetOrgSettings();

  useEffect(() => {
    if (me.isAuthenticated && !me.isLoading) {
      setLocation("/");
    }
  }, [me.isAuthenticated, me.isLoading, setLocation]);

  const chapterName = org?.chapterName ?? "Chapter";
  const chapterIdentifier = org?.chapterIdentifier ?? "Member";
  const universityName = org?.universityName ?? "Collegiate 100";
  const motto = org?.motto ?? "Discipline. Service. Excellence.";

  return (
    <div className="min-h-screen w-full bg-[hsl(var(--background))]">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between bg-[hsl(var(--primary))] p-12 text-[hsl(var(--primary-foreground))]">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/20">
              <span className="font-serif text-xl font-bold">C</span>
              <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-sm bg-[hsl(var(--secondary))] text-[10px] font-bold text-[hsl(var(--secondary-foreground))]">
                100
              </span>
            </span>
            <div className="leading-tight">
              <p className="font-serif text-base font-semibold">
                {chapterName}
              </p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">
                Collegiate 100 · {universityName}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--secondary))]">
              Chapter Operating System
            </p>
            <h1 className="font-serif text-4xl font-bold leading-tight">
              {motto}
            </h1>
            <p className="text-base text-white/80">
              The private operating system for the {universityName}{" "}
              {chapterName}. Track participation, run events, and certify
              who&apos;s ready for the next conference and scholarship cycle.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-white/80">
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-[hsl(var(--secondary))]" />
              Role-based access for members and leadership
            </li>
            <li className="flex items-center gap-3">
              <Users className="h-4 w-4 text-[hsl(var(--secondary))]" />
              Committees. One accountability standard.
            </li>
            <li className="flex items-center gap-3">
              <Trophy className="h-4 w-4 text-[hsl(var(--secondary))]" />
              Committee leaderboard. No public individual rankings.
            </li>
          </ul>
        </div>
        <div className="flex items-center justify-center p-8">
          <Card className="w-full max-w-md border-[hsl(var(--border))]">
            <CardContent className="space-y-6 p-8">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--primary))]">
                  Sign in
                </p>
                <h2 className="font-serif text-2xl font-bold">
                  Welcome, {chapterIdentifier}.
                </h2>
                <p className="text-sm text-muted-foreground">
                  Use your Replit account to access the chapter system. Your
                  Executive Board controls chapter membership.
                </p>
              </div>
              <Button
                asChild
                className="w-full"
                size="lg"
                data-testid="button-login"
              >
                <a href="/api/login?returnTo=/">
                  Continue with Replit
                  <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Not yet rostered? Reach out to your Executive Board to be added
                to the chapter.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
