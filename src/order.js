export const sameOrder = (left, right) =>
  left.length === right.length && left.every((id, index) => String(id) === String(right[index]))

export const sameMembers = (left, right) => {
  if (left.length !== right.length) return false
  const counts = new Map()
  for (const id of left) counts.set(String(id), (counts.get(String(id)) || 0) + 1)
  for (const id of right) {
    const key = String(id)
    const remaining = counts.get(key) || 0
    if (!remaining) return false
    counts.set(key, remaining - 1)
  }
  return [...counts.values()].every((count) => count === 0)
}

export const appendMissingInOrder = (existingIds, requestedIds) => {
  const seen = new Set(existingIds.map(String))
  return [...existingIds.map(String), ...requestedIds.map(String).filter((id) => !seen.has(id))]
}
