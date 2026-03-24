import type {
  AnalyseResponseBody,
  GscKeywordMetrics,
  KeywordMapping,
  PageData
} from "@/types";
import { analysePagesForOpportunities } from "@/lib/analyser";
import { applyGscToResults } from "@/lib/gsc-merge";
import { sanitizeGscByKeyword } from "@/lib/gsc-sanitize";
import { buildAnalyseGraphPayload } from "@/lib/build-analyse-graph";

export function buildAnalyseResponse(args: {
  pages: PageData[];
  keywordMappings: KeywordMapping[];
  gscByKeyword?: Record<string, GscKeywordMetrics>;
}): AnalyseResponseBody {
  const { pages, keywordMappings } = args;
  let results = analysePagesForOpportunities(pages, keywordMappings);

  const gsc = sanitizeGscByKeyword(args.gscByKeyword);
  if (gsc) {
    results = applyGscToResults(results, gsc);
  }

  return {
    crawledPageCount: pages.length,
    totalKeywordMappingsAnalysed: keywordMappings.length,
    totalOpportunitiesFound: results.filter(
      (r) =>
        r.status === "Opportunity found" || r.status === "Weak anchor"
    ).length,
    results,
    graph: buildAnalyseGraphPayload(pages, results)
  };
}
