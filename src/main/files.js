const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');

function filesRoot() {
  return store.getPaths().filesDir;
}

function versionDir(projectId, versionId) {
  return path.join(filesRoot(), String(projectId), String(versionId));
}

function md5File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function copyIntoVersion(sourcePath, projectId, versionId, fileType) {
  const dir = versionDir(projectId, versionId);
  fs.mkdirSync(dir, { recursive: true });
  const fileName = path.basename(sourcePath);
  const destPath = path.join(dir, fileType + '_' + fileName);
  await fs.promises.copyFile(sourcePath, destPath);
  const stat = fs.statSync(destPath);
  return {
    fileName,
    relativePath: path.relative(filesRoot(), destPath),
    fileSize: stat.size,
    md5: await md5File(destPath),
  };
}

function resolveStored(relativePath) {
  const root = filesRoot();
  const full = path.resolve(root, String(relativePath || ''));
  // 防止 ../ 逃逸出数据目录
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error('文件路径越界');
  }
  return full;
}

function removeVersionFiles(projectId, versionId) {
  const dir = versionDir(projectId, versionId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function removeProjectFiles(projectId) {
  const dir = path.join(filesRoot(), String(projectId));
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function fileInfo(relativePath) {
  const full = resolveStored(relativePath);
  if (!fs.existsSync(full)) return null;
  const stat = fs.statSync(full);
  return { fileName: path.basename(full), fileSize: stat.size, exists: true };
}

module.exports = {
  filesRoot,
  md5File,
  copyIntoVersion,
  resolveStored,
  removeVersionFiles,
  removeProjectFiles,
  fileInfo,
};
