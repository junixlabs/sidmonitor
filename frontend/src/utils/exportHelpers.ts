/** Shared export/download utilities for CSV and JSON. */

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function convertToCSV<T>(
  rows: T[],
  headers: string[],
  rowMapper: (row: T) => (string | number | boolean | null | undefined)[],
): string {
  const csvRows = [headers.join(',')]
  rows.forEach((row) => {
    const values = rowMapper(row).map((v) => {
      if (v === null || v === undefined) return ''
      const str = String(v)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
    csvRows.push(values.join(','))
  })
  return csvRows.join('\n')
}

export function generateFilename(
  baseName: string,
  format: 'csv' | 'json',
  filterParts?: string[],
): string {
  const date = new Date().toISOString().split('T')[0]
  let filename = `${baseName}-${date}`

  if (filterParts && filterParts.length > 0) {
    filename += `-${filterParts.join('-')}`
  }

  return `${filename}.${format}`
}
