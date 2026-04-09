import { describe, it, expect } from 'vitest'
import { applyTransform } from './transformUtils'

const makeRows = (data: string[][]) => data
const makeMappings = (mappings: Array<{ sourceField: string; destField: string; transform: 'string' | 'integer' | 'date' | 'trim' | 'lowercase' | 'uppercase' | 'concat'; transformParams?: Record<string, string> }>) =>
  mappings.map((m, i) => ({ id: String(i), ...m }))

describe('applyTransform', () => {
  describe('field mapping', () => {
    it('maps source fields to destination fields with string transform', () => {
      const rows = makeRows([['Alice', '30'], ['Bob', '25']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'fullName', transform: 'string' },
        { sourceField: 'age', destField: 'ageNum', transform: 'string' },
      ])
      const result = applyTransform({ rows, fields, mappings })
      expect(result.headers).toEqual(['fullName', 'ageNum'])
      expect(result.rows).toEqual([['Alice', '30'], ['Bob', '25']])
    })

    it('applies lowercase transform', () => {
      const rows = makeRows([['ALICE', '30'], ['Bob', '25']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'lowercaseName', transform: 'lowercase' },
      ])
      const result = applyTransform({ rows, fields, mappings })
      expect(result.rows[0][0]).toBe('alice')
    })

    it('applies uppercase transform', () => {
      const rows = makeRows([['alice', '30'], ['Bob', '25']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'uppercaseName', transform: 'uppercase' },
      ])
      const result = applyTransform({ rows, fields, mappings })
      expect(result.rows[0][0]).toBe('ALICE')
    })

    it('applies trim transform', () => {
      const rows = makeRows([['  Alice  ', '30']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'trimmedName', transform: 'trim' },
      ])
      const result = applyTransform({ rows, fields, mappings })
      expect(result.rows[0][0]).toBe('Alice')
    })

    it('applies integer transform', () => {
      const rows = makeRows([['30.7', '25.3'], ['abc', '10']])
      const fields = ['num', 'val']
      const mappings = makeMappings([
        { sourceField: 'num', destField: 'asInt', transform: 'integer' },
        { sourceField: 'val', destField: 'asInt2', transform: 'integer' },
      ])
      const result = applyTransform({ rows, fields, mappings })
      expect(result.rows[0]).toEqual(['30', '25'])
      expect(result.rows[1]).toEqual(['0', '10']) // 'abc' floors to 0
    })

    it('applies concat transform with prefix and suffix', () => {
      const rows = makeRows([['John', '30']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'greeting', transform: 'concat', transformParams: { prefix: 'Hello, ', suffix: '!' } },
      ])
      const result = applyTransform({ rows, fields, mappings })
      expect(result.rows[0][0]).toBe('Hello, John!')
    })
  })

  describe('filter', () => {
    it('filters rows with eq operator', () => {
      const rows = makeRows([['Alice', '30'], ['Bob', '25'], ['Alice', '35']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'name', transform: 'string' },
        { sourceField: 'age', destField: 'age', transform: 'string' },
      ])
      const result = applyTransform({
        rows, fields, mappings,
        filter: { field: 'name', op: 'eq', value: 'Alice' },
      })
      expect(result.rows.length).toBe(2)
      expect(result.rows[0][0]).toBe('Alice')
      expect(result.rows[1][0]).toBe('Alice')
    })

    it('filters rows with neq operator', () => {
      const rows = makeRows([['Alice', '30'], ['Bob', '25'], ['Alice', '35']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'name', transform: 'string' },
      ])
      const result = applyTransform({
        rows, fields, mappings,
        filter: { field: 'name', op: 'neq', value: 'Alice' },
      })
      expect(result.rows.length).toBe(1)
      expect(result.rows[0][0]).toBe('Bob')
    })

    it('filters rows with contains operator', () => {
      const rows = makeRows([['Alice', '30'], ['Mallory', '25'], ['Bob', '35']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'n', transform: 'string' },
        { sourceField: 'age', destField: 'a', transform: 'string' },
      ])
      const result = applyTransform({
        rows, fields, mappings,
        filter: { field: 'name', op: 'contains', value: 'll' },
      })
      // 'Mallory' contains 'll'; 'Alice' does NOT (only one 'l'); 'Bob' has no 'l'
      expect(result.rows.length).toBe(1)
      expect(result.rows[0][0]).toBe('Mallory')
    })

    it('filters rows with gt operator', () => {
      const rows = makeRows([['Alice', '30'], ['Bob', '25'], ['Carol', '35']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'name', transform: 'string' },
        { sourceField: 'age', destField: 'age', transform: 'string' },
      ])
      const result = applyTransform({
        rows, fields, mappings,
        filter: { field: 'age', op: 'gt', value: '29' },
      })
      expect(result.rows.length).toBe(2)
    })

    it('filters rows with lt operator', () => {
      const rows = makeRows([['Alice', '30'], ['Bob', '25'], ['Carol', '35']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'name', transform: 'string' },
        { sourceField: 'age', destField: 'age', transform: 'string' },
      ])
      const result = applyTransform({
        rows, fields, mappings,
        filter: { field: 'age', op: 'lt', value: '30' },
      })
      expect(result.rows.length).toBe(1)
      expect(result.rows[0][0]).toBe('Bob')
    })

    it('filters rows with gte operator', () => {
      const rows = makeRows([['Alice', '30'], ['Bob', '25'], ['Carol', '30']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'name', transform: 'string' },
        { sourceField: 'age', destField: 'age', transform: 'string' },
      ])
      const result = applyTransform({
        rows, fields, mappings,
        filter: { field: 'age', op: 'gte', value: '30' },
      })
      expect(result.rows.length).toBe(2)
    })

    it('filters rows with lte operator', () => {
      const rows = makeRows([['Alice', '30'], ['Bob', '25'], ['Carol', '30']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'name', transform: 'string' },
        { sourceField: 'age', destField: 'age', transform: 'string' },
      ])
      const result = applyTransform({
        rows, fields, mappings,
        filter: { field: 'age', op: 'lte', value: '30' },
      })
      expect(result.rows.length).toBe(3)
    })
  })

  describe('sort', () => {
    it('sorts rows ascending', () => {
      const rows = makeRows([['Charlie', '30'], ['Alice', '25'], ['Bob', '35']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'name', transform: 'string' },
      ])
      const result = applyTransform({
        rows, fields, mappings,
        sort: { field: 'name', dir: 'asc' },
      })
      expect(result.rows.map(r => r[0])).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('sorts rows descending', () => {
      const rows = makeRows([['Charlie', '30'], ['Alice', '25'], ['Bob', '35']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'name', transform: 'string' },
      ])
      const result = applyTransform({
        rows, fields, mappings,
        sort: { field: 'name', dir: 'desc' },
      })
      expect(result.rows.map(r => r[0])).toEqual(['Charlie', 'Bob', 'Alice'])
    })

    it('sorts numeric values correctly', () => {
      const rows = makeRows([['Alice', '30'], ['Bob', '10'], ['Carol', '20']])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'name', transform: 'string' },
        { sourceField: 'age', destField: 'age', transform: 'string' },
      ])
      const result = applyTransform({
        rows, fields, mappings,
        sort: { field: 'age', dir: 'asc' },
      })
      expect(result.rows.map(r => r[1])).toEqual(['10', '20', '30'])
    })
  })

  describe('filter + sort + mapping combined', () => {
    it('applies filter, sort, and mapping in correct order', () => {
      const rows = makeRows([
        ['Alice', '30'],
        ['Bob', '25'],
        ['Carol', '35'],
        ['Alice', '40'],
        ['Bob', '30'],
      ])
      const fields = ['name', 'age']
      const mappings = makeMappings([
        { sourceField: 'name', destField: 'user', transform: 'string' },
        { sourceField: 'age', destField: 'ageNum', transform: 'integer' },
      ])
      const result = applyTransform({
        rows, fields, mappings,
        filter: { field: 'name', op: 'neq', value: 'Carol' },
        sort: { field: 'age', dir: 'desc' },
      })
      // After filter: Alice-30, Bob-25, Alice-40, Bob-30
      // After sort desc by age: Alice-40, Alice-30, Bob-30, Bob-25
      expect(result.rows.length).toBe(4)
      expect(result.rows[0]).toEqual(['Alice', '40'])
      expect(result.rows[1]).toEqual(['Alice', '30'])
      expect(result.rows[2]).toEqual(['Bob', '30'])
      expect(result.rows[3]).toEqual(['Bob', '25'])
    })
  })

  describe('edge cases', () => {
    it('returns empty when rows are empty', () => {
      const result = applyTransform({ rows: [], fields: ['name'], mappings: makeMappings([{ sourceField: 'name', destField: 'n', transform: 'string' }]) })
      expect(result.rows).toEqual([])
      expect(result.headers).toEqual([])
    })

    it('returns empty when mappings are empty', () => {
      const rows = makeRows([['Alice', '30']])
      const fields = ['name', 'age']
      const result = applyTransform({ rows, fields, mappings: [] })
      expect(result.rows).toEqual([])
      expect(result.headers).toEqual([])
    })

    it('handles missing source field gracefully', () => {
      const rows = makeRows([['Alice']])
      const fields = ['name']
      const mappings = makeMappings([
        { sourceField: 'nonexistent', destField: 'missing', transform: 'string' },
      ])
      const result = applyTransform({ rows, fields, mappings })
      expect(result.rows[0][0]).toBe('')
    })

    it('applies date transform (passes through)', () => {
      const rows = makeRows([['2024-01-15']])
      const fields = ['date']
      const mappings = makeMappings([
        { sourceField: 'date', destField: 'parsedDate', transform: 'date' },
      ])
      const result = applyTransform({ rows, fields, mappings })
      expect(result.rows[0][0]).toBe('2024-01-15')
    })
  })
})
