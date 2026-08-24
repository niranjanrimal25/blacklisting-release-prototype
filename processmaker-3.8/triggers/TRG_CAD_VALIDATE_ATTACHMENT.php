<?php
/**
 * TRG_CAD_VALIDATE_ATTACHMENT - Before Next Step in CAD Validation
 * Attachment mandatory at CAD level
 */

$decision = @@cadDecision;
$remarks = trim(@@cadRemarks ?? "");
$requestNumber = trim(@@cibRequestNumber ?? "");

if (in_array($decision, ["CAD_RETURN","CAD_QUERY"]) && empty($remarks)) {
  throw new Exception("Remarks are mandatory for Return/Query at CAD level.");
}

if (in_array($decision, ["CAD_RETURN","CAD_QUERY","CIB_RETURNED"]) ) {
  // Check if any Input Doc uploaded in this task (e.g., IN_CAD_RETURN_ATTACHMENT)
  $caseId = @@APPLICATION;
  $q = "SELECT * FROM APP_DOCUMENT WHERE APP_UID = '$caseId' AND APP_DOC_STATUS = 'ACTIVE' ORDER BY APP_DOC_CREATE_DATE DESC LIMIT 1";
  $res = executeQuery($q);
  // More precise: check if file was uploaded in current task
  // For simplicity, check if attachment file variable set
  // In PM 3.8, you can check if file input has value via @@fileVariable
  // Here we assume trigger runs after file upload, so check if last doc exists
  if (count($res) == 0) {
    throw new Exception("An attachment is mandatory for Return/Query at CAD/CIC level and CIB Returned.");
  }
}

if ($decision == "CIB_REPORTED") {
  if (empty($requestNumber) || empty($remarks)) {
    throw new Exception("Request Number and remarks are mandatory for Reported to CIB.");
  }
  @@cibRequestNumberStored = $requestNumber;
}
?>
