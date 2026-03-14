export const previewRef = (type) => {
  const map = { IN: 'WH/IN', OUT: 'WH/OUT', INT: 'WH/INT', ADJ: 'WH/ADJ' }
  const suffix = String(Date.now()).slice(-5)
  return `${map[type] ?? 'WH/XX'}/${suffix}`
}
