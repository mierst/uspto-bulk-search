const usptoClient = require('./uspto-client');

/**
 * Fetch and parse assignment data for a given serial number
 */
async function fetchAssignments(serialNumber) {
  const results = await usptoClient.search(serialNumber, {
    productTitle: 'Trademark Assignment',
    rows: 100,
  });

  return results.items.map(normalizeAssignment);
}

/**
 * Normalize a raw assignment record into our standard format
 */
function normalizeAssignment(record) {
  return {
    serialNumber: record.serialNumber,
    registrationNumber: record.registrationNumber,
    markText: record.markText,
    assignor: record.assignor,
    assignee: record.assignee,
    executionDate: record.executionDate,
    recordedDate: record.recordedDate,
    reelFrame: record.reelFrame,
    correspondentName: record.raw?.correspondentName || null,
    conveyanceText: record.raw?.conveyanceText || null,
    raw: record.raw,
  };
}

/**
 * Build a chain of title from a list of assignment records.
 * Sorted chronologically by execution date.
 */
function buildChainOfTitle(assignments) {
  const sorted = [...assignments].sort((a, b) => {
    const dateA = a.executionDate || a.recordedDate || '';
    const dateB = b.executionDate || b.recordedDate || '';
    return dateA.localeCompare(dateB);
  });

  return {
    markText: sorted[0]?.markText || 'Unknown',
    serialNumber: sorted[0]?.serialNumber || null,
    registrationNumber: sorted[0]?.registrationNumber || null,
    entries: sorted.map((a, index) => ({
      step: index + 1,
      assignor: a.assignor || 'Unknown',
      assignee: a.assignee || 'Unknown',
      executionDate: a.executionDate || 'N/A',
      recordedDate: a.recordedDate || 'N/A',
      reelFrame: a.reelFrame || 'N/A',
      conveyanceText: a.conveyanceText || null,
    })),
    currentOwner: sorted.length > 0 ? sorted[sorted.length - 1].assignee : 'Unknown',
    totalAssignments: sorted.length,
  };
}

module.exports = {
  fetchAssignments,
  normalizeAssignment,
  buildChainOfTitle,
};
