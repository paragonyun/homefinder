# Apartment Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rule-based 100-point scoring model for registered apartments and surface it on the dashboard, compare page, and apartment detail page.

**Architecture:** Keep API routes and Supabase schema unchanged. Add one pure scoring service that accepts normalized apartment facts and returns total score, category scores, missing-data warnings, and evidence labels. Existing dashboard/comparison/detail model builders call the service and UI components render the result.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Supabase browser client, Vitest, Tailwind CSS.

---

### Task 1: Scoring Service

**Files:**
- Create: `src/lib/services/apartment-scoring.ts`
- Create: `src/lib/services/apartment-scoring.test.ts`

- [ ] Write failing tests for budget strong penalty, Yeouido/Gangnam 6:4 access weighting, floor-area-ratio fallback, 500-household minimum preference, and field-note strong weighting.
- [ ] Implement `scoreApartmentCandidate(input)` returning `totalScore`, category scores, warnings, and evidence labels.
- [ ] Run `npx vitest run src/lib/services/apartment-scoring.test.ts` and keep it green.

### Task 2: Dashboard Integration

**Files:**
- Modify: `src/lib/services/dashboard-model.ts`
- Modify: `src/lib/services/dashboard-model.test.ts`
- Modify: `src/components/dashboard/dashboard-client.tsx`

- [ ] Add field note input to `buildDashboardModel`.
- [ ] Add `score` to `DashboardApartmentSummary`.
- [ ] Sort priority apartments by the new score.
- [ ] Render score, category breakdown, and missing-data warnings in the dashboard priority list.

### Task 3: Compare Integration

**Files:**
- Modify: `src/lib/services/apartment-comparison.ts`
- Modify: `src/lib/services/apartment-comparison.test.ts`
- Modify: `src/components/compare/compare-client.tsx`

- [ ] Add `score` to `ApartmentComparisonRow`.
- [ ] Render total score and category breakdown in desktop table and mobile cards.
- [ ] Keep existing filters and metrics unchanged.

### Task 4: Detail Integration

**Files:**
- Modify: `src/components/apartments/apartment-detail-client.tsx`

- [ ] Compute score from the loaded apartment facts.
- [ ] Add a compact score summary to the hero metrics.
- [ ] Add a breakdown panel with warnings such as `용적률 수기 확인 필요`, `임장 후기 없음`, and `접근성 미조회`.

### Task 5: Verification

**Files:**
- No new files.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Commit, push, and confirm Vercel production deployment is READY.
