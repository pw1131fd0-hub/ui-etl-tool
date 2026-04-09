// Shared transform utility functions for ETL pipeline field mapping

export type TransformType = 'string' | 'integer' | 'date' | 'trim' | 'lowercase' | 'uppercase' | 'concat'
export type FilterOperator = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte'

export interface FieldMapping {
  id: string
  sourceField: string
  destField: string
  transform: TransformType
  transformParams?: Record<string, string>
}

export interface TransformInput {
  rows: string[][]
  fields: string[]
  mappings: FieldMapping[]
  filter?: { field: string; op: FilterOperator; value: string }
  sort?: { field: string; dir: 'asc' | 'desc' }
  flattenNested?: boolean
}

// Get nested value using dot notation: getNestedValue(row, "user.profile.name")
function getNestedValue(obj: Record<string, string>, path: string): string {
  const parts = path.split('.')
  let current: string | Record<string, string> = obj
  for (const part of parts) {
    if (current === null || current === undefined) return ''
    if (typeof current !== 'object') return ''
    current = current[part] as string | Record<string, string>
  }
  return typeof current === 'string' ? current : JSON.stringify(current)
}

// Flatten nested JSON objects to dot-notation keys
function flattenRow(row: Record<string, string>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(row)) {
    const newKey = prefix ? `${prefix}.${key}` : key
    // Try to parse as JSON object
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      parsed = null
    }
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      // Recursively flatten nested objects
      const nested = flattenRow(parsed as Record<string, string>, newKey)
      Object.assign(result, nested)
    } else {
      result[newKey] = value
    }
  }
  return result
}

export function applyTransform(input: TransformInput): { rows: string[][]; headers: string[] } {
  const { rows, fields, mappings, filter, sort, flattenNested } = input
  if (!rows.length || !mappings.length) return { rows: [], headers: [] }

  // Build object rows for easier processing
  let objRows = rows.map(row => {
    const obj: Record<string, string> = {}
    fields.forEach((f, i) => { obj[f] = row[i] ?? '' })
    return obj
  })

  // Flatten nested objects if enabled
  if (flattenNested) {
    objRows = objRows.map(row => flattenRow(row))
  }

  // Apply filter
  let filtered = objRows
  if (filter && filter.field) {
    filtered = objRows.filter(row => {
      const val = row[filter.field] ?? ''
      switch (filter.op) {
        case 'eq': return val === filter.value
        case 'neq': return val !== filter.value
        case 'contains': return val.includes(filter.value)
        case 'gt': return !isNaN(+val) && +val > +filter.value
        case 'lt': return !isNaN(+val) && +val < +filter.value
        case 'gte': return !isNaN(+val) && +val >= +filter.value
        case 'lte': return !isNaN(+val) && +val <= +filter.value
        default: return true
      }
    })
  }

  // Apply sort
  if (sort && sort.field) {
    filtered = [...filtered].sort((a, b) => {
      const aVal = a[sort.field] ?? ''
      const bVal = b[sort.field] ?? ''
      const cmp = isNaN(+aVal) || isNaN(+bVal) ? aVal.localeCompare(bVal) : +aVal - +bVal
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }

  // Apply mappings
  const destHeaders = mappings.map(m => m.destField)
  const result = filtered.map(row => {
    return mappings.map(m => {
      // Support dot notation for nested fields
      const val = m.sourceField.includes('.')
        ? getNestedValue(row, m.sourceField)
        : (row[m.sourceField] ?? '')
      let transformed: string = val
      switch (m.transform) {
        case 'trim': transformed = val.trim(); break
        case 'lowercase': transformed = val.toLowerCase(); break
        case 'uppercase': transformed = val.toUpperCase(); break
        case 'integer': transformed = String(Math.floor(+val) || 0); break
        case 'date': transformed = val; break
        case 'concat': {
          const params = m.transformParams as Record<string, string> | undefined
          transformed = (params?.prefix ?? '') + val + (params?.suffix ?? '')
          break
        }
        default: break
      }
      return transformed
    })
  })

  return { rows: result, headers: destHeaders }
}
