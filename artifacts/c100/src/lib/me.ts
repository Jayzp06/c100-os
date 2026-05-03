import * as React from "react";
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

export function hasRole(role: Role | null | undefined, allowed: Role[]) {
  return !!role && allowed.includes(role);
}

type MeValue = {
  auth: ReturnType<typeof useAuth>;
  member: Member | null;
  role: Role | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPendingApproval: boolean;
  isLeader: boolean;
  isExecOrAdmin: boolean;
  isAdmin: boolean;
  isChair: boolean;
  profileError: { status?: number } | null;
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

export function MeProvider({ children }: { children: React.ReactNode }) {
  const value = useMeValue();
  return React.createElement(MeContext.Provider, { value }, children);
}

export function useMe(): MeValue {
  const ctx = React.useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used inside <MeProvider>");
  return ctx;
}
