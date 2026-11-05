import { useCallback, useEffect, useMemo, useState } from 'react';
import { todayISO } from '../utils/date.js';

function newId() {
  // 用时间戳保证与旧数据的数字 id 兼容，同时降低同毫秒冲突概率
  return Date.now() + Math.floor(Math.random() * 1000);
}

const EMPTY_DATA = {
  schemaVersion: 2,
  projects: [],
  users: {},
  settings: { currentUser: null },
};

export function useAppData(confirm) {
  const [data, setData] = useState(EMPTY_DATA);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState(null);
  const [recoveryNotice, setRecoveryNotice] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone, at: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const applyResponse = useCallback((response) => {
    if (response && response.success && response.data) {
      setData(response.data);
    }
    return response;
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setFatalError(null);
    try {
      const response = await window.api.loadData();
      if (!response.success) throw new Error(response.error || '加载失败');
      setData(response.data);
      if (response.recovery) setRecoveryNotice(response.recovery);
      const current = await window.api.currentUser();
      setUser(current && current.user ? current.user : null);
    } catch (error) {
      setFatalError(error.message || String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // 只提交 projects/settings，用户表由主进程独占，绝不整包回写
  const persist = useCallback(
    async (patch) => {
      const response = await window.api.saveData(patch);
      if (!response.success) {
        notify('保存失败：' + (response.error || '未知错误'), 'error');
        throw new Error(response.error || '保存失败');
      }
      setData(response.data);
      return response.data;
    },
    [notify]
  );

  const isAdmin = !!(user && user.role === 'admin');
  const requireAdmin = useCallback(() => {
    if (!isAdmin) {
      notify('需要管理员权限', 'error');
      return false;
    }
    return true;
  }, [isAdmin, notify]);

  // ---- 项目 ----
  const addProject = useCallback(
    async (form) => {
      const project = {
        id: newId(),
        name: form.name.trim(),
        description: form.description || '',
        chip: form.chip || '',
        platform: form.platform || '',
        customer: form.customer || '',
        status: form.status || '进行中',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versions: [],
        testRecords: [],
      };
      const next = [...data.projects, project];
      await persist({ projects: next });
      notify('项目已创建');
      return project;
    },
    [data.projects, persist, notify]
  );

  const updateProject = useCallback(
    async (projectId, form) => {
      const next = data.projects.map((project) =>
        project.id === projectId
          ? { ...project, ...form, updatedAt: new Date().toISOString() }
          : project
      );
      await persist({ projects: next });
      notify('项目已更新');
    },
    [data.projects, persist, notify]
  );

  const deleteProject = useCallback(
    async (projectId) => {
      if (!requireAdmin()) return false;
      const project = data.projects.find((p) => p.id === projectId);
      const ok = await confirm({
        title: '删除项目',
        message: '确定删除「' + (project ? project.name : '该项目') + '」吗？该项目的版本记录、测试记录和已上传的文件都会被一并删除，且不可恢复。',
        confirmText: '删除',
      });
      if (!ok) return false;
      // 先删磁盘文件再删记录：反过来的话记录没了，文件就永远找不回来了
      const fileResult = await window.api.deleteProjectFiles(projectId);
      if (!fileResult.success) {
        notify('文件删除失败：' + fileResult.error, 'error');
      }
      await persist({ projects: data.projects.filter((p) => p.id !== projectId) });
      notify('项目已删除');
      return true;
    },
    [data.projects, persist, confirm, requireAdmin, notify]
  );

  // ---- 版本 ----
  const versionExists = useCallback(
    (projectId, versionText, exceptVersionId) => {
      const project = data.projects.find((p) => p.id === projectId);
      if (!project) return false;
      const target = String(versionText || '').trim().toLowerCase();
      return project.versions.some(
        (v) => v.id !== exceptVersionId && String(v.version || '').trim().toLowerCase() === target
      );
    },
    [data.projects]
  );

  const addVersion = useCallback(
    async (projectId, form) => {
      const versionId = newId();
      const record = {
        id: versionId,
        version: form.version.trim(),
        buildTime: form.buildTime || todayISO(),
        changelog: form.changelog || '',
        createdAt: new Date().toISOString(),
        md5: '',
        binaryFile: null,
        configFile: null,
      };

      if (form.binaryFile && form.binaryFile.tempPath) {
        const saved = await window.api.saveFile(form.binaryFile.tempPath, projectId, versionId, 'binary');
        if (!saved.success) {
          notify('二进制文件保存失败：' + saved.error, 'error');
          return null;
        }
        record.binaryFile = {
          fileName: saved.fileName,
          relativePath: saved.relativePath,
          fileSize: saved.fileSize,
          md5: saved.md5,
        };
        record.md5 = saved.md5;
      }

      if (form.configFile && form.configFile.tempPath) {
        const saved = await window.api.saveFile(form.configFile.tempPath, projectId, versionId, 'config');
        if (!saved.success) {
          notify('配置文件保存失败：' + saved.error, 'error');
          return null;
        }
        record.configFile = {
          fileName: saved.fileName,
          relativePath: saved.relativePath,
          fileSize: saved.fileSize,
          md5: saved.md5,
        };
      }

      const next = data.projects.map((project) =>
        project.id === projectId
          ? { ...project, versions: [record, ...project.versions], updatedAt: new Date().toISOString() }
          : project
      );
      await persist({ projects: next });
      notify('版本已添加');
      return record;
    },
    [data.projects, persist, notify]
  );

  const updateVersion = useCallback(
    async (projectId, versionId, form) => {
      let replacement = { ...form };
      delete replacement.tempPath;

      if (form.binaryFile && form.binaryFile.tempPath) {
        const saved = await window.api.saveFile(form.binaryFile.tempPath, projectId, versionId, 'binary');
        if (!saved.success) {
          notify('二进制文件保存失败：' + saved.error, 'error');
          return false;
        }
        replacement.binaryFile = {
          fileName: saved.fileName,
          relativePath: saved.relativePath,
          fileSize: saved.fileSize,
          md5: saved.md5,
        };
        replacement.md5 = saved.md5;
      }

      if (form.configFile && form.configFile.tempPath) {
        const saved = await window.api.saveFile(form.configFile.tempPath, projectId, versionId, 'config');
        if (!saved.success) {
          notify('配置文件保存失败：' + saved.error, 'error');
          return false;
        }
        replacement.configFile = {
          fileName: saved.fileName,
          relativePath: saved.relativePath,
          fileSize: saved.fileSize,
          md5: saved.md5,
        };
      }

      const next = data.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              versions: project.versions.map((v) => (v.id === versionId ? { ...v, ...replacement } : v)),
              updatedAt: new Date().toISOString(),
            }
          : project
      );
      await persist({ projects: next });
      notify('版本已更新');
      return true;
    },
    [data.projects, persist, notify]
  );

  const deleteVersion = useCallback(
    async (projectId, versionId) => {
      if (!requireAdmin()) return false;
      const ok = await confirm({
        title: '删除版本',
        message: '确定删除这个版本吗？关联的二进制文件和配置文件会一并删除，引用该版本的测试记录会变成「未关联」。',
        confirmText: '删除',
      });
      if (!ok) return false;

      const fileResult = await window.api.deleteVersionFiles(projectId, versionId);
      if (!fileResult.success) notify('文件删除失败：' + fileResult.error, 'error');

      const next = data.projects.map((project) => {
        if (project.id !== projectId) return project;
        return {
          ...project,
          versions: project.versions.filter((v) => v.id !== versionId),
          // 保留测试记录本身，只解除关联，避免连带丢数据
          testRecords: project.testRecords.map((r) =>
            r.versionId === versionId ? { ...r, versionId: null } : r
          ),
          updatedAt: new Date().toISOString(),
        };
      });
      await persist({ projects: next });
      notify('版本已删除');
      return true;
    },
    [data.projects, persist, confirm, requireAdmin, notify]
  );

  // ---- 测试记录 ----
  const addTestRecord = useCallback(
    async (projectId, form) => {
      const record = {
        id: newId(),
        testDate: form.testDate || todayISO(),
        tester: (form.tester || '').trim(),
        result: form.result === '失败' ? '失败' : '通过',
        notes: form.notes || '',
        versionId: form.versionId == null ? null : form.versionId,
        category: form.category === 'software' || form.category === 'hardware' ? form.category : '',
        createdAt: new Date().toISOString(),
      };
      const next = data.projects.map((project) =>
        project.id === projectId
          ? { ...project, testRecords: [...project.testRecords, record], updatedAt: new Date().toISOString() }
          : project
      );
      await persist({ projects: next });
      notify('测试记录已添加');
      return record;
    },
    [data.projects, persist, notify]
  );

  const updateTestRecord = useCallback(
    async (projectId, recordId, form) => {
      const next = data.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              testRecords: project.testRecords.map((r) =>
                r.id === recordId
                  ? {
                      ...r,
                      testDate: form.testDate,
                      tester: (form.tester || '').trim(),
                      result: form.result === '失败' ? '失败' : '通过',
                      notes: form.notes || '',
                      versionId: form.versionId == null ? null : form.versionId,
                    }
                  : r
              ),
              updatedAt: new Date().toISOString(),
            }
          : project
      );
      await persist({ projects: next });
      notify('测试记录已更新');
      return true;
    },
    [data.projects, persist, notify]
  );

  const deleteTestRecord = useCallback(
    async (projectId, recordId) => {
      if (!requireAdmin()) return false;
      const ok = await confirm({
        title: '删除测试记录',
        message: '确定删除这条测试记录吗？',
        confirmText: '删除',
      });
      if (!ok) return false;
      const next = data.projects.map((project) =>
        project.id === projectId
          ? { ...project, testRecords: project.testRecords.filter((r) => r.id !== recordId) }
          : project
      );
      await persist({ projects: next });
      notify('测试记录已删除');
      return true;
    },
    [data.projects, persist, confirm, requireAdmin, notify]
  );

  // ---- 认证 ----
  const login = useCallback(async (username, password) => {
    const response = await window.api.login(username, password);
    if (!response.success) return response;
    setData(response.data);
    setUser(response.user);
    return response;
  }, []);

  const logout = useCallback(async () => {
    const response = await window.api.logout();
    if (response.success) setData(response.data);
    setUser(null);
  }, []);

  const changePassword = useCallback(
    async (oldPassword, newPassword) => {
      const response = await window.api.changePassword(oldPassword, newPassword);
      if (response.success) notify('密码已更新');
      return response;
    },
    [notify]
  );

  // ---- 用户管理 ----
  const refreshUsers = useCallback(async () => {
    const response = await window.api.listUsers();
    if (response.success) {
      setData((prev) => {
        const users = {};
        for (const u of response.users) users[u.username] = u;
        return { ...prev, users };
      });
    }
    return response;
  }, []);

  const createUser = useCallback(
    async (payload) => {
      const response = await window.api.createUser(payload);
      if (response.success) {
        await refreshUsers();
        notify('用户已创建');
      }
      return response;
    },
    [refreshUsers, notify]
  );

  const updateUser = useCallback(
    async (payload) => {
      const response = await window.api.updateUser(payload);
      if (response.success) {
        await refreshUsers();
        notify('用户已更新');
      }
      return response;
    },
    [refreshUsers, notify]
  );

  const deleteUser = useCallback(
    async (username) => {
      const ok = await confirm({
        title: '删除用户',
        message: '确定删除用户「' + username + '」吗？',
        confirmText: '删除',
      });
      if (!ok) return false;
      const response = await window.api.deleteUser(username);
      if (response.success) {
        await refreshUsers();
        notify('用户已删除');
      } else {
        notify(response.error || '删除失败', 'error');
      }
      return response.success;
    },
    [confirm, refreshUsers, notify]
  );

  // ---- 导入导出 ----
  const exportData = useCallback(
    async (format) => {
      const response = await window.api.exportData(format);
      if (response.success) notify('已导出到 ' + response.filePath);
      else if (!response.canceled) notify('导出失败：' + (response.error || '未知错误'), 'error');
      return response;
    },
    [notify]
  );

  const importData = useCallback(async () => {
    if (!requireAdmin()) return false;
    const picked = await window.api.importData();
    if (!picked.success) {
      if (!picked.canceled) notify('导入失败：' + picked.error, 'error');
      return false;
    }
    const stats = picked.stats || { projects: 0, versions: 0, testRecords: 0 };
    const ok = await confirm({
      title: '导入备份',
      message:
        '即将导入 ' + stats.projects + ' 个项目、' + stats.versions + ' 个版本、' +
        stats.testRecords + ' 条测试记录。现有项目数据将被覆盖（本机账号不受影响），确定继续吗？',
      confirmText: '覆盖导入',
      tone: 'danger',
    });
    if (!ok) return false;
    const applied = await window.api.applyImport(picked.data);
    if (!applied.success) {
      notify('导入失败：' + applied.error, 'error');
      return false;
    }
    setData(applied.data);
    notify('导入完成');
    return true;
  }, [confirm, requireAdmin, notify]);

  // ---- 设备 / 批次 / 问题单（走增量通道，只回传受影响的项目）----
  const replaceProject = useCallback((updated) => {
    if (!updated) return;
    setData((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === updated.id ? updated : p)),
    }));
  }, []);

  const upsertDevices = useCallback(
    async (projectId, devices) => {
      const response = await window.api.upsertDevices(projectId, devices);
      if (!response.success) {
        notify('保存设备失败：' + response.error, 'error');
        return false;
      }
      // 主进程只回传本次改动的设备，就地合并进本地状态，
      // 避免为了几台设备把整个项目重新拉一遍（2000 台约 500KB）。
      const touched = response.devices || [];
      if (touched.length) {
        const byId = new Map(touched.map((d) => [d.id, d]));
        setData((prev) => ({
          ...prev,
          projects: prev.projects.map((p) => {
            if (p.id !== projectId) return p;
            const existing = new Map(p.devices.map((d) => [d.id, d]));
            for (const [id, dev] of byId) existing.set(id, dev);
            return { ...p, devices: [...existing.values()] };
          }),
        }));
      }
      return true;
    },
    [notify]
  );

  const removeDevices = useCallback(
    async (projectId, deviceIds) => {
      if (!requireAdmin()) return false;
      const ok = await confirm({
        title: '删除设备',
        message: '确定删除选中的 ' + (Array.isArray(deviceIds) ? deviceIds.length : 1) + ' 台设备吗？其测试记录会一并删除。',
        confirmText: '删除',
      });
      if (!ok) return false;
      const response = await window.api.removeDevices(projectId, deviceIds);
      if (!response.success) {
        notify('删除失败：' + response.error, 'error');
        return false;
      }
      replaceProject(response.project);
      notify('设备已删除');
      return true;
    },
    [confirm, requireAdmin, notify, replaceProject]
  );

  const addDeviceTestRecord = useCallback(
    async (projectId, deviceId, form) => {
      const response = await window.api.addDeviceTestRecord(projectId, deviceId, {
        ...form,
        id: newId(),
      });
      if (!response.success) {
        notify('保存测试记录失败：' + response.error, 'error');
        return false;
      }
      // 只把这条记录并进本地状态，避免整项目重传
      setData((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                devices: p.devices.map((d) =>
                  d.id === deviceId ? { ...d, testRecords: [...d.testRecords, response.record] } : d
                ),
              }
            : p
        ),
      }));
      notify('测试记录已添加');
      return true;
    },
    [notify]
  );

  const bulkAddDeviceTestRecords = useCallback(
    async (projectId, rows) => {
      const response = await window.api.bulkAddDeviceTestRecords(projectId, rows);
      if (!response.success) {
        notify('批量导入失败：' + response.error, 'error');
        return response;
      }
      replaceProject(response.project);
      notify('成功导入 ' + response.applied + ' 条' + (response.skipped.length ? '，跳过 ' + response.skipped.length + ' 条' : ''));
      return response;
    },
    [notify, replaceProject]
  );

  const upsertBatches = useCallback(
    async (projectId, batches) => {
      const response = await window.api.upsertBatches(projectId, batches);
      if (!response.success) {
        notify('保存批次失败：' + response.error, 'error');
        return false;
      }
      replaceProject(response.project);
      return true;
    },
    [notify, replaceProject]
  );

  const upsertIssues = useCallback(
    async (projectId, issues) => {
      const response = await window.api.upsertIssues(projectId, issues);
      if (!response.success) {
        notify('保存问题单失败：' + response.error, 'error');
        return false;
      }
      replaceProject(response.project);
      return true;
    },
    [notify, replaceProject]
  );

  const removeIssue = useCallback(
    async (projectId, issueId) => {
      if (!requireAdmin()) return false;
      const ok = await confirm({ title: '删除问题单', message: '确定删除这条问题单吗？', confirmText: '删除' });
      if (!ok) return false;
      const response = await window.api.removeIssue(projectId, issueId);
      if (!response.success) {
        notify('删除失败：' + response.error, 'error');
        return false;
      }
      replaceProject(response.project);
      notify('问题单已删除');
      return true;
    },
    [confirm, requireAdmin, notify, replaceProject]
  );

  const projects = useMemo(() => data.projects, [data.projects]);

  return {
    data,
    projects,
    users: data.users,
    user,
    isAdmin,
    loading,
    fatalError,
    recoveryNotice,
    dismissRecoveryNotice: () => setRecoveryNotice(null),
    toast,
    notify,
    reload,
    addProject,
    updateProject,
    deleteProject,
    addVersion,
    updateVersion,
    deleteVersion,
    versionExists,
    addTestRecord,
    updateTestRecord,
    deleteTestRecord,
    upsertDevices,
    removeDevices,
    addDeviceTestRecord,
    bulkAddDeviceTestRecords,
    upsertBatches,
    upsertIssues,
    removeIssue,
    login,
    logout,
    changePassword,
    createUser,
    updateUser,
    deleteUser,
    refreshUsers,
    exportData,
    importData,
  };
}
