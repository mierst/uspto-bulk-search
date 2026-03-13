const PDFDocument = require('pdfkit');

/**
 * Generate a PDF exhibit document from chain of title data
 */
async function exportChainOfTitle(chain) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Header
      doc.fontSize(16).font('Helvetica-Bold')
        .text('EXHIBIT', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14)
        .text('Trademark Assignment Chain of Title', { align: 'center' });
      doc.moveDown(1);

      // Mark info
      doc.fontSize(11).font('Helvetica');
      if (chain.markText) {
        doc.font('Helvetica-Bold').text('Mark: ', { continued: true });
        doc.font('Helvetica').text(chain.markText);
      }
      if (chain.serialNumber) {
        doc.font('Helvetica-Bold').text('Serial Number: ', { continued: true });
        doc.font('Helvetica').text(chain.serialNumber);
      }
      if (chain.registrationNumber) {
        doc.font('Helvetica-Bold').text('Registration Number: ', { continued: true });
        doc.font('Helvetica').text(chain.registrationNumber);
      }
      doc.font('Helvetica-Bold').text('Current Owner: ', { continued: true });
      doc.font('Helvetica').text(chain.currentOwner || 'Unknown');
      doc.font('Helvetica-Bold').text('Total Assignments: ', { continued: true });
      doc.font('Helvetica').text(String(chain.totalAssignments || 0));

      doc.moveDown(1);
      drawHorizontalLine(doc);
      doc.moveDown(1);

      // Assignment entries
      for (const entry of chain.entries) {
        // Check if we need a new page
        if (doc.y > 650) {
          doc.addPage();
        }

        doc.fontSize(12).font('Helvetica-Bold')
          .text(`Assignment ${entry.step}`, { underline: true });
        doc.moveDown(0.3);

        doc.fontSize(10).font('Helvetica');

        const rows = [
          ['Assignor (From):', entry.assignor],
          ['Assignee (To):', entry.assignee],
          ['Execution Date:', entry.executionDate],
          ['Recorded Date:', entry.recordedDate],
          ['Reel/Frame:', entry.reelFrame],
        ];

        if (entry.conveyanceText) {
          rows.push(['Conveyance:', entry.conveyanceText]);
        }

        for (const [label, value] of rows) {
          doc.font('Helvetica-Bold').text(label, 72, doc.y, { continued: true, width: 130 });
          doc.font('Helvetica').text(` ${value || 'N/A'}`, { width: 380 });
        }

        doc.moveDown(0.5);
        drawHorizontalLine(doc);
        doc.moveDown(0.5);
      }

      // Footer
      doc.moveDown(1);
      doc.fontSize(8).font('Helvetica')
        .fillColor('#888888')
        .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
        .text('Source: USPTO Open Data Portal (data.uspto.gov)', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function drawHorizontalLine(doc) {
  doc.strokeColor('#cccccc')
    .lineWidth(0.5)
    .moveTo(72, doc.y)
    .lineTo(540, doc.y)
    .stroke();
}

module.exports = {
  exportChainOfTitle,
};
