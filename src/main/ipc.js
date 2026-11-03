const { ipcMain, dialog, shell, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const auth = require('./auth');
const files = require('./files');

// 主进程持有权威数据。渲染进程只能提交 { projects, settings } 补丁，
// 用户表（含密码哈希）永远不经由渲染进程往返，避免被整包覆盖。
let db = null;

function database() {
  if (!db) {
    const result = store.load();
    db = result.data;
    if (result.corrupted) {
      db.settings.lastRecovery = {
        at: new Date().toISOString(),
        recovered: result.recovered,
      };
    }
  }
  return db;
}

function persist() {
  db = store.save(db);
  return db;
}

// 对外暴露的数据视图：剔除密码哈希与盐。
function publicView() {
  const data = database();
  const users = {};
  for (const [name, user] of Object.entries(data.users)) {
    users[name] = { username: user.username, role: user.role, createdAt: user.createdAt };
  }
  return {
    schemaVersion: data.schemaVersion,
    projects: data.projects,
    settings: data.settings,
    users,
  };
}

function currentUser() {
  const name = database().settings.currentUser;
  if (!name) return null;
  const user = database().users[name];
  if (!user) return null;
  return { username: user.username, role: user.role };
}

function requireAdmin() {
  const user = currentUser();
  if (!user) throw new Error('请先以管理员身份登录');
  if (user.role !== 'admin') throw new Error('需要管理员权限');
  return user;
}

function win() {
  return BrowserWindow.getAllWindows()[0] || null;
}

function fail(error) {
  return { success: false, error: error && error.message ? error.message : String(error) };
}

function register() {
  ipcMain.handle('data:load', async () => {
    const data = database();
    const recovery = data.settings.lastRecovery || null;
    if (recovery) {
      delete data.settings.lastRecovery;
      persist();
    }
    return { success: true, data: publicView(), recovery };
  });

  ipcMain.handle('data:save', async (event, patch) => {
    const data = database();
    if (patch && Array.isArray(patch.projects)) data.projects = patch.projects;
    if (patch && patch.settings && typeof patch.settings === 'object') {
      data.settings = { ...data.settings, ...patch.settings };
    }
    persist();
    return { success: true, data: publicView() };
  });

  // ---- 认证 ----
  ipcMain.handle('auth:login', async (event, username, password) => {
    const data = database();
    const name = auth.normalizeUsername(username);
    const user = data.users[name];
    if (!user || !auth.verifyPassword(password, user)) {
      return { success: false, error: '用户名或密码错误' };
    }
    // 旧版明文密码在首次成功登录时静默升级为 scrypt
    if (auth.needsUpgrade(user)) {
      const upgraded = auth.hashPassword(password);
      user.passwordHash = upgraded.passwordHash;
      user.salt = upgraded.salt;
    }
    data.settings.currentUser = name;
    persist();
    return { success: true, user: { username: user.username, role: user.role }, data: publicView() };
  });

  ipcMain.handle('auth:logout', async () => {
    database().settings.currentUser = null;
    persist();
    return { success: true, data: publicView() };
  });

  ipcMain.handle('auth:current', async () => ({ success: true, user: currentUser() }));

  ipcMain.handle('auth:change-password', async (event, oldPassword, newPassword) => {
    try {
      const user = currentUser();
      if (!user) throw new Error('请先登录');
      const record = database().users[user.username];
      if (!auth.verifyPassword(oldPassword, record)) throw new Error('原密码不正确');
      const validation = auth.validateCredentials(user.username, newPassword);
      if (!validation.ok) throw new Error(validation.problems.join('；'));
      const next = auth.hashPassword(newPassword);
      record.passwordHash = next.passwordHash;
      record.salt = next.salt;
      persist();
      return { success: true };
    } catch (error) {
      return fail(error);
    }
  });

  // ---- 用户管理 ----
  ipcMain.handle('users:list', async () => {
    const data = database();
    return {
      success: true,
      users: Object.values(data.users).map((u) => ({
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
      })),
    };
  });

  ipcMain.handle('users:create', async (event, payload) => {
    try {
      requireAdmin();
      const { username, password, role } = payload || {};
      const validation = auth.validateCredentials(username, password);
      if (!validation.ok) throw new Error(validation.problems.join('；'));
      if (database().users[validation.username]) throw new Error('用户名已存在');
      const hashed = auth.hashPassword(password);
      database().users[validation.username] = {
        username: validation.username,
        passwordHash: hashed.passwordHash,
        salt: hashed.salt,
        role: role === 'admin' ? 'admin' : 'viewer',
        createdAt: new Date().toISOString(),
      };
      persist();
      return { success: true };
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle('users:update', async (event, payload) => {
    try {
      const admin = requireAdmin();
      const { username, role, password } = payload || {};
      const user = database().users[username];
      if (!user) throw new Error('用户不存在');
      if (role) {
        if (username === admin.username && role !== 'admin') {
          throw new Error('不能撤销自己的管理员权限');
        }
        user.role = role === 'admin' ? 'admin' : 'viewer';
      }
      if (password) {
        const validation = auth.validateCredentials(username, password);
        if (!validation.ok) throw new Error(validation.problems.join('；'));
        const hashed = auth.hashPassword(password);
        user.passwordHash = hashed.passwordHash;
        user.salt = hashed.salt;
      }
      persist();
      return { success: true };
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle('users:delete', async (event, username) => {
    try {
      const admin = requireAdmin();
      if (username === admin.username) throw new Error('不能删除当前登录的账号');
      if (!database().users[username]) throw new Error('用户不存在');
      delete database().users[username];
      persist();
      return { success: true };
    } catch (error) {
      return fail(error);
    }
  });

  // ---- 文件 ----
  ipcMain.handle('files:select', async (event, fileType) => {
    try {
      const filters =
        fileType === 'binary'
          ? [{ name: '固件/二进制', extensions: ['bin', 'hex', 'elf', 'img', 'uf2', '*'] }, { name: '所有文件', extensions: ['*'] }]
          : [{ name: '配置文件', extensions: ['json', 'xml', 'ini', 'conf', 'cfg', 'yaml', 'yml', 'txt'] }, { name: '所有文件', extensions: ['*'] }];
      const result = await dialog.showOpenDialog(win(), { title: '选择文件', filters, properties: ['openFile'] });
      if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
      const filePath = result.filePaths[0];
      const stat = fs.statSync(filePath);
      return {
        success: true,
        fileName: path.basename(filePath),
        fileSize: stat.size,
        md5: await files.md5File(filePath),
        tempPath: filePath,
      };
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle('files:save', async (event, sourcePath, projectId, versionId, fileType) => {
    try {
      const ref = await files.copyIntoVersion(sourcePath, projectId, versionId, fileType);
      return { success: true, ...ref };
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle('files:open', async (event, relativePath) => {
    try {
      const full = files.resolveStored(relativePath);
      if (!fs.existsSync(full)) throw new Error('文件不存在');
      const error = await shell.openPath(full);
      if (error) throw new Error(error);
      return { success: true };
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle('files:reveal', async (event, relativePath) => {
    try {
      const full = files.resolveStored(relativePath);
      if (!fs.existsSync(full)) throw new Error('文件不存在');
      shell.showItemInFolder(full);
      return { success: true };
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle('files:delete-version', async (event, projectId, versionId) => {
    try {
      files.removeVersionFiles(projectId, versionId);
      return { success: true };
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle('files:delete-project', async (event, projectId) => {
    try {
      files.removeProjectFiles(projectId);
      return { success: true };
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle('files:info', async (event, relativePath) => {
    try {
      const info = files.fileInfo(relativePath);
      return info ? { success: true, ...info } : { success: false, error: '文件不存在' };
    } catch (error) {
      return fail(error);
    }
  });

  // ---- 导入 / 导出 ----
  ipcMain.handle('data:export', async (event, format) => {
    try {
      const data = database();
      const stamp = new Date().toISOString().split('T')[0];
      if (format === 'csv') {
        const rows = ['项目,芯片型号,平台,客户,状态,版本号,生成时间,MD5,变更说明,二进制文件,配置文件'];
        for (const project of data.projects) {
          if (!project.versions.length) {
            rows.push(csvRow([project.name, project.chip, project.platform, project.customer, project.status, '', '', '', '', '', '']));
          }
          for (const version of project.versions) {
            rows.push(csvRow([
              project.name, project.chip, project.platform, project.customer, project.status,
              version.version, version.buildTime, version.binaryFile ? version.binaryFile.md5 : version.md5,
              version.changelog, version.binaryFile ? version.binaryFile.fileName : '',
              version.configFile ? version.configFile.fileName : '',
            ]));
          }
        }
        const result = await dialog.showSaveDialog(win(), {
          title: '导出 CSV',
          defaultPath: 'versions_' + stamp + '.csv',
          filters: [{ name: 'CSV', extensions: ['csv'] }],
        });
        if (result.canceled || !result.filePath) return { success: false, canceled: true };
        // 加 BOM，Excel 打开中文才不乱码
        fs.writeFileSync(result.filePath, '\uFEFF' + rows.join('\r\n'), 'utf8');
        return { success: true, filePath: result.filePath };
      }

      const result = await dialog.showSaveDialog(win(), {
        title: '导出备份',
        defaultPath: 'backup_' + stamp + '.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return { success: false, canceled: true };
      const exportData = {
        schemaVersion: data.schemaVersion,
        exportedAt: new Date().toISOString(),
        projects: data.projects,
        users: Object.values(data.users).map((u) => ({ username: u.username, role: u.role })),
      };
      fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf8');
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle('data:import', async () => {
    try {
      requireAdmin();
      const result = await dialog.showOpenDialog(win(), {
        title: '导入备份',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
      let raw;
      try {
        raw = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
      } catch (error) {
        return { success: false, error: '文件不是合法的 JSON：' + error.message };
      }
      const validation = store.validateImport(raw);
      if (!validation.ok) {
        return { success: false, error: '备份结构不正确：' + validation.problems.join('；') };
      }
      return { success: true, data: validation.data, stats: validation.stats };
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle('data:import-apply', async (event, incoming) => {
    try {
      requireAdmin();
      const validation = store.validateImport(incoming);
      if (!validation.ok) throw new Error('备份结构不正确：' + validation.problems.join('；'));
      const data = database();
      data.projects = validation.data.projects;
      // 导入不覆盖本机账号体系，只合并项目数据，避免把自己锁在门外
      persist();
      return { success: true, data: publicView() };
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle('backups:list', async () => ({ success: true, backups: store.listBackups() }));

  ipcMain.handle('backups:restore', async (event, name) => {
    try {
      requireAdmin();
      const restored = store.readBackup(name);
      const data = database();
      data.projects = restored.projects;
      data.users = restored.users;
      persist();
      return { success: true, data: publicView() };
    } catch (error) {
      return fail(error);
    }
  });
}

function csvRow(values) {
  return values
    .map((value) => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"')
    .join(',');
}

module.exports = { register, database, publicView };
