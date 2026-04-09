import { describe, it, expect } from 'vitest'
import {
  applyTransform,
  transformRow,
  filterRows,
  sortRows,
  runTransformPipeline,
} from './transform'

describe('applyTransform', () => {
  it('returns null for null input', () => {
    expect(applyTransform(null, 'string')).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(applyTransform(undefined, 'string')).toBeNull()
  })

  it('converts to string by default', () => {
    expect(applyTransform(123, 'string')).toBe('123')
    expect(applyTransform(true, 'string')).toBe('true')
  })

  it('applies integer transform', () => {
    expect(applyTransform('42', 'integer')).toBe(42)
    expect(applyTransform('3.14', 'integer')).toBe(3)
    expect(applyTransform('abc', 'integer')).toBeNull()
    expect(applyTransform('', 'integer')).toBeNull()
  })

  it('applies trim transform', () => {
    expect(applyTransform('  hello  ', 'trim')).toBe('hello')
  })

  it('applies lowercase transform', () => {
    expect(applyTransform('HELLO World', 'lowercase')).toBe('hello world')
  })

  it('applies uppercase transform', () => {
    expect(applyTransform('Hello World', 'uppercase')).toBe('HELLO WORLD')
  })

  it('applies date transform', () => {
    expect(applyTransform('2024-01-15', 'date')).toBe('2024-01-15T00:00:00.000Z')
    expect(applyTransform('invalid-date', 'date')).toBeNull()
  })

  it('applies concat transform with prefix and suffix', () => {
    expect(applyTransform('John', 'concat', { prefix: 'Hello, ', suffix: '!' })).toBe('Hello, John!')
    expect(applyTransform('Jane', 'concat', { prefix: '(', suffix: ')' })).toBe('(Jane)')
  })

  it('applies concat with empty params', () => {
    expect(applyTransform('test', 'concat', {})).toBe('test')
  })
})

describe('transformRow', () => {
  const mappings = [
    { id: '1', sourceField: 'name', destField: 'fullName', transform: 'string' as const },
    { id: '2', sourceField: 'age', destField: 'ageNum', transform: 'integer' as const },
    { id: '3', sourceField: 'email', destField: 'emailLower', transform: 'lowercase' as const },
  ]

  it('transforms a row with multiple mappings', () => {
    const row = { name: 'Alice', age: '30', email: 'ALICE@EXAMPLE.COM' }
    const result = transformRow(row, mappings)
    expect(result.fullName).toBe('Alice')
    expect(result.ageNum).toBe(30)
    expect(result.emailLower).toBe('alice@example.com')
  })

  it('skips filter transform mappings', () => {
    const mappingsWithFilter = [
      { id: '1', sourceField: 'name', destField: 'fullName', transform: 'filter' as const },
    ]
    const row = { name: 'Alice' }
    const result = transformRow(row, mappingsWithFilter)
    expect(result.fullName).toBeUndefined()
  })

  it('returns a copy of row when mappings is empty', () => {
    const row = { name: 'Alice', age: '30' }
    const result = transformRow(row, [])
    expect(result).toEqual(row)
    expect(result).not.toBe(row) // it's a copy
  })
})

describe('filterRows', () => {
  const rows = [
    { name: 'Alice', age: '30' },
    { name: 'Bob', age: '25' },
    { name: 'Alice', age: '35' },
    { name: 'Mallory', age: '28' },
  ]

  it('returns all rows when filterField is empty', () => {
    expect(filterRows(rows, '', 'eq', 'Alice').length).toBe(4)
  })

  it('filters with eq operator', () => {
    const result = filterRows(rows, 'name', 'eq', 'Alice')
    expect(result.length).toBe(2)
    expect(result[0].name).toBe('Alice')
    expect(result[1].name).toBe('Alice')
  })

  it('filters with neq operator', () => {
    const result = filterRows(rows, 'name', 'neq', 'Alice')
    expect(result.length).toBe(2)
    expect(result[0].name).toBe('Bob')
    expect(result[1].name).toBe('Mallory')
  })

  it('filters with contains operator', () => {
    const result = filterRows(rows, 'name', 'contains', 'll')
    expect(result.length).toBe(1)
    expect(result[0].name).toBe('Mallory')
  })

  it('filters with gt operator', () => {
    const result = filterRows(rows, 'age', 'gt', '28')
    // Alice (30) and Alice (35) > 28; Bob (25) and Mallory (28) do not
    expect(result.length).toBe(2)
    expect(result.map(r => r.name)).toEqual(['Alice', 'Alice'])
  })

  it('filters with lt operator', () => {
    const result = filterRows(rows, 'age', 'lt', '30')
    expect(result.length).toBe(2)
  })

  it('filters with gte operator', () => {
    const result = filterRows(rows, 'age', 'gte', '30')
    expect(result.length).toBe(2)
  })

  it('filters with lte operator', () => {
    const result = filterRows(rows, 'age', 'lte', '28')
    expect(result.length).toBe(2)
  })

  it('returns all rows for unknown operator', () => {
    expect(filterRows(rows, 'name', 'unknown', 'Alice').length).toBe(4)
  })
})

describe('sortRows', () => {
  const rows = [
    { name: 'Charlie', age: '30' },
    { name: 'Alice', age: '25' },
    { name: 'Bob', age: '35' },
  ]

  it('returns rows unchanged when sortField is empty', () => {
    const result = sortRows(rows, '', 'asc')
    expect(result.length).toBe(3)
  })

  it('sorts strings ascending', () => {
    const result = sortRows(rows, 'name', 'asc')
    expect(result[0].name).toBe('Alice')
    expect(result[1].name).toBe('Bob')
    expect(result[2].name).toBe('Charlie')
  })

  it('sorts strings descending', () => {
    const result = sortRows(rows, 'name', 'desc')
    expect(result[0].name).toBe('Charlie')
    expect(result[1].name).toBe('Bob')
    expect(result[2].name).toBe('Alice')
  })

  it('sorts numbers as strings (localeCompare with numeric)', () => {
    const rowsWithNums = [
      { name: 'a', age: '10' },
      { name: 'b', age: '2' },
      { name: 'c', age: '100' },
    ]
    const result = sortRows(rowsWithNums, 'age', 'asc')
    // localeCompare with numeric: '2' < '10' < '100'
    expect(result[0].age).toBe('2')
    expect(result[1].age).toBe('10')
    expect(result[2].age).toBe('100')
  })

  it('does not mutate original array', () => {
    const original = [...rows]
    sortRows(rows, 'name', 'asc')
    expect(rows).toEqual(original)
  })
})

describe('runTransformPipeline', () => {
  it('applies filter, sort, and mapping in correct order', () => {
    const rows = [
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
      { name: 'Alice', age: '35' },
      { name: 'Mallory', age: '28' },
    ]
    const config = {
      mappings: [
        { id: '1', sourceField: 'name', destField: 'user', transform: 'string' as const },
        { id: '2', sourceField: 'age', destField: 'ageNum', transform: 'integer' as const },
      ],
      filterField: 'name',
      filterOperator: 'neq',
      filterValue: 'Mallory',
      sortField: 'age',
      sortDirection: 'desc' as const,
    }
    const result = runTransformPipeline(rows, config)
    // After filter (neq Mallory): Alice-30, Bob-25, Alice-35
    // After sort desc by age: Alice-35, Alice-30, Bob-25
    // After mapping: {user, ageNum}
    expect(result.length).toBe(3)
    expect(result[0].user).toBe('Alice')
    expect(result[0].ageNum).toBe(35)
    expect(result[1].user).toBe('Alice')
    expect(result[1].ageNum).toBe(30)
    expect(result[2].user).toBe('Bob')
    expect(result[2].ageNum).toBe(25)
  })

  it('returns empty array for empty input', () => {
    const result = runTransformPipeline([], { mappings: [] })
    expect(result).toEqual([])
  })

  it('applies only mappings when no filter or sort', () => {
    const rows = [{ name: 'Alice', age: '30' }]
    const config = {
      mappings: [{ id: '1', sourceField: 'name', destField: 'user', transform: 'string' as const }],
    }
    const result = runTransformPipeline(rows, config)
    expect(result).toEqual([{ user: 'Alice' }])
  })

  it('applies filter without sort or mappings', () => {
    const rows = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Alice' }]
    const config = {
      mappings: [],
      filterField: 'name',
      filterOperator: 'eq',
      filterValue: 'Alice',
    }
    const result = runTransformPipeline(rows, config)
    expect(result.length).toBe(2)
  })
})
