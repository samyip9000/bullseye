import { Database } from "bun:sqlite";
import { join } from "path";

const DB_PATH = join(import.meta.dir, "..", "bullseye.db");

const db = new Database(DB_PATH, { create: true });

// Enable WAL mode for better concurrent performance
db.exec("PRAGMA journal_mode = WAL;");

// Migrate telegram_connections if it exists with the old schema (wallet_address NOT NULL)
try {
  const cols = db
    .query("PRAGMA table_info(telegram_connections)")
    .all() as Array<{ name: string; notnull: number }>;
  const walletCol = cols.find((c) => c.name === "wallet_address");
  const hasChatId = cols.some((c) => c.name === "telegram_chat_id");
  // Old schema had wallet_address NOT NULL and no telegram_chat_id as NOT NULL
  if (walletCol?.notnull === 1 || (cols.length > 0 && !hasChatId)) {
    db.exec("DROP TABLE telegram_connections;");
  }
} catch {
  // Table doesn't exist yet — fine
}

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

  CREATE TABLE IF NOT EXISTS telegram_connections (
    id TEXT PRIMARY KEY,
    wallet_address TEXT,
    telegram_chat_id TEXT NOT NULL,
    telegram_username TEXT,
    pairing_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TEXT,
    paired_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_telegram_wallet ON telegram_connections(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_telegram_pairing_code ON telegram_connections(pairing_code);
  CREATE INDEX IF NOT EXISTS idx_telegram_chat_id ON telegram_connections(telegram_chat_id);

  CREATE TABLE IF NOT EXISTS telegram_actions (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_telegram_actions_wallet ON telegram_actions(wallet_address, status);
`);

export default db;
