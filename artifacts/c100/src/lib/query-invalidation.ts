import type { QueryClient } from "@tanstack/react-query";
import {
  getGetMyDashboardQueryKey,
  getGetAdminOverviewQueryKey,
  getGetScholarshipEligibilityQueryKey,
  getGetConferenceEligibilityQueryKey,
} from "@workspace/api-client-react";

/**
 * Invalidates every committee-scoped query (list, single committee, roster,
 * leaderboard) regardless of committee id. Committee rosters and the
 * leaderboard are derived from member/attendance state, so any admin
 * mutation that can move a member between committees or change their
 * standing must widen out to this instead of guessing which committee ids
 * are affected.
 */
export function invalidateCommittees(qc: QueryClient) {
  qc.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === "string" && key.startsWith("/api/committees");
    },
  });
}

/**
 * Invalidates every derived/aggregate query whose data can shift after an
 * admin mutation on members or events: the acting member's own dashboard,
 * all committee rollups (list/roster/leaderboard), and the chapter-wide
 * reports (admin overview, scholarship + conference eligibility).
 *
 * Call this alongside the mutation's own direct invalidation
 * (getGetMemberQueryKey/getGetEventQueryKey/etc) — it does not replace it.
 */
export function invalidateAggregates(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: getGetMyDashboardQueryKey() });
  qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
  qc.invalidateQueries({ queryKey: getGetScholarshipEligibilityQueryKey() });
  qc.invalidateQueries({ queryKey: getGetConferenceEligibilityQueryKey() });
  invalidateCommittees(qc);
}
