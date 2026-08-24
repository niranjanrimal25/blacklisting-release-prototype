/* Seed: users, blacklist register, and a few in-flight release cases. */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import {
  blacklistRecords,
  caseDocuments,
  caseEvents,
  notifications,
  releaseCases,
  users,
} from "./schema";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
});
const db = drizzle(pool);

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function main() {
  console.log("Seeding DigiHost demo data…");

  await db.delete(notifications);
  await db.delete(caseEvents);
  await db.delete(caseDocuments);
  await db.delete(releaseCases);
  await db.delete(blacklistRecords);
  await db.delete(users);

  const u = await db
    .insert(users)
    .values([
      { id: "u01", name: "Asha Rai", role: "initiator_branch", unit: "Kathmandu Main Branch", title: "Branch Operations Officer" },
      { id: "u02", name: "Deepak Shrestha", role: "initiator_npa", unit: "NPA Department", title: "NPA Recovery Officer" },
      { id: "u03", name: "Mira KC", role: "initiator_csd", unit: "Customer Service Department", title: "CSD Officer" },
      { id: "u04", name: "Rajan Thapa", role: "reviewer_oi", unit: "Kathmandu Main Branch", title: "Operation In-charge (OI)" },
      { id: "u05", name: "Sita Gurung", role: "reviewer_bm", unit: "Kathmandu Main Branch", title: "Branch Manager (BM)" },
      { id: "u06", name: "Prakash Adhikari", role: "brops", unit: "Branch Operations Control", title: "BROPs Analyst" },
      { id: "u07", name: "Nirmala Basnet", role: "brops", unit: "Branch Operations Control", title: "BROPs Analyst" },
      { id: "u08", name: "Anil Verma", role: "cad", unit: "Credit Administration / CIC", title: "CAD/CIC Officer" },
      { id: "u09", name: "Sabina Maharjan", role: "cad", unit: "Credit Administration / CIC", title: "CAD/CIC Officer" },
    ])
    .returning();
  console.log(`users: ${u.length}`);

  const recs = await db
    .insert(blacklistRecords)
    .values([
      {
        caseNumber: "DH-2025-03417", blacklistNumber: "BLK-2025-01121", cifId: "CIF-786541",
        source: "digihost", partyName: "Suman Karki", partyType: "individual",
        accountNumber: "0010023341221", category: "cheque",
        reason: "Cheque dishonoured — insufficient funds (3rd presentment)",
        freezeCodes: ["002"],
        parties: [{ name: "Suman Karki", role: "borrower", released: false }],
        chequeDetails: { chequeNumber: "223145", amount: "450000", date: "2025-09-14", payee: "Himal Suppliers Traders", bank: "DigiHost Bank — New Road", dishonour: "Insufficient funds" },
        documents: [
          { name: "Cheque copy (prior process)", note: "cheque-223145-scan.pdf" },
          { name: "Dishonour memo", note: "dishonour-memo-223145.pdf" },
        ],
        blacklistedAt: daysAgo(120),
      },
      {
        caseNumber: "DH-2025-03102", blacklistNumber: "BLK-2025-01187", cifId: "CIF-901233",
        source: "digihost", partyName: "Himalayan Traders Pvt. Ltd.", partyType: "entity",
        accountNumber: "0010023344556", category: "cheque",
        reason: "Cheque dishonoured — payment stopped by drawer",
        freezeCodes: ["025"],
        parties: [
          { name: "Himalayan Traders Pvt. Ltd.", role: "borrower", released: false },
          { name: "Bikash Manandhar", role: "signatory", released: false },
        ],
        chequeDetails: { chequeNumber: "771208", amount: "1250000", date: "2025-08-02", payee: "Koshi Cement Distributors", bank: "DigiHost Bank — Thamel", dishonour: "Payment stopped" },
        documents: [{ name: "Cheque copy (prior process)", note: "cheque-771208-scan.pdf" }],
        blacklistedAt: daysAgo(96),
      },
      {
        caseNumber: null, blacklistNumber: "BLK-2024-08903", cifId: "CIF-552310",
        source: "manual", partyName: "Goma Shrestha", partyType: "individual",
        accountNumber: "0010088110090", category: "npa",
        reason: "Loan overdue 380 days — classification: Loss (manual register)",
        freezeCodes: ["100"],
        parties: [{ name: "Goma Shrestha", role: "borrower", released: false }],
        npaDetails: { loanAccount: "LN-552310-01", product: "Home Loan", outstanding: "2400000", overdue: "380", classification: "Loss", emi: "38500" },
        documents: [],
        blacklistedAt: daysAgo(420),
      },
      {
        caseNumber: "DH-2024-02788", blacklistNumber: "BLK-2024-08854", cifId: "CIF-331876",
        source: "digihost", partyName: "Everest Textiles Ltd.", partyType: "entity",
        accountNumber: "0010099776655", category: "npa",
        reason: "Term loan default — rescheduled twice",
        freezeCodes: ["100", "045"],
        parties: [
          { name: "Everest Textiles Ltd.", role: "borrower", released: false },
          { name: "Nabin Shrestha", role: "signatory", released: false },
        ],
        npaDetails: { loanAccount: "LN-331876-02", product: "Term Loan II", outstanding: "8700000", overdue: "510", classification: "Loss", emi: "210000" },
        documents: [{ name: "Reschedule agreement (prior process)", note: "reschedule-agreement.pdf" }],
        blacklistedAt: daysAgo(500),
      },
      {
        caseNumber: "DH-2025-03901", blacklistNumber: "BLK-2025-01076", cifId: "CIF-664208",
        source: "digihost", partyName: "Bijay Tamang", partyType: "individual",
        accountNumber: "0010077001122", category: "npa",
        reason: "Hire purchase loan overdue 210 days",
        freezeCodes: ["002"],
        parties: [
          { name: "Bijay Tamang", role: "borrower", released: false },
          { name: "Karma Tamang", role: "guarantor", released: false },
        ],
        npaDetails: { loanAccount: "LN-664208-03", product: "Hire Purchase", outstanding: "1450000", overdue: "210", classification: "Doubtful", emi: "46200", guarantor: "Karma Tamang" },
        documents: [{ name: "Guarantee deed (prior process)", note: "guarantee-deed.pdf" }],
        blacklistedAt: daysAgo(240),
      },
      {
        caseNumber: "DH-2025-04115", blacklistNumber: "BLK-2025-01208", cifId: "CIF-712900",
        source: "digihost", partyName: "Pooja Sharma", partyType: "individual",
        accountNumber: "0010055667788", category: "cheque",
        reason: "Cheque dishonoured — signature mismatch (repeated)",
        freezeCodes: ["101"],
        parties: [{ name: "Pooja Sharma", role: "borrower", released: false }],
        chequeDetails: { chequeNumber: "910442", amount: "180000", date: "2025-10-01", payee: "Valley Electronics", bank: "DigiHost Bank — Putalisadak", dishonour: "Signature mismatch" },
        documents: [{ name: "Cheque copy (prior process)", note: "cheque-910442-scan.pdf" }],
        blacklistedAt: daysAgo(75),
      },
      {
        caseNumber: null, blacklistNumber: "BLK-2024-09117", cifId: "CIF-611208",
        source: "manual", partyName: "Sunrise Agro Industries", partyType: "entity",
        accountNumber: "0010011223344", category: "npa",
        reason: "Working capital loan overdue 290 days (manual register)",
        freezeCodes: ["025"],
        parties: [
          { name: "Sunrise Agro Industries", role: "borrower", released: false },
          { name: "Hari Prasad Pokhrel", role: "signatory", released: false },
        ],
        npaDetails: { loanAccount: "LN-611208-01", product: "OD / Working Capital", outstanding: "5300000", overdue: "290", classification: "Doubtful", emi: "0" },
        documents: [],
        blacklistedAt: daysAgo(300),
      },
      {
        caseNumber: "DH-2023-01954", blacklistNumber: "BLK-2023-07642", cifId: "CIF-409882",
        source: "digihost", partyName: "Ramesh Adhikari", partyType: "individual",
        accountNumber: "0010044332211", category: "cheque",
        reason: "Cheque dishonoured — account frozen under investigation code 003",
        freezeCodes: ["003"],
        parties: [{ name: "Ramesh Adhikari", role: "borrower", released: false }],
        chequeDetails: { chequeNumber: "335771", amount: "90000", date: "2023-11-21", payee: "City Hardware", bank: "DigiHost Bank — Baneshwor", dishonour: "Account frozen" },
        documents: [],
        blacklistedAt: daysAgo(700),
      },
    ])
    .returning();
  console.log(`blacklist records: ${recs.length}`);
  const [suman, himal, goma] = recs;

  /* Case 1 — applicant cheque routed to the BROPs pool, pending claim. */
  const [c1] = await db
    .insert(releaseCases)
    .values({
      reference: `BR-${new Date().getFullYear()}-0001`,
      blacklistRecordId: suman.id,
      releaseType: "applicant_cheque",
      status: "PENDING_REVIEW",
      initiatorId: "u01",
      reviewerId: null,
      routedToPool: true,
      letterStatus: "pending",
      createdAt: daysAgo(2),
      submittedAt: daysAgo(1),
      data: {
        source: "digihost", caseNumber: suman.caseNumber ?? "", blacklistNumber: suman.blacklistNumber,
        cifId: suman.cifId, partyName: suman.partyName, partyType: suman.partyType,
        accountNumber: suman.accountNumber ?? "", category: "cheque", freezeCodes: "002",
        chequeNumber: "223145", chequeAmount: "450000", chequeDate: "2025-09-14",
        payeeName: "Himal Suppliers Traders", issuingBranch: "New Road",
        chargeMdr: "5000",
        basis: "Payee has been settled in full by bank transfer; the applicant requests release of the cheque-related blacklisting with the payee's consent.",
      },
    })
    .returning();

  await db.insert(caseDocuments).values([
    { caseId: c1.id, requirementKey: "prior_docs", label: "Cheque copy (prior process)", fileName: "cheque-223145-scan.pdf", source: "carried" },
    { caseId: c1.id, requirementKey: "prior_docs", label: "Dishonour memo", fileName: "dishonour-memo-223145.pdf", source: "carried" },
    { caseId: c1.id, requirementKey: "copy_cheque", label: "Copy of cheque", fileName: "cheque-223145.pdf", source: "uploaded", uploadedBy: "u01" },
    { caseId: c1.id, requirementKey: "payee_application", label: "Application from payee / beneficiary", fileName: "payee-application.pdf", source: "uploaded", uploadedBy: "u01" },
    { caseId: c1.id, requirementKey: "mdr_copy", label: "Evidence of release charge — MDR copy", fileName: "mdr-receipt-8841.pdf", source: "uploaded", uploadedBy: "u01" },
    { caseId: c1.id, requirementKey: "id_holder", label: "Citizenship / registration certificate — account holder", fileName: "citizenship-suman.pdf", source: "uploaded", uploadedBy: "u01" },
    { caseId: c1.id, requirementKey: "cib_inclusion_letter", label: "Blacklist Inclusion Letter from CIC", fileName: "cib-inclusion-letter.pdf", source: "uploaded", uploadedBy: "u01" },
  ]);

  await db.insert(caseEvents).values([
    { caseId: c1.id, actorId: "u01", actorName: "Asha Rai", actorRole: "initiator_branch", action: "CREATED", toStatus: "DRAFT", remarks: "Case initiated via DigiHost auto-population — By Applicant – By Cheque.", createdAt: daysAgo(2) },
    { caseId: c1.id, actorId: null, actorName: "DigiHost System", actorRole: "system", action: "DATA_AUTOPOPULATED", remarks: "Blacklist data and 2 document(s) retrieved from DigiHost case DH-2025-03417.", createdAt: daysAgo(2) },
    { caseId: c1.id, actorId: "u01", actorName: "Asha Rai", actorRole: "initiator_branch", action: "SUBMITTED", fromStatus: "DRAFT", toStatus: "PENDING_REVIEW", createdAt: daysAgo(1) },
  ]);

  await db.insert(notifications).values([
    { userId: "u06", caseId: c1.id, message: `${c1.reference} submitted to the BROPs pool by Asha Rai — claim to review.`, createdAt: daysAgo(1) },
    { userId: "u07", caseId: c1.id, message: `${c1.reference} submitted to the BROPs pool by Asha Rai — claim to review.`, createdAt: daysAgo(1) },
  ]);

  /* Case 2 — NPA release waiting for CAD to complete the CIB letter. */
  const [c2] = await db
    .insert(releaseCases)
    .values({
      reference: `BR-${new Date().getFullYear()}-0002`,
      blacklistRecordId: goma.id,
      releaseType: "npa",
      status: "LETTER_PENDING",
      initiatorId: "u02",
      reviewerId: "u05",
      routedToPool: false,
      letterStatus: "generated",
      createdAt: daysAgo(6),
      submittedAt: daysAgo(5),
      data: {
        source: "manual", caseNumber: "", blacklistNumber: goma.blacklistNumber,
        cifId: goma.cifId, partyName: goma.partyName, partyType: goma.partyType,
        accountNumber: goma.accountNumber ?? "", category: "npa", freezeCodes: "100",
        loanAccountNo: "LN-552310-01", outstandingAmount: "2400000",
        settlementRef: "LOS-SET-2026-10331", regularizationDate: "2026-01-28", settledAmount: "2432500",
        basis: "Full and final settlement received and booked in LOS. Home loan LN-552310-01 regularized; release of blacklisting requested.",
      },
    })
    .returning();

  await db.insert(caseDocuments).values([
    { caseId: c2.id, requirementKey: "loan_regularization", label: "Loan regularization / settlement evidence", fileName: "los-settlement-letter.pdf", source: "uploaded", uploadedBy: "u02" },
    { caseId: c2.id, requirementKey: "cib_inclusion_letter", label: "Blacklist Inclusion Letter from CIC", fileName: "cib-inclusion-letter-goma.pdf", source: "uploaded", uploadedBy: "u02" },
  ]);

  await db.insert(caseEvents).values([
    { caseId: c2.id, actorId: "u02", actorName: "Deepak Shrestha", actorRole: "initiator_npa", action: "CREATED", toStatus: "DRAFT", remarks: "Case initiated via manual entry — NPA Release – By NPA.", createdAt: daysAgo(6) },
    { caseId: c2.id, actorId: "u02", actorName: "Deepak Shrestha", actorRole: "initiator_npa", action: "SUBMITTED", fromStatus: "DRAFT", toStatus: "PENDING_REVIEW", createdAt: daysAgo(5) },
    { caseId: c2.id, actorId: "u05", actorName: "Sita Gurung", actorRole: "reviewer_bm", action: "APPROVED", fromStatus: "PENDING_REVIEW", toStatus: "LETTER_PENDING", remarks: "Settlement verified in LOS. Approved for release.", createdAt: daysAgo(3) },
    { caseId: c2.id, actorId: null, actorName: "DigiHost System", actorRole: "system", action: "LETTER_GENERATED", toStatus: "LETTER_PENDING", remarks: "CIB Release Letter generated on the CAD screen.", createdAt: daysAgo(3) },
  ]);

  await db.insert(notifications).values([
    { userId: "u08", caseId: c2.id, message: `${c2.reference} approved at review. CIB Release Letter awaits completion/signing on the CAD screen.`, createdAt: daysAgo(3) },
    { userId: "u09", caseId: c2.id, message: `${c2.reference} approved at review. CIB Release Letter awaits completion/signing on the CAD screen.`, createdAt: daysAgo(3) },
  ]);

  /* Case 3 — returned to initiator for correction. */
  const [c3] = await db
    .insert(releaseCases)
    .values({
      reference: `BR-${new Date().getFullYear()}-0003`,
      blacklistRecordId: himal.id,
      releaseType: "ac_holder_cheque",
      status: "RETURNED",
      initiatorId: "u01",
      reviewerId: "u06",
      routedToPool: false,
      letterStatus: "pending",
      createdAt: daysAgo(4),
      submittedAt: daysAgo(4),
      data: {
        source: "digihost", caseNumber: himal.caseNumber ?? "", blacklistNumber: himal.blacklistNumber,
        cifId: himal.cifId, partyName: himal.partyName, partyType: himal.partyType,
        accountNumber: himal.accountNumber ?? "", category: "cheque", freezeCodes: "025",
        chequeNumber: "771208", chequeAmount: "1250000", chequeDate: "2025-08-02",
        payeeName: "Koshi Cement Distributors",
        balanceConfirm: "yes",
        lien: "Applied automatically in the name of the payee for the required balance",
        chargeDebit: "10000",
        basis: "Account holder has arranged funds covering the cheque amount plus charges; debit authority attached.",
      },
    })
    .returning();

  await db.insert(caseDocuments).values([
    { caseId: c3.id, requirementKey: "prior_docs", label: "Cheque copy (prior process)", fileName: "cheque-771208-scan.pdf", source: "carried" },
    { caseId: c3.id, requirementKey: "blacklist_docs", label: "Blacklist documents", fileName: "blacklist-docs-himal.pdf", source: "uploaded", uploadedBy: "u01" },
    { caseId: c3.id, requirementKey: "cib_inclusion_letter", label: "Blacklist Inclusion Letter from CIC", fileName: "cib-letter-himal.pdf", source: "uploaded", uploadedBy: "u01" },
  ]);

  await db.insert(caseEvents).values([
    { caseId: c3.id, actorId: "u01", actorName: "Asha Rai", actorRole: "initiator_branch", action: "CREATED", toStatus: "DRAFT", remarks: "Case initiated via DigiHost auto-population — By A/C Holder – By Cheque.", createdAt: daysAgo(4) },
    { caseId: c3.id, actorId: "u01", actorName: "Asha Rai", actorRole: "initiator_branch", action: "SUBMITTED", fromStatus: "DRAFT", toStatus: "PENDING_REVIEW", createdAt: daysAgo(4) },
    { caseId: c3.id, actorId: "u06", actorName: "Prakash Adhikari", actorRole: "brops", action: "RETURNED", fromStatus: "PENDING_REVIEW", toStatus: "RETURNED", remarks: "Debit Authority is missing and the MDR charge evidence does not match the entered amount (NPR 10,000). Rectify and forward after return.", createdAt: daysAgo(2) },
  ]);

  await db.insert(notifications).values([
    { userId: "u01", caseId: c3.id, message: `${c3.reference} returned for rectification by Prakash Adhikari: "Debit Authority is missing…"`, createdAt: daysAgo(2) },
  ]);

  console.log("seed cases: 3");
  console.log("Done.");
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
