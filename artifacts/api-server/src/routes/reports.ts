import { Router, type IRouter } from "express";
import {
  GetCommitteeReportParams,
  GetEventReportParams,
  GetMemberReportParams,
} from "@workspace/api-zod";
import {
  db,
  membersTable,
  eventsTable,
  committeesTable,
  attendanceTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  attendanceToDto,
  buildCommitteeAggregate,
  buildMemberDto,
  eventToDto,
  eventsEligibleForMember,
  getActiveSemester,
  getParticipationThreshold,
  memberPointsAndImpact,
  recentChapterAttendance,
  requireAuth,
  requirePermGroup,
} from "../lib/c100";
import {
  canAccessCommitteeReport,
  canAccessEventReport,
  canAccessMemberReport,
  committeeNameById,
} from "../lib/reporting";
import { isExportFormat, sendCsv, sendPdf, sendXlsx, type ReportColumn } from "../lib/export";

const router: IRouter = Router();

interface EligibilityInput {
  participationPct: number;
  totalPoints: number;
  impactPoints: number;
  gpa: number | null;
  duesPaid: boolean;
  membershipStatus: string;
}

function eligibility(rec: EligibilityInput, threshold: number) {
  const meetsParticipation = rec.participationPct >= threshold;
  const meetsGpa = rec.gpa != null ? rec.gpa >= 2.5 : false;
  const meetsDues = rec.duesPaid;
  const meetsStatus =
    rec.membershipStatus === "Active" ||
    rec.membershipStatus === "Probationary";
  const score =
    rec.participationPct * 0.4 +
    Math.min(rec.totalPoints, 200) * 0.2 +
    Math.min(rec.impactPoints, 200) * 0.3 +
    (rec.gpa != null ? rec.gpa * 10 : 0) * 0.1;
  return {
    meetsParticipation,
    meetsGpa,
    meetsDues,
    meetsStatus,
    systemScore: Math.round(score * 10) / 10,
    eligible: meetsParticipation && meetsGpa && meetsDues && meetsStatus,
  };
}

async function buildEligibilityList() {
  const [members, threshold] = await Promise.all([
    db
      .select({ m: membersTable, committeeName: committeesTable.name })
      .from(membersTable)
      .leftJoin(committeesTable, eq(committeesTable.id, membersTable.committeeId)),
    getParticipationThreshold(),
  ]);
  const records = await Promise.all(
    members.map(async ({ m, committeeName }) => {
      const [{ totalPoints, impactPoints }, { eligible, attended }] =
        await Promise.all([
          memberPointsAndImpact(m.id),
          eventsEligibleForMember(m.id),
        ]);
      const participationPct =
        eligible > 0 ? Math.round((attended / eligible) * 1000) / 10 : 0;
      const elig = eligibility({
        participationPct,
        totalPoints,
        impactPoints,
        gpa: m.gpa != null ? Number(m.gpa) : null,
        duesPaid: m.duesPaid,
        membershipStatus: m.membershipStatus,
      }, threshold);
      return {
        userId: m.id,
        fullName: m.fullName,
        committeeName: committeeName ?? null,
        participationPct,
        totalPoints,
        impactPoints,
        gpa: m.gpa != null ? Number(m.gpa) : null,
        duesPaid: m.duesPaid,
        membershipStatus: m.membershipStatus,
        ...elig,
      };
    }),
  );
  return records;
}

type EligibilityRecord = Awaited<ReturnType<typeof buildEligibilityList>>[number] & {
  rank: number | null;
};

const ELIGIBILITY_COLUMNS: ReportColumn<EligibilityRecord>[] = [
  { header: "Rank", key: "rank", value: (r) => r.rank ?? "" },
  { header: "Member", key: "fullName", value: (r) => r.fullName },
  { header: "Committee", key: "committeeName", value: (r) => r.committeeName ?? "" },
  { header: "Participation %", key: "participationPct", value: (r) => r.participationPct },
  { header: "Total Points", key: "totalPoints", value: (r) => r.totalPoints },
  { header: "Impact Points", key: "impactPoints", value: (r) => r.impactPoints },
  { header: "GPA", key: "gpa", value: (r) => r.gpa ?? "" },
  { header: "Dues Paid", key: "duesPaid", value: (r) => (r.duesPaid ? "Yes" : "No") },
  { header: "Status", key: "membershipStatus", value: (r) => r.membershipStatus },
  { header: "System Score", key: "systemScore", value: (r) => r.systemScore },
  { header: "Eligible", key: "eligible", value: (r) => (r.eligible ? "Yes" : "No") },
];

function respondEligibility(
  req: import("express").Request,
  res: import("express").Response,
  title: string,
  filenameBase: string,
  records: EligibilityRecord[],
) {
  const format = req.query.format;
  if (isExportFormat(format)) {
    const meta = {
      title,
      filenameBase,
      summary: [
        { label: "Members", value: records.length },
        { label: "Eligible", value: records.filter((r) => r.eligible).length },
      ],
    };
    if (format === "csv") return sendCsv(res, meta, ELIGIBILITY_COLUMNS, records);
    if (format === "xlsx")
      return sendXlsx(res, meta, [{ name: "Eligibility", columns: ELIGIBILITY_COLUMNS, rows: records }]);
    return sendPdf(res, meta, ELIGIBILITY_COLUMNS, records);
  }
  res.json(records);
}

router.get(
  "/reports/scholarship-eligibility",
  requirePermGroup("view_eligibility_reports")(async (req, res) => {
    const records = await buildEligibilityList();
    respondEligibility(
      req,
      res,
      "Scholarship Eligibility Report",
      "scholarship-eligibility",
      records.map((r) => ({ ...r, rank: null })),
    );
  }),
);

router.get(
  "/reports/conference-eligibility",
  requirePermGroup("view_eligibility_reports")(async (req, res) => {
    const records = await buildEligibilityList();
    const ranked = [...records]
      .sort((a, b) => b.systemScore - a.systemScore)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));
    respondEligibility(req, res, "Conference Eligibility Report", "conference-eligibility", ranked);
  }),
);

async function buildAdminOverview() {
  const members = await db.select().from(membersTable);
  const events = await db.select().from(eventsTable);
  const committees = await db.select().from(committeesTable).where(eq(committeesTable.active, true));
  const aggregates = await Promise.all(
    committees.map((c) => buildCommitteeAggregate(c)),
  );
  const ranked = [...aggregates]
    .sort((a, b) => b.totalImpactPoints - a.totalImpactPoints)
    .map((agg, idx) => ({
      committeeId: agg.committee.id,
      name: agg.committee.name,
      rank: idx + 1,
      participationPct: agg.aggregateParticipationPct,
      totalImpactPoints: agg.totalImpactPoints,
      totalEventsHosted: agg.totalEventsHosted,
      memberCount: agg.memberCount,
    }));

  let totalParticipation = 0;
  for (const m of members) {
    const { eligible, attended } = await eventsEligibleForMember(m.id);
    totalParticipation += eligible > 0 ? (attended / eligible) * 100 : 0;
  }
  const chapterParticipationPct =
    members.length > 0
      ? Math.round((totalParticipation / members.length) * 10) / 10
      : 0;

  const activeSem = await getActiveSemester();
  return {
    totalMembers: members.length,
    totalEvents: events.length,
    upcomingEvents: events.filter(
      (e) => e.status === "Upcoming" && e.semester === activeSem,
    ).length,
    completedEvents: events.filter((e) => e.status === "Completed").length,
    chapterParticipationPct,
    committees: ranked,
    recentActivity: await recentChapterAttendance(10),
    activeSem,
  };
}

type AdminOverviewCommittee = Awaited<ReturnType<typeof buildAdminOverview>>["committees"][number];
type AdminOverviewActivity = Awaited<ReturnType<typeof buildAdminOverview>>["recentActivity"][number];

const OVERVIEW_COMMITTEE_COLUMNS: ReportColumn<AdminOverviewCommittee>[] = [
  { header: "Rank", key: "rank", value: (r) => r.rank },
  { header: "Committee", key: "name", value: (r) => r.name },
  { header: "Members", key: "memberCount", value: (r) => r.memberCount },
  { header: "Events Hosted", key: "totalEventsHosted", value: (r) => r.totalEventsHosted },
  { header: "Impact Points", key: "totalImpactPoints", value: (r) => r.totalImpactPoints },
  { header: "Participation %", key: "participationPct", value: (r) => r.participationPct },
];

const OVERVIEW_ACTIVITY_COLUMNS: ReportColumn<AdminOverviewActivity>[] = [
  {
    header: "Check-in",
    key: "checkInTime",
    value: (r: any) => new Date(r.checkInTime).toLocaleString("en-US"),
  },
  { header: "Member", key: "userName", value: (r: any) => r.userName ?? "" },
  { header: "Event", key: "eventTitle", value: (r: any) => r.eventTitle ?? "" },
  { header: "Points", key: "pointsAwarded", value: (r: any) => r.pointsAwarded },
  { header: "Method", key: "method", value: (r: any) => r.method },
];

router.get(
  "/reports/admin-overview",
  requirePermGroup("view_chapter_overview")(async (req, res) => {
    const overview = await buildAdminOverview();
    const format = req.query.format;
    if (isExportFormat(format)) {
      const meta = {
        title: "Chapter Overview Report",
        filenameBase: "chapter-overview",
        period: overview.activeSem,
        summary: [
          { label: "Total Members", value: overview.totalMembers },
          { label: "Chapter Participation", value: `${overview.chapterParticipationPct}%` },
        ],
      };
      if (format === "csv") {
        return sendCsv(res, meta, OVERVIEW_COMMITTEE_COLUMNS, overview.committees);
      }
      if (format === "xlsx") {
        return sendXlsx(res, meta, [
          { name: "Committees", columns: OVERVIEW_COMMITTEE_COLUMNS, rows: overview.committees },
          { name: "Recent Activity", columns: OVERVIEW_ACTIVITY_COLUMNS, rows: overview.recentActivity },
        ]);
      }
      return sendPdf(res, meta, OVERVIEW_COMMITTEE_COLUMNS, overview.committees);
    }
    const { activeSem: _activeSem, ...json } = overview;
    res.json(json);
    void sql;
  }),
);

const MEMBER_ROSTER_COLUMNS: ReportColumn<any>[] = [
  { header: "Name", key: "fullName", value: (r) => r.fullName },
  { header: "Email", key: "email", value: (r) => r.email },
  { header: "Role", key: "role", value: (r) => r.role },
  { header: "Status", key: "membershipStatus", value: (r) => r.membershipStatus },
  { header: "Total Points", key: "totalPoints", value: (r) => r.totalPoints },
  { header: "Impact Points", key: "impactPoints", value: (r) => r.impactPoints },
  { header: "Participation %", key: "participationPct", value: (r) => r.participationPct },
  { header: "Events Attended", key: "eventsAttended", value: (r) => r.eventsAttended },
  { header: "Events Eligible", key: "eventsEligible", value: (r) => r.eventsEligible },
  { header: "Dues Paid", key: "duesPaid", value: (r) => (r.duesPaid ? "Yes" : "No") },
];

const COMMITTEE_EVENT_COLUMNS: ReportColumn<any>[] = [
  { header: "Title", key: "title", value: (r) => r.title },
  { header: "Type", key: "eventType", value: (r) => r.eventType },
  { header: "Date", key: "date", value: (r) => r.date },
  { header: "Location", key: "location", value: (r) => r.location },
  { header: "Attendees", key: "totalAttendees", value: (r) => r.totalAttendees },
  { header: "Status", key: "status", value: (r) => r.status },
];

router.get(
  "/reports/committee/:id",
  requireAuth(async (req, res) => {
    const params = GetCommitteeReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [committee] = await db
      .select()
      .from(committeesTable)
      .where(eq(committeesTable.id, params.data.id));
    if (!committee) {
      res.status(404).json({ error: "Committee not found" });
      return;
    }
    if (!(await canAccessCommitteeReport(req.member, committee.id))) {
      res.status(403).json({ error: "Insufficient role" });
      return;
    }

    const sem =
      typeof req.query.semester === "string" && req.query.semester
        ? req.query.semester
        : await getActiveSemester();

    const [agg, memberRows, eventRows] = await Promise.all([
      buildCommitteeAggregate(committee),
      db.select().from(membersTable).where(eq(membersTable.committeeId, committee.id)),
      db
        .select()
        .from(eventsTable)
        .where(and(eq(eventsTable.committeeId, committee.id), eq(eventsTable.semester, sem))),
    ]);

    const members = await Promise.all(memberRows.map((m) => buildMemberDto(m)));
    const events = eventRows.map((e) => eventToDto(e, committee.name));

    const report = {
      committeeId: committee.id,
      name: committee.name,
      chairName: agg.chairName,
      semester: sem,
      memberCount: agg.memberCount,
      totalEventsHosted: agg.totalEventsHosted,
      totalImpactPoints: agg.totalImpactPoints,
      aggregateParticipationPct: agg.aggregateParticipationPct,
      members,
      events,
    };

    const format = req.query.format;
    if (isExportFormat(format)) {
      const meta = {
        title: `${committee.name} Committee Report`,
        filenameBase: `committee-${committee.id}-${sem}`.replace(/\s+/g, "-").toLowerCase(),
        period: sem,
        summary: [
          { label: "Members", value: agg.memberCount },
          { label: "Events Hosted", value: agg.totalEventsHosted },
          { label: "Impact Points", value: agg.totalImpactPoints },
          { label: "Participation", value: `${agg.aggregateParticipationPct}%` },
        ],
      };
      if (format === "csv") return sendCsv(res, meta, MEMBER_ROSTER_COLUMNS, members);
      if (format === "xlsx") {
        return sendXlsx(res, meta, [
          { name: "Members", columns: MEMBER_ROSTER_COLUMNS, rows: members },
          { name: "Events", columns: COMMITTEE_EVENT_COLUMNS, rows: events },
        ]);
      }
      return sendPdf(res, meta, MEMBER_ROSTER_COLUMNS, members);
    }
    res.json(report);
  }),
);

const ATTENDANCE_COLUMNS: ReportColumn<any>[] = [
  { header: "Member", key: "userName", value: (r) => r.userName ?? "" },
  {
    header: "Check-in",
    key: "checkInTime",
    value: (r) => new Date(r.checkInTime).toLocaleString("en-US"),
  },
  { header: "Method", key: "method", value: (r) => r.method },
  { header: "Points", key: "pointsAwarded", value: (r) => r.pointsAwarded },
];

router.get(
  "/reports/event/:id",
  requireAuth(async (req, res) => {
    const params = GetEventReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id));
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    if (!(await canAccessEventReport(req.member, event.committeeId))) {
      res.status(403).json({ error: "Insufficient role" });
      return;
    }

    const [committeeName, attendanceRows] = await Promise.all([
      committeeNameById(event.committeeId),
      db
        .select({ a: attendanceTable, memberName: membersTable.fullName })
        .from(attendanceTable)
        .innerJoin(membersTable, eq(membersTable.id, attendanceTable.userId))
        .where(eq(attendanceTable.eventId, event.id))
        .orderBy(desc(attendanceTable.checkInTime)),
    ]);

    const attendance = attendanceRows.map((r) =>
      attendanceToDto(r.a, r.memberName, event.title),
    );
    const totalPointsAwarded = attendanceRows.reduce((sum, r) => sum + r.a.pointsAwarded, 0);

    const report = {
      event: eventToDto(event, committeeName, null, attendanceRows.length),
      attendance,
      totalAttendees: attendanceRows.length,
      totalPointsAwarded,
    };

    const format = req.query.format;
    if (isExportFormat(format)) {
      const meta = {
        title: `${event.title} — Event Report`,
        filenameBase: `event-${event.id}`,
        period: event.semester,
        summary: [
          { label: "Attendees", value: attendanceRows.length },
          { label: "Points Awarded", value: totalPointsAwarded },
          { label: "Date", value: report.event && (report.event as any).date },
        ],
      };
      if (format === "csv") return sendCsv(res, meta, ATTENDANCE_COLUMNS, attendance);
      if (format === "xlsx")
        return sendXlsx(res, meta, [{ name: "Attendance", columns: ATTENDANCE_COLUMNS, rows: attendance }]);
      return sendPdf(res, meta, ATTENDANCE_COLUMNS, attendance);
    }
    res.json(report);
  }),
);

router.get(
  "/reports/member/:id",
  requireAuth(async (req, res) => {
    const params = GetMemberReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [target] = await db.select().from(membersTable).where(eq(membersTable.id, params.data.id));
    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (!(await canAccessMemberReport(req.member, target.id, target.committeeId))) {
      res.status(403).json({ error: "Insufficient role" });
      return;
    }

    const threshold = await getParticipationThreshold();
    const [{ totalPoints, impactPoints }, { eligible, attended }, committeeName, attendanceRows] =
      await Promise.all([
        memberPointsAndImpact(target.id),
        eventsEligibleForMember(target.id),
        committeeNameById(target.committeeId),
        db
          .select({ a: attendanceTable, eventTitle: eventsTable.title })
          .from(attendanceTable)
          .innerJoin(eventsTable, eq(eventsTable.id, attendanceTable.eventId))
          .where(eq(attendanceTable.userId, target.id))
          .orderBy(desc(attendanceTable.checkInTime)),
      ]);

    const participationPct = eligible > 0 ? Math.round((attended / eligible) * 1000) / 10 : 0;
    const elig = eligibility(
      {
        participationPct,
        totalPoints,
        impactPoints,
        gpa: target.gpa != null ? Number(target.gpa) : null,
        duesPaid: target.duesPaid,
        membershipStatus: target.membershipStatus,
      },
      threshold,
    );

    const member = await buildMemberDto(target);
    const attendance = attendanceRows.map((r) => attendanceToDto(r.a, target.fullName, r.eventTitle));

    const report = {
      member,
      eligibility: {
        userId: target.id,
        fullName: target.fullName,
        committeeName,
        participationPct,
        totalPoints,
        impactPoints,
        gpa: target.gpa != null ? Number(target.gpa) : null,
        duesPaid: target.duesPaid,
        membershipStatus: target.membershipStatus,
        rank: null,
        ...elig,
      },
      attendance,
    };

    const format = req.query.format;
    if (isExportFormat(format)) {
      const meta = {
        title: `${target.fullName} — Member Report`,
        filenameBase: `member-${target.id}`,
        summary: [
          { label: "Participation", value: `${participationPct}%` },
          { label: "Total Points", value: totalPoints },
          { label: "Impact Points", value: impactPoints },
          { label: "Eligible", value: elig.eligible ? "Yes" : "No" },
        ],
      };
      if (format === "csv") return sendCsv(res, meta, ATTENDANCE_COLUMNS, attendance);
      if (format === "xlsx")
        return sendXlsx(res, meta, [{ name: "Attendance", columns: ATTENDANCE_COLUMNS, rows: attendance }]);
      return sendPdf(res, meta, ATTENDANCE_COLUMNS, attendance);
    }
    res.json(report);
  }),
);

export default router;
