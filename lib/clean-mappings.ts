import type { KeywordMapping } from "@/types";

export function cleanKeywordMappings(
  mappings: KeywordMapping[]
): KeywordMapping[] {
  return mappings
    .map((m) => ({
      keyword: m.keyword.trim(),
      destinationUrl: m.destinationUrl.trim(),
      matchMode: m.matchMode || "phrase",
      group: m.group?.trim() || undefined
    }))
    .filter((m) => m.keyword && m.destinationUrl);
}
