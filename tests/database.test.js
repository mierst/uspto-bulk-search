const fs = require('fs');
const path = require('path');
const os = require('os');
const database = require('../packages/core/src/database');

let dataRoot;

beforeEach(() => {
  // Create a unique temp directory for each test
  dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uspto-test-'));

  // Create migrations directory structure so getDb can find migrations
  const migrationsSource = path.join(__dirname, '..', 'src', 'migrations');
  const migrationsDest = path.join(dataRoot, '_migrations_link');

  // getDb uses path.join(__dirname, '..', 'migrations') relative to database.js
  // so migrations should be found automatically from the source tree
});

afterEach(() => {
  database.closeDb();
  // Clean up temp directory
  if (dataRoot && fs.existsSync(dataRoot)) {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

describe('Project CRUD', () => {
  it('creates a project and lists it', async () => {
    const project = await database.createProject(dataRoot, 'Test Project', ['test', 'mark']);

    expect(project.id).toBeGreaterThan(0);
    expect(project.name).toBe('Test Project');
    expect(project.storagePath).toBeDefined();

    const projects = await database.listProjects(dataRoot);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Test Project');
  });

  it('gets a project by id', async () => {
    const created = await database.createProject(dataRoot, 'Get Me', ['search']);
    const project = await database.getProject(dataRoot, created.id);

    expect(project).not.toBeNull();
    expect(project.name).toBe('Get Me');
    expect(project.id).toBe(created.id);
  });

  it('findOrCreateProject deduplicates by name', async () => {
    const first = await database.findOrCreateProject(dataRoot, 'Dedup Test', ['a']);
    const second = await database.findOrCreateProject(dataRoot, 'Dedup Test', ['b']);

    expect(first.id).toBe(second.id);
    expect(first.name).toBe('Dedup Test');

    const projects = await database.listProjects(dataRoot);
    expect(projects).toHaveLength(1);
  });

  it('renames a project', async () => {
    const project = await database.createProject(dataRoot, 'Old Name', ['x']);
    await database.renameProject(dataRoot, project.id, 'New Name');

    const updated = await database.getProject(dataRoot, project.id);
    expect(updated.name).toBe('New Name');
  });

  it('deletes a project and its data', async () => {
    const project = await database.createProject(dataRoot, 'Delete Me', ['y']);

    await database.saveAssignment(dataRoot, project.id, {
      serialNumber: '11111111',
      markText: 'DOOMED',
    });

    await database.deleteProject(dataRoot, project.id);

    const projects = await database.listProjects(dataRoot);
    expect(projects).toHaveLength(0);

    const assignments = await database.getAssignments(dataRoot, project.id);
    expect(assignments).toHaveLength(0);
  });
});

describe('Assignment CRUD', () => {
  it('saves and retrieves assignments', async () => {
    const project = await database.createProject(dataRoot, 'Assignment Project', ['test']);

    const result = await database.saveAssignment(dataRoot, project.id, {
      serialNumber: '87654321',
      registrationNumber: '1234567',
      markText: 'TEST MARK',
      assignor: 'Old Owner',
      assignee: 'New Owner',
      executionDate: '2025-01-15',
      recordedDate: '2025-02-01',
      reelFrame: '1234/0001',
    });

    expect(result.id).toBeGreaterThan(0);

    const assignments = await database.getAssignments(dataRoot, project.id);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].serial_number).toBe('87654321');
    expect(assignments[0].mark_text).toBe('TEST MARK');
    expect(assignments[0].assignor).toBe('Old Owner');
  });

  it('getAssignmentProjects returns projects for a serial number', async () => {
    const project1 = await database.createProject(dataRoot, 'Project A', ['a']);
    const project2 = await database.createProject(dataRoot, 'Project B', ['b']);

    await database.saveAssignment(dataRoot, project1.id, {
      serialNumber: '99999999',
      markText: 'SHARED MARK',
    });
    await database.saveAssignment(dataRoot, project2.id, {
      serialNumber: '99999999',
      markText: 'SHARED MARK',
    });

    const projects = await database.getAssignmentProjects(dataRoot, '99999999');
    expect(projects).toHaveLength(2);

    const names = projects.map(p => p.name).sort();
    expect(names).toEqual(['Project A', 'Project B']);
  });

  it('getAssignmentProjects returns empty for null serial', async () => {
    const result = await database.getAssignmentProjects(dataRoot, null);
    expect(result).toEqual([]);
  });
});

describe('Local Search', () => {
  it('searches assignments by mark text', async () => {
    const project = await database.createProject(dataRoot, 'Search Project', ['s']);
    await database.saveAssignment(dataRoot, project.id, {
      serialNumber: '11111111',
      markText: 'SUPER WIDGET',
    });
    await database.saveAssignment(dataRoot, project.id, {
      serialNumber: '22222222',
      markText: 'MEGA GADGET',
    });

    const results = await database.localSearch(dataRoot, 'WIDGET');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.serial_number === '11111111')).toBe(true);
    expect(results.every(r => r.serial_number !== '22222222')).toBe(true);
  });

  it('searches assignments by assignor', async () => {
    const project = await database.createProject(dataRoot, 'Assignor Search', ['s']);
    await database.saveAssignment(dataRoot, project.id, {
      serialNumber: '33333333',
      markText: 'BRAND',
      assignor: 'Acme Corporation',
    });

    const results = await database.localSearch(dataRoot, 'Acme');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].serial_number).toBe('33333333');
  });
});

describe('Storage Stats', () => {
  it('returns correct project count', async () => {
    await database.createProject(dataRoot, 'P1', ['a']);
    await database.createProject(dataRoot, 'P2', ['b']);

    const stats = await database.getStorageStats(dataRoot);
    expect(stats.projectCount).toBe(2);
  });

  it('returns zero counts for empty database', async () => {
    const stats = await database.getStorageStats(dataRoot);
    expect(stats.projectCount).toBe(0);
    expect(stats.fileCount).toBe(0);
    expect(stats.totalSize).toBe(0);
  });
});
