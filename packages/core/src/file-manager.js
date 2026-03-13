const fs = require('fs');
const path = require('path');
const { FOLDERS, PROJECT_META_FILE } = require('./constants');

/**
 * Ensure project directory structure exists
 */
function ensureProjectDirs(projectDir) {
  for (const folder of Object.values(FOLDERS)) {
    fs.mkdirSync(path.join(projectDir, folder), { recursive: true });
  }
}

/**
 * Write project metadata file
 */
function writeProjectMeta(projectDir, meta) {
  fs.writeFileSync(
    path.join(projectDir, PROJECT_META_FILE),
    JSON.stringify(meta, null, 2)
  );
}

/**
 * Read project metadata file
 */
function readProjectMeta(projectDir) {
  const metaPath = path.join(projectDir, PROJECT_META_FILE);
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
}

/**
 * Save a file to the project's downloads directory
 */
function saveDownload(projectDir, filename, buffer) {
  const filePath = path.join(projectDir, FOLDERS.DOWNLOADS, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Save assignment data as JSON
 */
function saveAssignmentFile(projectDir, serialNumber, data) {
  const filename = `assignment-${serialNumber || Date.now()}.json`;
  const filePath = path.join(projectDir, FOLDERS.ASSIGNMENTS, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

/**
 * Save chain of title summary
 */
function saveChainOfTitle(projectDir, chainData) {
  const filePath = path.join(projectDir, FOLDERS.ASSIGNMENTS, 'chain-of-title.json');
  fs.writeFileSync(filePath, JSON.stringify(chainData, null, 2));
  return filePath;
}

/**
 * Save an exported exhibit PDF
 */
function saveExhibit(projectDir, filename, pdfBuffer) {
  const filePath = path.join(projectDir, FOLDERS.EXPORTS, filename);
  fs.writeFileSync(filePath, pdfBuffer);
  return filePath;
}

/**
 * List all files in a project directory
 */
function listProjectFiles(projectDir) {
  const files = [];

  for (const folder of Object.values(FOLDERS)) {
    const folderPath = path.join(projectDir, folder);
    if (!fs.existsSync(folderPath)) continue;

    const entries = fs.readdirSync(folderPath);
    for (const entry of entries) {
      const filePath = path.join(folderPath, entry);
      const stats = fs.statSync(filePath);
      files.push({
        name: entry,
        path: filePath,
        folder,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      });
    }
  }

  return files;
}

/**
 * Delete a specific file
 */
function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Delete entire project directory
 */
function deleteProjectDir(projectDir) {
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}

/**
 * Calculate total size of a directory
 */
function getDirectorySize(dirPath) {
  let totalSize = 0;

  if (!fs.existsSync(dirPath)) return 0;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      totalSize += getDirectorySize(fullPath);
    } else {
      totalSize += fs.statSync(fullPath).size;
    }
  }

  return totalSize;
}

module.exports = {
  ensureProjectDirs,
  writeProjectMeta,
  readProjectMeta,
  saveDownload,
  saveAssignmentFile,
  saveChainOfTitle,
  saveExhibit,
  listProjectFiles,
  deleteFile,
  deleteProjectDir,
  getDirectorySize,
};
