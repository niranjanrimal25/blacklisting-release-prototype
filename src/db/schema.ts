import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/** Operational users of DigiHost (seeded demo identities per role). */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(), // initiator_branch | initiator_npa | initiator_csd | reviewer_oi | reviewer_bm | brops | cad
  unit: text("unit").notNull(),
  title: text("title").notNull().default(""),
});

export type Party = { name: string; role: "borrower" | "guarantor" | "signatory"; released: boolean };
export type PriorDoc = { name: string; note?: string };

/** The blacklist register: cases blacklisted via DigiHost or recorded manually. */
export const blacklistRecords = pgTable("blacklist_records", {
  id: serial("id").primaryKey(),
  caseNumber: text("case_number").unique(), // DigiHost case number; null when manual
  blacklistNumber: text("blacklist_number").notNull().unique(),
  cifId: text("cif_id").notNull(),
  source: text("source").notNull().default("digihost"), // digihost | manual
  partyName: text("party_name").notNull(),
  partyType: text("party_type").notNull().default("individual"), // individual | entity
  accountNumber: text("account_number"),
  category: text("category").notNull().default("cheque"), // cheque | npa
  reason: text("reason").notNull().default(""),
  freezeCodes: jsonb("freeze_codes").$type<string[]>().notNull().default([]),
  accountStatus: text("account_status").notNull().default("frozen"), // frozen | unfrozen
  status: text("status").notNull().default("active"), // active | released | partially_released | temporary_released
  parties: jsonb("parties").$type<Party[]>().notNull().default([]),
  chequeDetails: jsonb("cheque_details").$type<Record<string, string>>(),
  npaDetails: jsonb("npa_details").$type<Record<string, string>>(),
  documents: jsonb("documents").$type<PriorDoc[]>().notNull().default([]),
  blacklistedAt: timestamp("blacklisted_at").notNull().defaultNow(),
  releasedAt: timestamp("released_at"),
  temporaryUntil: timestamp("temporary_until"),
});

/** A blacklisting release case moving through the end-to-end workflow. */
export const releaseCases = pgTable("release_cases", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  blacklistRecordId: integer("blacklist_record_id").references(() => blacklistRecords.id),
  releaseType: text("release_type").notNull(), // applicant_cheque | ac_holder_cheque | court | npa | partial | temporary
  status: text("status").notNull().default("DRAFT"),
  initiatorId: text("initiator_id").notNull().references(() => users.id),
  reviewerId: text("reviewer_id").references(() => users.id), // assigned/claimed reviewer
  routedToPool: boolean("routed_to_pool").notNull().default(false), // BROPs pool intake
  data: jsonb("data").$type<Record<string, string>>().notNull().default({}),
  letterStatus: text("letter_status").notNull().default("pending"), // pending | generated | signed
  cibRequestNumber: text("cib_request_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  submittedAt: timestamp("submitted_at"),
  releasedAt: timestamp("released_at"),
  closedAt: timestamp("closed_at"),
});

/** Uploaded / carried / generated evidence attached to a release case. */
export const caseDocuments = pgTable("case_documents", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => releaseCases.id),
  requirementKey: text("requirement_key"), // checklist key; null for ad-hoc attachments
  label: text("label").notNull(),
  fileName: text("file_name"),
  filePath: text("file_path"),
  mimeType: text("mime_type"),
  size: integer("size"),
  source: text("source").notNull().default("uploaded"), // uploaded | carried | system
  uploadedBy: text("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Immutable audit trail of every workflow event. */
export const caseEvents = pgTable("case_events", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => releaseCases.id),
  actorId: text("actor_id"),
  actorName: text("actor_name").notNull().default("System"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  remarks: text("remarks"),
  attachmentDocId: integer("attachment_doc_id"),
  meta: jsonb("meta").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** In-system notifications replacing email-based case movement. */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  caseId: integer("case_id").references(() => releaseCases.id),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
