import {
  useGetMyProfile,
  getGetMyProfileQueryKey,
  type Member,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";

export type Role = Member["role"];

export const LEADERSHIP_ROLES: Role[] = [
  "CommitteeChair",
  "BylawsChair",
  "ExecutiveBoard",
  "Admin",
];

export const EXEC_OR_ADMIN: Role[] = ["ExecutiveBoard", "Admin"];

export function useMe() {
  const auth = useAuth();
  const profile = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      enabled: auth.isAuthenticated,
      retry: (count, err) => {
        const status = (err as { status?: number } | null)?.status;
        if (status === 403 || status === 401) return false;
        return count < 2;
      },
    },
  });

  const member = profile.data ?? null;
  const role = member?.role ?? null;
  const profileError = profile.error as { status?: number } | null;
  const isPendingApproval =
    auth.isAuthenticated && profileError?.status === 403;

  return {
    auth,
    member,
    role,
    isLoading: auth.isLoading || (auth.isAuthenticated && profile.isLoading),
    isAuthenticated: auth.isAuthenticated,
    isPendingApproval,
    isLeader: role !== null && LEADERSHIP_ROLES.includes(role),
    isExecOrAdmin: role !== null && EXEC_OR_ADMIN.includes(role),
    isAdmin: role === "Admin",
    isChair: role === "CommitteeChair",
    profileError,
  };
}

export function hasRole(role: Role | null | undefined, allowed: Role[]) {
  return !!role && allowed.includes(role);
}
