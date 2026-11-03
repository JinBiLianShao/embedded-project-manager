const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const SCHEMA_VERSION = 2;
const MAX_BACKUPS = 10;
const DEFAULT_ADMIN = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

let paths = null;

function getPaths() {
  if (paths) return paths;
  const userData = app.getPath('userData');
  paths = {
    userData,
    dataFile: path.join(userData, 'data.json'),
    backupDir: path.join(userData, 'backups'),
    filesDir: path.join(userData, 'files'),
  };
  return paths;
}

function ensureDirs() {
  const p = getPaths();
  for (const dir of [p.userData, p.backupDir, p.filesDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

// scrypt 实现放在这里而不是 require('./auth')，避免 store 与 auth 的循环依赖
function hashSecret(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return { passwordHash: derived.toString('hex'), salt };
}

function bootstrapAdmin() {
  const { passwordHash, salt } = hashSecret(DEFAULT_ADMIN_PASSWORD);
  return {
    username: DEFAULT_ADMIN,
    passwordHash,
    salt,
    role: 'admin',
    createdAt: new Date().toISOString(),
  };
}

function defaultData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    projects: [],
    users: { [DEFAULT_ADMIN]: bootstrapAdmin() },
    // 初始密码是公开的，首次登录后必须强制修改
    settings: { currentUser: null, mustChangePassword: false },
  };
}

function emptyProject(id) {
  return {
    id,
    name: '',
    description: '',
    chip: '',
    platform: '',
    customer: '',
    status: '进行中',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versions: [],
    // 项目级的自由测试记录（不分设备时使用）
    testRecords: [],
    // 以下为 v2.1 新增，默认空数组，旧数据自动补齐
    batches: [],
    devices: [],
    issues: [],
  };
}

// 保留调用方传入、但本模块不认识的字段。
// normalizeData 是「白名单重建」，若不显式保留，渲染层新增的字段
// 会在每次保存时被静默丢弃——这属于不可接受的数据丢失，故统一兜底。
function keepUnknown(source, known) {
  if (!source || typeof source !== 'object') return {};
  const extra = {};
  for (const key of Object.keys(source)) {
    if (!known.includes(key)) extra[key] = source[key];
  }
  return extra;
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// 把任意来源（旧版本 data.json / 导入的备份）规整成当前 schema。
// 只补字段、不猜内容：无法识别的字段原样丢弃，缺失的字段填默认值。
function normalizeData(raw) {
  const base = defaultData();
  if (!raw || typeof raw !== 'object') return base;

  const users = {};
  if (raw.users && typeof raw.users === 'object') {
    for (const [key, value] of Object.entries(raw.users)) {
      if (!value || typeof value !== 'object') continue;
      const username = asString(value.username, key);
      users[username] = {
        username,
        // 旧数据把明文密码存在 passwordHash 里，这里保留原值，
        // 由 auth.verifyPassword 识别为 legacy 并在下次登录时升级为 scrypt。
        passwordHash: asString(value.passwordHash),
        salt: asString(value.salt),
        role: value.role === 'admin' ? 'admin' : 'viewer',
        createdAt: asString(value.createdAt, new Date().toISOString()),
      };
    }
  }

  const projects = asArray(raw.projects)
    .filter((p) => p && typeof p === 'object' && p.id != null)
    .map((p) => {
      const project = emptyProject(p.id);
      // 先铺未知字段，再用已知字段覆盖，保证扩展字段不丢失
      Object.assign(project, keepUnknown(p, [
        'id', 'name', 'description', 'chip', 'platform', 'customer', 'status',
        'createdAt', 'updatedAt', 'versions', 'testRecords', 'batches', 'devices', 'issues',
      ]));
      project.name = asString(p.name, '未命名项目');
      project.description = asString(p.description);
      project.chip = asString(p.chip);
      project.platform = asString(p.platform);
      project.customer = asString(p.customer);
      project.status = asString(p.status, '进行中');
      project.createdAt = asString(p.createdAt, project.createdAt);
      project.updatedAt = asString(p.updatedAt, project.createdAt);

      project.versions = asArray(p.versions)
        .filter((v) => v && typeof v === 'object' && v.id != null)
        .map((v) => ({
          ...keepUnknown(v, [
            'id', 'version', 'buildTime', 'changelog', 'createdAt',
            'binaryFile', 'configFile', 'md5',
          ]),
          id: v.id,
          version: asString(v.version, '未命名版本'),
          buildTime: asString(v.buildTime),
          changelog: asString(v.changelog),
          createdAt: asString(v.createdAt, new Date().toISOString()),
          binaryFile: normalizeFileRef(v.binaryFile),
          configFile: normalizeFileRef(v.configFile),
          md5: asString(v.md5),
          // 阶段与组件清单（v2.1）
          stage: asString(v.stage),
          components: asArray(v.components),
          env: v.env && typeof v.env === 'object' ? v.env : {},
        }));

      project.testRecords = asArray(p.testRecords)
        .filter((r) => r && typeof r === 'object' && r.id != null)
        .map(normalizeTestRecord);

      project.batches = asArray(p.batches)
        .filter((b) => b && typeof b === 'object' && b.id != null)
        .map((b) => ({
          ...keepUnknown(b, ['id', 'code', 'stage', 'quantity', 'versionId', 'envSnapshot', 'createdAt', 'shippedAt', 'notes']),
          id: b.id,
          code: asString(b.code, '未命名批次'),
          stage: asString(b.stage),
          quantity: Number(b.quantity) || 0,
          versionId: b.versionId == null ? null : b.versionId,
          envSnapshot: b.envSnapshot && typeof b.envSnapshot === 'object' ? b.envSnapshot : {},
          createdAt: asString(b.createdAt, new Date().toISOString()),
          shippedAt: asString(b.shippedAt),
          notes: asString(b.notes),
        }));

      project.devices = asArray(p.devices)
        .filter((d) => d && typeof d === 'object' && d.id != null)
        .map((d) => ({
          ...keepUnknown(d, ['id', 'sn', 'batchId', 'versionId', 'envSnapshot', 'status', 'testRecords', 'issueIds', 'createdAt', 'updatedAt', 'shippedAt', 'customer', 'notes']),
          id: d.id,
          sn: asString(d.sn),
          batchId: d.batchId == null ? null : d.batchId,
          // 设备实际烧录的固件，可能与批次默认值不同
          versionId: d.versionId == null ? null : d.versionId,
          envSnapshot: d.envSnapshot && typeof d.envSnapshot === 'object' ? d.envSnapshot : {},
          status: asString(d.status, '待测'),
          testRecords: asArray(d.testRecords).map(normalizeTestRecord),
          issueIds: asArray(d.issueIds),
          createdAt: asString(d.createdAt, new Date().toISOString()),
          updatedAt: asString(d.updatedAt, new Date().toISOString()),
          shippedAt: asString(d.shippedAt),
          customer: asString(d.customer),
          notes: asString(d.notes),
        }));

      project.issues = asArray(p.issues)
        .filter((i) => i && typeof i === 'object' && i.id != null)
        .map((i) => ({
          ...keepUnknown(i, ['id', 'scope', 'batchId', 'deviceIds', 'versionId', 'severity', 'status', 'title', 'description', 'createdAt', 'updatedAt', 'resolvedAt', 'resolution', 'createdBy']),
          id: i.id,
          scope: i.scope === 'batch' ? 'batch' : 'device',
          batchId: i.batchId == null ? null : i.batchId,
          deviceIds: asArray(i.deviceIds),
          versionId: i.versionId == null ? null : i.versionId,
          severity: asString(i.severity, '一般'),
          status: asString(i.status, '打开'),
          title: asString(i.title),
          description: asString(i.description),
          createdAt: asString(i.createdAt, new Date().toISOString()),
          updatedAt: asString(i.updatedAt, new Date().toISOString()),
          resolvedAt: asString(i.resolvedAt),
          resolution: asString(i.resolution),
          createdBy: asString(i.createdBy),
        }));

      return project;
    });

  // 没有管理员就永远无法登录。任何来源的数据（旧版、导入的备份、损坏恢复）
  // 只要缺少管理员账号，就补一个默认管理员，保证应用始终可用。
  const hasAdmin = Object.values(users).some((u) => u.role === 'admin');
  if (!hasAdmin) {
    users[DEFAULT_ADMIN] = bootstrapAdmin();
  }

  const currentUser = raw.settings && asString(raw.settings.currentUser);
  return {
    schemaVersion: SCHEMA_VERSION,
    projects,
    users,
    settings: {
      currentUser: currentUser && users[currentUser] ? currentUser : null,
      mustChangePassword: !!(raw.settings && raw.settings.mustChangePassword),
    },
  };
}

// 测试记录：软件测试与硬件测试关注点不同，用 category 区分
function normalizeTestRecord(r) {
  return {
    ...keepUnknown(r, ['id', 'testDate', 'tester', 'result', 'notes', 'versionId', 'createdAt', 'category', 'deviceId']),
    id: r.id,
    testDate: asString(r.testDate),
    tester: asString(r.tester),
    result: r.result === '失败' ? '失败' : '通过',
    notes: asString(r.notes),
    // 旧数据没有 versionId，留空表示「未关联版本」，UI 会明确标注。
    versionId: r.versionId == null ? null : r.versionId,
    // software = 软件测试，hardware = 硬件测试，'' = 早期未区分
    category: r.category === 'software' || r.category === 'hardware' ? r.category : '',
    deviceId: r.deviceId == null ? null : r.deviceId,
    createdAt: asString(r.createdAt, new Date().toISOString()),
  };
}

function normalizeFileRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  const relativePath = asString(ref.relativePath);
  if (!relativePath) return null;
  return {
    fileName: asString(ref.fileName),
    relativePath,
    fileSize: Number(ref.fileSize) || 0,
    md5: asString(ref.md5),
  };
}

function readJsonFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  return JSON.parse(text);
}

function timestampSuffix() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// 原子写入：先写临时文件并 fsync，再 rename 覆盖。
// rename 在同一文件系统内是原子的，进程中途被杀也不会留下半个 data.json。
function writeFileAtomic(file, content) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, '.' + path.basename(file) + '.tmp-' + process.pid);
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

function pruneBackups() {
  const p = getPaths();
  if (!fs.existsSync(p.backupDir)) return;
  const entries = fs
    .readdirSync(p.backupDir)
    .filter((name) => name.startsWith('data-') && name.endsWith('.json'))
    .map((name) => ({ name, mtime: fs.statSync(path.join(p.backupDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const stale of entries.slice(MAX_BACKUPS)) {
    try {
      fs.unlinkSync(path.join(p.backupDir, stale.name));
    } catch {
      // 备份清理失败不应阻断保存
    }
  }
}

function backupCurrent() {
  const p = getPaths();
  if (!fs.existsSync(p.dataFile)) return;
  const target = path.join(p.backupDir, 'data-' + timestampSuffix() + '.json');
  try {
    fs.copyFileSync(p.dataFile, target);
    pruneBackups();
  } catch {
    // 备份失败不应阻断保存
  }
}

function load() {
  ensureDirs();
  const p = getPaths();
  if (!fs.existsSync(p.dataFile)) {
    const fresh = defaultData();
    writeFileAtomic(p.dataFile, JSON.stringify(fresh, null, 2));
    return { data: fresh, recovered: false, corrupted: false };
  }
  try {
    return { data: normalizeData(readJsonFile(p.dataFile)), recovered: false, corrupted: false };
  } catch (error) {
    // 主文件损坏：把它挪到一边，尝试用最近的备份恢复，避免直接覆盖用户数据。
    const quarantined = path.join(p.backupDir, 'corrupted-' + timestampSuffix() + '.json');
    try {
      fs.copyFileSync(p.dataFile, quarantined);
    } catch {
      // 隔离失败也要继续尝试恢复
    }
    const restored = restoreLatestBackup();
    if (restored) return { data: restored, recovered: true, corrupted: true };
    const fresh = defaultData();
    writeFileAtomic(p.dataFile, JSON.stringify(fresh, null, 2));
    return { data: fresh, recovered: false, corrupted: true, error: error.message };
  }
}

function restoreLatestBackup() {
  const p = getPaths();
  if (!fs.existsSync(p.backupDir)) return null;
  const candidates = fs
    .readdirSync(p.backupDir)
    .filter((name) => name.startsWith('data-') && name.endsWith('.json'))
    .map((name) => ({ name, mtime: fs.statSync(path.join(p.backupDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const candidate of candidates) {
    try {
      const data = normalizeData(readJsonFile(path.join(p.backupDir, candidate.name)));
      writeFileAtomic(p.dataFile, JSON.stringify(data, null, 2));
      return data;
    } catch {
      // 换下一个备份继续试
    }
  }
  return null;
}

function save(data) {
  ensureDirs();
  const p = getPaths();
  backupCurrent();
  const normalized = normalizeData(data);
  writeFileAtomic(p.dataFile, JSON.stringify(normalized, null, 2));
  return normalized;
}

// 校验外部导入的备份。返回 { ok, data, problems }，绝不直接落盘。
function validateImport(raw) {
  const problems = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, problems: ['文件内容不是 JSON 对象'] };
  }
  if (!Array.isArray(raw.projects)) problems.push('缺少 projects 数组');
  if (raw.users != null && typeof raw.users !== 'object') problems.push('users 不是对象');
  if (problems.length) return { ok: false, problems };

  const data = normalizeData(raw);
  return { ok: true, data, problems: [], stats: {
    projects: data.projects.length,
    versions: data.projects.reduce((sum, p) => sum + p.versions.length, 0),
    testRecords: data.projects.reduce((sum, p) => sum + p.testRecords.length, 0),
  } };
}

function listBackups() {
  const p = getPaths();
  if (!fs.existsSync(p.backupDir)) return [];
  return fs
    .readdirSync(p.backupDir)
    .filter((name) => name.startsWith('data-') && name.endsWith('.json'))
    .map((name) => {
      const stat = fs.statSync(path.join(p.backupDir, name));
      return { name, size: stat.size, mtime: stat.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function readBackup(name) {
  const p = getPaths();
  const safe = path.basename(name);
  if (!safe.startsWith('data-') || !safe.endsWith('.json')) {
    throw new Error('非法的备份文件名');
  }
  return normalizeData(readJsonFile(path.join(p.backupDir, safe)));
}

module.exports = {
  SCHEMA_VERSION,
  getPaths,
  ensureDirs,
  defaultData,
  normalizeData,
  load,
  save,
  validateImport,
  listBackups,
  readBackup,
  restoreLatestBackup,
};
