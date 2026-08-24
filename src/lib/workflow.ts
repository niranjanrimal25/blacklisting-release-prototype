/**
 * Central workflow definition for the DigiHost Blacklisting Release process.
 * Encodes the SOP: six release types, type-specific fields & document
 * checklists, workflow statuses, macro phases, and action availability rules.
 */

export type ReleaseTypeKey =
  | "applicant_cheque"
  | "ac_holder_cheque"
  | "court"
  | "npa"
  | "partial"
  | "temporary";

export type StatusKey =
  | "DRAFT"
  | "ON_HOLD"
  | "PENDING_REVIEW"
  | "RETURNED"
  | "QUERY"
  | "LETTER_PENDING"
  | "PENDING_CAD"
  | "CIB_RETURNED"
  | "CIB_REPORTED"
  | "RELEASED"
  | "REJECTED"
  | "CANCELLED";

export type FieldDef = {
  key: string;
  label: string;
  kind?: "text" | "number" | "date" | "textarea" | "select" | "checkbox" | "static";
  options?: string[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  wide?: boolean;
  autoValue?: string;
};

export type DocRequirement = {
  key: string;
  label: string;
  note?: string;
  required: boolean;
};

export type ReleaseTypeDef = {
  key: ReleaseTypeKey;
  label: string;
  short: string;
  code: string;
  category: "cheque" | "npa" | "hybrid";
  letterOwner: "initiator" | "cad";
  poolEligible: boolean;
  description: string;
  outcomeNote: string;
  fields: FieldDef[];
  documents: DocRequirement[];
};

const CHEQUE_FIELDS: FieldDef[] = [
  { key: "chequeNumber", label: "Cheque number", required: true, placeholder: "e.g., 223145" },
  { key: "chequeAmount", label: "Cheque amount (NPR)", kind: "number", required: true, placeholder: "0.00" },
  { key: "chequeDate", label: "Cheque date", kind: "date", required: true },
  { key: "payeeName", label: "Payee / beneficiary name", required: true },
];

export const RELEASE_TYPES: Record<ReleaseTypeKey, ReleaseTypeDef> = {
  applicant_cheque: {
    key: "applicant_cheque",
    label: "By Applicant – By Cheque",
    short: "Applicant · Cheque",
    code: "RL-01",
    category: "cheque",
    letterOwner: "initiator",
    poolEligible: true,
    description:
      "Release initiated by the payee/applicant on the basis of the underlying cheque. The release letter is auto-generated after review; the initiator signs and uploads it before CAD/CIC validation.",
    outcomeNote: "Blacklist removed fully after CAD/CIC release; eligible auto-unfreeze applies.",
    fields: [
      ...CHEQUE_FIELDS,
      { key: "issuingBranch", label: "Issuing branch" },
      {
        key: "chargeMdr",
        label: "Blacklist release charge collected (NPR)",
        kind: "number",
        required: true,
        hint: "Attach the MDR copy as evidence of collection.",
      },
      { key: "basis", label: "Release basis / justification", kind: "textarea", required: true, wide: true, placeholder: "Summarise why the blacklisting should be released…" },
    ],
    documents: [
      { key: "copy_cheque", label: "Copy of cheque", required: true },
      { key: "payee_application", label: "Application from payee / beneficiary", required: true },
      { key: "mdr_copy", label: "Evidence of release charge — MDR copy", required: true },
      { key: "id_holder", label: "Citizenship / registration certificate — account holder, shareholder, partner or proprietor", required: true },
      { key: "id_beneficiary", label: "Citizenship / registration certificate — beneficiary", required: false },
      { key: "beneficiary_minute", label: "Minute of beneficiary", note: "Required where the beneficiary is a company", required: false },
      { key: "cib_inclusion_letter", label: "Blacklist Inclusion Letter from CIC", required: true },
      { key: "prior_docs", label: "Documents from previous blacklisting process", note: "Carried forward automatically for DigiHost cases", required: false },
      { key: "other", label: "Other documents", required: false },
    ],
  },
  ac_holder_cheque: {
    key: "ac_holder_cheque",
    label: "By A/C Holder – By Cheque",
    short: "A/C Holder · Cheque",
    code: "RL-02",
    category: "cheque",
    letterOwner: "initiator",
    poolEligible: true,
    description:
      "Release requested by the account holder. Sufficient balance (cheque amount + charges) must be maintained; a lien is applied automatically in the name of the payee, and charges are debited from the account holder.",
    outcomeNote: "Blacklist removed fully after CAD/CIC release; eligible auto-unfreeze applies.",
    fields: [
      ...CHEQUE_FIELDS,
      {
        key: "balanceConfirm",
        label: "Sufficient balance (cheque amount + charges) is maintained in the account for encashment",
        kind: "checkbox",
        required: true,
        wide: true,
      },
      {
        key: "lien",
        label: "Lien",
        kind: "static",
        autoValue: "Applied automatically in the name of the payee for the required balance",
        wide: true,
      },
      { key: "chargeDebit", label: "Charges to debit from account holder (NPR)", kind: "number", required: true },
      { key: "basis", label: "Release basis / justification", kind: "textarea", required: true, wide: true },
    ],
    documents: [
      { key: "blacklist_docs", label: "Blacklist documents", required: true },
      { key: "cib_inclusion_letter", label: "Blacklist Inclusion Letter from CIC", required: true },
      { key: "debit_authority", label: "Debit Authority", required: true },
      { key: "prior_docs", label: "Documents from previous blacklisting process", required: false },
      { key: "other", label: "Other documents", required: false },
    ],
  },
  court: {
    key: "court",
    label: "Court Release – By Branch / NPA",
    short: "Court Release",
    code: "RL-03",
    category: "hybrid",
    letterOwner: "initiator",
    poolEligible: true,
    description:
      "For accounts blacklisted by court order and released on court letters. Sequence: branch initiation → Legal Department consent → BOC approval (and BROPs where applicable) → final CAD/CIC release approval.",
    outcomeNote: "Blacklist removed after CAD/CIC final release approval.",
    fields: [
      { key: "courtName", label: "Court name", required: true },
      { key: "courtLetterRef", label: "Court letter / order reference", required: true },
      { key: "courtOrderDate", label: "Court order date", kind: "date", required: true },
      { key: "legalConsentRef", label: "Legal Department consent reference", required: true, hint: "Consent/approval document must be uploaded." },
      { key: "bocApprovalRef", label: "BOC approval reference", required: true, hint: "BOC approval document must be uploaded." },
      { key: "chequeNumber", label: "Cheque number (where applicable)" },
      { key: "basis", label: "Release basis / justification", kind: "textarea", required: true, wide: true },
    ],
    documents: [
      { key: "court_letter", label: "Letter / order from court", required: true },
      { key: "legal_consent", label: "Consent/approval from Legal Department", required: true },
      { key: "boc_approval", label: "Approval from BOC", required: true },
      { key: "cad_approval", label: "Approval from CAD", note: "Where provided in advance; otherwise granted at final release", required: false },
      { key: "cib_inclusion_letter", label: "Blacklist Inclusion Letter from CIC", required: true },
      { key: "other", label: "Other documents", required: false },
    ],
  },
  npa: {
    key: "npa",
    label: "NPA Release – By NPA",
    short: "NPA Release",
    code: "RL-04",
    category: "npa",
    letterOwner: "cad",
    poolEligible: false,
    description:
      "Full release after loan regularization or settlement. Settlement evidence is retrieved from LOS; the CIB Release Letter is generated on the CAD screen, digitally signed and uploaded by CAD/CIC.",
    outcomeNote: "Blacklist removed fully; eligible auto-unfreeze applies.",
    fields: [
      { key: "loanAccountNo", label: "Loan account number", required: true },
      { key: "outstandingAmount", label: "Outstanding at blacklisting (NPR)", kind: "number" },
      { key: "settlementRef", label: "LOS settlement / regularization reference", required: true, hint: "Retrieved from LOS where the integration is available." },
      { key: "regularizationDate", label: "Regularization / settlement date", kind: "date", required: true },
      { key: "settledAmount", label: "Settled amount (NPR)", kind: "number" },
      { key: "basis", label: "Release basis / justification", kind: "textarea", required: true, wide: true },
    ],
    documents: [
      { key: "loan_regularization", label: "Loan regularization / settlement evidence", note: "Retrieve from LOS where available", required: true },
      { key: "cib_inclusion_letter", label: "Blacklist Inclusion Letter from CIC", required: true },
      { key: "prior_docs", label: "Documents from previous blacklisting process", required: false },
      { key: "other", label: "Other documents", required: false },
    ],
  },
  partial: {
    key: "partial",
    label: "Partial Release – By NPA",
    short: "Partial · Guarantor",
    code: "RL-05",
    category: "npa",
    letterOwner: "cad",
    poolEligible: false,
    description:
      "Releases the guarantor only while the borrower remains blacklisted. The outcome is recorded at party level so the borrower's blacklist status is never removed inadvertently.",
    outcomeNote: "Only the guarantor party is released; the borrower remains blacklisted.",
    fields: [
      { key: "borrowerName", label: "Borrower (remains blacklisted)", required: true },
      { key: "guarantorName", label: "Guarantor to be released", required: true },
      { key: "guarantorSettlementAmount", label: "Guarantor settlement amount (NPR)", kind: "number", required: true },
      { key: "nrrcMinuteRef", label: "NRRC minute reference", required: true, hint: "NPA Recovery and Regularization Committee minute" },
      { key: "nrrcDate", label: "NRRC minute date", kind: "date" },
      { key: "basis", label: "Release basis / justification", kind: "textarea", required: true, wide: true },
    ],
    documents: [
      { key: "nrrc_minute", label: "NRRC minute", note: "NPA Recovery and Regularization Committee minute", required: true },
      { key: "guarantor_settlement", label: "Guarantor settlement confirmation", required: true },
      { key: "cib_inclusion_letter", label: "Blacklist Inclusion Letter from CIC", required: true },
      { key: "other", label: "Other documents", required: false },
    ],
  },
  temporary: {
    key: "temporary",
    label: "Temporary Release – By NPA",
    short: "Temporary · 6 months",
    code: "RL-06",
    category: "npa",
    letterOwner: "cad",
    poolEligible: false,
    description:
      "Releases the account for six months only, based on the EMI payment plan. The temporary period and the charges field must be recorded as part of the release information.",
    outcomeNote: "Release expires six months after release date (expiry rule pending confirmation).",
    fields: [
      { key: "emiAmount", label: "EMI amount per plan (NPR)", kind: "number", required: true },
      { key: "emiCount", label: "Number of EMIs in plan", kind: "number" },
      { key: "planStartDate", label: "Payment plan start date", kind: "date", required: true },
      { key: "periodMonths", label: "Temporary release period", kind: "static", autoValue: "6 months — based on the EMI payment plan", wide: true },
      { key: "committeeMinuteRef", label: "Board / committee minute reference", required: true },
      { key: "chargeTemp", label: "Temporary release charge (NPR)", kind: "number", required: true, hint: "Charges field is mandatory for temporary release." },
      { key: "basis", label: "Release basis / justification", kind: "textarea", required: true, wide: true },
    ],
    documents: [
      { key: "payment_plan_letter", label: "Borrower payment plan commitment letter", required: true },
      { key: "committee_minute", label: "Minute from board / committee", required: true },
      { key: "cib_inclusion_letter", label: "Blacklist Inclusion Letter from CIC", required: true },
      { key: "other", label: "Other documents", required: false },
    ],
  },
};

export const RELEASE_TYPE_LIST = Object.values(RELEASE_TYPES);

/* ---------------------------------- statuses --------------------------------- */

export const STATUS_META: Record<StatusKey, { label: string; tone: string; phase: number }> = {
  DRAFT: { label: "Draft · Manual Entry", tone: "neutral", phase: 1 },
  ON_HOLD: { label: "On Hold", tone: "neutral", phase: 1 },
  PENDING_REVIEW: { label: "Pending Review", tone: "amber", phase: 2 },
  RETURNED: { label: "Returned for Correction", tone: "red", phase: 1 },
  QUERY: { label: "Query Raised", tone: "violet", phase: 1 },
  LETTER_PENDING: { label: "Release Letter Stage", tone: "cyan", phase: 3 },
  PENDING_CAD: { label: "Pending CAD/CIC Validation", tone: "blue", phase: 4 },
  CIB_RETURNED: { label: "Returned by CIB", tone: "red", phase: 4 },
  CIB_REPORTED: { label: "Reported to CIB", tone: "violet", phase: 4 },
  RELEASED: { label: "Blacklist Released", tone: "green", phase: 5 },
  REJECTED: { label: "Rejected", tone: "dark", phase: 5 },
  CANCELLED: { label: "Cancelled", tone: "dark", phase: 5 },
};

export const PHASES = ["Initiation", "Review", "Letter", "CAD/CIC", "Released"] as const;

export const ELIGIBLE_UNFREEZE_CODES = ["002", "025", "100"];

export function unfreezeEligibility(codes: string[]): { eligible: boolean; reason: string } {
  if (codes.length === 1 && ELIGIBLE_UNFREEZE_CODES.includes(codes[0])) {
    return { eligible: true, reason: `Single freeze reason code ${codes[0]} — auto-unfreeze authorised.` };
  }
  if (codes.length === 1) {
    return { eligible: false, reason: `Freeze code ${codes[0]} is outside 002/025/100 — route to manual control.` };
  }
  return { eligible: false, reason: "Multiple freeze reason codes exist — automatic unfreezing not authorised; route to manual control." };
}

/* ---------------------------------- actions ---------------------------------- */

export type ActionKey =
  | "PROCEED"
  | "HOLD"
  | "RESUME"
  | "CANCEL_CASE"
  | "CLAIM"
  | "APPROVE"
  | "FORWARD"
  | "RETURN"
  | "QUERY"
  | "REJECT"
  | "FORWARD_AFTER_RETURN"
  | "SUBMIT_TO_CAD"
  | "RELEASE"
  | "CAD_RETURN"
  | "CAD_QUERY"
  | "CIB_RETURNED"
  | "CIB_REPORTED"
  | "RESUME_VALIDATION";

export type ActionDef = {
  key: ActionKey;
  label: string;
  kind: "primary" | "danger" | "neutral" | "success";
  requires?: ("remarks" | "attachment" | "forwardTo" | "requestNumber")[];
  hint?: string;
  confirm?: string;
};

export const ACTION_DEFS: Record<ActionKey, ActionDef> = {
  PROCEED: { key: "PROCEED", label: "Proceed — Submit to Reviewer", kind: "primary", hint: "Maker completeness check runs on all mandatory documents." },
  HOLD: { key: "HOLD", label: "Hold", kind: "neutral", hint: "Pause processing; the case stays with you." },
  RESUME: { key: "RESUME", label: "Resume", kind: "primary" },
  CANCEL_CASE: { key: "CANCEL_CASE", label: "Cancel Case", kind: "danger", confirm: "Cancel this release case? This closes the case." },
  CLAIM: { key: "CLAIM", label: "Claim from Pool", kind: "primary" },
  APPROVE: { key: "APPROVE", label: "Approve", kind: "success", hint: "Data and documents are complete and valid." },
  FORWARD: { key: "FORWARD", label: "Forward to…", kind: "neutral", requires: ["forwardTo"], hint: "Route the case to another configured authority before approval." },
  RETURN: { key: "RETURN", label: "Return for Rectification", kind: "danger", requires: ["remarks"], hint: "Remarks are mandatory. Case returns to the initiator for correction." },
  QUERY: { key: "QUERY", label: "Raise Query", kind: "neutral", requires: ["remarks"], hint: "Remarks are mandatory. Use for clarification/justification only." },
  REJECT: { key: "REJECT", label: "Reject", kind: "danger", requires: ["remarks"], confirm: "Reject this case? The case will be closed." },
  FORWARD_AFTER_RETURN: { key: "FORWARD_AFTER_RETURN", label: "Forward after Return", kind: "primary", hint: "Resubmit the corrected/clarified case to the reviewer." },
  SUBMIT_TO_CAD: { key: "SUBMIT_TO_CAD", label: "Submit to CAD/CIC", kind: "primary", hint: "Requires the signed/digitally-signed release letter to be uploaded." },
  RELEASE: { key: "RELEASE", label: "Release Blacklist", kind: "success", confirm: "Execute the blacklist release? Eligible auto-unfreeze is triggered immediately." },
  CAD_RETURN: { key: "CAD_RETURN", label: "Return (with attachment)", kind: "danger", requires: ["remarks", "attachment"], hint: "Attachment is mandatory at CAD/CIC level." },
  CAD_QUERY: { key: "CAD_QUERY", label: "Query (with attachment)", kind: "neutral", requires: ["remarks", "attachment"], hint: "Attachment is mandatory at CAD/CIC level." },
  CIB_RETURNED: { key: "CIB_RETURNED", label: "Returned by CIB", kind: "neutral", requires: ["attachment"], hint: "Attach the CIB return feedback/document." },
  CIB_REPORTED: { key: "CIB_REPORTED", label: "Reported to CIB", kind: "neutral", requires: ["requestNumber", "remarks"], hint: "Record the CIB Request Number and remarks." },
  RESUME_VALIDATION: { key: "RESUME_VALIDATION", label: "Resume Validation", kind: "primary", hint: "Bring the case back into CAD/CIC validation after the CIB return is addressed." },
};

type ActionCtx = {
  status: string;
  role: string;
  isInitiator: boolean;
  isReviewer: boolean;
  letterOwner: "initiator" | "cad";
  routedToPool: boolean;
  claimed: boolean;
};

/** Role- and status-aware actions available on a case right now. */
export function availableActions(ctx: ActionCtx): ActionKey[] {
  const { status, role, isInitiator, isReviewer, letterOwner, routedToPool, claimed } = ctx;
  const a: ActionKey[] = [];

  if (isInitiator) {
    if (status === "DRAFT") a.push("PROCEED", "HOLD", "CANCEL_CASE");
    if (status === "ON_HOLD") a.push("RESUME", "CANCEL_CASE");
    if (status === "RETURNED" || status === "QUERY") a.push("FORWARD_AFTER_RETURN", "CANCEL_CASE");
    if (status === "LETTER_PENDING" && letterOwner === "initiator") a.push("SUBMIT_TO_CAD", "CANCEL_CASE");
  }

  if (role === "brops" && status === "PENDING_REVIEW" && routedToPool && !claimed) a.push("CLAIM");

  if (isReviewer && status === "PENDING_REVIEW") a.push("APPROVE", "FORWARD", "RETURN", "QUERY", "REJECT");

  if (role === "cad") {
    if (status === "LETTER_PENDING" && letterOwner === "cad") a.push("SUBMIT_TO_CAD");
    if (status === "PENDING_CAD" || status === "CIB_REPORTED")
      a.push("RELEASE", "CAD_RETURN", "CAD_QUERY", "CIB_RETURNED", "CIB_REPORTED");
    if (status === "CIB_RETURNED") a.push("RESUME_VALIDATION");
  }

  return a;
}

/** Missing mandatory checklist documents for a case. */
export function missingRequiredDocs(typeKey: ReleaseTypeKey, uploadedRequirementKeys: string[]): DocRequirement[] {
  const def = RELEASE_TYPES[typeKey];
  return def.documents.filter((d) => d.required && !uploadedRequirementKeys.includes(d.key));
}

export function isReviewerRole(role: string) {
  return role === "reviewer_oi" || role === "reviewer_bm" || role === "brops";
}

export function roleLabel(role: string) {
  switch (role) {
    case "initiator_branch": return "Initiator — Branch";
    case "initiator_npa": return "Initiator — NPA";
    case "initiator_csd": return "Initiator — CSD";
    case "reviewer_oi": return "Reviewer — Operation In-charge";
    case "reviewer_bm": return "Reviewer — Branch Manager";
    case "brops": return "BROPs — Branch Operations Control";
    case "cad": return "CAD/CIC";
    default: return role;
  }
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtMoney(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return "NPR " + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
