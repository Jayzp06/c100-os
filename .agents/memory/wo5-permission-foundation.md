---
name: WO-5 Permission Foundation
description: Detailed outcomes and non-obvious decisions from the WO-5 RBAC permission refactor (commit 54f6d7c).
---

## What changed

1. **manage_documents split** → manage_minutes, manage_agendas, manage_official_correspondence, view_official_records (Secretary); manage_governance_documents, upload_governance_documents, version_governance_documents, view_governance_documents (Bylaws); view_governance_documents, manage_procedure_records, manage_motions, manage_parliamentary_rulings (Parliamentarian); manage_archives, upload_archive_material, manage_chapter_timeline, view_archives (Historian).

2. **view_reports split** → view_chapter_overview, view_financial_reports, view_eligibility_reports, view_committee_reports, view_official_records, view_governance_reports, view_archive_reports, view_conduct_reports. Routes updated: scholarship/conference → view_eligibility_reports; admin-overview → view_chapter_overview.

3. **Technology Chair** is now technical-only: 8 tech-specific perms, no exec/finance/document/report access.

4. **Platform Admin** is account-admin only: manage_members + system perms; no exec, no attendance, no org settings.

5. **All bypasses removed**:
   - `requireRole()` — no more platform_admin/technology_chair pass-through
   - `requirePermGroup()` — no more technology_chair pass-through
   - `requirePermissionGroup()` — no more isTechSuperuser() pass-through
   - `isChapterWideReporter()` — removed isTechChair/platform_admin bypass
   - `committees.ts` roster gate — removed isTechChair/platform_admin bypass

6. **CHAPTER_WIDE_ROSTER_ROLES** and **CHAPTER_WIDE_REPORT_ROLES** — TechnologyChair removed from both.

7. **workspace-gate.tsx** — Technology workspace: Tech Chair only. All other workspaces: orgRole holder only (no Tech Chair/isAdmin bypass).

8. **bylaws_chair tier** → appointed_officer (was committee_leadership).

9. **Seed** adds a cleanup step that deletes manage_documents + view_reports from DB before reseeding. Seed output: 43 perm groups, 96 org role assignments.

## Why (key constraint)
The bypass removal is safe because Tech Chair members have role="TechnologyChair" and Platform Admin members have role="Admin", so role-gated routes still work for them via the first role-match check. The bypasses only ever triggered when someone had the system role but a mismatched legacy role — a scenario that shouldn't occur in normal operation.

## Not done (explicitly deferred per WO-5)
- Bylaws workspace card in the Exec Suite hub (no new officer tools in WO-5)
- Committee Chair report access via view_committee_reports (no new report endpoints built)
- Role management UI updates to reflect the new perm groups

## How to apply
Any future executive workspace must gate on `useExecWorkspaceAccess(workspace)` which now checks only the exact orgRole holder. No bypass overrides. Any new report route must use `requirePermGroup("<specific_report_slug>")` — never the removed `view_reports`.
