import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyProfile,
  getGetMyProfileQueryKey,
  useSwitchMyExperience,
  useResetMyExperience,
  type Member,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";

export type Role = Member["role"];
export type ExperienceType = Member["experience"];

// ---------------------------------------------------------------------------
// Position display labels — canonical human-readable labels for every
// officer / system-role slug returned by /api/me.  Used by the sidebar user
// panel and any other surface that must show a role name to the user.
// Never reads the legacy `members.role` enum directly — that enum is a DB
// implementation detail and can be stale in a desktop cache.
// ---------------------------------------------------------------------------

const POSITION_DISPLAY: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  chief_of_staff: "Chief of Staff",
  secretary: "Secretary",
  treasurer: "Treasurer",
  parliamentarian: "Parliamentarian",
  historian: "Historian",
  bylaws_chair: "Bylaws Officer",
  bylaws_officer: "Bylaws Officer",
  sergeant_at_arms: "Sergeant-at-Arms",
  committee_chair: "Committee Chair",
  platform_admin: "Platform Admin",
  technology_chair: "Technology Chair",
};

/**
 * Compute a single user-facing position label from the server-derived
 * RBAC context.  Priority:
 *  1. Active officer term (most specific — actual role they hold right now)
 *  2. System roles (platform_admin > technology_chair)
 *  3. Org roles from the RBAC context (formatted nicely)
 *  4. Fallback: "Member"
 *
 * Deliberately does NOT read the legacy `members.role` enum so that a
 * stale desktop cache showing "ExecutiveBoard" can never pollute the label
 * after a role has been removed.
 */
export function computePositionLabel(
  officerPositions: string[],
  systemRoles: string[],
  orgRoles: string[],
): string {
  if (officerPositions.length > 0) {
    const slug = officerPositions[0]!;
    return (
      POSITION_DISPLAY[slug] ??
      slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }
  if (systemRoles.includes("platform_admin")) return "Platform Admin";
  if (systemRoles.includes("technology_chair")) return "Technology Chair";
  for (const r of orgRoles) {
    const label = POSITION_DISPLAY[r];
    if (label) return label;
  }
  return "Member";
}

export const LEADERSHIP_ROLES: Role[] = [
  "CommitteeChair",
  "ExecutiveBoard",
  "Admin",
  "TechnologyChair",
];

export const EXEC_OR_ADMIN: Role[] = ["ExecutiveBoard", "Admin"];

export function hasRole(role: Role | null | undefined, allowed: Role[]) {
  return !!role && allowed.includes(role);
}

export type ImpersonationState = {
  viewAs: string;
  startedAt: string;
};

type MeValue = {
  auth: ReturnType<typeof useAuth>;
  member: Member | null;
  role: Role | null;
  experience: ExperienceType | null;
  officerPositions: string[];
  committeeChairId: number | null;
  /** System-level role slugs (e.g. "platform_admin", "technology_chair"). */
  systemRoles: string[];
  /** Org-level role slugs (e.g. "president", "general_member"). */
  orgRoles: string[];
  /** Union of all permission group slugs granted through system + org roles. */
  permissionGroups: string[];
  /**
   * Returns true if the current member has the given permission group slug.
   * Platform admins and technology chairs always return true.
   */
  can: (permGroupSlug: string) => boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPendingApproval: boolean;
  isLeader: boolean;
  isExecOrAdmin: boolean;
  isAdmin: boolean;
  isTechChair: boolean;
  isChair: boolean;
  isOpsConsole: boolean;
  isCommitteePortal: boolean;
  isMemberPortal: boolean;
  impersonating: ImpersonationState | null;
  profileError: { status?: number } | null;
  /**
   * All experience shells this member legitimately qualifies for. Length > 1
   * means the multi-role "switch view" affordance should be shown.
   */
  availableExperiences: ExperienceType[];
  /**
   * Human-readable position label derived from current RBAC context — never
   * from the legacy `members.role` enum.  Safe to show in the sidebar and any
   * other UI surface.
   */
  positionLabel: string;
  /** Switch the active view to another experience this member legitimately holds. */
  switchExperience: (experience: ExperienceType) => void;
  isSwitchingExperience: boolean;
  /** Reset the active view back to the member's default (highest-priority) experience. */
  resetExperience: () => void;
  isResettingExperience: boolean;
};

const MeContext = React.createContext<MeValue | null>(null);

function useMeValue(): MeValue {
  const auth = useAuth();
  const profile = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      enabled: auth.isAuthenticated,
      staleTime: 60_000,
      retry: (count, err) => {
        const errAny = err as {
          status?: number;
          response?: { status?: number };
        } | null;
        const status = errAny?.status ?? errAny?.response?.status;
        if (status === 403 || status === 401) return false;
        return count < 2;
      },
      retryOnMount: false,
    },
  });

  const member = profile.data ?? null;
  const role = member?.role ?? null;
  const experience = member?.experience ?? null;
  const officerPositions = member?.officerPositions ?? [];
  const committeeChairId = member?.committeeChairId ?? null;
  const profileError = profile.error as { status?: number } | null;
  const isPendingApproval =
    auth.isAuthenticated && profileError?.status === 403;

  const memberExt = member as
    | (typeof member & {
        isTechChair?: boolean;
        systemRoles?: string[];
        orgRoles?: string[];
        permissionGroups?: string[];
        impersonating?: ImpersonationState | null;
        availableExperiences?: ExperienceType[];
      })
    | null;

  const isTechChair = !!memberExt?.isTechChair;
  const systemRoles: string[] = memberExt?.systemRoles ?? [];
  const orgRoles: string[] = memberExt?.orgRoles ?? [];
  const permissionGroups: string[] = memberExt?.permissionGroups ?? [];
  const impersonating = memberExt?.impersonating ?? null;

  const permGroupSet = new Set(permissionGroups);
  const can = (slug: string): boolean => permGroupSet.has(slug);

  const availableExperiences: ExperienceType[] =
    memberExt?.availableExperiences ?? [];

  const qc = useQueryClient();
  const switchMutation = useSwitchMyExperience({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
    },
  });
  const resetMutation = useResetMyExperience({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
    },
  });

  const positionLabel = computePositionLabel(officerPositions, systemRoles, orgRoles);

  return {
    auth,
    member,
    role,
    experience,
    officerPositions,
    committeeChairId,
    systemRoles,
    orgRoles,
    permissionGroups,
    can,
    isLoading: auth.isLoading || (auth.isAuthenticated && profile.isLoading),
    isAuthenticated: auth.isAuthenticated,
    isPendingApproval,
    isLeader: role !== null && LEADERSHIP_ROLES.includes(role),
    isExecOrAdmin: role !== null && EXEC_OR_ADMIN.includes(role),
    isAdmin: role === "Admin",
    isTechChair,
    isChair: role === "CommitteeChair" || role === "BylawsChair",
    isOpsConsole: experience === "operations_console",
    isCommitteePortal: experience === "committee_portal",
    isMemberPortal: experience === "member_portal",
    impersonating,
    profileError,
    availableExperiences,
    positionLabel,
    switchExperience: (exp: ExperienceType) =>
      switchMutation.mutate({ data: { experience: exp as never } }),
    isSwitchingExperience: switchMutation.isPending,
    resetExperience: () => resetMutation.mutate(),
    isResettingExperience: resetMutation.isPending,
  };
}

export function MeProvider({ children }: { children: React.ReactNode }) {
  const value = useMeValue();
  return React.createElement(MeContext.Provider, { value }, children);
}

export function useMe(): MeValue {
  const ctx = React.useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used inside <MeProvider>");
  return ctx;
}
