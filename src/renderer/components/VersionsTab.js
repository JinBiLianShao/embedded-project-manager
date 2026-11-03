import React, { memo, useMemo, useState } from 'react';
import { Icon } from './Icon.js';
import { EmptyState } from './EmptyState.js';
import { formatFileSize } from '../utils/format.js';
import { formatDateShort, formatRelativeDays } from '../utils/date.js';

const SORTS = [
  { key: 'buildTime', label: '按生成时间' },
  { key: 'version', label: '按版本号' },
  { key: 'createdAt', label: '按添加时间' },
];

function compareVersions(a, b) {
  // 语义化版本比较：v1.10.0 应排在 v1.9.0 之后，纯字符串比较会出错
  const parse = (text) => String(text || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export const VersionsTab = memo(function VersionsTab({
  project,
  onAdd,
  onEdit,
  onDelete,
  onCompare,
  isAdmin,
  isLoggedIn,
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('buildTime');
  const [desc, setDesc] = useState(true);

  const versions = project.versions || [];

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = versions.filter((v) => {
      if (!keyword) return true;
      return [v.version, v.changelog, v.binaryFile && v.binaryFile.fileName, v.configFile && v.configFile.fileName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'version') return compareVersions(a.version, b.version);
      return String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''));
    });
    return desc ? sorted.reverse() : sorted;
  }, [versions, search, sortKey, desc]);

  const handleReveal = async (relativePath) => {
    const result = await window.api.revealFile(relativePath);
    if (!result.success) window.alert('打开失败：' + result.error);
  };

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-search">
          <Icon name="search" size={18}/>
          <input
            className="form-input"
            placeholder="搜索版本号、变更说明…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="toolbar-actions">
          <select className="form-select" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            {SORTS.map((sort) => (
              <option key={sort.key} value={sort.key}>{sort.label}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={() => setDesc((v) => !v)}>
            <Icon name={desc ? 'download' : 'upload'} size={16}/>
            <span>{desc ? '降序' : '升序'}</span>
          </button>
          {versions.length >= 2 ? (
            <button className="btn btn-secondary" onClick={() => onCompare(versions)}>
              <Icon name="compare" size={16}/>
              <span>版本对比</span>
            </button>
          ) : null}
          {isLoggedIn ? (
            <button onClick={onAdd} className="btn btn-primary">
              <Icon name="plus" size={16}/>
              <span>新增版本</span>
            </button>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="file"
          title={versions.length === 0 ? '还没有版本记录' : '没有匹配的版本'}
          hint={versions.length === 0 ? '新增版本时可以同时上传固件二进制和配置文件' : '换个关键词试试'}
        />
      ) : (
        <div className="version-list">
          {visible.map((version) => {
            const md5 = (version.binaryFile && version.binaryFile.md5) || version.md5;
            return (
              <div key={version.id} className="list-item">
                <div className="list-item-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-4 mb-2">
                      <span className="version-tag">{version.version}</span>
                      <span className="text-sm text-gray-500">{formatDateShort(version.buildTime)}</span>
                      <span className="text-sm muted">{formatRelativeDays(version.buildTime)}</span>
                    </div>

                    {md5 ? (
                      <div className="text-sm text-gray-600 mb-2">
                        <strong>MD5:</strong> <code>{md5}</code>
                      </div>
                    ) : null}

                    {version.binaryFile ? (
                      <div className="file-info">
                        <div className="file-info-header">
                          <Icon name="chip" size={16}/>
                          <span>二进制文件</span>
                        </div>
                        <div className="file-info-content">
                          <button className="file-link" onClick={() => handleReveal(version.binaryFile.relativePath)}>
                            {version.binaryFile.fileName}
                          </button>
                          <span className="text-sm text-gray-500">{formatFileSize(version.binaryFile.fileSize)}</span>
                        </div>
                      </div>
                    ) : null}

                    {version.configFile ? (
                      <div className="file-info">
                        <div className="file-info-header">
                          <Icon name="fileText" size={16}/>
                          <span>配置文件</span>
                        </div>
                        <div className="file-info-content">
                          <button className="file-link" onClick={() => handleReveal(version.configFile.relativePath)}>
                            {version.configFile.fileName}
                          </button>
                          <span className="text-sm text-gray-500">{formatFileSize(version.configFile.fileSize)}</span>
                        </div>
                      </div>
                    ) : null}

                    {version.changelog ? (
                      <div className="text-sm text-gray-600 mt-2 version-changelog">{version.changelog}</div>
                    ) : null}
                  </div>

                  {isAdmin ? (
                    <div className="list-item-actions">
                      <button onClick={() => onEdit(version)} className="btn btn-icon btn-secondary" title="编辑版本">
                        <Icon name="edit" size={18}/>
                      </button>
                      <button onClick={() => onDelete(version.id)} className="btn btn-icon btn-danger" title="删除版本">
                        <Icon name="trash" size={18}/>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
