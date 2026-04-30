import {
  db,
  committeesTable,
  membersTable,
  eventsTable,
  attendanceTable,
  semesterConfigTable,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const CURRENT_SEMESTER = "Spring 2026";

const COMMITTEES = [
  {
    name: "Mentoring",
    description:
      "Pairs Trailblazer members with FVSU underclassmen and local high-school students to model accountability, study habits, and post-graduation planning.",
    fourForFutureAlignment: "Mentor",
  },
  {
    name: "Education",
    description:
      "Runs academic workshops, study halls, and faculty-led talks. Holds members to the chapter's GPA standards.",
    fourForFutureAlignment: "Educate",
  },
  {
    name: "Economic Development",
    description:
      "Hosts financial-literacy series, professional development clinics, and chapter fundraising for community partners.",
    fourForFutureAlignment: "Empower",
  },
  {
    name: "Health & Wellness",
    description:
      "Coordinates blood drives, mental-health programming, and community fitness events across Fort Valley.",
    fourForFutureAlignment: "Engage",
  },
  {
    name: "Bylaws",
    description:
      "Stewards the chapter constitution, conducts bylaw review, and supports the Bylaws Chair on governance matters.",
    fourForFutureAlignment: "Educate",
  },
];

const SEED_MEMBERS = [
  {
    authId: "seed-admin-001",
    fullName: "Marcus Bell",
    email: "marcus.bell@fvsu.edu",
    studentId: "FV2023-1001",
    role: "Admin" as const,
    committeeName: "Bylaws",
    gpa: "3.78",
    graduationYear: 2026,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Active",
    streakCount: 8,
  },
  {
    authId: "seed-exec-002",
    fullName: "Jordan Whitfield",
    email: "jordan.whitfield@fvsu.edu",
    studentId: "FV2023-1002",
    role: "ExecutiveBoard" as const,
    committeeName: "Education",
    gpa: "3.65",
    graduationYear: 2026,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Active",
    streakCount: 6,
  },
  {
    authId: "seed-bylaws-003",
    fullName: "Andre Coleman",
    email: "andre.coleman@fvsu.edu",
    studentId: "FV2024-1003",
    role: "BylawsChair" as const,
    committeeName: "Bylaws",
    gpa: "3.52",
    graduationYear: 2027,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Active",
    streakCount: 5,
  },
  {
    authId: "seed-chair-mentoring-004",
    fullName: "Devon Patrick",
    email: "devon.patrick@fvsu.edu",
    studentId: "FV2023-1004",
    role: "CommitteeChair" as const,
    committeeName: "Mentoring",
    gpa: "3.41",
    graduationYear: 2026,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Active",
    streakCount: 4,
  },
  {
    authId: "seed-chair-education-005",
    fullName: "Terrence Hall",
    email: "terrence.hall@fvsu.edu",
    studentId: "FV2023-1005",
    role: "CommitteeChair" as const,
    committeeName: "Education",
    gpa: "3.83",
    graduationYear: 2026,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Active",
    streakCount: 7,
  },
  {
    authId: "seed-chair-econ-006",
    fullName: "Roland Carter",
    email: "roland.carter@fvsu.edu",
    studentId: "FV2024-1006",
    role: "CommitteeChair" as const,
    committeeName: "Economic Development",
    gpa: "3.27",
    graduationYear: 2027,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Active",
    streakCount: 3,
  },
  {
    authId: "seed-chair-health-007",
    fullName: "Isaiah Booker",
    email: "isaiah.booker@fvsu.edu",
    studentId: "FV2024-1007",
    role: "CommitteeChair" as const,
    committeeName: "Health & Wellness",
    gpa: "3.55",
    graduationYear: 2027,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Active",
    streakCount: 5,
  },
  {
    authId: "seed-member-008",
    fullName: "Trent Jeffries",
    email: "trent.jeffries@fvsu.edu",
    studentId: "FV2025-1008",
    role: "Member" as const,
    committeeName: "Mentoring",
    gpa: "3.02",
    graduationYear: 2028,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Active",
    streakCount: 4,
  },
  {
    authId: "seed-member-009",
    fullName: "Khalil Spencer",
    email: "khalil.spencer@fvsu.edu",
    studentId: "FV2025-1009",
    role: "Member" as const,
    committeeName: "Education",
    gpa: "3.31",
    graduationYear: 2028,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Warning",
    streakCount: 2,
  },
  {
    authId: "seed-member-010",
    fullName: "Brandon Sims",
    email: "brandon.sims@fvsu.edu",
    studentId: "FV2024-1010",
    role: "Member" as const,
    committeeName: "Economic Development",
    gpa: "2.89",
    graduationYear: 2027,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "AtRisk",
    streakCount: 1,
  },
  {
    authId: "seed-member-011",
    fullName: "Cameron Vaughn",
    email: "cameron.vaughn@fvsu.edu",
    studentId: "FV2024-1011",
    role: "Member" as const,
    committeeName: "Health & Wellness",
    gpa: "3.18",
    graduationYear: 2027,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Active",
    streakCount: 3,
  },
  {
    authId: "seed-member-012",
    fullName: "Malachi Reese",
    email: "malachi.reese@fvsu.edu",
    studentId: "FV2025-1012",
    role: "Member" as const,
    committeeName: "Mentoring",
    gpa: "3.44",
    graduationYear: 2028,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Active",
    streakCount: 5,
  },
  {
    authId: "seed-member-013",
    fullName: "Nathaniel Brooks",
    email: "nathaniel.brooks@fvsu.edu",
    studentId: "FV2024-1013",
    role: "Member" as const,
    committeeName: "Education",
    gpa: "2.65",
    graduationYear: 2027,
    duesPaid: false,
    membershipStatus: "Probationary",
    nudgeStatus: "Critical",
    streakCount: 0,
  },
  {
    authId: "seed-member-014",
    fullName: "Donovan Pierce",
    email: "donovan.pierce@fvsu.edu",
    studentId: "FV2025-1014",
    role: "Member" as const,
    committeeName: "Health & Wellness",
    gpa: "3.61",
    graduationYear: 2028,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Active",
    streakCount: 6,
  },
  {
    authId: "seed-member-015",
    fullName: "Reggie Holloway",
    email: "reggie.holloway@fvsu.edu",
    studentId: "FV2025-1015",
    role: "Member" as const,
    committeeName: "Bylaws",
    gpa: "3.22",
    graduationYear: 2028,
    duesPaid: true,
    membershipStatus: "Active",
    nudgeStatus: "Warning",
    streakCount: 2,
  },
];

const SEED_EVENTS = [
  {
    title: "January General Body Meeting",
    description: "Spring kickoff, semester goals, and standards review.",
    eventType: "GeneralBodyMeeting",
    committeeName: null as string | null,
    date: "2026-01-22",
    startTime: "18:00",
    endTime: "19:30",
    location: "Founders Hall, Room 210",
    pointValue: 10,
    impactMultiplier: "1.00",
    status: "Completed",
  },
  {
    title: "Mentoring Night with Peach County HS",
    description: "Trailblazers mentor 9th-10th graders on study habits and college planning.",
    eventType: "MentoringSession",
    committeeName: "Mentoring",
    date: "2026-02-05",
    startTime: "17:30",
    endTime: "20:00",
    location: "Peach County High School",
    pointValue: 12,
    impactMultiplier: "1.50",
    status: "Completed",
  },
  {
    title: "Financial Literacy Workshop",
    description: "Local CPA leads a session on credit, budgeting, and post-graduation finances.",
    eventType: "Workshop",
    committeeName: "Economic Development",
    date: "2026-02-19",
    startTime: "18:00",
    endTime: "19:30",
    location: "Stallworth Building, Room 105",
    pointValue: 10,
    impactMultiplier: "1.00",
    status: "Completed",
  },
  {
    title: "Spring Blood Drive",
    description: "Joint event with American Red Cross. Members staff intake, recovery, and outreach.",
    eventType: "CommunityService",
    committeeName: "Health & Wellness",
    date: "2026-03-04",
    startTime: "10:00",
    endTime: "16:00",
    location: "Pettigrew Center",
    pointValue: 15,
    impactMultiplier: "2.00",
    status: "Completed",
  },
  {
    title: "February General Body Meeting",
    description: "Committee updates, conference selection criteria, and bylaws Q&A.",
    eventType: "GeneralBodyMeeting",
    committeeName: null,
    date: "2026-02-26",
    startTime: "18:00",
    endTime: "19:30",
    location: "Founders Hall, Room 210",
    pointValue: 10,
    impactMultiplier: "1.00",
    status: "Completed",
  },
  {
    title: "Tonight: Chapter Service Day Planning",
    description: "Active QR check-in. Plan logistics for the April community service day.",
    eventType: "CommitteeMeeting",
    committeeName: "Mentoring",
    date: new Date().toISOString().slice(0, 10),
    startTime: "18:30",
    endTime: "20:00",
    location: "Founders Hall, Room 305",
    pointValue: 8,
    impactMultiplier: "1.00",
    status: "Active",
    qrActive: true,
  },
  {
    title: "Spring Scholarship Fundraiser",
    description: "Chapter dinner & silent auction supporting the Trailblazer scholarship fund.",
    eventType: "Fundraiser",
    committeeName: "Economic Development",
    date: "2026-05-09",
    startTime: "18:30",
    endTime: "21:30",
    location: "FVSU Alumni Center",
    pointValue: 12,
    impactMultiplier: "1.50",
    status: "Upcoming",
  },
  {
    title: "Regional Collegiate 100 Conference",
    description: "Travel event. Chapter delegates present at the regional conference.",
    eventType: "Conference",
    committeeName: null,
    date: "2026-05-22",
    startTime: "08:00",
    endTime: "20:00",
    location: "Atlanta, GA",
    pointValue: 25,
    impactMultiplier: "2.00",
    status: "Upcoming",
  },
];

async function main() {
  console.log("Seeding C100 system...");

  await db
    .insert(semesterConfigTable)
    .values({
      semester: CURRENT_SEMESTER,
      participationThreshold: "75.00",
      startDate: "2026-01-08",
      endDate: "2026-05-15",
      active: true,
    })
    .onConflictDoNothing();

  for (const c of COMMITTEES) {
    await db
      .insert(committeesTable)
      .values(c)
      .onConflictDoNothing({ target: committeesTable.name });
  }

  const allCommittees = await db.select().from(committeesTable);
  const committeeByName = new Map(allCommittees.map((c) => [c.name, c]));

  const userIdByAuthId = new Map<string, string>();
  for (const m of SEED_MEMBERS) {
    const [user] = await db
      .insert(usersTable)
      .values({
        id: m.authId,
        email: m.email,
        firstName: m.fullName.split(" ")[0]!,
        lastName: m.fullName.split(" ").slice(1).join(" "),
        profileImageUrl: null,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: { email: m.email, updatedAt: new Date() },
      })
      .returning();
    userIdByAuthId.set(m.authId, user!.id);
  }

  const memberIdByAuthId = new Map<string, number>();
  for (const m of SEED_MEMBERS) {
    const committee = committeeByName.get(m.committeeName);
    const [row] = await db
      .insert(membersTable)
      .values({
        authId: m.authId,
        fullName: m.fullName,
        email: m.email,
        studentId: m.studentId,
        gpa: m.gpa,
        graduationYear: m.graduationYear,
        role: m.role,
        committeeId: committee?.id ?? null,
        membershipStatus: m.membershipStatus,
        duesPaid: m.duesPaid,
        nudgeStatus: m.nudgeStatus,
        streakCount: m.streakCount,
      })
      .onConflictDoUpdate({
        target: membersTable.authId,
        set: {
          fullName: m.fullName,
          email: m.email,
          role: m.role,
          committeeId: committee?.id ?? null,
          membershipStatus: m.membershipStatus,
          duesPaid: m.duesPaid,
          nudgeStatus: m.nudgeStatus,
          streakCount: m.streakCount,
          updatedAt: new Date(),
        },
      })
      .returning();
    memberIdByAuthId.set(m.authId, row!.id);
  }

  // Set committee chairs.
  const chairAssignments: Record<string, string> = {
    Mentoring: "seed-chair-mentoring-004",
    Education: "seed-chair-education-005",
    "Economic Development": "seed-chair-econ-006",
    "Health & Wellness": "seed-chair-health-007",
    Bylaws: "seed-bylaws-003",
  };
  for (const [committeeName, chairAuthId] of Object.entries(chairAssignments)) {
    const committee = committeeByName.get(committeeName);
    const chairMemberId = memberIdByAuthId.get(chairAuthId);
    if (committee && chairMemberId) {
      await db
        .update(committeesTable)
        .set({ chairUserId: chairMemberId })
        .where(eq(committeesTable.id, committee.id));
    }
  }

  // Events
  const adminMemberId = memberIdByAuthId.get("seed-admin-001")!;
  const eventIdByTitle = new Map<string, number>();
  for (const e of SEED_EVENTS) {
    const committeeId = e.committeeName
      ? (committeeByName.get(e.committeeName)?.id ?? null)
      : null;
    const [row] = await db
      .insert(eventsTable)
      .values({
        title: e.title,
        description: e.description,
        eventType: e.eventType,
        committeeId,
        createdBy: adminMemberId,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        pointValue: e.pointValue,
        impactMultiplier: e.impactMultiplier,
        qrActive: e.qrActive ?? false,
        status: e.status,
        semester: CURRENT_SEMESTER,
      })
      .onConflictDoNothing()
      .returning();
    if (row) eventIdByTitle.set(e.title, row.id);
  }

  // Attendance for completed events — most members attended most things.
  const completedEventTitles = SEED_EVENTS.filter(
    (e) => e.status === "Completed",
  ).map((e) => e.title);
  for (let i = 0; i < SEED_MEMBERS.length; i++) {
    const m = SEED_MEMBERS[i]!;
    const memberId = memberIdByAuthId.get(m.authId);
    if (!memberId) continue;
    // Vary attendance: critical members attend few, active members attend most.
    const attendRate =
      m.nudgeStatus === "Critical"
        ? 0.25
        : m.nudgeStatus === "AtRisk"
          ? 0.5
          : m.nudgeStatus === "Warning"
            ? 0.7
            : 0.95;
    for (const title of completedEventTitles) {
      const eventId = eventIdByTitle.get(title);
      if (!eventId) continue;
      // Deterministic-ish so re-running stays sane
      const seed = (memberId * 7 + eventId * 13) % 100;
      if (seed > attendRate * 100) continue;
      const event = SEED_EVENTS.find((e) => e.title === title)!;
      const points = Math.round(
        event.pointValue * Number(event.impactMultiplier),
      );
      await db
        .insert(attendanceTable)
        .values({
          userId: memberId,
          eventId,
          method: "QrScan",
          pointsAwarded: points,
          semester: CURRENT_SEMESTER,
        })
        .onConflictDoNothing();
    }
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
