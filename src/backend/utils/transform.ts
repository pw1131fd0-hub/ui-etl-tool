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
    const val = applyTransform(row[m.sourceField], m.transform, m.transformParams)
    out[m.destField] = val
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
