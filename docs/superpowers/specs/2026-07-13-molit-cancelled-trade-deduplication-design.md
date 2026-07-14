# MOLIT Cancelled Trade Deduplication Design

## Problem

The MOLIT apartment trade API can return the original trade row and a later cancellation row with the same transaction identity. `apartment_transactions` uses that identity as its upsert key, so sending both rows in one upsert causes PostgreSQL to reject the entire batch.

## Design

Before persistence, collapse matched MOLIT rows by the same identity used by `source_hash`. Preserve the first-seen ordering, but replace an existing active row with a cancellation row when both represent the same trade. This keeps one database row per reported transaction and makes the final row reflect cancellation status.

No database migration is required. The route will upsert the collapsed rows, and its response count will report the number of unique rows submitted for storage.

## Verification

- A regression test reproduces an active/cancelled duplicate pair and expects one cancelled row.
- Existing transaction sync, provider, lint, type, and production build checks remain green.
- After production deployment, re-running the apartment sync stores the unique transaction rows and the production database reports a non-zero count.
