import { Plus, X, Save } from "lucide-react";
import type { FilterRule, FilterField, FilterOperator } from "../types";

interface FilterBuilderProps {
  filters: FilterRule[];
  onChange: (filters: FilterRule[]) => void;
  onSave?: () => void;
  screenerName?: string;
  onNameChange?: (name: string) => void;
}

const FIELD_OPTIONS: { value: FilterField; label: string }[] = [
  { value: "marketCapUsd", label: "Market Cap (USD)" },
  { value: "priceUsd", label: "Price (USD)" },
  { value: "ethCollected", label: "ETH Collected" },
  { value: "totalVolumeUsd", label: "Total Volume (USD)" },
  { value: "tradeCount", label: "Trade Count" },
  { value: "graduated", label: "Graduated" },
];

const OPERATOR_OPTIONS: { value: FilterOperator; label: string }[] = [
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: "=", label: "=" },
  { value: "!=", label: "!=" },
];

export default function FilterBuilder({
  filters,
  onChange,
  onSave,
  screenerName,
  onNameChange,
}: FilterBuilderProps) {
  const addFilter = () => {
    const newFilter: FilterRule = {
      id: crypto.randomUUID(),
      field: "marketCapUsd",
      operator: ">",
      value: "0",
    };
    onChange([...filters, newFilter]);
  };

  const removeFilter = (id: string) => {
    onChange(filters.filter((f) => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<FilterRule>) => {
    onChange(
      filters.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  return (
    <div className="bg-[#080808] border-b border-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-[0.65rem] uppercase tracking-[2px] text-gray-500 font-bold">
            Custom Filters
          </span>
          {onNameChange && (
            <input
              type="text"
              value={screenerName || ""}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Screener name..."
              className="bg-transparent border border-white/[0.08] text-phosphor font-mono text-xs px-2 py-1 rounded w-48"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addFilter}
            className="flex items-center gap-1 text-[0.65rem] px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] text-gray-400 hover:text-phosphor hover:border-phosphor/30 rounded transition-all uppercase tracking-wider font-bold"
          >
            <Plus className="w-3 h-3" />
            Add Filter
          </button>
          {onSave && (
            <button
              onClick={onSave}
              className="flex items-center gap-1 text-[0.65rem] px-3 py-1.5 bg-phosphor/10 border border-phosphor/30 text-phosphor rounded transition-all uppercase tracking-wider font-bold hover:bg-phosphor/20"
            >
              <Save className="w-3 h-3" />
              Save
            </button>
          )}
        </div>
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <div
              key={filter.id}
              className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.08] rounded px-2 py-1.5"
            >
              <select
                value={filter.field}
                onChange={(e) =>
                  updateFilter(filter.id, {
                    field: e.target.value as FilterField,
                    // Reset value for boolean field
                    value:
                      e.target.value === "graduated"
                        ? "false"
                        : filter.value,
                  })
                }
                className="bg-transparent text-[0.7rem] text-gray-300 font-mono border-none appearance-none cursor-pointer"
              >
                {FIELD_OPTIONS.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    className="bg-obsidian-surface"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>

              {filter.field === "graduated" ? (
                <select
                  value={filter.value}
                  onChange={(e) =>
                    updateFilter(filter.id, { value: e.target.value })
                  }
                  className="bg-transparent text-[0.7rem] text-phosphor font-mono border-none appearance-none cursor-pointer"
                >
                  <option value="false" className="bg-obsidian-surface">
                    No
                  </option>
                  <option value="true" className="bg-obsidian-surface">
                    Yes
                  </option>
                </select>
              ) : (
                <>
                  <select
                    value={filter.operator}
                    onChange={(e) =>
                      updateFilter(filter.id, {
                        operator: e.target.value as FilterOperator,
                      })
                    }
                    className="bg-transparent text-[0.7rem] text-phosphor font-mono border-none appearance-none cursor-pointer w-8 text-center"
                  >
                    {OPERATOR_OPTIONS.map((opt) => (
                      <option
                        key={opt.value}
                        value={opt.value}
                        className="bg-obsidian-surface"
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) =>
                      updateFilter(filter.id, { value: e.target.value })
                    }
                    className="bg-transparent text-[0.7rem] text-phosphor font-mono border border-white/[0.05] rounded px-1.5 py-0.5 w-24"
                    placeholder="value"
                  />
                </>
              )}

              <button
                onClick={() => removeFilter(filter.id)}
                className="text-gray-600 hover:text-loss transition-colors ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {filters.length === 0 && (
        <p className="text-gray-600 text-[0.7rem] font-mono">
          No filters applied. Click "Add Filter" to create custom screening
          rules.
        </p>
      )}
    </div>
  );
}
