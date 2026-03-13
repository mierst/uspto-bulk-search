const { normalizeAssignment, buildChainOfTitle } = require('../packages/core/src/assignment-engine');

describe('normalizeAssignment', () => {
  it('maps all fields from a full record', () => {
    const record = {
      serialNumber: '87654321',
      registrationNumber: '1234567',
      markText: 'ACME WIDGET',
      assignor: 'Old Corp',
      assignee: 'New Corp',
      executionDate: '2025-01-15',
      recordedDate: '2025-02-01',
      reelFrame: '7890/0123',
      raw: {
        correspondentName: 'John Doe',
        conveyanceText: 'ASSIGNMENT OF THE ENTIRE INTEREST',
      },
    };

    const result = normalizeAssignment(record);

    expect(result.serialNumber).toBe('87654321');
    expect(result.registrationNumber).toBe('1234567');
    expect(result.markText).toBe('ACME WIDGET');
    expect(result.assignor).toBe('Old Corp');
    expect(result.assignee).toBe('New Corp');
    expect(result.executionDate).toBe('2025-01-15');
    expect(result.recordedDate).toBe('2025-02-01');
    expect(result.reelFrame).toBe('7890/0123');
    expect(result.correspondentName).toBe('John Doe');
    expect(result.conveyanceText).toBe('ASSIGNMENT OF THE ENTIRE INTEREST');
    expect(result.raw).toBe(record.raw);
  });

  it('handles missing optional fields with null defaults', () => {
    const record = {
      serialNumber: '11111111',
      markText: 'MINIMAL',
    };

    const result = normalizeAssignment(record);

    expect(result.serialNumber).toBe('11111111');
    expect(result.markText).toBe('MINIMAL');
    expect(result.registrationNumber).toBeUndefined();
    expect(result.correspondentName).toBeNull();
    expect(result.conveyanceText).toBeNull();
  });

  it('handles record with no raw field', () => {
    const record = { serialNumber: '22222222' };
    const result = normalizeAssignment(record);

    expect(result.correspondentName).toBeNull();
    expect(result.conveyanceText).toBeNull();
    expect(result.raw).toBeUndefined();
  });
});

describe('buildChainOfTitle', () => {
  it('sorts assignments chronologically by executionDate', () => {
    const assignments = [
      { markText: 'BRAND', serialNumber: '111', assignor: 'C', assignee: 'D', executionDate: '2025-03-01', recordedDate: '2025-03-15', reelFrame: '003/001' },
      { markText: 'BRAND', serialNumber: '111', assignor: 'A', assignee: 'B', executionDate: '2024-01-01', recordedDate: '2024-01-15', reelFrame: '001/001' },
      { markText: 'BRAND', serialNumber: '111', assignor: 'B', assignee: 'C', executionDate: '2024-06-01', recordedDate: '2024-06-15', reelFrame: '002/001' },
    ];

    const chain = buildChainOfTitle(assignments);

    expect(chain.markText).toBe('BRAND');
    expect(chain.serialNumber).toBe('111');
    expect(chain.totalAssignments).toBe(3);
    expect(chain.currentOwner).toBe('D');

    expect(chain.entries[0].step).toBe(1);
    expect(chain.entries[0].assignor).toBe('A');
    expect(chain.entries[0].assignee).toBe('B');

    expect(chain.entries[1].step).toBe(2);
    expect(chain.entries[1].assignor).toBe('B');
    expect(chain.entries[1].assignee).toBe('C');

    expect(chain.entries[2].step).toBe(3);
    expect(chain.entries[2].assignor).toBe('C');
    expect(chain.entries[2].assignee).toBe('D');
  });

  it('falls back to recordedDate when executionDate is missing', () => {
    const assignments = [
      { markText: 'X', assignor: 'B', assignee: 'C', recordedDate: '2025-06-01' },
      { markText: 'X', assignor: 'A', assignee: 'B', recordedDate: '2025-01-01' },
    ];

    const chain = buildChainOfTitle(assignments);

    expect(chain.entries[0].assignor).toBe('A');
    expect(chain.entries[1].assignor).toBe('B');
  });

  it('handles empty array gracefully', () => {
    const chain = buildChainOfTitle([]);

    expect(chain.markText).toBe('Unknown');
    expect(chain.serialNumber).toBeNull();
    expect(chain.registrationNumber).toBeNull();
    expect(chain.entries).toHaveLength(0);
    expect(chain.currentOwner).toBe('Unknown');
    expect(chain.totalAssignments).toBe(0);
  });

  it('fills N/A for missing fields in entries', () => {
    const assignments = [
      { markText: 'Y', assignor: null, assignee: null },
    ];

    const chain = buildChainOfTitle(assignments);

    expect(chain.entries[0].assignor).toBe('Unknown');
    expect(chain.entries[0].assignee).toBe('Unknown');
    expect(chain.entries[0].executionDate).toBe('N/A');
    expect(chain.entries[0].recordedDate).toBe('N/A');
    expect(chain.entries[0].reelFrame).toBe('N/A');
  });
});
