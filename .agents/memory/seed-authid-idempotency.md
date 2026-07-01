---
name: Seed authId idempotency
description: The users table has BOTH a primary key on id AND a unique constraint on email. Re-seeding with a new authId for an existing person hits the email unique constraint even though the id conflict clause handles the id correctly.
---

The `users` table has two unique constraints: `id` (PK) and `email`. The seed uses `onConflictDoUpdate({ target: usersTable.id })` which only handles the id conflict path.

If a reseed changes a person's authId (e.g. Andre Coleman from `seed-bylaws-003` → `seed-exec-treasurer-003`), the insert with the new id won't match the id conflict, so Postgres tries a plain INSERT — and the existing email fires the `users_email_unique` constraint.

**Why:** Discovered during V2 Phase 0 reseed when Andre Coleman's logical role changed (BylawsChair → ExecutiveBoard/Treasurer) and the authId was updated to reflect the new role prefix.

**How to apply:** When updating the seed, always keep the original authId for any person who already exists in the DB. Rename the authId prefix only for genuinely new seed records. Document the old authId in a comment when the role changes (e.g., `// Previously BylawsChair, now ExecutiveBoard/Treasurer in V2`).

Existing authIds in the C100 seed DB (as of V2 Phase 0):
- seed-admin-001: Marcus Bell
- seed-exec-002: Jordan Whitfield
- seed-bylaws-003: Andre Coleman (role upgraded to ExecutiveBoard, authId unchanged)
- seed-chair-mentoring-004: Devon Patrick
- seed-chair-education-005: Terrence Hall
- seed-chair-econ-006: Roland Carter
- seed-chair-health-007: Isaiah Booker
- seed-member-008: Trent Jeffries
- seed-member-009: Khalil Spencer
- seed-member-010: Brandon Sims
- seed-member-011: Cameron Vaughn
- seed-member-012: Malachi Reese
- seed-member-013: Nathaniel Brooks
- seed-member-014: Donovan Pierce
- seed-member-015: Reggie Holloway
- seed-chair-service-016: Darius Freeman (new in V2)
