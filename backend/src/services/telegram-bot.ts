import db from "../db";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let offset = 0;
let running = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a 6-char uppercase alphanumeric code (ambiguous chars excluded). */
function generatePairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Ensure the generated code is unique among pending rows. */
function uniquePairingCode(): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generatePairingCode();
    const exists = db
      .query(
        "SELECT 1 FROM telegram_connections WHERE pairing_code = ? AND status = 'pending'"
      )
      .get(code);
    if (!exists) return code;
  }
  // Extremely unlikely fallback
  return generatePairingCode() + generatePairingCode().slice(0, 2);
}

// ---------------------------------------------------------------------------
// Telegram Bot API wrappers
// ---------------------------------------------------------------------------

export async function sendMessage(
  chatId: number | string,
  text: string,
  parseMode: "Markdown" | "HTML" = "Markdown"
) {
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });
  if (!res.ok) {
    console.error("sendMessage failed:", await res.text());
  }
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handleStart(chatId: number) {
  await sendMessage(
    chatId,
    `*Welcome to Bullseye Bot!*\n\n` +
      `I'll send you real-time trade alerts, strategy notifications, and market updates.\n\n` +
      `*Getting started:*\n` +
      `1. Use /pair to generate a pairing code\n` +
      `2. Enter the code in the Bullseye app under *Connections*\n` +
      `3. You're linked!\n\n` +
      `_Commands:_\n` +
      `/pair  — Generate a new pairing code\n` +
      `/status — Check your connection status\n` +
      `/unpair — Disconnect your wallet\n\n` +
      `_Remote Control:_\n` +
      `/screen <filter> — Apply screener filters in the app\n` +
      `/strategies — List your saved strategies\n` +
      `/execute <name> — Open a strategy in the app`
  );
}

async function handlePair(
  chatId: number,
  username: string | undefined
) {
  // Check if already paired
  const existing = db
    .query(
      "SELECT * FROM telegram_connections WHERE telegram_chat_id = ? AND status = 'paired'"
    )
    .get(String(chatId)) as Record<string, unknown> | null;

  if (existing) {
    const addr = existing.wallet_address as string;
    const short = addr
      ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
      : "unknown";
    await sendMessage(
      chatId,
      `You're already paired to wallet \`${short}\`.\n\n` +
        `Use /unpair first if you want to link a different wallet.`
    );
    return;
  }

  // Remove any previous pending codes for this chat
  db.query(
    "DELETE FROM telegram_connections WHERE telegram_chat_id = ? AND status = 'pending'"
  ).run(String(chatId));

  // Generate a fresh code
  const code = uniquePairingCode();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  db.query(
    `INSERT INTO telegram_connections (id, telegram_chat_id, telegram_username, pairing_code, status, expires_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`
  ).run(id, String(chatId), username ?? null, code, expiresAt);

  await sendMessage(
    chatId,
    `*Your Pairing Code*\n\n` +
      `\`${code}\`\n\n` +
      `Enter this code in the Bullseye app:\n` +
      `  *Wallet menu → Connections → Paste code → Pair*\n\n` +
      `This code expires in *10 minutes*.`
  );
}

async function handleStatus(chatId: number) {
  const row = db
    .query(
      "SELECT * FROM telegram_connections WHERE telegram_chat_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(String(chatId)) as Record<string, unknown> | null;

  if (!row) {
    await sendMessage(
      chatId,
      `You haven't started pairing yet.\nUse /pair to get a code.`
    );
    return;
  }

  if (row.status === "paired") {
    const addr = row.wallet_address as string;
    const short = addr
      ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
      : "unknown";
    await sendMessage(
      chatId,
      `*Connected*\nWallet: \`${short}\`\nPaired: ${row.paired_at}`
    );
  } else {
    await sendMessage(
      chatId,
      `*Pending*\nCode: \`${row.pairing_code}\`\nExpires: ${row.expires_at}\n\nEnter the code in the Bullseye app to complete pairing.`
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers for paired-only commands
// ---------------------------------------------------------------------------

/** Returns the wallet_address for a paired chat, or null. */
function getWalletForChat(chatId: number): string | null {
  const row = db
    .query(
      "SELECT wallet_address FROM telegram_connections WHERE telegram_chat_id = ? AND status = 'paired'"
    )
    .get(String(chatId)) as { wallet_address: string } | null;
  return row?.wallet_address ?? null;
}

/** Queue an action for the frontend to consume. */
function queueAction(
  walletAddress: string,
  type: string,
  payload: Record<string, unknown>
) {
  const id = crypto.randomUUID();
  db.query(
    `INSERT INTO telegram_actions (id, wallet_address, type, payload) VALUES (?, ?, ?, ?)`
  ).run(id, walletAddress, type, JSON.stringify(payload));
  return id;
}

// ---------------------------------------------------------------------------
// /screen command
// ---------------------------------------------------------------------------

async function handleScreen(chatId: number, args: string) {
  const wallet = getWalletForChat(chatId);
  if (!wallet) {
    await sendMessage(
      chatId,
      `You need to pair your wallet first. Use /pair to get started.`
    );
    return;
  }

  if (!args.trim()) {
    await sendMessage(
      chatId,
      `*Usage:* \`/screen <filter description>\`\n\n` +
        `*Examples:*\n` +
        `\`/screen market cap over 5K\`\n` +
        `\`/screen price under $0.001 and more than 50 trades\`\n` +
        `\`/screen graduated tokens with volume above 10K\`\n` +
        `\`/screen eth collected more than 0.5\`\n\n` +
        `Supports natural language — just describe what you're looking for.`
    );
    return;
  }

  queueAction(wallet, "apply_filter", { query: args.trim() });

  await sendMessage(
    chatId,
    `*Filter sent to app*\n\n` +
      `\`${args.trim()}\`\n\n` +
      `The screener will open with this filter applied.`
  );
}

// ---------------------------------------------------------------------------
// /strategies command
// ---------------------------------------------------------------------------

async function handleStrategies(chatId: number) {
  const wallet = getWalletForChat(chatId);
  if (!wallet) {
    await sendMessage(
      chatId,
      `You need to pair your wallet first. Use /pair to get started.`
    );
    return;
  }

  const strategies = db
    .query("SELECT id, name, token_name, strategy_type FROM strategies ORDER BY updated_at DESC LIMIT 10")
    .all() as Array<{
    id: string;
    name: string;
    token_name: string;
    strategy_type: string;
  }>;

  if (strategies.length === 0) {
    await sendMessage(
      chatId,
      `No saved strategies found.\n\nCreate one in the Bullseye app first.`
    );
    return;
  }

  const LABELS: Record<string, string> = {
    price_dip: "Dip Buy",
    momentum: "Momentum",
    mean_reversion: "Mean Reversion",
    threshold: "Threshold",
  };

  const lines = strategies.map(
    (s, i) =>
      `${i + 1}. *${s.name}*\n   ${s.token_name || "—"} · ${LABELS[s.strategy_type] || s.strategy_type}\n   ID: \`${s.id.slice(0, 8)}\``
  );

  await sendMessage(
    chatId,
    `*Your Strategies* (${strategies.length})\n\n` +
      lines.join("\n\n") +
      `\n\n_Use_ \`/execute <name>\` _to open one in the app._`
  );
}

// ---------------------------------------------------------------------------
// /execute command
// ---------------------------------------------------------------------------

async function handleExecute(chatId: number, args: string) {
  const wallet = getWalletForChat(chatId);
  if (!wallet) {
    await sendMessage(
      chatId,
      `You need to pair your wallet first. Use /pair to get started.`
    );
    return;
  }

  if (!args.trim()) {
    await sendMessage(
      chatId,
      `*Usage:* \`/execute <strategy name or ID>\`\n\n` +
        `Use /strategies to see your saved strategies.`
    );
    return;
  }

  const search = args.trim();

  // Try exact ID match (full or prefix)
  let strategy = db
    .query("SELECT * FROM strategies WHERE id = ?")
    .get(search) as Record<string, unknown> | null;

  // Try ID prefix match
  if (!strategy) {
    strategy = db
      .query("SELECT * FROM strategies WHERE id LIKE ? LIMIT 1")
      .get(`${search}%`) as Record<string, unknown> | null;
  }

  // Try name match (case-insensitive)
  if (!strategy) {
    strategy = db
      .query(
        "SELECT * FROM strategies WHERE LOWER(name) = LOWER(?) LIMIT 1"
      )
      .get(search) as Record<string, unknown> | null;
  }

  // Try partial name match
  if (!strategy) {
    strategy = db
      .query(
        "SELECT * FROM strategies WHERE LOWER(name) LIKE LOWER(?) LIMIT 1"
      )
      .get(`%${search}%`) as Record<string, unknown> | null;
  }

  if (!strategy) {
    await sendMessage(
      chatId,
      `No strategy found matching \`${search}\`.\n\nUse /strategies to see your saved strategies.`
    );
    return;
  }

  queueAction(wallet, "open_strategy", {
    strategyId: strategy.id,
    strategyName: strategy.name,
  });

  const params = JSON.parse(strategy.params as string);
  const LABELS: Record<string, string> = {
    price_dip: "Dip Buy",
    momentum: "Momentum",
    mean_reversion: "Mean Reversion",
    threshold: "Threshold",
  };

  await sendMessage(
    chatId,
    `*Opening strategy in app*\n\n` +
      `*${strategy.name}*\n` +
      `Token: ${strategy.token_name || "—"}\n` +
      `Type: ${LABELS[strategy.strategy_type as string] || strategy.strategy_type}\n` +
      `Entry: ${params.entryThresholdPercent}% · TP: ${params.takeProfitPercent}% · SL: ${params.stopLossPercent}%\n\n` +
      `_The strategy detail page will open in the Bullseye app._`
  );
}

async function handleUnpair(chatId: number) {
  const existing = db
    .query(
      "SELECT * FROM telegram_connections WHERE telegram_chat_id = ? AND status = 'paired'"
    )
    .get(String(chatId)) as Record<string, unknown> | null;

  if (!existing) {
    await sendMessage(chatId, `No active pairing found. Use /pair to start.`);
    return;
  }

  db.query("DELETE FROM telegram_connections WHERE telegram_chat_id = ?").run(
    String(chatId)
  );

  await sendMessage(
    chatId,
    `Your wallet has been unlinked. You can pair again anytime with /pair.`
  );
}

// ---------------------------------------------------------------------------
// Update processor
// ---------------------------------------------------------------------------

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
  };
}

async function handleUpdate(update: TelegramUpdate) {
  const msg = update.message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const username = msg.from?.username;

  const command = text.split(" ")[0].split("@")[0];
  const args = text.slice(command.length).trim();

  switch (command) {
    case "/start":
      await handleStart(chatId);
      break;
    case "/pair":
      await handlePair(chatId, username);
      break;
    case "/status":
      await handleStatus(chatId);
      break;
    case "/unpair":
      await handleUnpair(chatId);
      break;
    case "/screen":
      await handleScreen(chatId, args);
      break;
    case "/strategies":
      await handleStrategies(chatId);
      break;
    case "/execute":
      await handleExecute(chatId, args);
      break;
    default:
      // Ignore unrecognized messages
      break;
  }
}

// ---------------------------------------------------------------------------
// Long-polling loop
// ---------------------------------------------------------------------------

async function pollUpdates() {
  try {
    const res = await fetch(
      `${API}/getUpdates?offset=${offset}&timeout=30&allowed_updates=["message"]`,
      { signal: AbortSignal.timeout(35_000) }
    );
    const data = (await res.json()) as {
      ok: boolean;
      result: TelegramUpdate[];
    };

    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        try {
          await handleUpdate(update);
        } catch (err) {
          console.error("Error handling update:", err);
        }
        offset = update.update_id + 1;
      }
    }
  } catch (err: unknown) {
    // Timeout is expected for long polling; ignore.
    const isTimeout =
      err instanceof Error && err.name === "TimeoutError";
    if (!isTimeout) {
      console.error("Telegram polling error:", err);
      // Back off briefly on real errors
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function startBot() {
  if (!BOT_TOKEN) {
    console.warn(
      "⚠️  TELEGRAM_BOT_TOKEN not set — Telegram bot disabled"
    );
    return;
  }

  // Verify token is valid
  try {
    const me = await fetch(`${API}/getMe`);
    const data = (await me.json()) as {
      ok: boolean;
      result?: { username: string };
    };
    if (!data.ok) throw new Error("getMe failed");
    console.log(
      `🤖 Telegram bot @${data.result?.username} started polling...`
    );
  } catch (err) {
    console.error("❌ Failed to connect to Telegram:", err);
    return;
  }

  running = true;
  while (running) {
    await pollUpdates();
  }
}

export function stopBot() {
  running = false;
}
