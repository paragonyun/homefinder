# MOLIT Apartment Matching Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match apartments such as 돈암삼성 to the MOLIT source name `돈암동삼성` by exact structured address evidence, rank up to 20 safe same-dong candidates by explainable similarity, and fall back from 12 to 36 months only when the primary window has no match.

**Architecture:** Extend normalized MOLIT trades with separate lot and road-address evidence, then use a pure matching service to combine exact address evidence with normalized-name similarity. The transaction route will load K-apt legal/road addresses, provide structured hints, persist automatically discovered aliases, and query an extended recent window only after the first 12 months fail. Candidate evidence remains serializable for the existing client panel.

**Tech Stack:** Next.js 16.2.6 App Router route handlers, TypeScript, React client components, Supabase, Vitest, Vercel.

## Global Constraints

- Preserve unrelated user changes in the original `/Users/jsy/Documents/Codex/homefinder` checkout.
- Use the installed Next.js 16.2.6 documentation under `node_modules/next/dist/docs/` rather than older conventions.
- Require the same legal dong when MOLIT supplies `umdCd`; never match road number `24` to lot `524` or `624`.
- Automatically accept a fuzzy name only when a unique exact lot/road address also matches; ambiguous candidates remain manual selections.
- Show at most 20 candidates, ordered by match score before transaction count, with human-readable match reasons.
- Keep the normal successful sync window at 12 months; inspect months 13–36 only when no transaction matched in the first 12.
- Do not add a database migration or a new dependency.
- Follow red-green-refactor for every behavior change and run the full verification suite before committing or deploying.

---

### Task 1: Normalize structured MOLIT address evidence

**Files:**
- Modify: `src/lib/data-providers/molit-transactions.ts`
- Test: `src/lib/data-providers/molit-transactions.test.ts`

**Interfaces:**
- Produces: optional `lotNumberFromSource: string | null` and `roadAddressFromSource: string | null` fields on `MolitApartmentTrade`.
- Preserves: `addressFromSource` as the existing `법정동 + 지번` display/storage value.

- [ ] **Step 1: Write the failing parser test**

Add a MOLIT XML record containing `jibun=15-1`, `roadNm=동소문로34길`, `roadNmBonbun=24`, and `roadNmBubun=0`, then assert:

```ts
expect(result.transactions[0]).toMatchObject({
  apartmentNameFromSource: "돈암동삼성",
  addressFromSource: "돈암동 15-1",
  lotNumberFromSource: "15-1",
  roadAddressFromSource: "동소문로34길 24",
});
```

- [ ] **Step 2: Run the focused parser test and verify RED**

Run: `npm test -- src/lib/data-providers/molit-transactions.test.ts`

Expected: FAIL because the structured fields do not exist.

- [ ] **Step 3: Implement structured source fields**

Add the optional trade fields and construct the road building number from MOLIT fields without including a zero sub-number:

```ts
const roadName = cleanText(readFirst(record, ["roadNm", "도로명"]));
const roadMain = parseInteger(readFirst(record, ["roadNmBonbun", "도로명건물본번호코드"]));
const roadSub = parseInteger(readFirst(record, ["roadNmBubun", "도로명건물부번호코드"]));
const roadBuildingNumber = roadMain === null
  ? null
  : roadSub && roadSub > 0
    ? `${roadMain}-${roadSub}`
    : String(roadMain);

setOptional(trade, "lotNumberFromSource", jibun);
setOptional(
  trade,
  "roadAddressFromSource",
  [roadName, roadBuildingNumber].filter(Boolean).join(" ") || null,
);
```

- [ ] **Step 4: Run the focused parser test and verify GREEN**

Run: `npm test -- src/lib/data-providers/molit-transactions.test.ts`

Expected: the parser test file passes.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/data-providers/molit-transactions.ts src/lib/data-providers/molit-transactions.test.ts
git commit -m "Parse MOLIT source addresses"
```

---

### Task 2: Score exact-address and fuzzy-name matches

**Files:**
- Modify: `src/lib/services/molit-transaction-matching.ts`
- Modify: `src/lib/services/apartment-transaction-sync.ts`
- Test: `src/lib/services/molit-transaction-matching.test.ts`
- Test: `src/lib/services/apartment-transaction-sync.test.ts`

**Interfaces:**
- Produces: `MolitAddressHints` with `lotNumbers`, `roadBuildingNumbers`, and `legalDongNames`.
- Produces: `getMolitAddressHints({ legalAddresses, roadAddresses, fallbackAddresses })`.
- Changes: matching/candidate functions consume `addressHints` rather than untyped number tokens.
- Extends: candidates with `score`, `nameSimilarity`, and `matchReasons` values from `lot_exact`, `road_exact`, `name_exact`, `name_similar`.

- [ ] **Step 1: Write failing structured-address tests**

Add assertions that:

```ts
expect(getMolitAddressHints({
  legalAddresses: ["서울특별시 성북구 돈암동 15-1 돈암삼성"],
  roadAddresses: ["서울특별시 성북구 동소문로34길 24"],
  fallbackAddresses: [],
})).toEqual({
  lotNumbers: ["15-1"],
  roadBuildingNumbers: ["24"],
  legalDongNames: ["돈암동"],
});
```

Also assert that target road number `24` does not make `돈암동 524` or `돈암동 624` an address match.

- [ ] **Step 2: Write failing 돈암삼성 matching and ranking tests**

Create three same-dong trades: `돈암동삼성/15-1`, `일신건영휴먼빌아파트/524`, and `구현대/624`. Assert that filtering target names `돈암삼성아파트`, `돈암삼성` returns only `돈암동삼성`, and that the candidate builder ranks it first with `lot_exact` and `name_similar`. Assert candidate output is capped at 20 and score ordering wins over transaction volume.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
npm test -- src/lib/services/molit-transaction-matching.test.ts src/lib/services/apartment-transaction-sync.test.ts
```

Expected: FAIL because structured hints, fuzzy scoring, reason fields, and the 20-candidate limit do not exist.

- [ ] **Step 4: Implement hint parsing and exact equality**

Parse only the final legal lot/building number and classify fallback addresses by road (`로`/`길`) versus legal (`동`/`읍`/`면`/`리`) form. Normalize leading zeroes per number segment and compare exact normalized values only:

```ts
export type MolitAddressHints = {
  lotNumbers: string[];
  roadBuildingNumbers: string[];
  legalDongNames: string[];
};
```

- [ ] **Step 5: Implement explainable name similarity and candidate scores**

Use normalized suffix-stripped variants plus Dice bigram similarity. Compare locality-prefixed forms by also removing the current legal-dong prefix, but never auto-match a generic fuzzy name without exact address evidence. Apply these score components:

```ts
const score =
  (lotExact || roadExact ? 100 : 0) +
  (nameExact ? 80 : Math.round(nameSimilarity * 50));
```

Filter automatic fuzzy matches with:

```ts
const canAutoMatch =
  (lotExact || roadExact) && nameSimilarity >= 0.45;
```

Group candidates by source name, retain representative `aptSeq`, exact-address evidence, and reasons, sort by score/name similarity/count, and slice to 20.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/lib/services/molit-transaction-matching.test.ts src/lib/services/apartment-transaction-sync.test.ts
```

Expected: both test files pass.

- [ ] **Step 7: Refactor while keeping focused tests green**

Extract pure helpers for number normalization, Dice similarity, and source evidence evaluation; do not change thresholds or add dependencies.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/lib/services/molit-transaction-matching.ts src/lib/services/apartment-transaction-sync.ts src/lib/services/molit-transaction-matching.test.ts src/lib/services/apartment-transaction-sync.test.ts
git commit -m "Improve MOLIT apartment matching"
```

---

### Task 3: Integrate K-apt hints, adaptive fallback, aliases, and candidate UI

**Files:**
- Modify: `src/app/api/apartments/[id]/transactions/sync/route.ts`
- Modify: `src/lib/services/apartment-transaction-sync.ts`
- Modify: `src/lib/services/apartment-transaction-sync.test.ts`
- Modify: `src/lib/services/molit-transaction-matching.ts`
- Modify: `src/lib/services/molit-transaction-matching.test.ts`
- Create: `src/lib/services/molit-candidate-presentation.ts`
- Create: `src/lib/services/molit-candidate-presentation.test.ts`
- Modify: `src/components/apartments/apartment-detail-client.tsx`

**Interfaces:**
- Route reads `apartment_basic_info.legal_address_from_source` and `road_address_from_source`.
- Recent collection accepts a 36-month list plus `primaryMonthCount: 12`, stopping after month 12 when any primary-window match exists.
- Sync result exposes distinct `matchedSourceNames` so automatically discovered MOLIT names can be persisted as aliases.
- Presentation helper maps reason codes to `지번 일치`, `도로명 일치`, `이름 일치`, `이름 유사 N%`.
- The comprehensive client flow resolves/syncs K-apt basic info before requesting MOLIT transactions, so a newly added apartment can use the legal-lot hint on its first full lookup.
- Candidate cards retain representative MOLIT legal/road addresses even when those addresses are not exact matches; reason codes separately identify exact evidence.

- [ ] **Step 1: Write the failing adaptive-window test**

Assert that a 36-month request calls `fetchPages` 12 times when a primary-window match exists, but calls all 36 months when no primary-window match exists and can find a matching older transaction.

- [ ] **Step 2: Write the failing matched-source and presentation tests**

Assert that a fuzzy exact-address match exposes `matchedSourceNames: ["돈암동삼성"]`, and:

```ts
expect(formatMolitCandidateReasons({
  matchReasons: ["lot_exact", "name_similar"],
  nameSimilarity: 0.86,
})).toEqual(["지번 일치", "이름 유사 86%"]);
```

Also assert that a same-dong candidate without exact address evidence still contains its representative `addressFromSource`, allowing the operator to distinguish similarly named complexes.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
npm test -- src/lib/services/apartment-transaction-sync.test.ts src/lib/services/molit-candidate-presentation.test.ts
```

Expected: FAIL because adaptive stopping, matched source names, and the presentation helper are missing.

- [ ] **Step 4: Implement adaptive collection and matched source names**

Keep manual mode unchanged. In recent mode, process the first 12 months; return after month 12 if any transaction matched. Otherwise continue through the provided fallback months. Derive distinct non-empty MOLIT source names from matched transactions.

- [ ] **Step 5: Load K-apt address hints and persist discovered aliases**

After loading the apartment, query:

```ts
supabase
  .from("apartment_basic_info")
  .select("legal_address_from_source,road_address_from_source")
  .eq("apartment_id", apartmentId)
  .maybeSingle();
```

Build hints from basic-info addresses and classify apartment fallback addresses. For automatic recent syncs, request 36 months with `primaryMonthCount: 12`; explicit `dealYmd`/`months` requests keep their selected scope. Upsert each newly matched source name as a `source: "molit"` alias after transaction persistence.

Move the comprehensive client flow's transaction request after K-apt code resolution/basic-info sync. Even when K-apt sync fails or requires manual selection, continue with the transaction request using fallback apartment addresses.

- [ ] **Step 6: Add candidate reason presentation and UI badges**

Render the score and reason labels above the existing candidate address summary. Keep the current manual `이 이름으로 조회` action and disabled states.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/lib/services/apartment-transaction-sync.test.ts src/lib/services/molit-candidate-presentation.test.ts
```

Expected: both test files pass.

- [ ] **Step 8: Run complete local verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, ESLint exits with zero warnings/errors, and Next.js production build exits 0.

- [ ] **Step 9: Commit Task 3**

```bash
git add src/app/api/apartments/[id]/transactions/sync/route.ts src/lib/services/apartment-transaction-sync.ts src/lib/services/apartment-transaction-sync.test.ts src/lib/services/molit-candidate-presentation.ts src/lib/services/molit-candidate-presentation.test.ts src/components/apartments/apartment-detail-client.tsx
git commit -m "Use K-apt hints for MOLIT sync"
```

---

### Task 4: Final review, production deployment, and 돈암삼성 verification

**Files:**
- Modify only files required by review findings.

**Interfaces:**
- Consumes all Task 1–3 behavior.
- Produces a pushed commit, READY Vercel production deployment, and verified 돈암삼성 transaction data.

- [ ] **Step 1: Run a whole-branch code review**

Review the complete diff from `fcdb145` to HEAD for spec compliance, false-positive risk, API/runtime cost, and client serialization. Fix every Critical/Important finding with focused tests.

- [ ] **Step 2: Re-run fresh verification**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Push and deploy the verified artifact**

Push `codex/improve-molit-matching`, deploy the exact tested worktree to Vercel production, and inspect until status is `READY`.

- [ ] **Step 4: Trigger and verify 돈암삼성 in production**

Use the authenticated production UI to run `아파트 종합 정보 조회하기` for apartment `fdd2d259-896f-4f79-8d81-4f936abc579d`. Verify the sync matches source `돈암동삼성`, persists alias `돈암동삼성`, stores active transactions from `돈암동 15-1`, and no longer recommends `524`/`624` because of road number `24`.

- [ ] **Step 5: Record deployment evidence**

Capture deployment URL/status, commit SHA, transaction count/latest trade, and any remaining operational caveats in the handoff.
