/**
 * In-memory DB that mimics drizzle-orm API for the prototype.
 * File-persistent fallback to survive Turbopack worker restarts.
 */

import * as schema from "./schema";
import * as fs from "fs";
import * as path from "path";

type Row = Record<string, any>;

const DATA_FILE = path.join(process.cwd(), ".memory-data.json");

type MemData = {
  users: Row[];
  blacklist_records: Row[];
  release_cases: Row[];
  case_documents: Row[];
  case_events: Row[];
  notifications: Row[];
  nextIds: Record<string, number>;
};

type GlobalMem = typeof globalThis & {
  __arenaMemData?: MemData;
  __arenaMemColumnMap?: WeakMap<any, string>;
  __arenaMemTableMap?: WeakMap<any, string>;
};

const g = globalThis as GlobalMem;

function loadFromFile(): MemData | null {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      if (!raw || !raw.trim()) return null;
      const parsed = JSON.parse(raw);
      // Revive dates: try to parse ISO strings for known date fields
      const dateFields = ["blacklistedAt", "releasedAt", "temporaryUntil", "createdAt", "updatedAt", "submittedAt", "closedAt"];
      const revive = (obj: any) => {
        if (!obj || typeof obj !== "object") return obj;
        for (const k of Object.keys(obj)) {
          if (dateFields.includes(k) && typeof obj[k] === "string") {
            const d = new Date(obj[k]);
            if (!isNaN(d.getTime())) obj[k] = d;
          } else if (typeof obj[k] === "object") {
            revive(obj[k]);
          }
        }
      };
      for (const tbl of ["users", "blacklist_records", "release_cases", "case_documents", "case_events", "notifications"] as const) {
        if (Array.isArray((parsed as any)[tbl])) {
          for (const r of (parsed as any)[tbl]) revive(r);
        }
      }
      return parsed as MemData;
    }
  } catch (e) {
    console.warn("[memdb] load file failed", e);
  }
  return null;
}

function saveToFile(data: MemData) {
  try {
    const tmp = DATA_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data), "utf-8");
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.warn("[memdb] save file failed", e);
  }
}

function getData(): MemData {
  if (g.__arenaMemData) return g.__arenaMemData;
  const fromFile = loadFromFile();
  if (fromFile) {
    g.__arenaMemData = fromFile;
    return fromFile;
  }
  const empty: MemData = {
    users: [],
    blacklist_records: [],
    release_cases: [],
    case_documents: [],
    case_events: [],
    notifications: [],
    nextIds: {
      blacklist_records: 1,
      release_cases: 1,
      case_documents: 1,
      case_events: 1,
      notifications: 1,
    },
  };
  g.__arenaMemData = empty;
  return empty;
}

function persist() {
  const data = getData();
  saveToFile(data);
}

function buildColumnMap() {
  if (g.__arenaMemColumnMap) return g.__arenaMemColumnMap;
  const map = new WeakMap<any, string>();
  const tableMap = new WeakMap<any, string>();

  const tableToKey: Record<string, string> = {
    users: "users",
    blacklistRecords: "blacklist_records",
    releaseCases: "release_cases",
    caseDocuments: "case_documents",
    caseEvents: "case_events",
    notifications: "notifications",
  };

  for (const [exportName, table] of Object.entries(schema)) {
    const key = (tableToKey as any)[exportName];
    if (!key) continue;
    if (typeof table === "object" && table !== null) {
      tableMap.set(table as any, key);
      for (const [jsKey, col] of Object.entries(table as any)) {
        if (col && typeof col === "object") {
          try {
            map.set(col as any, jsKey);
          } catch {}
        }
      }
    }
  }
  g.__arenaMemColumnMap = map;
  g.__arenaMemTableMap = tableMap;
  return map;
}

function getTableMap() {
  buildColumnMap();
  return g.__arenaMemTableMap!;
}

function getJsKey(col: any): string {
  if (!col) return "";
  const map = buildColumnMap();
  return map.get(col) || col?.name || "";
}

function getTableKey(table: any): string {
  const map = getTableMap();
  const mapped = map.get(table);
  if (mapped) return mapped;
  if (!table || typeof table !== "object") return "";
  const keys = Object.keys(table);
  // Robust detection ignoring enableRLS and other drizzle internals
  if (keys.includes("blacklistNumber")) return "blacklist_records";
  if (keys.includes("reference") && keys.includes("releaseType")) return "release_cases";
  if (keys.includes("requirementKey")) return "case_documents";
  if (keys.includes("action") && keys.includes("actorName")) return "case_events";
  if (keys.includes("message") && keys.includes("userId")) return "notifications";
  if (keys.includes("role") && keys.includes("unit")) return "users";
  if (keys.includes("id") && keys.includes("name") && keys.includes("role")) return "users";
  return "";
}

function getTableArray(table: any): Row[] {
  const data = getData();
  const key = getTableKey(table);
  if (!key) {
    console.error("[memdb] Unknown table, keys:", table ? Object.keys(table) : table);
    throw new Error(`Unknown table ${JSON.stringify(Object.keys(table || {}))}`);
  }
  return (data as any)[key];
}

function cloneRow(row: Row): Row {
  if (row === undefined || row === null) return row;
  try {
    if (typeof (globalThis as any).structuredClone === "function") {
      return (globalThis as any).structuredClone(row);
    }
  } catch {}
  // Shallow clone + deep clone for known nested objects without JSON.parse
  const out: Row = {};
  for (const k of Object.keys(row)) {
    const v = row[k];
    if (Array.isArray(v)) {
      out[k] = v.map((el: any) => (typeof el === "object" && el !== null ? { ...el } : el));
    } else if (v && typeof v === "object" && !(v instanceof Date)) {
      out[k] = { ...v };
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Predicate helpers
export function eq(col: any, value: any) {
  const jsKey = getJsKey(col);
  const dbName = col?.name;
  return (row: Row) => {
    const v = jsKey && row[jsKey] !== undefined ? row[jsKey] : dbName ? row[dbName] : undefined;
    return v === value;
  };
}

export function ne(col: any, value: any) {
  const jsKey = getJsKey(col);
  const dbName = col?.name;
  return (row: Row) => {
    const v = jsKey && row[jsKey] !== undefined ? row[jsKey] : dbName ? row[dbName] : undefined;
    return v !== value;
  };
}

export function isNull(col: any) {
  const jsKey = getJsKey(col);
  const dbName = col?.name;
  return (row: Row) => {
    const v = jsKey && row[jsKey] !== undefined ? row[jsKey] : dbName ? row[dbName] : undefined;
    return v === null || v === undefined;
  };
}

export function and(...preds: ((row: Row) => boolean)[]) {
  return (row: Row) => preds.every((p) => (typeof p === "function" ? p(row) : true));
}

export function or(...preds: ((row: Row) => boolean)[]) {
  return (row: Row) => preds.some((p) => (typeof p === "function" ? p(row) : false));
}

export function desc(col: any) {
  return { col, dir: "desc" as const };
}

export function asc(col: any) {
  return { col, dir: "asc" as const };
}

export function sql(strings: TemplateStringsArray, ...values: any[]) {
  return {
    strings,
    values,
    toString: () => strings.join("?"),
  };
}

// Query builders
class SelectBuilder {
  private table: any;
  private fields: any;
  private predicate: ((row: Row) => boolean) | null = null;
  private sort: any = null;
  private limitN: number | null = null;

  constructor(table: any, fields: any) {
    this.table = table;
    this.fields = fields;
  }

  from(table: any) {
    this.table = table;
    return this;
  }

  where(pred: any) {
    if (typeof pred === "function") this.predicate = pred;
    return this;
  }

  orderBy(sort: any) {
    this.sort = sort;
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  then(resolve: (value: any) => void, reject: (reason: any) => void) {
    try {
      let rows = getTableArray(this.table).map(cloneRow);
      if (this.predicate) {
        rows = rows.filter(this.predicate);
      }
      if (this.sort) {
        const sort = this.sort;
        const col = sort.col;
        const dir = sort.dir;
        const jsKey = getJsKey(col);
        const dbName = col?.name;
        rows.sort((a: Row, b: Row) => {
          const av = jsKey && a[jsKey] !== undefined ? a[jsKey] : dbName ? a[dbName] : undefined;
          const bv = jsKey && b[jsKey] !== undefined ? b[jsKey] : dbName ? b[dbName] : undefined;
          if (av === bv) return 0;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          if (av < bv) return dir === "asc" ? -1 : 1;
          return dir === "asc" ? 1 : -1;
        });
      }
      if (this.limitN !== null) {
        rows = rows.slice(0, this.limitN);
      }
      if (this.fields && typeof this.fields === "object" && !Array.isArray(this.fields)) {
        const projected = rows.map((row) => {
          const out: Row = {};
          for (const [alias, col] of Object.entries(this.fields)) {
            const jsKey = getJsKey(col as any);
            const dbName = (col as any)?.name;
            const val = jsKey && row[jsKey] !== undefined ? row[jsKey] : dbName ? row[dbName] : undefined;
            out[alias] = val;
          }
          return out;
        });
        resolve(projected);
        return;
      }
      resolve(rows);
    } catch (e) {
      reject(e);
    }
  }

  catch(reject: (reason: any) => void) {
    return this.then((v) => v, reject);
  }
}

class InsertBuilder {
  private table: any;
  private vals: Row | Row[] = [];

  constructor(table: any) {
    this.table = table;
  }

  values(vals: Row | Row[]) {
    this.vals = vals;
    return this;
  }

  returning() {
    const data = getData();
    const tableKey = getTableKey(this.table);
    const arr = getTableArray(this.table);
    const toInsert = Array.isArray(this.vals) ? this.vals : [this.vals];
    const inserted: Row[] = [];

    for (let v of toInsert) {
      const row = { ...v };
      if (tableKey !== "users" && (row.id === undefined || row.id === null)) {
        const next = data.nextIds[tableKey] ?? 1;
        row.id = next;
        data.nextIds[tableKey] = next + 1;
      }
      if (tableKey === "blacklist_records") {
        if (!row.freezeCodes) row.freezeCodes = [];
        if (!row.parties) row.parties = [];
        if (!row.documents) row.documents = [];
        if (!row.accountStatus) row.accountStatus = "frozen";
        if (!row.status) row.status = "active";
        if (!row.source) row.source = "digihost";
        if (!row.partyType) row.partyType = "individual";
        if (!row.category) row.category = "cheque";
        if (!row.reason) row.reason = "";
        if (!row.blacklistedAt) row.blacklistedAt = new Date();
      }
      if (tableKey === "release_cases") {
        if (!row.status) row.status = "DRAFT";
        if (!row.data) row.data = {};
        if (!row.letterStatus) row.letterStatus = "pending";
        if (row.routedToPool === undefined) row.routedToPool = false;
        if (!row.createdAt) row.createdAt = new Date();
        if (!row.updatedAt) row.updatedAt = new Date();
      }
      if (tableKey === "case_documents") {
        if (!row.source) row.source = "uploaded";
        if (!row.createdAt) row.createdAt = new Date();
      }
      if (tableKey === "case_events") {
        if (!row.actorName) row.actorName = "System";
        if (!row.meta) row.meta = {};
        if (!row.createdAt) row.createdAt = new Date();
      }
      if (tableKey === "notifications") {
        if (row.read === undefined) row.read = false;
        if (!row.createdAt) row.createdAt = new Date();
      }
      if (tableKey === "users") {
        if (!row.title) row.title = "";
      }

      arr.push(row);
      inserted.push(cloneRow(row));
    }
    persist();

    return {
      then: (resolve: (v: any) => void) => resolve(inserted),
    } as any;
  }

  then(resolve: (v: any) => void) {
    return this.returning().then(resolve);
  }
}

class UpdateBuilder {
  private table: any;
  private setVals: Row = {};
  private predicate: ((row: Row) => boolean) | null = null;

  constructor(table: any) {
    this.table = table;
  }

  set(vals: Row) {
    this.setVals = vals;
    return this;
  }

  where(pred: any) {
    if (typeof pred === "function") this.predicate = pred;
    const arr = getTableArray(this.table);
    let count = 0;
    for (let row of arr) {
      if (!this.predicate || this.predicate(row)) {
        Object.assign(row, this.setVals);
        count++;
      }
    }
    persist();
    return {
      then: (resolve: (v: any) => void) => resolve({ count }),
    } as any;
  }
}

class DeleteBuilder {
  private table: any;

  constructor(table: any) {
    this.table = table;
  }

  where(pred: any) {
    const data = getData();
    const tableKey = getTableKey(this.table);
    const arr = getTableArray(this.table);
    if (typeof pred === "function") {
      const remaining = arr.filter((r) => !pred(r));
      (data as any)[tableKey] = remaining;
    } else {
      (data as any)[tableKey] = [];
      if (tableKey !== "users") {
        data.nextIds[tableKey] = 1;
      }
    }
    persist();
    return {
      then: (resolve: (v: any) => void) => resolve({}),
    } as any;
  }

  then(resolve: (v: any) => void) {
    const data = getData();
    const tableKey = getTableKey(this.table);
    (data as any)[tableKey] = [];
    if (tableKey !== "users") {
      data.nextIds[tableKey] = 1;
    }
    persist();
    resolve({});
    return Promise.resolve({});
  }
}

export const db = {
  select: (fields?: any) => new SelectBuilder(null as any, fields),
  insert: (table: any) => new InsertBuilder(table),
  update: (table: any) => new UpdateBuilder(table),
  delete: (table: any) => new DeleteBuilder(table),
  execute: async (_q: any) => {
    return { rows: [] };
  },
};

export async function ensureReady() {
  const data = getData();
  // If users empty, seed
  if (data.users.length > 0) return;

  console.log("[db] Seeding in-memory DB");

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  await db.insert(schema.users).values([
    { id: "u01", name: "Asha Rai", role: "initiator_branch", unit: "Kathmandu Main Branch", title: "Branch Operations Officer" },
    { id: "u02", name: "Deepak Shrestha", role: "initiator_npa", unit: "NPA Department", title: "NPA Recovery Officer" },
    { id: "u03", name: "Mira KC", role: "initiator_csd", unit: "Customer Service Department", title: "CSD Officer" },
    { id: "u04", name: "Rajan Thapa", role: "reviewer_oi", unit: "Kathmandu Main Branch", title: "Operation In-charge (OI)" },
    { id: "u05", name: "Sita Gurung", role: "reviewer_bm", unit: "Kathmandu Main Branch", title: "Branch Manager (BM)" },
    { id: "u06", name: "Prakash Adhikari", role: "brops", unit: "Branch Operations Control", title: "BROPs Analyst" },
    { id: "u07", name: "Nirmala Basnet", role: "brops", unit: "Branch Operations Control", title: "BROPs Analyst" },
    { id: "u08", name: "Anil Verma", role: "cad", unit: "Credit Administration / CIC", title: "CAD/CIC Officer" },
    { id: "u09", name: "Sabina Maharjan", role: "cad", unit: "Credit Administration / CIC", title: "CAD/CIC Officer" },
  ]);

  const recs = await db.insert(schema.blacklistRecords).values([
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
  ]).returning();

  const [suman, himal, goma] = recs;

  const [c1] = await db.insert(schema.releaseCases).values({
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
  }).returning();

  await db.insert(schema.caseDocuments).values([
    { caseId: c1.id, requirementKey: "prior_docs", label: "Cheque copy (prior process)", fileName: "cheque-223145-scan.pdf", source: "carried" },
    { caseId: c1.id, requirementKey: "prior_docs", label: "Dishonour memo", fileName: "dishonour-memo-223145.pdf", source: "carried" },
    { caseId: c1.id, requirementKey: "copy_cheque", label: "Copy of cheque", fileName: "cheque-223145.pdf", source: "uploaded", uploadedBy: "u01" },
    { caseId: c1.id, requirementKey: "payee_application", label: "Application from payee / beneficiary", fileName: "payee-application.pdf", source: "uploaded", uploadedBy: "u01" },
    { caseId: c1.id, requirementKey: "mdr_copy", label: "Evidence of release charge — MDR copy", fileName: "mdr-receipt-8841.pdf", source: "uploaded", uploadedBy: "u01" },
    { caseId: c1.id, requirementKey: "id_holder", label: "Citizenship / registration certificate — account holder", fileName: "citizenship-suman.pdf", source: "uploaded", uploadedBy: "u01" },
    { caseId: c1.id, requirementKey: "cib_inclusion_letter", label: "Blacklist Inclusion Letter from CIC", fileName: "cib-inclusion-letter.pdf", source: "uploaded", uploadedBy: "u01" },
  ]);

  await db.insert(schema.caseEvents).values([
    { caseId: c1.id, actorId: "u01", actorName: "Asha Rai", actorRole: "initiator_branch", action: "CREATED", toStatus: "DRAFT", remarks: "Case initiated via DigiHost auto-population — By Applicant – By Cheque.", createdAt: daysAgo(2) },
    { caseId: c1.id, actorId: null, actorName: "DigiHost System", actorRole: "system", action: "DATA_AUTOPOPULATED", remarks: "Blacklist data and 2 document(s) retrieved from DigiHost case DH-2025-03417.", createdAt: daysAgo(2) },
    { caseId: c1.id, actorId: "u01", actorName: "Asha Rai", actorRole: "initiator_branch", action: "SUBMITTED", fromStatus: "DRAFT", toStatus: "PENDING_REVIEW", createdAt: daysAgo(1) },
  ]);

  await db.insert(schema.notifications).values([
    { userId: "u06", caseId: c1.id, message: `${c1.reference} submitted to the BROPs pool by Asha Rai — claim to review.`, createdAt: daysAgo(1) },
    { userId: "u07", caseId: c1.id, message: `${c1.reference} submitted to the BROPs pool by Asha Rai — claim to review.`, createdAt: daysAgo(1) },
  ]);

  const [c2] = await db.insert(schema.releaseCases).values({
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
  }).returning();

  await db.insert(schema.caseDocuments).values([
    { caseId: c2.id, requirementKey: "loan_regularization", label: "Loan regularization / settlement evidence", fileName: "los-settlement-letter.pdf", source: "uploaded", uploadedBy: "u02" },
    { caseId: c2.id, requirementKey: "cib_inclusion_letter", label: "Blacklist Inclusion Letter from CIC", fileName: "cib-inclusion-letter-goma.pdf", source: "uploaded", uploadedBy: "u02" },
  ]);

  await db.insert(schema.caseEvents).values([
    { caseId: c2.id, actorId: "u02", actorName: "Deepak Shrestha", actorRole: "initiator_npa", action: "CREATED", toStatus: "DRAFT", remarks: "Case initiated via manual entry — NPA Release – By NPA.", createdAt: daysAgo(6) },
    { caseId: c2.id, actorId: "u02", actorName: "Deepak Shrestha", actorRole: "initiator_npa", action: "SUBMITTED", fromStatus: "DRAFT", toStatus: "PENDING_REVIEW", createdAt: daysAgo(5) },
    { caseId: c2.id, actorId: "u05", actorName: "Sita Gurung", actorRole: "reviewer_bm", action: "APPROVED", fromStatus: "PENDING_REVIEW", toStatus: "LETTER_PENDING", remarks: "Settlement verified in LOS. Approved for release.", createdAt: daysAgo(3) },
    { caseId: c2.id, actorId: null, actorName: "DigiHost System", actorRole: "system", action: "LETTER_GENERATED", toStatus: "LETTER_PENDING", remarks: "CIB Release Letter generated on the CAD screen.", createdAt: daysAgo(3) },
  ]);

  await db.insert(schema.notifications).values([
    { userId: "u08", caseId: c2.id, message: `${c2.reference} approved at review. CIB Release Letter awaits completion/signing on the CAD screen.`, createdAt: daysAgo(3) },
    { userId: "u09", caseId: c2.id, message: `${c2.reference} approved at review. CIB Release Letter awaits completion/signing on the CAD screen.`, createdAt: daysAgo(3) },
  ]);

  const [c3] = await db.insert(schema.releaseCases).values({
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
  }).returning();

  await db.insert(schema.caseDocuments).values([
    { caseId: c3.id, requirementKey: "prior_docs", label: "Cheque copy (prior process)", fileName: "cheque-771208-scan.pdf", source: "carried" },
    { caseId: c3.id, requirementKey: "blacklist_docs", label: "Blacklist documents", fileName: "blacklist-docs-himal.pdf", source: "uploaded", uploadedBy: "u01" },
    { caseId: c3.id, requirementKey: "cib_inclusion_letter", label: "Blacklist Inclusion Letter from CIC", fileName: "cib-letter-himal.pdf", source: "uploaded", uploadedBy: "u01" },
  ]);

  await db.insert(schema.caseEvents).values([
    { caseId: c3.id, actorId: "u01", actorName: "Asha Rai", actorRole: "initiator_branch", action: "CREATED", toStatus: "DRAFT", remarks: "Case initiated via DigiHost auto-population — By A/C Holder – By Cheque.", createdAt: daysAgo(4) },
    { caseId: c3.id, actorId: "u01", actorName: "Asha Rai", actorRole: "initiator_branch", action: "SUBMITTED", fromStatus: "DRAFT", toStatus: "PENDING_REVIEW", createdAt: daysAgo(4) },
    { caseId: c3.id, actorId: "u06", actorName: "Prakash Adhikari", actorRole: "brops", action: "RETURNED", fromStatus: "PENDING_REVIEW", toStatus: "RETURNED", remarks: "Debit Authority is missing and the MDR charge evidence does not match the entered amount (NPR 10,000). Rectify and forward after return.", createdAt: daysAgo(2) },
  ]);

  await db.insert(schema.notifications).values([
    { userId: "u01", caseId: c3.id, message: `${c3.reference} returned for rectification by Prakash Adhikari: "Debit Authority is missing…"`, createdAt: daysAgo(2) },
  ]);

  console.log("[db] seed cases: 3");
}

export const pool = undefined as any;
export const pglite = undefined as any;
