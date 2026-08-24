<?php
/**
 * TRG_MAKER_COMPLETENESS_CHECK - Before Next Step in T03_Upload_Docs
 * Checks mandatory Input Documents per release type
 * Mirrors missingRequiredDocs() in workflow.ts
 */

$releaseType = @@releaseType;
$requiredMap = [
  "applicant_cheque" => ["IN_COPY_CHEQUE","IN_PAYEE_APPLICATION","IN_MDR_COPY","IN_ID_HOLDER","IN_CIB_INCLUSION_LETTER"],
  "ac_holder_cheque" => ["IN_BLACKLIST_DOCS","IN_CIB_INCLUSION_LETTER","IN_DEBIT_AUTHORITY"],
  "court" => ["IN_COURT_LETTER","IN_LEGAL_CONSENT","IN_BOC_APPROVAL","IN_CIB_INCLUSION_LETTER"],
  "npa" => ["IN_LOAN_REGULARIZATION","IN_CIB_INCLUSION_LETTER"],
  "partial" => ["IN_NRRC_MINUTE","IN_GUARANTOR_SETTLEMENT","IN_CIB_INCLUSION_LETTER"],
  "temporary" => ["IN_PAYMENT_PLAN","IN_COMMITTEE_MINUTE","IN_CIB_INCLUSION_LETTER"]
];

$required = $requiredMap[$releaseType] ?? [];
$missing = [];

// PM function to check if Input Doc uploaded: count of APP_DOCUMENT
$caseId = @@APPLICATION;
foreach ($required as $docUid) {
  // Query APP_DOCUMENT for this case and doc
  $q = "SELECT * FROM APP_DOCUMENT WHERE APP_UID = '$caseId' AND DOC_UID = '$docUid' AND APP_DOC_STATUS = 'ACTIVE'";
  $res = executeQuery($q);
  if (count($res) == 0) {
    $missing[] = $docUid;
  }
}

if (count($missing) > 0) {
  // Block routing
  throw new Exception("Mandatory documents missing: " . implode(", ", $missing) . ". Upload them to pass maker completeness check.");
}

// If passes, set status
@@makerCheckPassed = "Yes";
?>
