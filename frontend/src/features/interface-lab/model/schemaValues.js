export function defaultValues(schema = []) {
  return Object.fromEntries(
    schemaFields(schema)
      .filter((field) => field.name)
      .map((field) => [field.name, defaultValue(field.type)]),
  )
}

export function normalizeNumericValues(values, schema = []) {
  const numericFields = new Set(
    schemaFields(schema)
      .filter((field) => field.name && isNumericType(field.type))
      .map((field) => field.name),
  )
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      numericFields.has(name) && value !== '' ? Number(value) : value,
    ]),
  )
}

export function schemaFields(schema) {
  return Array.isArray(schema) ? schema : []
}

export function defaultValue(type = '') {
  if (type === 'bool' || type === 'boolean') return false
  if (isArrayType(type)) return []
  if (isCustomType(type)) return {}
  if (isNumericType(type)) return 0
  return ''
}

export function isNumericType(type = '') {
  return /^(?:u?int(?:8|16|32|64)|float(?:32|64)|double)$/.test(type)
}

export function isArrayType(type = '') {
  return /\[[0-9]*\]$/.test(type) || /^sequence<.+>$/.test(type)
}

export function isCustomType(type = '') {
  return /^[A-Za-z][A-Za-z0-9_]*\/(?:msg\/)?[A-Z][A-Za-z0-9_]*$/.test(type)
}

export function isComplexType(type = '') {
  return isArrayType(type) || isCustomType(type)
}

