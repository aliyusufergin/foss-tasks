# 0007 — PowerSync bucket storage on Postgres (Beta), not MongoDB

Date: 2026-07-18
Status: Accepted

## Context

The self-hosted PowerSync Service needs a **bucket storage** backend (its precomputed sync-bucket
state), separate from the source-of-truth Postgres. PowerSync supports **MongoDB (GA)** or
**Postgres (Beta)** for this role. Verification (`docs/research/decision-verification-2026-07.md`)
confirmed the Postgres option is labelled **Beta**, on par in capability with MongoDB but not GA.

Key property: the bucket store is **not** the source of truth — it holds derived state that can be
**rebuilt from the source Postgres**. A Beta defect there is recoverable (rebuild), not data loss.

## Decision

Use **Postgres as the PowerSync bucket store**, accepting its Beta status, so the whole stack runs
on **one database engine**. Self-hosters manage a single Postgres, not Postgres + MongoDB.

If the Beta proves problematic before or during v1, fall back to **MongoDB (GA)** — cheap because
the bucket state is rebuildable, not migrated.

## Consequences

**Positive**
- One DB engine to run, back up, and operate in docker-compose — materially simpler for small
  self-hosted deployments.
- No MongoDB knowledge required of self-hosters.

**Negative / costs**
- Rides a **Beta** feature; possible rough edges or breaking changes before it reaches GA.
- Mitigated by: bucket state is rebuildable from source Postgres, and MongoDB GA remains a
  low-cost escape hatch.

## Alternatives considered

- **MongoDB bucket store (GA)** — proven and PowerSync's primary path, but adds a second database
  engine to the self-hosted stack and its ops burden. Rejected for v1 in favour of single-engine
  simplicity; kept as the escape hatch.
- **Start on MongoDB now, migrate to Postgres at GA** — avoids Beta risk now, but pays the
  two-engine ops cost immediately for a migration that is cheap anyway (rebuildable state).
  Rejected: start on the simpler target, fall back only if needed.
