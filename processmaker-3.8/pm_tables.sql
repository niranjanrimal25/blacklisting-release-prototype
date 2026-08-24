-- ProcessMaker 3.8 PM Tables for Blacklisting Release SOP
-- Create these via Admin → PM Tables → New → SQL or via phpMyAdmin

-- 1. Blacklist Register (digihost + manual)
CREATE TABLE IF NOT EXISTS BLACKLIST_REGISTER (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_number VARCHAR(50) UNIQUE,
  blacklist_number VARCHAR(50) NOT NULL UNIQUE,
  cif_id VARCHAR(50) NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'digihost', -- digihost | manual
  party_name VARCHAR(255) NOT NULL,
  party_type VARCHAR(20) NOT NULL DEFAULT 'individual', -- individual | entity
  account_number VARCHAR(50),
  category VARCHAR(20) NOT NULL DEFAULT 'cheque', -- cheque | npa
  reason TEXT,
  freeze_codes TEXT NOT NULL, -- JSON array e.g. ["002"] or comma "002"
  account_status VARCHAR(20) NOT NULL DEFAULT 'frozen', -- frozen | unfrozen
  status VARCHAR(30) NOT NULL DEFAULT 'active', -- active | released | partially_released | temporary_released
  parties TEXT, -- JSON array of {name, role, released}
  cheque_details TEXT, -- JSON
  npa_details TEXT, -- JSON
  documents TEXT, -- JSON array of prior docs {name, note}
  blacklisted_at DATETIME NOT NULL,
  released_at DATETIME NULL,
  temporary_until DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Seed same 8 records as Next.js prototype
INSERT INTO BLACKLIST_REGISTER (case_number, blacklist_number, cif_id, source, party_name, party_type, account_number, category, reason, freeze_codes, parties, cheque_details, documents, blacklisted_at) VALUES
('DH-2025-03417','BLK-2025-01121','CIF-786541','digihost','Suman Karki','individual','0010023341221','cheque','Cheque dishonoured — insufficient funds (3rd presentment)','[\"002\"]','[{\"name\":\"Suman Karki\",\"role\":\"borrower\",\"released\":false}]','{\"chequeNumber\":\"223145\",\"amount\":\"450000\",\"date\":\"2025-09-14\",\"payee\":\"Himal Suppliers Traders\",\"bank\":\"DigiHost Bank — New Road\",\"dishonour\":\"Insufficient funds\"}','[{\"name\":\"Cheque copy (prior process)\",\"note\":\"cheque-223145-scan.pdf\"},{\"name\":\"Dishonour memo\",\"note\":\"dishonour-memo-223145.pdf\"}]', DATE_SUB(NOW(), INTERVAL 120 DAY)),
('DH-2025-03102','BLK-2025-01187','CIF-901233','digihost','Himalayan Traders Pvt. Ltd.','entity','0010023344556','cheque','Cheque dishonoured — payment stopped by drawer','[\"025\"]','[{\"name\":\"Himalayan Traders Pvt. Ltd.\",\"role\":\"borrower\",\"released\":false},{\"name\":\"Bikash Manandhar\",\"role\":\"signatory\",\"released\":false}]','{\"chequeNumber\":\"771208\",\"amount\":\"1250000\",\"date\":\"2025-08-02\",\"payee\":\"Koshi Cement Distributors\",\"bank\":\"DigiHost Bank — Thamel\",\"dishonour\":\"Payment stopped\"}','[{\"name\":\"Cheque copy (prior process)\",\"note\":\"cheque-771208-scan.pdf\"}]', DATE_SUB(NOW(), INTERVAL 96 DAY)),
('DH-2024-02788','BLK-2024-08854','CIF-331876','digihost','Everest Textiles Ltd.','entity','0010099776655','npa','Term loan default — rescheduled twice','[\"100\",\"045\"]','[{\"name\":\"Everest Textiles Ltd.\",\"role\":\"borrower\",\"released\":false},{\"name\":\"Nabin Shrestha\",\"role\":\"signatory\",\"released\":false}]',NULL,'[{\"name\":\"Reschedule agreement (prior process)\",\"note\":\"reschedule-agreement.pdf\"}]', DATE_SUB(NOW(), INTERVAL 500 DAY)),
('DH-2025-03901','BLK-2025-01076','CIF-664208','digihost','Bijay Tamang','individual','0010077001122','npa','Hire purchase loan overdue 210 days','[\"002\"]','[{\"name\":\"Bijay Tamang\",\"role\":\"borrower\",\"released\":false},{\"name\":\"Karma Tamang\",\"role\":\"guarantor\",\"released\":false}]',NULL,'[{\"name\":\"Guarantee deed (prior process)\",\"note\":\"guarantee-deed.pdf\"}]', DATE_SUB(NOW(), INTERVAL 240 DAY)),
('DH-2025-04115','BLK-2025-01208','CIF-712900','digihost','Pooja Sharma','individual','0010055667788','cheque','Cheque dishonoured — signature mismatch (repeated)','[\"101\"]','[{\"name\":\"Pooja Sharma\",\"role\":\"borrower\",\"released\":false}]','{\"chequeNumber\":\"910442\",\"amount\":\"180000\",\"date\":\"2025-10-01\",\"payee\":\"Valley Electronics\",\"bank\":\"DigiHost Bank — Putalisadak\",\"dishonour\":\"Signature mismatch\"}','[{\"name\":\"Cheque copy (prior process)\",\"note\":\"cheque-910442-scan.pdf\"}]', DATE_SUB(NOW(), INTERVAL 75 DAY)),
('DH-2023-01954','BLK-2023-07642','CIF-409882','digihost','Ramesh Adhikari','individual','0010044332211','cheque','Cheque dishonoured — account frozen under investigation code 003','[\"003\"]','[{\"name\":\"Ramesh Adhikari\",\"role\":\"borrower\",\"released\":false}]','{\"chequeNumber\":\"335771\",\"amount\":\"90000\",\"date\":\"2023-11-21\",\"payee\":\"City Hardware\",\"bank\":\"DigiHost Bank — Baneshwor\",\"dishonour\":\"Account frozen\"}','[]', DATE_SUB(NOW(), INTERVAL 700 DAY));

INSERT INTO BLACKLIST_REGISTER (blacklist_number, cif_id, source, party_name, party_type, account_number, category, reason, freeze_codes, parties, npa_details, blacklisted_at) VALUES
('BLK-2024-08903','CIF-552310','manual','Goma Shrestha','individual','0010088110090','npa','Loan overdue 380 days — classification: Loss (manual register)','[\"100\"]','[{\"name\":\"Goma Shrestha\",\"role\":\"borrower\",\"released\":false}]','{\"loanAccount\":\"LN-552310-01\",\"product\":\"Home Loan\",\"outstanding\":\"2400000\",\"overdue\":\"380\",\"classification\":\"Loss\",\"emi\":\"38500\"}', DATE_SUB(NOW(), INTERVAL 420 DAY)),
('BLK-2024-09117','CIF-611208','manual','Sunrise Agro Industries','entity','0010011223344','npa','Working capital loan overdue 290 days (manual register)','[\"025\"]','[{\"name\":\"Sunrise Agro Industries\",\"role\":\"borrower\",\"released\":false},{\"name\":\"Hari Prasad Pokhrel\",\"role\":\"signatory\",\"released\":false}]','{\"loanAccount\":\"LN-611208-01\",\"product\":\"OD / Working Capital\",\"outstanding\":\"5300000\",\"overdue\":\"290\",\"classification\":\"Doubtful\",\"emi\":\"0\"}', DATE_SUB(NOW(), INTERVAL 300 DAY));

-- 2. Release Cases (snapshot + workflow)
CREATE TABLE IF NOT EXISTS BLACKLIST_RELEASE_CASES (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(20) NOT NULL UNIQUE,
  blacklist_record_id INT,
  release_type VARCHAR(30) NOT NULL, -- applicant_cheque | ac_holder_cheque | court | npa | partial | temporary
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  initiator_id VARCHAR(20) NOT NULL,
  reviewer_id VARCHAR(20),
  routed_to_pool TINYINT NOT NULL DEFAULT 0,
  data_snapshot TEXT, -- JSON of all fields at initiation
  letter_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  cib_request_number VARCHAR(50),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (blacklist_record_id) REFERENCES BLACKLIST_REGISTER(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- 3. Freeze code rules (auto-unfreeze eligibility)
CREATE TABLE IF NOT EXISTS FREEZE_CODE_RULES (
  code VARCHAR(10) PRIMARY KEY,
  description VARCHAR(255),
  auto_unfreeze_eligible TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO FREEZE_CODE_RULES (code, description, auto_unfreeze_eligible) VALUES
('002','Cheque dishonour',1),
('025','Regulatory directive',1),
('100','Loan default / NPA',1),
('101','Signature irregularity',0),
('003','Investigation hold',0),
('045','Other regulatory',0)
ON DUPLICATE KEY UPDATE description=VALUES(description), auto_unfreeze_eligible=VALUES(auto_unfreeze_eligible);

-- 4. Optional: Case documents log (if you want to track checklist outside Input Docs)
CREATE TABLE IF NOT EXISTS CASE_DOCUMENTS_LOG (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  requirement_key VARCHAR(50),
  label VARCHAR(255) NOT NULL,
  file_name VARCHAR(255),
  source VARCHAR(20) NOT NULL DEFAULT 'uploaded', -- uploaded | carried | system
  uploaded_by VARCHAR(20),
  created_at DATETIME NOT NULL,
  FOREIGN KEY (case_id) REFERENCES BLACKLIST_RELEASE_CASES(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
