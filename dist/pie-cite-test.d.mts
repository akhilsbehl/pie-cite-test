import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
//#region src/index.d.ts
type Citation = {
  claim: string;
  url: string;
  context?: string;
};
type JevAnswer = {
  type: string;
  [key: string]: unknown;
};
type CitationResult = {
  claim: string;
  url: string;
  sourceTitle?: string;
  answers?: Record<string, JevAnswer>;
  error?: string;
};
type CiteTestResult = {
  tested: number;
  passed: number;
  failed: number;
  results: CitationResult[];
};
declare function readSource(url: string, signal?: AbortSignal): Promise<string>;
declare function buildDecision(citation: Citation, source: string): {
  state: string;
  questions: {
    support: {
      type: string;
      instructions: string;
      criteria: {
        supported: string;
        partial: string;
        unsupported: string;
      };
    };
    sole_source: {
      type: string;
      instructions: string;
      criteria: {
        true: string;
        false: string;
      };
    };
    fit: {
      type: string;
      instructions: string;
      criteria: {
        fits: string;
        uncertain: string;
        wrong: string;
      };
    };
  };
};
declare function citationPassed(answers: Record<string, JevAnswer>): boolean;
declare function testCitations(citations: Citation[], signal?: AbortSignal): Promise<CiteTestResult>;
declare function pieCiteTest(pi: ExtensionAPI): void;
//#endregion
export { CiteTestResult, buildDecision, citationPassed, pieCiteTest as default, readSource, testCitations };