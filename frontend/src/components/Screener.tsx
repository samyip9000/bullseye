import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Target,
  Search,
  Sparkles,
  X,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import FilterBuilder from "./FilterBuilder";
import type { Token, FilterRule } from "../types";
import { createScreener } from "../services/api";
import {
  parseNaturalLanguageFilters,
  describeFilters,
  getAutocompleteSuggestion,
} from "../utils/nlFilterParser";

interface ScreenerProps {
  tokens: Token[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectForStrategy: (token: Token) => void;
  /** Externally-injected filters (e.g. from Telegram). Applied on change. */
  externalFilters?: { filters: FilterRule[]; query: string } | null;
}

type SortField =
  | "name"
  | "priceUsd"
  | "marketCapUsd"
  | "ethCollected"
  | "totalVolumeUsd"
  | "tradeCount"
  | "graduated";
type SortDir = "asc" | "desc";

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  if (value >= 0.0001) return `$${value.toFixed(6)}`;
  return `$${value.toExponential(2)}`;
}

const IPFS_GATEWAY = "https://olive-defensive-giraffe-83.mypinata.cloud/ipfs/";

function resolveIpfsUrl(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return IPFS_GATEWAY + uri.slice("ipfs://".length);
  }
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return uri;
  }
  return null;
}

// Cache fetched image URLs across renders so we don't re-fetch on every sort/filter
const imageCache = new Map<string, string | null>();

function TokenImage({ uri, symbol }: { uri: string; symbol: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(
    imageCache.get(uri) ?? null
  );
  const [loaded, setLoaded] = useState(imageCache.has(uri));
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (imageCache.has(uri)) {
      setImageUrl(imageCache.get(uri)!);
      setLoaded(true);
      return;
    }

    const metadataUrl = resolveIpfsUrl(uri);
    if (!metadataUrl) {
      imageCache.set(uri, null);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    fetch(metadataUrl)
      .then((res) => res.json())
      .then((json: { image?: string }) => {
        if (cancelled) return;
        const img = json.image ? resolveIpfsUrl(json.image) : null;
        imageCache.set(uri, img);
        setImageUrl(img);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        imageCache.set(uri, null);
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [uri]);

  const fallback = (
    <div className="w-7 h-7 rounded-full bg-gray-600 flex-shrink-0" />
  );

  if (!loaded) {
    // Shimmer placeholder while loading
    return (
      <div className="w-7 h-7 rounded-full bg-white/[0.05] animate-pulse flex-shrink-0" />
    );
  }

  if (imageUrl && !imgError) {
    return (
      <img
        src={imageUrl}
        alt={symbol}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0 bg-white/[0.05]"
        onError={() => setImgError(true)}
      />
    );
  }

  return fallback;
}

function applyFilter(token: Token, filter: FilterRule): boolean {
  let fieldValue: number | boolean;

  switch (filter.field) {
    case "marketCapUsd":
      fieldValue = token.marketCapUsd;
      break;
    case "priceUsd":
      fieldValue = token.priceUsd;
      break;
    case "ethCollected":
      fieldValue = token.ethCollected;
      break;
    case "totalVolumeUsd":
      fieldValue = token.totalVolumeUsd;
      break;
    case "tradeCount":
      fieldValue = token.tradeCount;
      break;
    case "graduated":
      fieldValue = token.graduated;
      break;
    default:
      return true;
  }

  if (typeof fieldValue === "boolean") {
    const boolValue = filter.value === "true";
    return filter.operator === "=" ? fieldValue === boolValue : fieldValue !== boolValue;
  }

  const numValue = parseFloat(filter.value);
  if (isNaN(numValue)) return true;

  switch (filter.operator) {
    case ">":
      return fieldValue > numValue;
    case "<":
      return fieldValue < numValue;
    case ">=":
      return fieldValue >= numValue;
    case "<=":
      return fieldValue <= numValue;
    case "=":
      return fieldValue === numValue;
    case "!=":
      return fieldValue !== numValue;
    default:
      return true;
  }
}

export default function Screener({
  tokens,
  loading,
  error,
  onRefresh,
  onSelectForStrategy,
  externalFilters,
}: ScreenerProps) {
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("marketCapUsd");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [screenerName, setScreenerName] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Apply external filters (e.g. from Telegram /screen command)
  useEffect(() => {
    if (externalFilters) {
      setFilters(externalFilters.filters);
      setNlQuery(externalFilters.query);
      setNlApplied(describeFilters(externalFilters.filters));
    }
  }, [externalFilters]);

  // Pagination
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);

  // Natural-language filter input
  const [nlQuery, setNlQuery] = useState("");
  const [nlApplied, setNlApplied] = useState<string | null>(null);
  const [nlFocused, setNlFocused] = useState(false);
  const nlWrapperRef = useRef<HTMLDivElement>(null);
  const nlInputRef = useRef<HTMLInputElement>(null);

  // ── Suggestion phrases (pool of 30, show 3 at a time) ──
  const SUGGESTION_POOL = useMemo<string[]>(
    () => [
      "market cap over 5K and more than 20 trades",
      "price under $0.001 and volume above 1K",
      "graduated tokens with more than 100 trades",
      "tokens worth more than 0.0001",
      "market cap above 10K",
      "more than 50 trades and market cap over 1K",
      "volume over 5K and price above 0.00001",
      "eth collected more than 0.5",
      "not graduated and market cap under 2K",
      "trade count over 200",
      "price below 0.0000001",
      "market cap between 1K and 50K",
      "tokens with at least 500 trades",
      "volume at least 10K",
      "graduated and volume over 20K",
      "market cap over 100K",
      "fewer than 10 trades",
      "price above $0.01 and graduated",
      "eth collected over 1",
      "tokens worth less than 0.00001",
      "more than 1000 trades",
      "volume under 500",
      "market cap at least 3K and trades over 40",
      "price over 0.001 and not graduated",
      "eth collected above 2 and more than 75 trades",
      "market cap under 500",
      "volume above 50K and graduated",
      "at least 30 trades and price over 0.0001",
      "market cap over 20K and volume above 5K",
      "tokens with price under $0.0001 and more than 60 trades",
    ],
    []
  );

  function pickRandom(pool: string[], count: number): string[] {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  const [suggestions, setSuggestions] = useState<string[]>(() =>
    pickRandom(SUGGESTION_POOL, 3)
  );

  const rerollSuggestions = useCallback(() => {
    setSuggestions(pickRandom(SUGGESTION_POOL, 3));
  }, [SUGGESTION_POOL]);

  // Inline autocomplete ghost text
  const ghostSuffix = useMemo(
    () => (nlFocused ? getAutocompleteSuggestion(nlQuery, SUGGESTION_POOL) : null),
    [nlQuery, nlFocused, SUGGESTION_POOL]
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        nlWrapperRef.current &&
        !nlWrapperRef.current.contains(e.target as Node)
      ) {
        setNlFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNlSubmit = useCallback(() => {
    const trimmed = nlQuery.trim();
    if (!trimmed) return;
    // Always clear existing filters before applying new ones
    setFilters([]);
    const parsed = parseNaturalLanguageFilters(trimmed);
    if (parsed.length > 0) {
      setFilters(parsed);
      setNlApplied(describeFilters(parsed));
      setNlFocused(false);
    } else {
      setNlApplied("No filters matched — try rephrasing");
      setTimeout(() => setNlApplied(null), 3000);
    }
  }, [nlQuery]);

  const handleSuggestionClick = useCallback(
    (phrase: string) => {
      setNlQuery(phrase);
      setNlFocused(false);
      // Auto-apply
      const parsed = parseNaturalLanguageFilters(phrase);
      if (parsed.length > 0) {
        setFilters(parsed);
        setNlApplied(describeFilters(parsed));
      }
    },
    []
  );

  const clearNlFilters = useCallback(() => {
    setFilters([]);
    setNlQuery("");
    setNlApplied(null);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filteredTokens = useMemo(() => {
    let result = tokens;

    // Apply search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.tokenAddress.toLowerCase().includes(q)
      );
    }

    // Apply custom filters
    for (const filter of filters) {
      result = result.filter((t) => applyFilter(t, filter));
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: number | string | boolean, bVal: number | string | boolean;

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "priceUsd":
          aVal = a.priceUsd;
          bVal = b.priceUsd;
          break;
        case "marketCapUsd":
          aVal = a.marketCapUsd;
          bVal = b.marketCapUsd;
          break;
        case "ethCollected":
          aVal = a.ethCollected;
          bVal = b.ethCollected;
          break;
        case "totalVolumeUsd":
          aVal = a.totalVolumeUsd;
          bVal = b.totalVolumeUsd;
          break;
        case "tradeCount":
          aVal = a.tradeCount;
          bVal = b.tradeCount;
          break;
        case "graduated":
          aVal = a.graduated ? 1 : 0;
          bVal = b.graduated ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [tokens, filters, search, sortField, sortDir]);

  // Reset to page 1 when filters, search, sort, or rowsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, search, sortField, sortDir, rowsPerPage]);

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filteredTokens.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedTokens = useMemo(() => {
    const start = (safeCurrentPage - 1) * rowsPerPage;
    return filteredTokens.slice(start, start + rowsPerPage);
  }, [filteredTokens, safeCurrentPage, rowsPerPage]);

  const rangeStart = filteredTokens.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(safeCurrentPage * rowsPerPage, filteredTokens.length);

  // Generate visible page numbers (max 5 around current page)
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, safeCurrentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [safeCurrentPage, totalPages]);

  const handleSaveScreener = async () => {
    if (!screenerName.trim()) {
      setSaveMsg("Enter a name first");
      setTimeout(() => setSaveMsg(null), 2000);
      return;
    }
    try {
      await createScreener({
        name: screenerName,
        filters,
        sortField,
        sortDirection: sortDir,
      });
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(null), 2000);
    } catch {
      setSaveMsg("Save failed");
      setTimeout(() => setSaveMsg(null), 2000);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 text-gray-600" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-phosphor" />
    ) : (
      <ArrowDown className="w-3 h-3 text-phosphor" />
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.03]">
        <div className="flex items-center gap-3">
          <h2 className="text-[0.7rem] uppercase tracking-[2px] font-bold text-gray-500">
            Token Screener
          </h2>
          <span className="text-[0.65rem] font-mono text-phosphor">
            {filteredTokens.length === 0
              ? "0 results"
              : `${rangeStart}–${rangeEnd} of ${filteredTokens.length}`}
          </span>
          {saveMsg && (
            <span className="text-[0.65rem] font-mono text-phosphor animate-pulse">
              {saveMsg}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3 h-3 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tokens..."
              className="bg-white/[0.03] border border-white/[0.08] text-gray-300 font-mono text-xs pl-7 pr-3 py-1.5 rounded w-56"
            />
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-[0.65rem] px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] text-gray-400 hover:text-phosphor hover:border-phosphor/30 rounded transition-all uppercase tracking-wider font-bold disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3 h-3 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Natural-Language Filter Input */}
      <div className="border-b border-white/[0.03] bg-[#060606] px-4 py-5">
        <div className="max-w-2xl mx-auto" ref={nlWrapperRef}>
          <div className="relative">
            <Sparkles className="w-4 h-4 text-phosphor/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />

            {/* Ghost text overlay — shows autocomplete suggestion */}
            <div
              aria-hidden
              className="absolute inset-0 flex items-center pl-10 pr-24 py-3 pointer-events-none overflow-hidden"
            >
              <span className="font-mono text-xs whitespace-pre">
                {/* Invisible: user's typed text (takes up space to position ghost) */}
                <span className="invisible">{nlQuery}</span>
                {/* Visible ghost suffix */}
                {ghostSuffix && (
                  <span className="text-gray-600">{ghostSuffix}</span>
                )}
              </span>
            </div>

            <input
              ref={nlInputRef}
              type="text"
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
              onFocus={() => setNlFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Tab" && ghostSuffix) {
                  e.preventDefault();
                  setNlQuery((prev) => prev + ghostSuffix);
                }
                if (e.key === "Enter") handleNlSubmit();
                if (e.key === "Escape") setNlFocused(false);
              }}
              placeholder='Describe your filter — e.g. "market cap over 3.5K and more than 30 trades"'
              className="relative w-full bg-transparent border border-white/[0.08] focus:border-phosphor/40 text-gray-200 font-mono text-xs pl-10 pr-24 py-3 rounded-lg transition-colors placeholder:text-gray-600 z-[1]"
              style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
              autoComplete="off"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-[2]">
              {nlQuery && (
                <button
                  onClick={() => {
                    setNlQuery("");
                    setNlApplied(null);
                  }}
                  className="text-gray-500 hover:text-gray-300 p-1 transition-colors"
                  title="Clear input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={handleNlSubmit}
                disabled={!nlQuery.trim()}
                className="text-[0.6rem] uppercase tracking-wider font-black px-3 py-1.5 rounded bg-phosphor/10 border border-phosphor/30 text-phosphor hover:bg-phosphor/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Apply
              </button>
            </div>

            {/* Suggestions dropdown */}
            {nlFocused && !nlQuery && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#0a0a0a] border border-white/[0.08] rounded-lg shadow-xl shadow-black/40 z-20 overflow-hidden">
                <div className="px-3 pt-2.5 pb-1.5">
                  <span className="text-[0.6rem] uppercase tracking-[2px] text-gray-600 font-bold">
                    Try a filter
                  </span>
                </div>
                {suggestions.map((phrase, i) => (
                  <button
                    key={`${phrase}-${i}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSuggestionClick(phrase);
                    }}
                    className="w-full text-left px-3 py-2 text-[0.75rem] font-mono text-gray-400 hover:bg-phosphor/[0.06] hover:text-phosphor transition-colors flex items-center gap-2.5"
                  >
                    <Sparkles className="w-3 h-3 text-phosphor/30 flex-shrink-0" />
                    {phrase}
                  </button>
                ))}
                <div className="border-t border-white/[0.05] px-3 py-2">
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      rerollSuggestions();
                    }}
                    className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-wider font-bold text-gray-500 hover:text-phosphor transition-colors"
                  >
                    <Shuffle className="w-3 h-3" />
                    More ideas
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Applied feedback */}
          {nlApplied && (
            <div className="mt-2.5 flex items-center justify-center gap-2">
              <span className="text-[0.65rem] font-mono text-phosphor/70">
                {nlApplied}
              </span>
              <button
                onClick={clearNlFilters}
                className="text-[0.6rem] uppercase tracking-wider font-bold text-gray-500 hover:text-loss transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Builder */}
      <FilterBuilder
        filters={filters}
        onChange={setFilters}
        onSave={handleSaveScreener}
        screenerName={screenerName}
        onNameChange={setScreenerName}
      />

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-loss/10 border-b border-loss/20">
          <p className="text-loss text-xs font-mono">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-[0.8rem]">
          <thead>
            <tr>
              <th
                onClick={() => handleSort("name")}
                className="text-left px-4 py-3 text-gray-500 font-medium sticky top-0 bg-obsidian-surface border-b border-white/[0.03] z-10 cursor-pointer hover:text-gray-300 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  TOKEN <SortIcon field="name" />
                </span>
              </th>
              <th
                onClick={() => handleSort("priceUsd")}
                className="text-right px-4 py-3 text-gray-500 font-medium sticky top-0 bg-obsidian-surface border-b border-white/[0.03] z-10 cursor-pointer hover:text-gray-300 transition-colors"
              >
                <span className="flex items-center justify-end gap-1.5">
                  PRICE <SortIcon field="priceUsd" />
                </span>
              </th>
              <th
                onClick={() => handleSort("marketCapUsd")}
                className="text-right px-4 py-3 text-gray-500 font-medium sticky top-0 bg-obsidian-surface border-b border-white/[0.03] z-10 cursor-pointer hover:text-gray-300 transition-colors"
              >
                <span className="flex items-center justify-end gap-1.5">
                  MARKET CAP <SortIcon field="marketCapUsd" />
                </span>
              </th>
              <th
                onClick={() => handleSort("totalVolumeUsd")}
                className="text-right px-4 py-3 text-gray-500 font-medium sticky top-0 bg-obsidian-surface border-b border-white/[0.03] z-10 cursor-pointer hover:text-gray-300 transition-colors"
              >
                <span className="flex items-center justify-end gap-1.5">
                  VOLUME <SortIcon field="totalVolumeUsd" />
                </span>
              </th>
              <th
                onClick={() => handleSort("tradeCount")}
                className="text-right px-4 py-3 text-gray-500 font-medium sticky top-0 bg-obsidian-surface border-b border-white/[0.03] z-10 cursor-pointer hover:text-gray-300 transition-colors"
              >
                <span className="flex items-center justify-end gap-1.5">
                  TRADES <SortIcon field="tradeCount" />
                </span>
              </th>
              <th
                onClick={() => handleSort("graduated")}
                className="text-center px-4 py-3 text-gray-500 font-medium sticky top-0 bg-obsidian-surface border-b border-white/[0.03] z-10 cursor-pointer hover:text-gray-300 transition-colors"
              >
                <span className="flex items-center justify-center gap-1.5">
                  STATUS <SortIcon field="graduated" />
                </span>
              </th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium sticky top-0 bg-obsidian-surface border-b border-white/[0.03] z-10">
                ACTION
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && tokens.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-phosphor" />
                    <span className="text-xs">
                      Fetching tokens from RobinPump...
                    </span>
                  </div>
                </td>
              </tr>
            ) : filteredTokens.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">
                  <p className="text-xs">
                    No tokens match your filters.
                  </p>
                </td>
              </tr>
            ) : (
              paginatedTokens.map((token) => (
                <tr
                  key={token.id}
                  className="token-row border-b border-white/[0.015] hover:bg-phosphor/[0.02] transition-all"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <TokenImage uri={token.uri} symbol={token.symbol} />
                      <div className="flex flex-col">
                        <span className="text-gray-200 font-medium">
                          ${token.symbol}
                        </span>
                        <span className="text-gray-600 text-[0.65rem]">
                          {token.name}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {formatUsd(token.priceUsd)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {formatUsd(token.marketCapUsd)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {formatUsd(token.totalVolumeUsd)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {token.tradeCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-[0.65rem] px-2 py-0.5 rounded ${
                        token.graduated
                          ? "bg-phosphor/10 text-phosphor"
                          : "bg-white/[0.03] text-gray-500"
                      }`}
                    >
                      {token.graduated ? "GRADUATED" : "BONDING"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onSelectForStrategy(token)}
                      className="inline-flex items-center gap-1 bg-transparent border border-phosphor/20 text-phosphor px-3 py-1 text-[0.65rem] uppercase font-black rounded hover:bg-phosphor hover:text-black hover:shadow-[0_0_15px_#00ff41] transition-all"
                    >
                      <Target className="w-3 h-3" />
                      Backtest
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {filteredTokens.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.03] bg-obsidian-surface flex-shrink-0">
          {/* Rows per page selector */}
          <div className="flex items-center gap-2">
            <span className="text-[0.65rem] text-gray-500 uppercase tracking-wider font-bold">
              Rows
            </span>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="bg-white/[0.03] border border-white/[0.08] text-gray-300 font-mono text-xs px-2 py-1 rounded cursor-pointer hover:border-phosphor/30 transition-colors focus:outline-none focus:border-phosphor/40"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size} className="bg-[#0a0a0a]">
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Page info */}
          <span className="text-[0.65rem] font-mono text-gray-500">
            Page {safeCurrentPage} of {totalPages}
          </span>

          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded text-gray-500 hover:text-phosphor hover:bg-phosphor/[0.06] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              title="First page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded text-gray-500 hover:text-phosphor hover:bg-phosphor/[0.06] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {pageNumbers[0] > 1 && (
              <span className="text-gray-600 text-xs px-1">...</span>
            )}

            {pageNumbers.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`min-w-[28px] h-7 rounded text-xs font-mono transition-all ${
                  page === safeCurrentPage
                    ? "bg-phosphor/10 border border-phosphor/30 text-phosphor font-bold"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                }`}
              >
                {page}
              </button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <span className="text-gray-600 text-xs px-1">...</span>
            )}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded text-gray-500 hover:text-phosphor hover:bg-phosphor/[0.06] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded text-gray-500 hover:text-phosphor hover:bg-phosphor/[0.06] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              title="Last page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
