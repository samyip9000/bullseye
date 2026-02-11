import type { FilterRule, FilterField, FilterOperator } from "../types";

// ── Field aliases ───────────────────────────────────────────────────────────
// Keys MUST be lowercase. Order matters – longer phrases first so they match
// before shorter sub-strings.

const FIELD_ALIASES: { keywords: string[]; field: FilterField }[] = [
  {
    keywords: [
      "market cap",
      "marketcap",
      "market_cap",
      "mcap",
      "mkt cap",
      "cap",
      "marketcap"
    ],
    field: "marketCapUsd",
  },
  {
    keywords: ["total volume", "volume", "vol", "total vol", "ttl vol", "ttl volume"],
    field: "totalVolumeUsd",
  },
  {
    keywords: ["eth collected", "eth raised", "eth", "amount collected", "amount raised"],
    field: "ethCollected",
  },
  {
    keywords: [
      "trade count",
      "trades",
      "trade",
      "number of trades",
      "num trades",
      "txns",
      "transactions",
      "txn"
    ],
    field: "tradeCount",
  },
  {
    keywords: ["price", "pricing", "price usd", "price in usd", "price in USD", "worth", "valued at", "costing"],
    field: "priceUsd",
  },
  {
    keywords: ["graduated", "grad", "graduated tokens", "grad tokens", "graduated curves", "grad curves"],
    field: "graduated",
  },
];

// ── Operator aliases ────────────────────────────────────────────────────────
// Longer phrases first to avoid partial matches.

const OPERATOR_ALIASES: { phrases: string[]; op: FilterOperator }[] = [
  { phrases: ["at least", "minimum", "min", "no less than", ">="], op: ">=" },
  { phrases: ["at most", "maximum", "max", "no more than", "<="], op: "<=" },
  {
    phrases: [
      "more than",
      "greater than",
      "higher than",
      "above",
      "over",
      "exceeding",
      ">",
    ],
    op: ">",
  },
  {
    phrases: [
      "less than",
      "lower than",
      "below",
      "under",
      "fewer than",
      "<",
    ],
    op: "<",
  },
  { phrases: ["exactly", "equal to", "equals", "is", "="], op: "=" },
  { phrases: ["not equal", "not", "!="], op: "!=" },
];

// ── Value parser ────────────────────────────────────────────────────────────
// Handles suffixes like 3.5K, 1M, 200B, etc.

function parseValue(raw: string): number {
  const cleaned = raw.replace(/[$,]/g, "").trim().toLowerCase();
  const m = cleaned.match(/^([\d.]+)\s*([kmbt]?)$/);
  if (!m) return NaN;

  let num = parseFloat(m[1]);
  switch (m[2]) {
    case "k":
      num *= 1_000;
      break;
    case "m":
      num *= 1_000_000;
      break;
    case "b":
      num *= 1_000_000_000;
      break;
    case "t":
      num *= 1_000_000_000_000;
      break;
  }
  return num;
}

// ── Clause parser ───────────────────────────────────────────────────────────
// Attempts to extract (field, operator, value) from a single clause.

function parseClause(clause: string): FilterRule | null {
  const text = clause.toLowerCase().trim();
  if (!text) return null;

  // 1. Detect field
  let detectedField: FilterField | null = null;
  let fieldMatchPos = -1;
  let fieldMatchLen = 0;

  for (const entry of FIELD_ALIASES) {
    for (const kw of entry.keywords) {
      const idx = text.indexOf(kw);
      if (idx !== -1 && kw.length > fieldMatchLen) {
        detectedField = entry.field;
        fieldMatchPos = idx;
        fieldMatchLen = kw.length;
      }
    }
  }

  if (!detectedField) return null;

  // 2. Detect operator
  let detectedOp: FilterOperator | null = null;
  let opMatchPos = -1;
  let opMatchLen = 0;

  for (const entry of OPERATOR_ALIASES) {
    for (const phrase of entry.phrases) {
      const idx = text.indexOf(phrase);
      if (idx !== -1 && phrase.length > opMatchLen) {
        detectedOp = entry.op;
        opMatchPos = idx;
        opMatchLen = phrase.length;
      }
    }
  }

  // Default operator
  if (!detectedOp) {
    detectedOp = ">";
    opMatchPos = -1;
    opMatchLen = 0;
  }

  // 3. Special handling for boolean "graduated" field
  if (detectedField === "graduated") {
    const hasNot =
      text.includes("not graduated") || text.includes("not grad");
    const isTrue = !hasNot;
    return {
      id: crypto.randomUUID(),
      field: "graduated",
      operator: "=",
      value: isTrue ? "true" : "false",
    };
  }

  // 4. Extract numeric value – find all number tokens with optional suffix
  // The suffix [kmbt] must NOT be followed by another letter, otherwise we'd
  // mistake the "t" in "trades" for the "trillion" suffix.
  const numRegex = /\$?([\d,.]+)\s*([kmbt](?![a-z]))?/gi;
  let valueStr: string | null = null;

  let numMatch: RegExpExecArray | null;
  while ((numMatch = numRegex.exec(text)) !== null) {
    // Skip numbers that are part of the field or operator text themselves
    const matchPos = numMatch.index;
    // Make sure this number isn't overlapping the field keyword position
    if (
      matchPos >= fieldMatchPos &&
      matchPos < fieldMatchPos + fieldMatchLen
    ) {
      continue;
    }
    if (
      opMatchPos >= 0 &&
      matchPos >= opMatchPos &&
      matchPos < opMatchPos + opMatchLen
    ) {
      continue;
    }

    const rawVal = numMatch[1] + (numMatch[2] || "");
    const parsed = parseValue(rawVal);
    if (!isNaN(parsed)) {
      valueStr = String(parsed);
      break;
    }
  }

  if (valueStr === null) return null;

  return {
    id: crypto.randomUUID(),
    field: detectedField,
    operator: detectedOp,
    value: valueStr,
  };
}

// ── Main parser ─────────────────────────────────────────────────────────────

/**
 * Parse a natural-language description into an array of FilterRules.
 *
 * Examples:
 *   "market cap over 3.5K and trades above 30"
 *   "I want tokens with price under $0.01, volume at least 10K"
 *   "graduated tokens with more than 50 trades"
 */
export function parseNaturalLanguageFilters(input: string): FilterRule[] {
  if (!input.trim()) return [];

  // Split on "and", "," , "with", "&" – but only as clause separators
  // Use a regex that splits while keeping the delimiters out
  const clauses = input
    .split(/\s*(?:,\s*and\s*|,\s*|\band\b|\balso\b|&)\s*/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const rules: FilterRule[] = [];

  for (const clause of clauses) {
    const rule = parseClause(clause);
    if (rule) {
      rules.push(rule);
    }
  }

  // If no clauses matched individually but input has content, try the
  // whole input as one clause (handles "tokens over 3.5K market cap")
  if (rules.length === 0) {
    const rule = parseClause(input);
    if (rule) rules.push(rule);
  }

  return rules;
}

/**
 * Returns a human-readable summary of what filters were applied.
 */
export function describeFilters(rules: FilterRule[]): string {
  if (rules.length === 0) return "";

  const FIELD_LABELS: Record<FilterField, string> = {
    marketCapUsd: "Market Cap",
    priceUsd: "Price",
    ethCollected: "ETH Collected",
    totalVolumeUsd: "Volume",
    tradeCount: "Trades",
    graduated: "Graduated",
  };

  const parts = rules.map((r) => {
    const label = FIELD_LABELS[r.field] || r.field;
    if (r.field === "graduated") {
      return r.value === "true" ? "Graduated = Yes" : "Graduated = No";
    }
    const num = parseFloat(r.value);
    let display: string;
    // Trade count is a plain integer — never abbreviate with K/M
    if (r.field === "tradeCount") {
      console.log(num)
      display = num.toLocaleString();
    } else if (num >= 1_000_000) {
      display = `${(num / 1_000_000).toFixed(1)}M`;
    } else if (num >= 1_000) {
      display = `${(num / 1_000).toFixed(1)}K`;
    } else {
      display = String(num);
    }
    return `${label} ${r.operator} ${display}`;
  });

  return parts.join(", ");
}

// ── Autocomplete engine ─────────────────────────────────────────────────────

// Vocabulary tokens the user might type – field keywords + operator phrases
const VOCABULARY: string[] = (() => {
  const words: string[] = [];
  for (const entry of FIELD_ALIASES) {
    for (const kw of entry.keywords) words.push(kw);
  }
  for (const entry of OPERATOR_ALIASES) {
    for (const ph of entry.phrases) {
      // Skip single-char operators like >, <, = etc.
      if (ph.length > 1) words.push(ph);
    }
  }
  // Common connecting / filler words
  words.push("and", "with", "tokens", "more than", "less than", "at least", "at most");
  return [...new Set(words)];
})();

/**
 * Given the current input text and a pool of full suggestion phrases,
 * returns the suggested completion suffix (the part after the cursor),
 * or null if nothing matches.
 *
 * Matching strategy (in priority order):
 *   1. Full input is a prefix of a suggestion-pool phrase → complete the phrase
 *   2. Last word being typed matches start of a vocabulary token → complete that word/phrase
 */
export function getAutocompleteSuggestion(
  input: string,
  suggestionPool: string[]
): string | null {
  if (!input) return null;
  const lower = input.toLowerCase();

  // 1. Match full input as prefix of a suggestion pool phrase
  for (const phrase of suggestionPool) {
    if (phrase.toLowerCase().startsWith(lower) && phrase.length > input.length) {
      return phrase.slice(input.length);
    }
  }

  // 2. Match the last partial word(s) against vocabulary
  // Try matching the last 1, 2, and 3 words as a prefix
  const words = lower.split(/\s+/);
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const tail = words.slice(-n).join(" ");
    if (!tail) continue;

    let bestMatch: string | null = null;
    for (const vocab of VOCABULARY) {
      if (
        vocab.startsWith(tail) &&
        vocab.length > tail.length &&
        (bestMatch === null || vocab.length < bestMatch.length)
      ) {
        bestMatch = vocab;
      }
    }

    if (bestMatch) {
      return bestMatch.slice(tail.length);
    }
  }

  return null;
}
