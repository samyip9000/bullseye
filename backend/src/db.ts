import { Database } from "bun:sqlite";
import { join } from "path";

const DB_PATH = join(import.meta.dir, "..", "bullseye.db");

const db = new Database(DB_PATH, { create: true });

// Enable WAL mode for better concurrent performance
db.exec("PRAGMA journal_mode = WAL;");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS screeners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    filters TEXT NOT NULL DEFAULT '[]',
    sort_field TEXT DEFAULT 'marketCap',
    sort_direction TEXT DEFAULT 'desc',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS strategies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_address TEXT,
    token_name TEXT,
    curve_id TEXT,
    strategy_type TEXT NOT NULL DEFAULT 'price_dip',
    params TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS backtest_results (
    id TEXT PRIMARY KEY,
    strategy_id TEXT NOT NULL,
    token_address TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT '{}',
    executed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
  );
`);

export default db;
