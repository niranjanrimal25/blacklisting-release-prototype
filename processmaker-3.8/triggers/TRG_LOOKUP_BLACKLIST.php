<?php
/**
 * TRG_LOOKUP_BLACKLIST - Before Dynaform DF_IDENTIFY_CASE
 * Searches BLACKLIST_REGISTER PM Table by caseNumber/cifId/blacklistNumber/partyName
 * Auto-populates case data and prior docs grid
 */

$identifier = @@searchIdentifier;
if (empty($identifier)) {
  // Try manual mode, skip lookup
  return;
}

$identifier = trim($identifier);
$lower = strtolower($identifier);

// Query PM Table BLACKLIST_REGISTER (you can also query external DigiHost DB via executeQuery)
$query = "SELECT * FROM BLACKLIST_REGISTER WHERE 
  LOWER(case_number) = '$lower' OR 
  LOWER(blacklist_number) = '$lower' OR 
  LOWER(cif_id) = '$lower' OR
  LOWER(party_name) LIKE '%$lower%' 
  LIMIT 1";

$result = executeQuery($query);

if (count($result) > 0) {
  $rec = $result[1]; // PM returns 1-indexed
  @@blacklistRecordId = $rec['id'];
  @@partyName = $rec['party_name'];
  @@partyType = $rec['party_type'];
  @@cifId = $rec['cif_id'];
  @@blacklistNumber = $rec['blacklist_number'];
  @@caseNumber = $rec['case_number'];
  @@accountNumber = $rec['account_number'];
  @@category = $rec['category'];
  @@freezeCodes = $rec['freeze_codes']; // JSON array
  @@accountStatus = $rec['account_status'];
  @@blacklistReason = $rec['reason'];
  @@source = $rec['source'];

  // Cheque details JSON
  if (!empty($rec['cheque_details'])) {
    $ch = json_decode($rec['cheque_details'], true);
    if ($ch) {
      @@chequeNumber = $ch['chequeNumber'] ?? '';
      @@chequeAmount = $ch['amount'] ?? '';
      @@chequeDate = $ch['date'] ?? '';
      @@payeeName = $ch['payee'] ?? '';
      @@issuingBranch = $ch['bank'] ?? '';
    }
  }
  // NPA details
  if (!empty($rec['npa_details'])) {
    $np = json_decode($rec['npa_details'], true);
    if ($np) {
      @@loanAccountNo = $np['loanAccount'] ?? '';
      @@outstandingAmount = $np['outstanding'] ?? '';
      @@emiAmount = $np['emi'] ?? '';
      @@borrowerName = $rec['party_name'];
      // Guarantor
      $parties = json_decode($rec['parties'], true);
      if ($parties) {
        foreach ($parties as $p) {
          if ($p['role'] == 'guarantor') {
            @@guarantorName = $p['name'];
          }
        }
      }
    }
  }

  // Prior docs grid
  @@priorDocs = [];
  if (!empty($rec['documents'])) {
    $docs = json_decode($rec['documents'], true);
    if ($docs) {
      foreach ($docs as $d) {
        @@priorDocs[] = ['name' => $d['name'], 'note' => $d['note'] ?? $d['name']];
      }
    }
  }

  @@lookupFound = "Yes";
  @@lookupMessage = "Retrieved from DigiHost — " . count(@@priorDocs) . " prior doc(s) will carry forward";
} else {
  @@lookupFound = "No";
  @@lookupMessage = "No DigiHost case matches. Use manual entry fallback.";
  // Clear
  @@partyName = "";
}
?>
