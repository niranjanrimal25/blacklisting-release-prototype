<?php
/**
 * TRG_RELEASE_BLACKLIST - Trigger on RELEASE in CAD Validation Task
 * Most important trigger – handles partial, temporary, auto-unfreeze
 * Mirrors engine.ts RELEASE case
 */

$releaseType = @@releaseType;
$blacklistRecordId = @@blacklistRecordId;
$caseRef = @@reference ?? @@APPLICATION;

// Fetch blacklist record
$q = "SELECT * FROM BLACKLIST_REGISTER WHERE id = $blacklistRecordId LIMIT 1";
$res = executeQuery($q);
if (count($res) == 0) {
  throw new Exception("Underlying blacklist record not found: $blacklistRecordId");
}
$record = $res[1];
$freezeCodesJson = $record['freeze_codes']; // e.g. ["002"]
$freezeCodes = json_decode($freezeCodesJson, true);
if (!is_array($freezeCodes)) {
  // Try comma separated
  $freezeCodes = explode(",", trim($freezeCodesJson, "[]\" "));
}
$freezeCodes = array_map('trim', $freezeCodes);
$accountNumber = $record['account_number'];

$now = date("Y-m-d H:i:s");

// Handle per release type
if ($releaseType == "partial") {
  $gname = strtolower(trim(@@guarantorName ?? ""));
  $partiesJson = $record['parties'];
  $parties = json_decode($partiesJson, true) ?? [];
  $newParties = [];
  foreach ($parties as $p) {
    if ($p['role'] == 'guarantor' && (empty($gname) || stripos(strtolower($p['name']), $gname) !== false || stripos($gname, strtolower($p['name'])) !== false)) {
      $p['released'] = true;
    }
    $newParties[] = $p;
  }
  $newPartiesJson = json_encode($newParties);
  $q2 = "UPDATE BLACKLIST_REGISTER SET parties = '$newPartiesJson', status = 'partially_released' WHERE id = $blacklistRecordId";
  executeQuery($q2);
  @@releaseLog = "Guarantor '" . @@guarantorName . "' released at party level; borrower " . @@borrowerName . " remains blacklisted.";
  @@autoUnfreezeSkipped = "Partial release — account remains frozen for borrower; guarantor release at party level.";
} elseif ($releaseType == "temporary") {
  $until = date("Y-m-d H:i:s", strtotime("+6 months"));
  $q2 = "UPDATE BLACKLIST_REGISTER SET status = 'temporary_released', released_at = '$now', temporary_until = '$until' WHERE id = $blacklistRecordId";
  executeQuery($q2);
  @@releaseLog = "Temporary release recorded for six months based on EMI payment plan. Until $until";
  @@temporaryUntil = $until;
} else {
  // Full release
  $q2 = "UPDATE BLACKLIST_REGISTER SET status = 'released', released_at = '$now' WHERE id = $blacklistRecordId";
  executeQuery($q2);
}

// Auto-unfreeze: only after release, single code 002/025/100, not partial
if ($releaseType != "partial") {
  $eligibleCodes = ["002","025","100"];
  $eligible = false;
  $reason = "";
  if (count($freezeCodes) == 1 && in_array($freezeCodes[0], $eligibleCodes)) {
    $eligible = true;
    $reason = "Single freeze reason code " . $freezeCodes[0] . " — auto-unfreeze authorised.";
  } elseif (count($freezeCodes) == 1) {
    $reason = "Freeze code " . $freezeCodes[0] . " is outside 002/025/100 — route to manual control.";
  } else {
    $reason = "Multiple freeze reason codes exist — automatic unfreezing not authorised; route to manual control.";
  }

  if ($eligible) {
    $q3 = "UPDATE BLACKLIST_REGISTER SET account_status = 'unfrozen' WHERE id = $blacklistRecordId";
    executeQuery($q3);
    @@autoUnfrozen = "Account $accountNumber unfrozen automatically. $reason";
    @@unfreezeLog = @@autoUnfrozen;
  } else {
    @@autoUnfreezeSkipped = $reason;
    @@unfreezeLog = $reason;
  }
} else {
  @@autoUnfreezeSkipped = "Partial release — account remains frozen for borrower.";
}

// Final log for Output Document
@@releasedAt = $now;
@@releaseTypeLabel = $releaseType;
@@finalReleaseMessage = "Blacklist released. Eligible auto-unfreeze evaluated.";

?>
