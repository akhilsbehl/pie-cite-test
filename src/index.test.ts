import { describe, expect, it } from 'vitest'
import { buildDecision, citationPassed } from './index.js'

describe('buildDecision', () => {
  it('keeps the claim, context, URL, and source in one bounded state', () => {
    const result = buildDecision(
      { claim: 'The launch was in 2025.', url: 'https://example.com/report', context: 'Use reports from 2025.' },
      '# Report\nThe launch was in 2025.',
    )
    expect(result.state).toContain('The launch was in 2025.')
    expect(result.state).toContain('Use reports from 2025.')
    expect(result.state).toContain('https://example.com/report')
    expect(Object.keys(result.questions)).toEqual(['support', 'sole_source', 'fit'])
  })
})

describe('citationPassed', () => {
  it('passes only direct, complete, context-fit support', () => {
    expect(citationPassed({
      support: { type: 'choice', value: 'supported' },
      sole_source: { type: 'noul', value: true },
      fit: { type: 'choice', value: 'fits' },
    })).toBe(true)
  })

  it('fails partial support', () => {
    expect(citationPassed({
      support: { type: 'choice', value: 'partial' },
      sole_source: { type: 'noul', value: true },
      fit: { type: 'choice', value: 'fits' },
    })).toBe(false)
  })

  it('fails a mismatched source', () => {
    expect(citationPassed({
      support: { type: 'choice', value: 'supported' },
      sole_source: { type: 'noul', value: true },
      fit: { type: 'choice', value: 'wrong' },
    })).toBe(false)
  })
})
