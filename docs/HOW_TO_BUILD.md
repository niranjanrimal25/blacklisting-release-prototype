# How to Create a Full Blacklisting Release Prototype (Step-by-Step)

This guide shows how we built **one prototype that matches the full blacklisting releases document** — from zero to runnable.

## 0. Understand the SOP first

Before coding, extract the SOP into a workflow model:

- **Sources:** DigiHost blacklisting (cheque & NPA) + manual register
- **Retrieval keys:** Case Number (primary), CIF ID, Blacklist Number, Party Name
- **6 release types:** RL-01 applicant cheque, RL-02 ac-holder cheque, RL-03 court, RL-04 NPA, RL-05 partial guarantor, RL-06 temporary 6-month
- **States:** DRAFT, ON_HOLD, PENDING_REVIEW, RETURNED, QUERY, LETTER_PENDING, PENDING_CAD, CIB_RETURNED, CIB_REPORTED, RELEASED, REJECTED, CANCELLED
- **Roles:** initiator_branch, initiator_npa, initiator_csd, reviewer_oi, reviewer_bm, brops, cad
- **BROPs pool:** cheque types go to unassigned pool, claimed by BROPs
- **Letter:** auto-generated after APPROVE, individual vs entity, digital signature upload
- **CAD:** RELEASE, CAD_RETURN/QUERY (attachment mandatory), CIB_RETURNED, CIB_REPORTED (request number), RESUME_VALIDATION
- **Business rules:** auto-unfreeze only after release + single code 002/025/100; partial = party-level; temporary = 6 months
- **Non-functional:** in-system notifications, immutable audit, no email

Encode this into `src/lib/workflow.ts` as constants: `RELEASE_TYPES`, `STATUS_META`, `PHASES`, `ACTION_DEFS`, `availableActions()`, `unfreezeEligibility()`.

## 1. Scaffold Next.js + Drizzle

```bash
npx create-next-app@latest blacklisting-release-prototype --typescript --tailwind --eslint
npm install drizzle-orm pg dotenv lucide-react
npm install -D drizzle-kit @types/pg
```

Create `drizzle.config.json` and `src/db/schema.ts` with 6 tables:
- users (id, name, role, unit, title)
- blacklist_records (case_number unique, blacklist_number unique, cif_id, source, party_name, party_type, account_number, category, reason, freeze_codes jsonb, account_status, status, parties jsonb, cheque_details jsonb, npa_details jsonb, documents jsonb, blacklisted_at, released_at, temporary_until)
- release_cases (reference unique, blacklist_record_id fk, release_type, status, initiator_id fk, reviewer_id fk, routed_to_pool bool, data jsonb, letter_status, cib_request_number, timestamps)
- case_documents (case_id fk, requirement_key, label, file_name, file_path, mime_type, size, source, uploaded_by fk)
- case_events (case_id fk, actor_id, actor_name, actor_role, action, from_status, to_status, remarks, attachment_doc_id, meta jsonb)
- notifications (user_id fk, case_id fk, message, read)

## 2. Make DB runnable without external Postgres (critical for prototype)

We used an in-memory DB that mimics drizzle API (`src/db/memory.ts`):

- Stores arrays in `globalThis` to survive HMR
- Implements `eq`, `ne`, `isNull`, `and`, `or`, `desc`, `asc`, `sql` returning predicate functions
- Implements `db.select().from().where().orderBy().limit()` as thenable
- Implements `insert().values().returning()`, `update().set().where()`, `delete().where()`
- Auto-seeds 8 blacklist records + 3 release cases on first use
- `src/db/index.ts` tries external Postgres if DATABASE_URL is non-localhost, else uses memory

This makes `npm run dev` work anywhere.

## 3. Workflow engine (single source of truth)

`src/lib/engine.ts`:

- `logEvent()` – append to case_events
- `notify()` – insert notifications
- `saveDocument()` – writes file to ./uploads with UUID, removes prior upload for same requirementKey, inserts case_documents
- `performCaseAction(user, caseId, action, payload)` – switch on ActionKey:
  - HOLD/RESUME/CANCEL_CASE (initiator, DRAFT/ON_HOLD/RETURNED/QUERY/LETTER_PENDING)
  - PROCEED (checks missingRequiredDocs, sets PENDING_REVIEW, notifies BROPs pool or reviewer)
  - FORWARD_AFTER_RETURN (RETURNED/QUERY → PENDING_REVIEW)
  - SUBMIT_TO_CAD (LETTER_PENDING, checks signed_letter)
  - CLAIM (brops, pool)
  - APPROVE/FORWARD/RETURN/QUERY/REJECT (reviewer, PENDING_REVIEW, remarks mandatory for RETURN/QUERY/REJECT, forwardTo for FORWARD)
  - RELEASE (cad, PENDING_CAD/CIB_REPORTED, checks signed_letter, sets RELEASED, handles partial/temporary, evaluates unfreeze)
  - CAD_RETURN/CAD_QUERY (remarks+attachment mandatory)
  - CIB_RETURNED (attachment mandatory), CIB_REPORTED (requestNumber+remarks), RESUME_VALIDATION
- `createCase(user, payload)` – validates manual fields, validates type-specific required fields, creates release case with TMP ref then BR-YYYY-XXXX, logs CREATED, carries forward prior docs, notifies
- `lookupBlacklist(identifier)` – searches caseNumber, blacklistNumber, cifId, partyName (exact + partial)

All routes and server actions call this engine, never direct DB writes.

## 4. UI – 4-step wizard + case page

**Wizard (`src/components/wizard.tsx`):**

- Step 0 Identify: input + Retrieve button + Manual toggle; shows retrieved record with freeze codes, prior doc count
- Step 1 Release Type: 6 cards with code, short, category badge, letter owner, poolEligible, description, outcomeNote
- Step 2 Details & Routing: renders `def.fields` via `Field` component (text/number/date/textarea/select/checkbox/static with auto badge); routing: BROPs Pool card + reviewer list
- Step 3 Confirm: summary + mandatory docs list + Create button

**Case page (`src/app/(app)/cases/[id]/page.tsx`):**

- Header with reference, status pill, party name, blacklist no., holder text, PhaseStepper
- Main column:
  - 01 Case data: grid of MetaItem from `data`, static fields, basis
  - 02 Document checklist: DocumentsPanel with mandatory badges, carried vs uploaded, upload control per requirement, OtherUpload
  - 03 Release letter: View & print link + SignedLetterUpload + final release doc link when RELEASED
  - 04 Workflow trail: Timeline with attachment file links
- Right rail:
  - Workflow actions: ActionPanel with confirm dialogs, remarks/forwardTo/requestNumber/attachment fields per ACTION_DEFS
  - Routing: initiator, reviewer/pool, final unit CAD, CIB request number
  - Underlying blacklist: record status, account frozen/unfrozen, freeze codes, eligibility box, temporary until, parties
  - Decision rule note

**Other pages:**

- `/login`: role picker with 9 demo users
- `/dashboard`: work queue per role (myQueue), stats (awaiting action, active, blacklist entries, released), live routing feed, controlled loop steps
- `/register`: blacklist register table with search, status meta, freeze eligibility, link to start release
- `/pool`: BROPs pool unclaimed + assigned to you, ClaimButton
- `/cases/[id]/letter`: printable CIB release letter (individual/entity branching, particulars table, digital signature note)
- `/cases/[id]/release-document`: final release doc with unfreezing outcome

**Components:**

- `ui.tsx`: StatusPill, PhaseStepper, SectionTitle, MetaItem, EmptyState, UserChip, Card
- `case-actions.tsx`: ActionPanel with form handling, confirm, error, pending
- `documents-panel.tsx`: DocumentsPanel, OtherUpload, SignedLetterUpload
- `timeline.tsx`: Timeline with action, actor, remarks, meta, attachment
- `shell.tsx`: Sidebar with nav, pool count, user switch, NotifBell
- `pool-actions.tsx`: ClaimButton
- `print-button.tsx`: PrintBar

## 5. Auth & session

Cookie `dh_uid` with user id, httpOnly, 7-day. `getSessionUser()` reads cookie, looks up users. `loginAs()` sets cookie, `logout()` clears. No passwords for prototype.

## 6. File handling

`POST /api/cases/[id]/documents` with form-data file, requirementKey, label. Checks who may upload when (initiator in DRAFT/RETURNED/QUERY/ON_HOLD or CAD). Calls saveDocument.

`GET /api/files/[id]` serves file from ./uploads if exists, else 404 with note about carried-forward reference.

## 7. Seed data

In-memory seed creates:

- 9 users covering all roles
- 8 blacklist records: cheque (002,025,101,003) and NPA (100,100+045,002,025) with chequeDetails/npaDetails/documents
- 3 release cases demonstrating pool, letter stage, returned

## 8. Build & run

```bash
npm install
npm run dev   # http://localhost:3000
npm run build # production, uses same in-memory seed
```

No need for DATABASE_URL, but if provided with external host, it will use Postgres.

## 9. Verify full SOP coverage

Use `docs/SOP_MAPPING.md` as traceability matrix – each SOP clause → file & line.

Demo flow in README shows end-to-end.

## 10. Next steps to production

- Replace memory DB with Postgres + drizzle-kit migrations
- Add SSO, RBAC, audit log immutability guarantees
- Integrate real DigiHost API, LOS, CIB
- Add e-signature, virus scan, retention
- Add SLA, expiry job for temporary releases

This is how one prototype can match the full document.
