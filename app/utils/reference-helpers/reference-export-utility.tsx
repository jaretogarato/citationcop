import type { Document, Reference } from '@/app/types/reference'
import Papa from 'papaparse'
import ExcelJS from 'exceljs'

/**
 * Prepares a flattened array of references from documents for export
 */
export const prepareReferencesForExport = (documents: Document[]) => {
  return documents.flatMap((doc) =>
    doc.references.map((ref) => ({
      document: doc.pdfId,
      id: ref.id,
      title: ref.title,
      authors: Array.isArray(ref.authors)
        ? ref.authors.join('; ')
        : ref.authors,
      year: ref.year,
      status: ref.status,
      fixedReference: ref.fixedReference,
      raw: ref.raw,
      message: ref.message,
      url_valid: ref.url_valid,
      url_match: ref.url_match,
      DOI: ref.DOI,
      arxivId: ref.arxivId,
      PMID: ref.PMID,
      ISBN: ref.ISBN,
      url: ref.url,
      sourceDocument: ref.sourceDocument
    }))
  )
}

/**
 * Exports references to CSV file
 */
export const exportReferencesToCSV = (documents: Document[]) => {
  const allRefs = prepareReferencesForExport(documents)

  // Convert to CSV
  const csv = Papa.unparse(allRefs)

  // Create download link
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'references-export.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Exports references to Excel file
 */
export const exportReferencesToExcel = async (documents: Document[]) => {
  const allRefs = prepareReferencesForExport(documents)

  // Create a new workbook
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('References')

  // Add column headers
  const headers = Object.keys(allRefs[0] || {})
  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: 20 // Set a reasonable default width
  }))

  // Special width adjustments for specific columns
  worksheet.getColumn('title').width = 40
  worksheet.getColumn('raw').width = 50

  // Style the header row
  worksheet.getRow(1).font = { bold: true }

  // Add data rows
  allRefs.forEach((ref) => {
    worksheet.addRow(ref)
  })

  // Generate Excel file
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(blob)

  // Create download link
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'references-export.xlsx')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
