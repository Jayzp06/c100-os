import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MeProvider } from "@/lib/me";
import { initDesktop, listenForDesktopAuthCallback, IS_TAURI } from "@/lib/desktop-auth";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import LoginPage from "@/pages/login";
import ProfilePage from "@/pages/profile";
import MembersPage from "@/pages/members";
import MemberDetailPage from "@/pages/member-detail";
import CommitteesPage from "@/pages/committees";
import CommitteeDetailPage from "@/pages/committee-detail";
import MyCommitteePage from "@/pages/my-committee";
import LeaderboardPage from "@/pages/leaderboard";
import EventsPage from "@/pages/events";
import NewEventPage from "@/pages/event-new";
import EventDetailPage from "@/pages/event-detail";
import EventQrPage from "@/pages/event-qr";
import NudgesPage from "@/pages/nudges";
import ReportsPage from "@/pages/reports";
import TechConsolePage from "@/pages/tech-console";

// ---------------------------------------------------------------------------
// Desktop initialisation — must run before any component mounts so that
// setBaseUrl and setAuthTokenGetter are configured prior to the first fetch.
// This is a no-op in the web build (IS_TAURI === false).
// ---------------------------------------------------------------------------
initDesktop();

// Persist query cache to localStorage so read-only views (dashboard, events,
// members, committees) survive page reloads and brief network loss.
// gcTime must exceed staleTime for persistence to be meaningful.
// Using the functional API (not PersistQueryClientProvider) to avoid a React
// context mismatch between the persist-client package's own react-query copy
// and the copy used by the rest of the app.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "c100-query-cache-v1",
  throttleTime: 1_000,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1_000 * 60 * 60 * 24, // 24 h — keep cache across sessions
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,      // re-validate when network restores
      retry: 1,
    },
  },
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1_000 * 60 * 60 * 24,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      // Only persist successful reads — never persist mutations or error states
      query.state.status === "success",
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/members" component={MembersPage} />
      <Route path="/members/:id" component={MemberDetailPage} />
      <Route path="/committees" component={CommitteesPage} />
      <Route path="/my-committee" component={MyCommitteePage} />
      <Route path="/committees/:id" component={CommitteeDetailPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/events/new" component={NewEventPage} />
      <Route path="/events/:id" component={EventDetailPage} />
      <Route path="/events/:id/qr" component={EventQrPage} />
      <Route path="/nudges" component={NudgesPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/tech" component={TechConsolePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function DesktopAuthListener() {
  useEffect(() => {
    if (!IS_TAURI) return;
    let unlisten: (() => void) | null = null;
    listenForDesktopAuthCallback().then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <MeProvider>
            <DesktopAuthListener />
            <Router />
          </MeProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
