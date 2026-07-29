/**
 * Shared access-control helpers for the reporting module. These sit on top
 * of the existing role/RBAC primitives in `c100.ts` / `rbac.ts` and encode
 * the reporting privacy rules:
 *
 *  - Chapter-level reports (scholarship/conference/admin overview): Admin,
 *    Technology Chair, and Executive Board only (`requireRole(...EXEC_OR_ADMIN)`
 *    already grants platform_admin/technology_chair via system-role fallback).
 *  - Committee-level reports: chapter-wide leadership roles OR the committee's
 *    own chair — never a chair for a committee they do not lead.
 *  - Event-level reports: chapter-wide leadership roles OR the chair of the
 *    event's own committee (if any).
 *  - Member-level reports: chapter-wide leadership roles, the member's own
 *    committee chair, or the member themself. Never another member.
 */

import { db, committeesTable, type Member as MemberRow, type Role } from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolvePermissions } from "./c100";
import { hasSystemRole } from "./rbac";

/** Roles that can see any committee's roster/report, any event, any member. */
export const CHAPTER_WIDE_REPORT_ROLES: Role[] = [
  "ExecutiveBoard",
  "Admin",
  "TechnologyChair",
];

export async function isChapterWideReporter(member: MemberRow): Promise<boolean> {
  if (CHAPTER_WIDE_REPORT_ROLES.includes(member.role as Role)) return true;
  const perms = await resolvePermissions(member);
  return perms.isTechChair || hasSystemRole(perms.rbac, "platform_admin");
}

export async function canAccessCommitteeReport(
  member: MemberRow,
  committeeId: number,
): Promise<boolean> {
  if (await isChapterWideReporter(member)) return true;
  const perms = await resolvePermissions(member);
  return perms.committeeChairId === committeeId;
}

export async function canAccessEventReport(
  member: MemberRow,
  eventCommitteeId: number | null,
): Promise<boolean> {
  if (await isChapterWideReporter(member)) return true;
  if (eventCommitteeId == null) return false;
  const perms = await resolvePermissions(member);
  return perms.committeeChairId === eventCommitteeId;
}

export async function canAccessMemberReport(
  member: MemberRow,
  targetMemberId: number,
  targetCommitteeId: number | null,
): Promise<boolean> {
  if (member.id === targetMemberId) return true;
  if (await isChapterWideReporter(member)) return true;
  if (targetCommitteeId == null) return false;
  const perms = await resolvePermissions(member);
  return perms.committeeChairId === targetCommitteeId;
}

export async function committeeNameById(id: number | null): Promise<string | null> {
  if (id == null) return null;
  const [row] = await db
    .select({ name: committeesTable.name })
    .from(committeesTable)
    .where(eq(committeesTable.id, id));
  return row?.name ?? null;
}
