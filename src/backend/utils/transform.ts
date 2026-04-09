// Backend ETL transform utilities - pure functions for data transformation
// These functions are shared between the ETL worker and can be unit tested

export interface FieldMapping {
  id: string
  sourceField: string
  destField: string
  transform: 'string' | 'integer' | 'date' | 'trim' | 'lowercase' | 'uppercase' | 'concat' | 'filter'
  transformParams?: Record<string, unknown>
}

export interface TransformConfig {
  mappings: FieldMapping[]
  filterField?: string
  filterOperator?: string
  filterValue?: string
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  flattenNested?: boolean
}

// Flatten nested objects: { user: { name: "John" } } -> { "user.name": "John" }
export function flattenObject(obj: unknown, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (typeof obj !== 'object' || obj === null) {
    if (prefix) result[prefix] = obj
    return result
  }
  if (Array.isArray(obj)) {
    if (prefix) result[prefix] = obj
    return result
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const newKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey))
    } else if (Array.isArray(value)) {
      // For arrays in source, stringify them (can be further parsed by destination)
      result[newKey] = JSON.stringify(value)
    } else {
      result[newKey] = value
    }
  }
  return result
}

// Flatten all rows (for nested JSON sources)
export function flattenRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(row => flattenObject(row))
}

// Extract nested value using dot notation: row["user.profile.name"]
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current
}

export function applyTransform(value: unknown, type: string, params?: Record<string, unknown>): unknown {
  if (value === null || value === undefined) return null
  switch (type) {
    case 'integer': {
      const num = parseInt(String(value), 10)
      return isNaN(num) ? null : num
    }
    case 'date': {
      const d = new Date(String(value))
      return isNaN(d.getTime()) ? null : d.toISOString()
    }
    case 'trim':
      return String(value).trim()
    case 'lowercase':
      return String(value).toLowerCase()
    case 'uppercase':
      return String(value).toUpperCase()
    case 'concat': {
      const prefix = (params?.prefix as string) ?? ''
      const suffix = (params?.suffix as string) ?? ''
      return prefix + String(value) + suffix
    }
    case 'string':
    default:
      return String(value)
  }
}

export function transformRow(
  row: Record<string, unknown>,
  mappings: FieldMapping[]
): Record<string, unknown> {
  if (!mappings || mappings.length === 0) {
    return { ...row }
  }
  const out: Record<string, unknown> = {}
  for (const m of mappings) {
    if (m.transform === 'filter') continue
    // Support dot notation for nested fields: "user.profile.name"
    const val = m.sourceField.includes('.')
      ? getNestedValue(row, m.sourceField)
      : row[m.sourceField]
    out[m.destField] = applyTransform(val, m.transform, m.transformParams)
  }
  return out
}

export function filterRows(
  rows: Record<string, unknown>[],
  filterField: string,
  filterOperator: string,
  filterValue: string
): Record<string, unknown>[] {
  if (!filterField) return rows
  return rows.filter((row) => {
    const fieldVal = String(row[filterField] ?? '')
    switch (filterOperator) {
      case 'eq':
        return fieldVal === filterValue
      case 'neq':
        return fieldVal !== filterValue
      case 'contains':
        return fieldVal.includes(filterValue)
      case 'gt':
        return parseFloat(fieldVal) > parseFloat(filterValue)
      case 'lt':
        return parseFloat(fieldVal) < parseFloat(filterValue)
      case 'gte':
        return parseFloat(fieldVal) >= parseFloat(filterValue)
      case 'lte':
        return parseFloat(fieldVal) <= parseFloat(filterValue)
      default:
        return true
    }
  })
}

export function sortRows(
  rows: Record<string, unknown>[],
  sortField: string,
  sortDirection: 'asc' | 'desc'
): Record<string, unknown>[] {
  if (!sortField) return rows
  return [...rows].sort((a, b) => {
    const aVal = String(a[sortField] ?? '')
    const bVal = String(b[sortField] ?? '')
    const cmp = aVal.localeCompare(bVal, undefined, { numeric: true })
    return sortDirection === 'desc' ? -cmp : cmp
  })
}

export function runTransformPipeline(
  rows: Record<string, unknown>[],
  config: TransformConfig
): Record<string, unknown>[] {
  let result = rows

  // Flatten nested objects if enabled
  if (config.flattenNested) {
    result = flattenRows(result)
  }

  // Apply filter
  if (config.filterField && config.filterOperator) {
    result = filterRows(result, config.filterField, config.filterOperator, config.filterValue ?? '')
  }

  // Apply sort
  if (config.sortField) {
    result = sortRows(result, config.sortField, config.sortDirection ?? 'asc')
  }

  // Apply mappings
  if (config.mappings && config.mappings.length > 0) {
    result = result.map(row => transformRow(row, config.mappings))
  }

  return result
}
