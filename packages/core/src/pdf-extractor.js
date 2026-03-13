const fs = require('fs');

/**
 * Extract text content from a PDF file for indexing
 */
async function extractText(filePath) {
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    console.error(`PDF extraction failed for ${filePath}:`, err.message);
    return '';
  }
}

module.exports = {
  extractText,
};
