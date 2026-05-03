import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MeProvider } from "@/lib/me";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import LoginPage from "@/pages/login";
import ProfilePage from "@/pages/profile";
import MembersPage from "@/pages/members";
import MemberDetailPage from "@/pages/member-detail";
import CommitteesPage from "@/pages/committees";
import CommitteeDetailPage from "@/pages/committee-detail";
import LeaderboardPage from "@/pages/leaderboard";
import EventsPage from "@/pages/events";
import NewEventPage from "@/pages/event-new";
import EventDetailPage from "@/pages/event-detail";
import EventQrPage from "@/pages/event-qr";
import NudgesPage from "@/pages/nudges";
import ReportsPage from "@/pages/reports";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
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
      <Route path="/committees/:id" component={CommitteeDetailPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/events/new" component={NewEventPage} />
      <Route path="/events/:id" component={EventDetailPage} />
      <Route path="/events/:id/qr" component={EventQrPage} />
      <Route path="/nudges" component={NudgesPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <MeProvider>
            <Router />
          </MeProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
