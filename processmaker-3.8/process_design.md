# ProcessMaker 3.8 BPMN Design – Blacklisting Release

## Process Overview

**Process Name:** Blacklisting Release – Cheque & NPA (Full SOP)
**Version:** 1.0
**Description:** End-to-end release from DigiHost auto-population to CAD/CIC final release, with BROPs pool, mandatory docs, letter generation, partial/temporary, auto-unfreeze.

## Swimlanes

- **Lane 1: Initiator (Branch/NPA/CSD)**
- **Lane 2: Reviewer (OI/BM)**
- **Lane 3: BROPs (Branch Operations Control)**
- **Lane 4: CAD/CIC**

## Flow (BPMN 2.0)

```
Start Event
  → Task: T01_Identify_Case (Initiator)
    Dynaform: DF_IDENTIFY_CASE
    Trigger: TRG_LOOKUP_BLACKLIST (Before)
  → Task: T02_Select_Type_Details (Initiator)
    Dynaform: DF_RELEASE_TYPE_SELECT + DF_TYPE_DETAILS_*
    Trigger: TRG_VALIDATE_TYPE_FIELDS (Before Next Step)
  → Task: T03_Upload_Docs (Initiator)
    Input Docs: per type
    Dynaform: DF_DOCUMENT_CHECKLIST
    Trigger: TRG_MAKER_COMPLETENESS_CHECK (Before Next Step)
  → Exclusive Gateway: G01_Route_Mode
    if @@routeMode == "pool" → T04a_BROPS_Pool
    else → T04b_Review

  T04a_BROPS_Pool (BROPS, Self-Service)
    Dynaform: DF_BROPS_CLAIM_INFO
    Trigger: TRG_CLAIM_FROM_POOL
    → T04b_Review

  T04b_Review (Reviewer)
    Dynaform: DF_REVIEW_DECISION
    Trigger: TRG_VALIDATE_REVIEW
    → Exclusive Gateway G02_Review_Decision
      Approve → T06_Letter_Gateway
      Return → T05a_Rectify
      Query → T05b_Clarify
      Forward → (Value-based assignment to @@forwardTo) → loop to T04b
      Reject → End_Rejected

  T05a_Rectify (Initiator) & T05b_Clarify (Initiator)
    Dynaform: DF_RETURN_CORRECTION (shows @@reviewRemarks)
    → T04b_Review

  T06_Letter_Gateway (Exclusive)
    if @@letterOwner == "initiator" → T06a_Initiator_Letter
    else → T06b_CAD_Letter

  T06a_Initiator_Letter (Initiator)
    Output Doc: OD_CIB_RELEASE_LETTER (generated after Approve)
    Input Doc: IN_SIGNED_LETTER
    Dynaform: DF_LETTER_INITIATOR
    Trigger: TRG_CHECK_SIGNED_LETTER
    → T07_CAD_Validation

  T06b_CAD_Letter (CAD)
    Output Doc: OD_CIB_RELEASE_LETTER
    Input Doc: IN_SIGNED_LETTER
    Dynaform: DF_LETTER_CAD
    Trigger: TRG_CHECK_SIGNED_LETTER
    → T07_CAD_Validation

  T07_CAD_Validation (CAD)
    Dynaform: DF_CAD_VALIDATION
    Triggers:
      TRG_CAD_VALIDATE_ATTACHMENT
      TRG_CAD_CIB_REPORTED
      TRG_RELEASE_BLACKLIST (on RELEASE)
    Gateways:
      CAD_RETURN → T05a
      CAD_QUERY → T05b
      CIB_RETURNED → T07_CIB_Returned
      CIB_REPORTED → loop or RELEASE
      RELEASE → End_Released

  T07_CIB_Returned (Intermediate)
    → T07_CAD_Validation (via RESUME_VALIDATION)

End Events:
  End_Released (type: released)
  End_Rejected
  End_Cancelled
```

## Routing Rules (Gateway Conditions)

**G01_Route_Mode:**
- To BROPs Pool: `@@routeMode == "pool"`
- To Review: `@@routeMode != "pool"`

**G02_Review_Decision:**
- To Approve: `@@reviewDecision == "APPROVE"`
- To Return: `@@reviewDecision == "RETURN"`
- To Query: `@@reviewDecision == "QUERY"`
- To Forward: `@@reviewDecision == "FORWARD"`
- To Reject: `@@reviewDecision == "REJECT"`

**G06_Letter_Owner:**
- To Initiator: `@@letterOwner == "initiator"`
- To CAD: `@@letterOwner == "cad"`

**LetterOwner derivation (Trigger after Type selection):**
```php
$chequeTypes = ["applicant_cheque","ac_holder_cheque","court"];
if (in_array(@@releaseType, $chequeTypes)) {
  @@letterOwner = "initiator";
} else {
  @@letterOwner = "cad"; // npa, partial, temporary
}
$poolEligible = in_array(@@releaseType, $chequeTypes);
```

**PoolEligible:**
- If `@@releaseType` in cheque types → BROPs Pool option visible

## Assignment Rules

- T01-T03, T05a/b, T06a: `@@USER_LOGGED` (initiator who started)
- T04a: Self-Service, Group `GRP_BROPS`
- T04b: Value-based: `@@reviewerId` or Group `GRP_REVIEWER_OI`, `GRP_REVIEWER_BM`
- T06b, T07: Group `GRP_CAD`

## SLAs (optional)

- PENDING_REVIEW → 2 days → escalation to BM
- LETTER_PENDING → 1 day
- PENDING_CAD → 3 days

## Case Tracker

Enable for all tasks, show Dynaforms, Input Docs, Output Docs, Messages.

## Notifications

Use **Notifications** feature to send after each routing (replaces email).

## Output Documents Conditions

- `OD_CIB_RELEASE_LETTER`: always generated after Approve
- `OD_FINAL_RELEASE_DOCUMENT`: generated after RELEASE, only when status RELEASED

## Input Documents Required per Task

- T03: per type checklist (see input_documents/ folder)
- T06a/b: IN_SIGNED_LETTER required
- T07: IN_CAD_RETURN_ATTACHMENT for CAD_RETURN/CAD_QUERY, IN_CIB_RETURN_FEEDBACK for CIB_RETURNED
