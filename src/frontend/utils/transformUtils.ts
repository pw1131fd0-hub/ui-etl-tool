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
}

export function applyTransform(input: TransformInput): { rows: string[][]; headers: string[] } {
  const { rows, fields, mappings, filter, sort } = input
  if (!rows.length || !mappings.length) return { rows: [], headers: [] }

  // Build object rows for easier processing
  const objRows = rows.map(row => {
    const obj: Record<string, string> = {}
    fields.forEach((f, i) => { obj[f] = row[i] ?? '' })
    return obj
  })

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
      let val: string = row[m.sourceField] ?? ''
      switch (m.transform) {
        case 'trim': val = val.trim(); break
        case 'lowercase': val = val.toLowerCase(); break
        case 'uppercase': val = val.toUpperCase(); break
        case 'integer': val = String(Math.floor(+val) || 0); break
        case 'date': val = val; break
        case 'concat': {
          const params = m.transformParams as Record<string, string> | undefined
          val = (params?.prefix ?? '') + val + (params?.suffix ?? '')
          break
        }
        default: break
      }
      return val
    })
  })

  return { rows: result, headers: destHeaders }
}
