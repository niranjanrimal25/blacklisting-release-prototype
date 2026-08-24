<?php
/**
 * TRG_CHECK_SIGNED_LETTER - Before Next Step in Letter Tasks
 * Ensures signed letter uploaded
 */

$caseId = @@APPLICATION;
$q = "SELECT * FROM APP_DOCUMENT WHERE APP_UID = '$caseId' AND DOC_UID = 'IN_SIGNED_LETTER' AND APP_DOC_STATUS = 'ACTIVE'";
$res = executeQuery($q);

if (count($res) == 0) {
  throw new Exception("Upload the signed/digitally-signed CIB Release Letter before submitting to CAD/CIC.");
}

@@letterStatus = "signed";
@@signedLetterUploaded = "Yes";
?>
