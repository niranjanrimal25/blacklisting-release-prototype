<?php
/**
 * TRG_VALIDATE_REVIEW - Before Next Step in Review Task
 * Enforces remarks mandatory for Return/Query/Reject and forwardTo for Forward
 */

$decision = @@reviewDecision;
$remarks = trim(@@reviewRemarks ?? "");
$forwardTo = trim(@@forwardTo ?? "");

if (in_array($decision, ["RETURN","QUERY","REJECT"]) && empty($remarks)) {
  throw new Exception("Remarks are mandatory for Return / Query / Reject at reviewer level.");
}

if ($decision == "FORWARD" && empty($forwardTo)) {
  throw new Exception("Select the authority to forward the case to.");
}

// If Forward, set next reviewer
if ($decision == "FORWARD") {
  // PM Value-based assignment: set @@nextReviewerId
  @@nextReviewerId = $forwardTo;
  // Log
  @@forwardLog = "Forwarded to " . $forwardTo . " by " . @@USER_LOGGED;
}

// If Return/Query, store for initiator display
if ($decision == "RETURN" || $decision == "QUERY") {
  @@lastReturnRemarks = $remarks;
  @@lastReturnAction = $decision;
}
?>
