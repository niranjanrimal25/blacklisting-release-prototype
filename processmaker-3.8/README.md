# Blacklisting Release Process — ProcessMaker 3.8 Implementation

This folder contains **complete, import-ready artifacts** to build the full blacklisting release SOP in **ProcessMaker 3.8** (Community/Enterprise).

> If you are running PM 3.8 on-prem, follow steps 1-7. The structure mirrors the Next.js prototype you already have, so business rules stay identical.

---

## 0. Prerequisites

- ProcessMaker 3.8.x installed (PHP 7.x, MySQL)
- Admin access to create PM Tables, Processes, Users, Groups
- DigiHost DB access (or mock) and LOS DB access (or mock) — optional, triggers have fallback to PM Table

---

## 1. PM Tables (create first)

Go to **Admin → PM Tables → New**. Import `pm_tables.sql` or create manually:

- `BLACKLIST_REGISTER` — your blacklist register (digihost + manual)
- `BLACKLIST_RELEASE_CASES` — release cases (reference, type, status, data snapshot)
- `CASE_DOCUMENTS_LOG` — optional, tracks mandatory checklist per case (if you don't want to rely only on Input Docs)
- `FREEZE_CODE_RULES` — 002,025,100 eligible

See `pm_tables.sql` for full DDL.

Seed `BLACKLIST_REGISTER` with 8 rows from that SQL (same as Next.js seed).

---

## 2. Users, Groups, Roles

Create Groups:

- `GRP_INITIATOR_BRANCH` — Asha Rai (branch ops)
- `GRP_INITIATOR_NPA` — Deepak Shrestha (NPA)
- `GRP_INITIATOR_CSD` — Mira KC (CSD)
- `GRP_REVIEWER_OI` — Rajan Thapa
- `GRP_REVIEWER_BM` — Sita Gurung
- `GRP_BROPS` — Prakash Adhikari, Nirmala Basnet (self-service)
- `GRP_CAD` — Anil Verma, Sabina Maharjan

Process Permissions will use these groups.

---

## 3. Process Design (BPMN)

Create new Process: **"Blacklisting Release – Cheque & NPA (Full SOP)"**

**Tasks (swimlanes):**

1. **Start Event → Task 1: Identify Blacklisted Case** (Initiator lane)
   - Dynaform: `DF_IDENTIFY_CASE` (search + manual fallback)
   - Trigger: `TRG_LOOKUP_BLACKLIST` (Before Dynaform) — queries BLACKLIST_REGISTER by caseNumber/cifId/blacklistNumber, populates @@partyName, @@freezeCodes, @@chequeDetails, @@priorDocs grid

2. **Task 2: Select Release Type & Details** (Initiator)
   - Dynaform: `DF_RELEASE_TYPE_SELECT` (6 cards as radio)
   - Dynaform: `DF_TYPE_DETAILS_APPLICANT_CHEQUE`, `DF_TYPE_DETAILS_AC_HOLDER`, `DF_TYPE_DETAILS_COURT`, `DF_TYPE_DETAILS_NPA`, `DF_TYPE_DETAILS_PARTIAL`, `DF_TYPE_DETAILS_TEMPORARY` — show/hide via JS based on @@releaseType
   - Trigger: `TRG_VALIDATE_TYPE_FIELDS` (Before Next Step) — checks required per type

3. **Task 3: Upload Mandatory Documents** (Initiator)
   - Input Documents: per type (see `input_documents/`)
   - Dynaform: `DF_DOCUMENT_CHECKLIST` showing grid of required vs uploaded + `TRG_MAKER_COMPLETENESS_CHECK` (Before Next Step) — blocks if mandatory missing

4. **Exclusive Gateway: Route by Reporting Structure**
   - Condition 1: `@@routeMode == "pool"` → Task 4a
   - Default: → Task 4b

5. **Task 4a: BROPs Pool (Self-Service)** (BROPS lane, Self-Service assignment)
   - Dynaform: `DF_BROPS_CLAIM_INFO` (read-only case data + Claim button)
   - Trigger: `TRG_CLAIM_FROM_POOL` (Before Assignment) — sets @@claimedBy

6. **Task 4b: Review – Approve / Return / Query / Forward / Reject** (Reviewer lane)
   - Dynaform: `DF_REVIEW_DECISION` (Approve, Return, Query, Forward, Reject + remarks + forwardTo dropdown)
   - Trigger: `TRG_VALIDATE_REVIEW` — remarks mandatory for Return/Query/Reject, forwardTo for Forward
   - Gateway after: 
     - Return → Task 5a
     - Query → Task 5b
     - Forward → reassign to another reviewer (loop)
     - Reject → End (Rejected)
     - Approve → Task 6

7. **Task 5a: Rectify After Return** (Initiator) + **Task 5b: Clarify After Query** (Initiator)
   - Dynaform: `DF_RETURN_CORRECTION` (shows reviewer remarks @@reviewRemarks, editable fields)
   - Then → back to Review Task

8. **Task 6: Release Letter Stage**
   - Exclusive Gateway: `@@letterOwner`
     - `initiator` → Task 6a: Initiator Signs Letter
     - `cad` → Task 6b: CAD Completes Letter
   - Output Document: `OD_CIB_RELEASE_LETTER` generated after Approve (individual vs entity via condition in template)
   - Input Document: `IN_SIGNED_LETTER` (digitally signed)

9. **Task 6a: Initiator – Download, Sign, Upload** (Initiator)
   - Dynaform: `DF_LETTER_INITIATOR` (link to Output Doc + file upload)
   - Trigger: `TRG_CHECK_SIGNED_LETTER`

10. **Task 6b: CAD – Complete & Digitally Sign** (CAD lane)
    - Dynaform: `DF_LETTER_CAD` (completes letter fields + upload)
    - Same check

11. **Task 7: CAD/CIC Final Validation** (CAD lane)
    - Dynaform: `DF_CAD_VALIDATION` (RELEASE, CAD_RETURN, CAD_QUERY, CIB_RETURNED, CIB_REPORTED, RESUME_VALIDATION)
    - Triggers:
      - `TRG_CAD_VALIDATE_ATTACHMENT` — attachment mandatory for CAD_RETURN/CAD_QUERY/CIB_RETURNED
      - `TRG_CAD_CIB_REPORTED` — requestNumber mandatory
      - `TRG_RELEASE_BLACKLIST` — on RELEASE: updates BLACKLIST_REGISTER status, handles partial/temporary, evaluates auto-unfreeze

12. **End Events:** Released, Rejected, Cancelled

See `process_design.md` for full BPMN XML pseudo and routing rules.

---

## 4. Dynaforms

All JSON in `dynaforms/` — import via **Process → Dynaforms → Import** or create manually.

Key Dynaforms:

- `DF_IDENTIFY_CASE.json` — search field + grid for result + manual entry panel
- `DF_RELEASE_TYPE_SELECT.json` — 6 radio options with description
- `DF_TYPE_DETAILS_*.json` — 6 variants, each with fields from workflow.ts
- `DF_DOCUMENT_CHECKLIST.json` — shows mandatory badges
- `DF_REVIEW_DECISION.json` — decision + remarks + forwardTo
- `DF_LETTER_INITIATOR.json`, `DF_LETTER_CAD.json`
- `DF_CAD_VALIDATION.json`

Each Dynaform has JS to show/hide based on @@releaseType and @@letterOwner.

---

## 5. Triggers (PHP)

All in `triggers/` — create in **Process → Triggers**, paste PHP.

- `TRG_LOOKUP_BLACKLIST.php` — searches BLACKLIST_REGISTER
- `TRG_VALIDATE_TYPE_FIELDS.php` — required per type
- `TRG_MAKER_COMPLETENESS_CHECK.php` — blocks if Input Docs missing
- `TRG_CLAIM_FROM_POOL.php` — self-service claim
- `TRG_VALIDATE_REVIEW.php` — remarks mandatory
- `TRG_CHECK_SIGNED_LETTER.php` — signed letter exists
- `TRG_CAD_VALIDATE_ATTACHMENT.php` — attachment mandatory
- `TRG_RELEASE_BLACKLIST.php` — partial/temporary/auto-unfreeze logic (most important)

See each file for full code.

---

## 6. Input Documents

Create in **Process → Input Documents**:

- `IN_COPY_CHEQUE`, `IN_PAYEE_APPLICATION`, `IN_MDR_COPY`, `IN_ID_HOLDER`, `IN_ID_BENEFICIARY`, `IN_BENEFICIARY_MINUTE`, `IN_CIB_INCLUSION_LETTER`, `IN_BLACKLIST_DOCS`, `IN_DEBIT_AUTHORITY`, `IN_COURT_LETTER`, `IN_LEGAL_CONSENT`, `IN_BOC_APPROVAL`, `IN_CAD_APPROVAL`, `IN_LOAN_REGULARIZATION`, `IN_NRRC_MINUTE`, `IN_GUARANTOR_SETTLEMENT`, `IN_PAYMENT_PLAN`, `IN_COMMITTEE_MINUTE`, `IN_SIGNED_LETTER`, `IN_CAD_RETURN_ATTACHMENT`, `IN_CIB_RETURN_FEEDBACK`

Mark required per task as per SOP.

---

## 7. Output Documents

Create in **Process → Output Documents**:

- `OD_CIB_RELEASE_LETTER` — template `output_documents/OD_CIB_RELEASE_LETTER.html` with `@@partyName`, `@@blacklistNumber`, `@@releaseType`, conditional for entity vs individual, table of particulars, freeze codes, etc. Generate PDF.
- `OD_FINAL_RELEASE_DOCUMENT` — template `OD_FINAL_RELEASE_DOCUMENT.html` with unfreeze outcome

---

## 8. Test the full loop

1. Login as Asha Rai (initiator_branch) → New Case → search `DH-2025-03417` → see auto-populated
2. Choose RL-01 → fill chargeMdr 5000 + basis → route to BROPs Pool → submit
3. Upload 5 mandatory Input Docs → trigger passes → routes to BROPs
4. Login as Prakash (BROPS) → Self-Service → Claim → Approve
5. Login as Asha → Letter Task → download Output Doc → upload signed → Submit to CAD
6. Login as Anil (CAD) → Final Validation → RELEASE → check BLACKLIST_REGISTER status becomes `released`, `account_status` → `unfrozen` if freeze code 002/025/100 single

---

## 9. Mapping to Next.js prototype

Your Next.js prototype already implements all triggers as `engine.ts` functions. Use `docs/SOP_MAPPING.md` to see traceability — you can copy business rules directly into PM Triggers.

---

## 10. Cleanup

- To clean all initiated cases in PM 3.8: **Admin → Cases → Delete** or run SQL `DELETE FROM APPLICATION WHERE PRO_UID = 'your-process-uid'`
- In Next.js prototype: Dashboard → Demo data controls → Clear ALL / Reset

---

Need a real `.pmx` export? Tell me your PM 3.8 exact version and I can package these JSONs into a `.pmx` zip you can import via **Admin → Processes → Import**.
