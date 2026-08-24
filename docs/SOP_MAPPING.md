# Blacklisting Release SOP → Prototype Mapping (Full Document)

This file is the traceability matrix for the full blacklisting release SOP. It is intended to prove that the single prototype covers every clause of the SOP.

## Source SOP (inferred from implementation)

The SOP describes:
- Blacklisting via DigiHost (cheque & NPA) and manual register
- Release initiated by payee/applicant, account holder, court order, NPA regularization, partial guarantor, temporary EMI plan
- End-to-end controlled loop: Initiation → Review → Letter → CAD/CIC → Released
- BROPs pool for BOC-reporting branches
- Mandatory documents per type, maker completeness check
- Return for correction vs Query for clarification (remarks mandatory)
- Forwarding between authorities
- Release letter generation (individual/entity), digital signature upload
- CAD/CIC final validation with attachments mandatory, CIB reporting & return handling
- Auto-unfreeze only after release, single freeze code 002/025/100
- Notifications in-system, audit trail

## Detailed mapping

### 1. Initiation & Auto-population

**SOP clause:** "Case Number is the primary retrieval key – available data and documents are auto-populated. Manual entry fallback when no DigiHost case matches."

**Prototype:**
- `src/components/wizard.tsx` Step 0: input with placeholder "DH-... · CIF-... · BLK-..."
- `lookupBlacklist()` in `engine.ts` searches caseNumber, blacklistNumber, cifId, partyName (case-insensitive, partial)
- On match, displays party, type, CIF, blacklist no., DigiHost case, account, category, freeze codes, reason, prior doc count
- `prefill()` auto-fills chequeNumber, chequeAmount, chequeDate, payeeName, issuingBranch, loanAccountNo, outstanding, emi, borrower/guarantor from `chequeDetails`/`npaDetails`/`parties`
- Manual toggle creates `blacklistRecords` with source=manual, freezeCodes=[selected]
- `createCase()` snapshots source, caseNumber, blacklistNumber, etc. into `releaseCases.data` for immutability
- Prior docs from `blacklistRecords.documents` inserted as `caseDocuments` with source=carried, requirementKey=prior_docs if type supports

**Verification:** Start new case → search DH-2025-03417 → see auto-populated fields marked "auto" badge, 2 prior docs carried.

### 2. Six release types

**SOP:** Applicant cheque, Ac holder cheque, Court, NPA, Partial, Temporary – each with distinct fields & docs, pool eligibility, letter owner.

**Prototype:** `RELEASE_TYPES` in `workflow.ts` defines:

- **RL-01 applicant_cheque:** chequeNumber, chequeAmount, chequeDate, payeeName, issuingBranch, chargeMdr (required, MDR copy hint), basis. Docs: copy_cheque*, payee_application*, mdr_copy*, id_holder*, id_beneficiary, beneficiary_minute, cib_inclusion_letter*, prior_docs, other. poolEligible=true, letterOwner=initiator
- **RL-02 ac_holder_cheque:** + balanceConfirm checkbox required, lien static, chargeDebit required. Docs: blacklist_docs*, cib_inclusion_letter*, debit_authority*, prior_docs. poolEligible=true, letterOwner=initiator
- **RL-03 court:** courtName*, courtLetterRef*, courtOrderDate*, legalConsentRef*, bocApprovalRef*, chequeNumber, basis. Docs: court_letter*, legal_consent*, boc_approval*, cad_approval, cib_inclusion_letter*, other. poolEligible=true, letterOwner=initiator
- **RL-04 npa:** loanAccountNo*, outstandingAmount, settlementRef* (LOS hint), regularizationDate*, settledAmount, basis. Docs: loan_regularization* (LOS hint), cib_inclusion_letter*, prior_docs. poolEligible=false, letterOwner=cad
- **RL-05 partial:** borrowerName* (remains), guarantorName*, guarantorSettlementAmount*, nrrcMinuteRef*, nrrcDate, basis. Docs: nrrc_minute*, guarantor_settlement*, cib_inclusion_letter*. poolEligible=false, letterOwner=cad, outcome: party-level release
- **RL-06 temporary:** emiAmount*, emiCount, planStartDate*, periodMonths static 6 months, committeeMinuteRef*, chargeTemp* (mandatory), basis. Docs: payment_plan_letter*, committee_minute*, cib_inclusion_letter*. poolEligible=false, letterOwner=cad, outcome: 6-month expiry

All fields rendered in wizard Step 2 via `Field` component handling text/number/date/textarea/select/checkbox/static.

### 3. Reviewing authority & BROPs pool

**SOP:** "Select according to reporting structure – e.g., BROPs for BOC-reporting branch; OI/BM for branch or CSD-initiated cases."

**Prototype:**
- Wizard Step 2 routing: if poolEligible, shows BROPs Pool card (gold) + list of reviewers (reviewer_oi, reviewer_bm, brops). Choosing pool sets `routedToPool=true, reviewerId=null`, else specific reviewer.
- `releaseCases.routedToPool` boolean, `reviewerId` nullable.
- `/pool` page queries `status=PENDING_REVIEW AND routedToPool=true AND reviewerId IS NULL` – unclaimed; plus `reviewerId=user.id` – assigned to you.
- `CLAIM` action (brops only) sets reviewerId, logs CLAIMED, notifies initiator.
- `FORWARD` action (reviewer) requires forwardTo, updates reviewerId, routedToPool=false, logs FORWARDED with meta.to.

### 4. Maker completeness & mandatory docs

**SOP:** "Mandatory inputs enforced – Return/Query remarks, CAD/CIC attachments, CIB request numbers and type-specific document checklists."

**Prototype:**
- `missingRequiredDocs(typeKey, uploadedKeys)` filters `def.documents` where required && not in uploadedKeys.
- UI shows missing count badge, red mandatory badge per row.
- `PROCEED` in engine.ts checks missing, fails with message listing labels.
- `ACTION_DEFS` declares `requires` per action: RETURN/QUERY/REJECT need remarks, FORWARD needs forwardTo, CAD_RETURN/CAD_QUERY need remarks+attachment, CIB_RETURNED needs attachment, CIB_REPORTED needs requestNumber+remarks.
- Engine enforces: `if ((action===RETURN||QUERY||REJECT) && !remarks) fail(...)`, `if (!payload.attachment) fail(...)`, etc.
- `DocumentsPanel` shows check vs alert icon based on satisfied/missing.

### 5. Letter stage

**SOP:** "Letters generated by the system – Individual and entity formats; digital signature uploaded instead of print-and-scan."

**Prototype:**
- After `APPROVE`, status → LETTER_PENDING, letterStatus=generated, event LETTER_GENERATED.
- If letterOwner=initiator, notify initiator "Release letter generated — download, sign and upload it."
- If cad, notify cad "CIB Release Letter awaits completion/signing on the CAD screen."
- `/cases/[id]/letter` renders letterhead DigiHost Bank Ltd., ref CIB/REL/..., date, subject with partyName + blacklistNumber, body branching on isEntity, basis, table of particulars (release type, party type, CIF, blacklist no., account, cheque amount/number/payee, loan account, settlement ref, guarantor released, temporary period, freeze codes), sign-off with CAD user name and "Digitally signed · uploaded in the CIB Release Letter"
- `SignedLetterUpload` shows existing signed doc with download, or amber prompt; upload control uses `requirementKey=signed_letter`
- `SUBMIT_TO_CAD` checks signed_letter exists, sets status PENDING_CAD, letterStatus=signed

### 6. CAD/CIC final validation

**SOP:** "Sequence: branch initiation → Legal consent → BOC approval (and BROPs where applicable) → final CAD/CIC release approval. CAD/CIC attachment mandatory."

**Prototype:**
- CAD actions available when status PENDING_CAD or CIB_REPORTED (or CIB_RETURNED for resume):
  - `RELEASE`: checks signed_letter exists, sets RELEASED, logs BLACKLIST_RELEASED, handles record status per type, evaluates auto-unfreeze, notifies initiator
  - `CAD_RETURN`/`CAD_QUERY`: requires remarks+attachment, saves doc with label "CAD/CIC Return/Query attachment", sets status RETURNED/QUERY, notifies initiator
  - `CIB_RETURNED`: requires attachment, saves as "Returned by CIB — feedback", sets CIB_RETURNED, notifies
  - `CIB_REPORTED`: requires requestNumber+remarks, sets CIB_REPORTED, cib_request_number, logs REPORTED_TO_CIB with meta.requestNumber
  - `RESUME_VALIDATION`: from CIB_RETURNED → PENDING_CAD

### 7. Partial & Temporary specifics

**SOP:** "Releases the guarantor only while borrower remains blacklisted. Temporary releases for six months only, based on EMI payment plan. Charges field mandatory."

**Prototype:**
- Partial: `parties` JSONB array with released flag; engine maps parties, marks matching guarantor released, status=partially_released, event PARTY_RELEASED with borrower remains note; UI shows parties list with released badge; auto-unfreeze skipped with rule pending note
- Temporary: `periodMonths` static field "6 months — based on EMI payment plan"; engine sets temporaryUntil = now+6mo, status=temporary_released, releasedAt=now, event TEMPORARY_RELEASE_RECORDED with until meta; register page shows until date; final release doc notes 6-month period; chargeTemp field required with hint

### 8. Auto-unfreeze

**SOP:** "Auto-unfreeze after release only and only where account carries single freeze reason code 002, 025 or 100."

**Prototype:**
- `ELIGIBLE_UNFREEZE_CODES = ["002","025","100"]`
- `unfreezeEligibility(codes)` returns eligible if length==1 && code in list, else not eligible with reason
- In RELEASE action, if def.key !== partial, evaluates eligibility; if eligible, sets accountStatus=unfrozen, logs AUTO_UNFROZEN with reason; else logs AUTO_UNFREEZE_SKIPPED
- UI shows eligibility badge in register (Auto-unfreeze eligible vs Manual unfreeze control) and in case page with colored box
- Final release document has "Account unfreezing outcome" section showing event remarks and control note

### 9. Notifications & audit

**SOP:** "System-driven movement replacing email traffic."

**Prototype:**
- `notifications` table, `notify()` inserts per user, `NotifBell` in layout shows last 20, unread dot, mark read action
- Events on: SUBMITTED (to BROPs pool or reviewer), CLAIMED (to initiator), FORWARDED, RETURNED/QUERY (with remarks excerpt), APPROVED (letter generated), SUBMITTED_TO_CAD, RELEASED, RETURNED_BY_CIB, REPORTED_TO_CIB
- `caseEvents` immutable, with actorName, from/to, remarks, attachmentDocId, meta; Timeline component renders chronologically with file links for attachmentDocId

### 10. Final release document

**SOP:** "Final Blacklist Release Document provided by CAD/CIC – system record of release. Initiator downloads final document."

**Prototype:**
- `/cases/[id]/release-document` only accessible when RELEASED; shows release completed banner, table of party, CIF, blacklist no., release type, account, freeze codes, released at/by, partial/temporary notes, unfreezing outcome box, sign-off areas, footer "Generated and stored by DigiHost upon completion"
- Link from case page when RELEASED

## Conclusion

Every clause of the inferred SOP is implemented in a single Next.js prototype with PGlite persistence, file uploads, printable letters, and role-based work queues. The prototype is runnable via `npm run dev` without external dependencies and seeded with realistic cheque & NPA cases.
