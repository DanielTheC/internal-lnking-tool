"use client";

import type { KeywordMapping } from "@/types";

type Props = {
  mappings: KeywordMapping[];
  onChange: (mappings: KeywordMapping[]) => void;
};

export default function KeywordMappingInput({ mappings, onChange }: Props) {
  const updateMapping = (index: number, patch: Partial<KeywordMapping>) => {
    const next = [...mappings];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const addRow = () => {
    onChange([
      ...mappings,
      { keyword: "", destinationUrl: "", matchMode: "phrase" }
    ]);
  };

  const removeRow = (index: number) => {
    if (mappings.length === 1) return;
    onChange(mappings.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">
          Keyword mappings
        </h2>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-slate-500"
        >
          Add keyword
        </button>
      </div>
      <div className="space-y-3">
        {mappings.map((mapping, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/80 p-3 md:grid-cols-[1.1fr_1.7fr_1.2fr_auto]"
          >
            <div>
              <label className="block text-xs font-medium text-slate-300">
                Keyword
              </label>
              <input
                type="text"
                required
                value={mapping.keyword}
                onChange={(e) =>
                  updateMapping(index, { keyword: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">
                Destination URL
              </label>
              <input
                type="url"
                required
                value={mapping.destinationUrl}
                onChange={(e) =>
                  updateMapping(index, { destinationUrl: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">
                Group / topic (optional)
              </label>
              <input
                type="text"
                value={mapping.group || ""}
                onChange={(e) =>
                  updateMapping(index, { group: e.target.value || undefined })
                }
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col items-start justify-between gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Match mode
                </label>
                <select
                  value={mapping.matchMode}
                  onChange={(e) =>
                    updateMapping(index, {
                      matchMode: e.target.value as KeywordMapping["matchMode"]
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="exact">Exact</option>
                  <option value="phrase">Phrase</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="self-end text-xs text-slate-400 hover:text-red-400"
                disabled={mappings.length === 1}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

