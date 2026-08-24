# DigiHost — Blacklisting Release Prototype (Full SOP)

A fully functional, end-to-end prototype that implements the **complete Blacklisting Release SOP** for cheque and NPA cases, as used in DigiHost.

> **One prototype, full coverage:** initiation with DigiHost auto-population + manual fallback, 6 release types, maker-checker review, BROPs pool claim, auto-generated CIB release letters (individual vs entity), CAD/CIC final validation with mandatory attachments, CIB reporting/return handling, partial & temporary releases, eligible auto-unfreeze, in-system notifications, and immutable audit trail — with email-based case movement eliminated.

---

## 1. How this matches the full Blacklisting Releases Document

### SOP → Prototype mapping

| SOP Requirement | How prototype implements it |
|---|---|
| **DigiHost auto-population** – Case Number as primary key, plus CIF ID, Blacklist Number, Party Name search | `NewCaseWizard` Step 0 retrieves via `lookupBlacklist()`; data & prior docs carried forward (`DATA_AUTOPOPULATED` event). `src/lib/engine.ts#createCase` |
| **Manual-entry fallback** when no DigiHost match | Toggle to manual form (party, CIF, blacklist no., freeze code, etc.); creates `blacklist_records` with `source=manual` |
| **Six release types, one controlled loop** | `src/lib/workflow.ts` `RELEASE_TYPES`: `applicant_cheque` (RL-01), `ac_holder_cheque` (RL-02), `court` (RL-03), `npa` (RL-04), `partial` (RL-05), `temporary` (RL-06). Each has `fields`, `documents`, `letterOwner`, `poolEligible`, `outcomeNote` |
| **Type-specific fields** – cheque details, balance confirm + lien (static), LOS settlement ref, NRRC minute, EMI plan, 6-month static, charges | `FieldDef` with `required`, `kind: checkbox|static|date|number|textarea`; auto-prefill from `chequeDetails`/`npaDetails`; validation in `createCase` |
| **Type-specific document checklist** – mandatory vs optional | `DocRequirement` per type; UI shows Mandatory badge; maker completeness check in `PROCEED` action via `missingRequiredDocs()` |
| **Reviewing authority per reporting structure** – OI/BM/BROPs | Step 2 of wizard: choose BROPs Pool (if `poolEligible`) or specific reviewer from `users` where role in `reviewer_oi, reviewer_bm, brops`. Routing note in UI |
| **BROPs pool** – unclaimed cheque releases, claim assigns | `releaseCases.routedToPool=true, reviewerId=null`; `/pool` page lists unclaimed; `CLAIM` action assigns; notification to initiator |
| **Maker completeness check** on Proceed | `PROCEED` verifies all required `requirementKey` uploaded; fails with list of missing |
| **Return vs Query semantics** – Return=correction, Query=clarification | `STATUS_META`: `RETURNED` vs `QUERY`; both mandatory remarks; `FORWARD_AFTER_RETURN` resubmits; timeline distinguishes |
| **Forward to another authority** | `FORWARD` action requires `forwardTo` user; updates `reviewerId`, logs `FORWARDED` with `meta.to` |
| **Hold / Resume / Cancel** | Initiator actions `HOLD`, `RESUME`, `CANCEL_CASE` limited to DRAFT/ON_HOLD/RETURNED/QUERY/LETTER_PENDING |
| **Release letter stage** – auto-generated after approval, individual vs entity format, digital signature uploaded not print-scan | `/cases/[id]/letter` generates letter with party-type branching, table of particulars, signatory from CAD user; `letterStatus` tracks; `signed_letter` upload required; owner depends on `letterOwner` (initiator for cheque/court, cad for NPA/partial/temporary) |
| **CAD/CIC final validation** – RELEASE, RETURN/QUERY with attachment mandatory, CIB return with evidence, CIB reported with request number | `ACTION_DEFS`: `RELEASE` (success, confirm), `CAD_RETURN`/`CAD_QUERY` (requires remarks+attachment), `CIB_RETURNED` (attachment mandatory), `CIB_REPORTED` (requestNumber+remarks), `RESUME_VALIDATION` |
| **Partial release – guarantor only, borrower remains** | `def.key==='partial'`: updates `parties` JSONB marking guarantor released, `status=partially_released`; event `PARTY_RELEASED`; UI shows parties with released badge |
| **Temporary release – 6 months EMI plan, charges mandatory** | `def.key==='temporary'`: sets `temporaryUntil = now+6mo`, `status=temporary_released`; event `TEMPORARY_RELEASE_RECORDED`; register shows expiry |
| **Auto-unfreeze – only after CAD release, single code 002/025/100** | `unfreezeEligibility(codes)` checks single code in [002,025,100]; triggered only in `RELEASE` after blacklist released; logs `AUTO_UNFROZEN` or `AUTO_UNFREEZE_SKIPPED`; control note in final release document |
| **CIB Request Number tracking** | `cib_request_number` column; `CIB_REPORTED` stores it; displayed in routing card and release doc |
| **In-system notifications replacing email** | `notifications` table; `notify()` on SUBMITTED, CLAIMED, FORWARDED, RETURNED/QUERY, APPROVED, SUBMITTED_TO_CAD, RELEASED, etc.; bell in layout with unread |
| **Immutable audit trail** | `caseEvents` append-only; every transition logs actor, from/to, remarks, attachment, meta; Timeline component renders with file links |
| **Final release document – CAD provides, initiator downloads** | `/cases/[id]/release-document` shows release outcome, unfreeze outcome, sign-off; available only after RELEASED |
| **Freeze codes & account status** | `blacklistRecords.freezeCodes` JSONB, `accountStatus` frozen/unfrozen; register page shows eligibility and status |

### Workflow states (full loop)

```
DRAFT → (HOLD ↔ DRAFT) → PENDING_REVIEW → 
  ├─→ RETURNED / QUERY → (initiator) FORWARD_AFTER_RETURN → PENDING_REVIEW
  ├─→ FORWARD → PENDING_REVIEW (new reviewer)
  ├─→ REJECTED (closed)
  └─→ APPROVED → LETTER_PENDING → 
        ├─ initiator uploads signed → SUBMIT_TO_CAD → PENDING_CAD
        └─ CAD uploads signed → PENDING_CAD
            ├─ CAD_RETURN / CAD_QUERY (attachment) → RETURNED/QUERY
            ├─ CIB_RETURNED (attachment) → CIB_RETURNED → RESUME_VALIDATION → PENDING_CAD
            ├─ CIB_REPORTED (requestNumber) → CIB_REPORTED → RELEASE (or further CAD actions)
            └─ RELEASE → RELEASED (auto-unfreeze evaluated)
```

Phases: **Initiation (1) → Review (2) → Letter (3) → CAD/CIC (4) → Released (5)**

---

## 2. Running the prototype

### No external DB needed (PGlite fallback)

The prototype now runs **without PostgreSQL** using `@electric-sql/pglite` (WASM Postgres) with file persistence in `.pglite-data/`. If `DATABASE_URL` points to an external Postgres (not localhost), it will use that instead.

```bash
npm install
npm run dev
# open http://localhost:3000
```

- First run seeds 8 blacklist records (cheque & NPA, digihost + manual) and 3 in-flight release cases covering:
  - BR-...-0001: applicant cheque in BROPs pool (pending claim)
  - BR-...-0002: NPA release awaiting CAD letter
  - BR-...-0003: ac-holder cheque returned for correction

- Login via demo identities (no password):
  - **Initiators:** Asha Rai (Branch), Deepak Shrestha (NPA), Mira KC (CSD)
  - **Reviewers:** Rajan Thapa (OI), Sita Gurung (BM)
  - **BROPs:** Prakash Adhikari, Nirmala Basnet
  - **CAD/CIC:** Anil Verma, Sabina Maharjan

- Build: `npm run build` → `npm start` (requires `.pglite-data` from dev or fresh seed on start)

### File storage

Uploaded files go to `./uploads/` with random UUID prefix; carried-forward prior docs are reference-only (no file). `GET /api/files/[id]` serves files.

---

## 3. Project structure

```
src/
  db/
    schema.ts      # users, blacklist_records, release_cases, case_documents, case_events, notifications
    index.ts       # PGlite fallback + PG support + auto-seed
    seed.ts        # original seed (PG) – logic duplicated in index.ts for PGlite
  lib/
    workflow.ts    # RELEASE_TYPES (6), STATUS_META, PHASES, ACTION_DEFS, availableActions(), unfreezeEligibility()
    engine.ts      # logEvent, notify, saveDocument, performCaseAction (all transitions), createCase, lookupBlacklist
    session.ts     # cookie-based demo auth (dh_uid)
  app/
    login/         # role picker
    (app)/
      layout.tsx   # sidebar, notification bell, pool count
      dashboard/   # work queue per role, live routing feed
      register/    # blacklist register with search, freeze-code eligibility
      pool/        # BROPs pool claim UI
      cases/
        new/       # 4-step wizard: Identify → Release Type → Details & Routing → Confirm
        [id]/
          page.tsx # case data, doc checklist, letter stage, timeline, actions rail
          letter/  # auto-generated CIB release letter (printable)
          release-document/ # final release doc after CAD release
    api/
      cases/[id]/actions  # POST form-data → performCaseAction
      cases/[id]/documents # POST upload → saveDocument
      files/[id]           # GET file
      health               # DB health
  components/
    wizard.tsx, case-actions.tsx, documents-panel.tsx, timeline.tsx, ui.tsx, shell.tsx
```

---

## 4. How to demo the full flow

1. **Login as Branch Initiator (Asha Rai)** → Dashboard shows returned case BR-0003 needing action.
2. **Start new case** → Search `DH-2025-03417` (Suman Karki) → auto-populated cheque details + 2 prior docs carried.
3. Choose `By Applicant – By Cheque` → fill `chargeMdr`, `basis` → route to BROPs Pool → Create → Draft.
4. **Upload mandatory docs** (copy cheque, payee application, MDR, citizenship, CIB inclusion) → Proceed → submits to BROPs pool (notifies BROPs users).
5. **Login as BROPs (Prakash)** → Pool page → Claim → assigned → Approve → letter generated, notifies initiator.
6. **Login as Initiator** → letter stage → View & print letter → Upload signed letter → Submit to CAD.
7. **Login as CAD (Anil)** → Pending CAD → Review signed letter → Release Blacklist → auto-unfreeze evaluated (002 eligible) → final release document available.
8. **Try other types:** NPA (CAD owns letter), Partial (guarantor only), Temporary (6-month expiry), Court (legal consent + BOC approval docs).

---

## 5. Key design decisions

- **Single workflow engine** (`engine.ts`) is the only place transitions happen – auditable, testable.
- **Attachment mandatory at CAD** enforced in `performCaseAction`, not just UI.
- **Return vs Query** both go back to initiator but with distinct actions (`RETURNED` vs `QUERY`) and timeline labels.
- **Digital signature** replaces print-scan: upload field `signed_letter` with note “digitally signed”.
- **LOS integration** mocked as `settlementRef` field with hint “Retrieve from LOS where available”.
- **No email** – all routing via `notifications` table and in-app bell.

---

## 6. Extending to production

- Replace cookie auth with SSO, add RBAC middleware.
- Replace PGlite with managed Postgres, run `drizzle-kit push`.
- Integrate real DigiHost case search API, LOS settlement retrieval, CIB submission API.
- Add e-signature service for `signed_letter`, virus scan on upload, retention policy.
- Add SLA timers, escalation, reports (release TAT, return reasons, auto-unfreeze rate).
- Implement temporary release expiry job that re-blacklists after 6 months (currently noted as “rule pending confirmation”).

---

## 7. License / Demo

Demo data only – seeded operational identities and synthetic blacklist cases. No real customer data.

