/**
 * DB entry point – tries real Postgres if DATABASE_URL is external,
 * otherwise falls back to in-memory implementation (no external deps).
 */

import * as schema from "./schema";

type GlobalCache = typeof globalThis & {
  __arenaDrizzle?: any;
  __arenaPool?: any;
  __arenaDbType?: "pg" | "mem";
  __arenaReady?: Promise<void>;
};

const g = globalThis as GlobalCache;

// Try real PG if URL is external (not localhost)
let usePg = false;
let pgDb: any = null;
let pgPool: any = null;

const url = process.env.DATABASE_URL;
if (url && !url.includes("127.0.0.1") && !url.includes("localhost")) {
  try {
    const { Pool } = require("pg");
    const { drizzle } = require("drizzle-orm/node-postgres");
    pgPool = g.__arenaPool ?? new Pool({ connectionString: url });
    g.__arenaPool = pgPool;
    pgDb = g.__arenaDrizzle ?? drizzle(pgPool, { schema });
    g.__arenaDrizzle = pgDb;
    g.__arenaDbType = "pg";
    usePg = true;
    console.log("[db] Using external Postgres");
    g.__arenaReady = Promise.resolve();
  } catch (e) {
    console.warn("[db] External PG init failed, falling back to memory", e);
    usePg = false;
  }
}

let mem: any = null;
if (!usePg) {
  // Use in-memory DB
  mem = require("./memory");
  // Share global drizzle instance if already created for mem
  if (!g.__arenaDrizzle) {
    g.__arenaDrizzle = mem.db;
    g.__arenaDbType = "mem";
  }
  if (!g.__arenaReady) {
    g.__arenaReady = mem.ensureReady();
  }
}

export const db = (usePg ? pgDb : (g.__arenaDrizzle || mem?.db)) as any;
export const pool = (usePg ? pgPool : undefined) as any;
export const pglite = undefined as any;

export async function ensureReady() {
  if (g.__arenaReady) await g.__arenaReady;
  // For mem, also ensure its own ready
  if (!usePg && mem) {
    await mem.ensureReady();
  }
}

// Re-export query helpers from memory (which work for both, but for PG we also need drizzle-orm helpers)
// For PG mode, we should use drizzle-orm helpers; for mem mode, use mem helpers
// To keep compatibility, export both – the mem helpers are functions returning predicates that
// our mem db understands; drizzle-orm helpers return SQL objects that pg db understands.
// We detect mode at runtime: if usePg, re-export from drizzle-orm, else from mem.

let helpers: any;
if (usePg) {
  helpers = require("drizzle-orm");
} else {
  helpers = require("./memory");
}

export const eq = helpers.eq;
export const ne = helpers.ne;
export const and = helpers.and;
export const or = helpers.or;
export const isNull = helpers.isNull;
export const desc = helpers.desc;
export const asc = helpers.asc;
export const sql = helpers.sql;
