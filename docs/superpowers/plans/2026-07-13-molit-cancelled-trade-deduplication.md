# MOLIT Cancelled Trade Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a MOLIT active/cancelled duplicate pair from aborting the complete apartment transaction upsert.

**Architecture:** Add a pure transaction-collapse function beside the existing MOLIT payload/hash logic. The API route passes matched transactions through it before upsert and reports the persisted unique count.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, Supabase/PostgreSQL, Vercel

## Global Constraints

- Do not change the database schema or existing unique constraint.
- Use the existing transaction identity represented by `source_hash`.
- Prefer a cancellation row when active and cancelled versions share an identity.

---

### Task 1: Collapse duplicate MOLIT transactions

**Files:**
- Modify: `src/lib/services/apartment-transaction-sync.ts`
- Test: `src/lib/services/apartment-transaction-sync.test.ts`

**Interfaces:**
- Produces: `collapseMolitTransactions(transactions, apartmentId)` returning unique `MolitApartmentTrade[]` rows.

- [ ] Write a failing test with matching active and cancellation rows.
- [ ] Run the focused test and verify the duplicate remains before implementation.
- [ ] Implement identity-based collapse that prefers the cancellation row.
- [ ] Run the focused tests and verify they pass.

### Task 2: Persist only collapsed transactions

**Files:**
- Modify: `src/app/api/apartments/[id]/transactions/sync/route.ts`
- Test: `src/lib/services/apartment-transaction-sync.test.ts`

**Interfaces:**
- Consumes: `collapseMolitTransactions(transactions, apartmentId)`.
- Produces: a duplicate-free Supabase upsert payload and unique `matchedCount` response.

- [ ] Use the collapse function before building the upsert payload.
- [ ] Return the collapsed count from the route response.
- [ ] Run transaction tests, lint, type checks, and production build.
- [ ] Deploy to Vercel Production and verify the production sync/database result.
