/**
 * Export data to CSV and trigger download
 * @param {Array} data - Array of objects
 * @param {string} filename - Output filename
 */
export function exportToCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Build CSV rows
  const csvRows = [
    headers.join(','), // header row
    ...data.map(row =>
      headers.map(header => {
        const val = row[header];
        // Escape commas and quotes
        const escaped = String(val ?? '').replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    )
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}
