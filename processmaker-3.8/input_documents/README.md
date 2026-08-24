# Input Documents – ProcessMaker 3.8

Create these Input Documents in PM 3.8 (Process → Input Documents → New). Mark as required per task as below.

## Cheque – Applicant (RL-01)
- IN_COPY_CHEQUE – Copy of cheque – Required in T03
- IN_PAYEE_APPLICATION – Application from payee/beneficiary – Required
- IN_MDR_COPY – Evidence of release charge MDR copy – Required
- IN_ID_HOLDER – Citizenship / registration cert – account holder – Required
- IN_ID_BENEFICIARY – Citizenship – beneficiary – Optional
- IN_BENEFICIARY_MINUTE – Minute of beneficiary – Optional (required if entity)
- IN_CIB_INCLUSION_LETTER – Blacklist Inclusion Letter from CIC – Required

## Cheque – A/C Holder (RL-02)
- IN_BLACKLIST_DOCS – Blacklist documents – Required
- IN_CIB_INCLUSION_LETTER – Required
- IN_DEBIT_AUTHORITY – Debit Authority – Required

## Court (RL-03)
- IN_COURT_LETTER – Letter/order from court – Required
- IN_LEGAL_CONSENT – Consent from Legal Dept – Required
- IN_BOC_APPROVAL – Approval from BOC – Required
- IN_CAD_APPROVAL – Approval from CAD – Optional
- IN_CIB_INCLUSION_LETTER – Required

## NPA (RL-04)
- IN_LOAN_REGULARIZATION – Loan regularization/settlement evidence (LOS) – Required
- IN_CIB_INCLUSION_LETTER – Required

## Partial (RL-05)
- IN_NRRC_MINUTE – NRRC minute – Required
- IN_GUARANTOR_SETTLEMENT – Guarantor settlement confirmation – Required
- IN_CIB_INCLUSION_LETTER – Required

## Temporary (RL-06)
- IN_PAYMENT_PLAN – Borrower payment plan commitment letter – Required
- IN_COMMITTEE_MINUTE – Minute from board/committee – Required
- IN_CIB_INCLUSION_LETTER – Required

## Letter Stage
- IN_SIGNED_LETTER – CIB Release Letter — digitally signed – Required in T06a/T06b

## CAD/CIC
- IN_CAD_RETURN_ATTACHMENT – CAD Return/Query attachment – Required for CAD_RETURN/CAD_QUERY
- IN_CIB_RETURN_FEEDBACK – Returned by CIB feedback – Required for CIB_RETURNED

## Common
- IN_OTHER – Other documents – Optional, allow multiple

For each Input Document, set:
- Destination: Task T03 (or T06, T07)
- Allow Multiple: No (except IN_OTHER)
- Versioning: Yes
