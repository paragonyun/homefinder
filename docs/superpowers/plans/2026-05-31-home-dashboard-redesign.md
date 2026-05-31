# Home Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the home screen as a neighborhood portfolio dashboard with priority apartment candidates.

**Architecture:** Keep the backend unchanged. Add a pure dashboard model service that combines neighborhoods, apartments, transactions, K-apt basic info, and commute rows, then render it through a client-only dashboard component on `/`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Supabase browser client, Vitest.

---

## Files

- Create `src/lib/services/dashboard-model.ts`: pure data aggregation, neighborhood summaries, and priority ranking.
- Create `src/lib/services/dashboard-model.test.ts`: unit tests for portfolio summaries, missing-data badges, and ranking.
- Create `src/components/dashboard/dashboard-client.tsx`: Supabase session loading and responsive dashboard UI.
- Modify `src/app/page.tsx`: replace the old mock dashboard with `DashboardClient`.
- Modify `docs/TASKS.md`: mark the home dashboard redesign as implemented if a clear section exists.

## Task 1: Dashboard Model

**Files:**
- Create: `src/lib/services/dashboard-model.ts`
- Test: `src/lib/services/dashboard-model.test.ts`

- [ ] **Step 1: Write tests for neighborhood summaries**

Create tests that pass two neighborhoods, three apartments, transactions, basic info, and commute rows. Assert that:

- neighborhood count is correct
- price range uses transaction prices
- representative apartments are limited to two
- missing price and commute badges appear only when data is absent

- [ ] **Step 2: Implement `buildDashboardModel`**

Expose:

```ts
export function buildDashboardModel(input: DashboardModelInput): DashboardModel
```

The function should return:

- `summary`: total neighborhoods, active apartments, with price, with commute
- `neighborhoods`: card models sorted by active apartment count, then name
- `priorityApartments`: ranked candidates, max five

- [ ] **Step 3: Verify task 1**

Run:

```powershell
npm test -- src/lib/services/dashboard-model.test.ts
```

Expected: new dashboard model tests pass.

## Task 2: Dashboard UI

**Files:**
- Create: `src/components/dashboard/dashboard-client.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the old home page shell**

`src/app/page.tsx` should render only:

```tsx
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { AppShell } from "@/components/layout/app-shell";

export default function Home() {
  return (
    <AppShell>
      <DashboardClient />
    </AppShell>
  );
}
```

- [ ] **Step 2: Add Supabase data loading**

`DashboardClient` should:

- read session with `supabase.auth.getSession()`
- load `neighborhoods`, `apartments`, `apartment_transactions`, `apartment_basic_info`, and `commute_times`
- gracefully ignore `42P01` for optional tables
- show mock dashboard when Supabase is unavailable or logged out

- [ ] **Step 3: Add responsive UI sections**

Render:

- compact page header
- `PortfolioSummaryStrip`
- `NeighborhoodPortfolioGrid`
- `PriorityApartmentList`

Use cards and responsive grids, not wide tables.

- [ ] **Step 4: Verify task 2**

Run:

```powershell
npm run lint
npx tsc --noEmit
```

Expected: lint and typecheck pass.

## Task 3: Integration Verification and Deploy

**Files:**
- Modify only if verification reveals a bug in task 1 or task 2 files.

- [ ] **Step 1: Run full local checks**

Run:

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Expected: all checks pass.

- [ ] **Step 2: Browser QA**

Start a local production server and verify `/` at desktop and mobile widths:

- page renders without horizontal overflow
- logged-out mock state is usable
- cards and priority list remain readable on mobile

- [ ] **Step 3: Commit, push, and deploy**

Commit implementation, push `main`, then verify Vercel production deployment is `READY` and `https://homefinder-opal.vercel.app/` returns `200 OK`.
