import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Text } from '@earendil-works/pi-tui'
import { Type, type Static } from 'typebox'

const JINA_READER_ENDPOINT = 'https://r.jina.ai/'
const JEV_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions'
const JEV_MODEL = 'typesafe/jev-latest'
const DEFAULT_TIMEOUT_MS = 90_000
const MAX_SOURCE_CHARS = 60_000
const MAX_CITATIONS = 20

type Citation = { claim: string; url: string; context?: string }
type JevAnswer = { type: string; [key: string]: unknown }
type CitationResult = {
  claim: string
  url: string
  sourceTitle?: string
  answers?: Record<string, JevAnswer>
  error?: string
}
export type CiteTestResult = { tested: number; passed: number; failed: number; results: CitationResult[] }

const CitationSchema = Type.Object({
  claim: Type.String({ minLength: 1, description: 'One factual claim attributed to this source.' }),
  url: Type.String({ minLength: 1, description: 'The cited HTTP(S) source URL.' }),
  context: Type.Optional(Type.String({ description: 'The user request or date constraint that makes relevance and freshness testable.' })),
})
const CiteTestSchema = Type.Object({
  citations: Type.Array(CitationSchema, {
    minItems: 1,
    maxItems: MAX_CITATIONS,
    description: 'Explicit claim-to-source pairs. Split compound claims when different sources support different parts.',
  }),
})
type CiteTestInput = Static<typeof CiteTestSchema>

function env(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function validUrl(raw: string): string {
  const url = new URL(raw)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('citation URL must use HTTP or HTTPS')
  return url.toString()
}

async function fetchWithTimeout(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  return fetch(url, { ...init, signal: combined })
}

function errorBody(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 400)
}

export async function readSource(url: string, signal?: AbortSignal): Promise<string> {
  const sourceUrl = validUrl(url)
  const response = await fetchWithTimeout(`${JINA_READER_ENDPOINT}${sourceUrl}`, {
    headers: {
      Authorization: `Bearer ${env('JINA_API_KEY')}`,
      'X-Return-Format': 'markdown',
      'X-Retain-Images': 'none',
      'X-Retain-Links': 'all',
      'X-Token-Budget': '30000',
    },
  }, signal)
  const text = await response.text()
  if (!response.ok) throw new Error(`source read failed (${response.status}): ${errorBody(text)}`)
  return text.slice(0, MAX_SOURCE_CHARS)
}

function titleFromMarkdown(markdown: string): string | undefined {
  const metadata = markdown.match(/^Title:\s*(.+)$/m)?.[1]?.trim()
  if (metadata) return metadata
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()
}

export function buildDecision(citation: Citation, source: string) {
  const context = citation.context?.trim() || 'No separate request context was supplied. Judge only claim support.'
  return {
    state: [
      `CLAIM:\n${citation.claim.trim()}`,
      `REQUEST CONTEXT:\n${context}`,
      `CITED SOURCE URL:\n${citation.url}`,
      `CITED SOURCE CONTENT:\n${source}`,
    ].join('\n\n'),
    questions: {
      support: {
        type: 'choice',
        instructions: 'Decide whether the cited source content supports the claim as written. Do not use outside knowledge.',
        criteria: {
          supported: 'The source directly supports every material part of the claim.',
          partial: 'The source supports only part of the claim, or the claim is stronger or more specific than the source.',
          unsupported: 'The source contradicts the claim or does not provide evidence for it.',
        },
      },
      sole_source: {
        type: 'noul',
        instructions: 'Can this source alone substantiate every material part of the claim, without silently combining facts from other sources?',
        criteria: {
          true: 'Yes. This source alone covers every material part.',
          false: 'No. At least one material part is absent, inferred, or requires another source.',
        },
      },
      fit: {
        type: 'choice',
        instructions: 'Judge whether this source fits the request context, including topic, entity, geography, and date or freshness constraints. Do not use outside knowledge.',
        criteria: {
          fits: 'The source matches all explicit request constraints.',
          uncertain: 'The supplied text or context is insufficient to establish fit.',
          wrong: 'The source conflicts with at least one explicit request constraint.',
        },
      },
    },
  }
}

async function askJev(state: string, questions: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, JevAnswer>> {
  const response = await fetchWithTimeout(JEV_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('OPENROUTER_API_KEY')}` },
    body: JSON.stringify({ model: JEV_MODEL, state, questions }),
  }, signal)
  const text = await response.text()
  if (!response.ok) throw new Error(`JEV decision failed (${response.status}): ${errorBody(text)}`)
  const parsed = JSON.parse(text) as { answers?: Record<string, JevAnswer> }
  if (!parsed.answers || typeof parsed.answers !== 'object') throw new Error('JEV response did not contain answers')
  return parsed.answers
}

function decisionValue(answer: JevAnswer | undefined): unknown {
  if (!answer) return undefined
  for (const key of ['value', 'answer', 'choice', 'label', 'result']) {
    if (key in answer) return answer[key]
  }
  return undefined
}

export function citationPassed(answers: Record<string, JevAnswer>): boolean {
  const support = decisionValue(answers.support)
  const soleSource = decisionValue(answers.sole_source)
  const fit = decisionValue(answers.fit)
  return support === 'supported' && soleSource === true && fit !== 'wrong'
}

export async function testCitations(citations: Citation[], signal?: AbortSignal): Promise<CiteTestResult> {
  const results: CitationResult[] = []
  for (const citation of citations) {
    try {
      const url = validUrl(citation.url)
      const source = await readSource(url, signal)
      const decision = buildDecision({ ...citation, url }, source)
      const answers = await askJev(decision.state, decision.questions, signal)
      results.push({ claim: citation.claim, url, sourceTitle: titleFromMarkdown(source), answers })
    } catch (error) {
      results.push({ claim: citation.claim, url: citation.url, error: error instanceof Error ? error.message : String(error) })
    }
  }
  const passed = results.filter(result => result.answers && citationPassed(result.answers)).length
  return { tested: results.length, passed, failed: results.length - passed, results }
}

function renderSummary(result: CiteTestResult): string {
  const lines = [`Citation test: ${result.passed}/${result.tested} passed`]
  for (const [index, item] of result.results.entries()) {
    const mark = item.answers && citationPassed(item.answers) ? 'PASS' : 'FAIL'
    lines.push(`${index + 1}. ${mark} — ${item.claim}`)
    if (item.error) lines.push(`   ${item.error}`)
  }
  return lines.join('\n')
}

export default function pieCiteTest(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'cite_test',
    label: 'Test citations',
    description: 'Test explicit claim-to-URL citation pairs. Reads each source, then asks JEV whether it supports the full claim, works as the sole source, and fits the request context.',
    promptSnippet: 'Check claim-to-source citation accuracy with Jina Reader and JEV',
    promptGuidelines: [
      'Use cite_test after producing citation-heavy research when citation accuracy matters.',
      'Pass explicit claim-to-source pairs. Split claims when different sources support different parts.',
      'Treat failed source reads and uncertain decisions as failures, not passes.',
    ],
    parameters: CiteTestSchema,
    async execute(_toolCallId, params: CiteTestInput, signal) {
      const result = await testCitations(params.citations, signal)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], details: result }
    },
    renderCall(args, theme) {
      return new Text(`${theme.fg('success', theme.bold('cite_test'))}${theme.fg('muted', ` · ${args.citations.length} citation(s)`)}`, 0, 0)
    },
    renderResult(result, options, theme) {
      const details = result.details as CiteTestResult | undefined
      if (!details) return new Text(theme.fg('error', 'Citation test failed'), 0, 0)
      const summary = renderSummary(details)
      if (!options.expanded) return new Text(theme.fg(details.failed === 0 ? 'success' : 'warning', summary.split('\n')[0] ?? ''), 0, 0)
      return new Text(`\n${theme.fg(details.failed === 0 ? 'success' : 'warning', summary)}`, 0, 0)
    },
  })
}
