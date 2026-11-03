import React, { memo, useMemo, useState } from 'react';
import { Icon } from './Icon.js';
import { EmptyState } from './EmptyState.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { formatRelativeDays, daysBetween, todayISO } from '../utils/date.js';

export const PROJECT_STATUSES = ['进行中', '已完成', '已归档', '暂停'];

function statusClass(status) {
  if (status === '已完成') return 'badge badge-success';
  if (status === '已归档') return 'badge';
  if (status === '暂停') return 'badge badge-danger';
  return 'badge badge-info';
}

export const ProjectList = memo(function ProjectList({
  projects,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  isAdmin,
  isLoggedIn,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 250);

  const filtered = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();
    return projects
      .filter((project) => (statusFilter === 'all' ? true : project.status === statusFilter))
      .filter((project) => {
        if (!keyword) return true;
        return [project.name, project.description, project.chip, project.platform, project.customer]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword));
      })
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [projects, debouncedSearch, statusFilter]);

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-search">
          <Icon name="search" size={18}/>
          <input
            className="form-input"
            placeholder="搜索项目名称、芯片型号、客户…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="toolbar-actions">
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">全部状态</option>
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          {isLoggedIn ? (
            <button onClick={onAdd} className="btn btn-primary">
              <Icon name="plus" size={18}/>
              <span>新建项目</span>
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="package"
          title={projects.length === 0 ? '还没有项目' : '没有匹配的项目'}
          hint={projects.length === 0 ? '点击「新建项目」开始记录第一个嵌入式项目' : '试试换个关键词或清除筛选条件'}
        />
      ) : (
        <div className="card-grid">
          {filtered.map((project) => {
            const versions = project.versions || [];
            const records = project.testRecords || [];
            const latest = versions[0];
            const lastTest = records.length
              ? records.reduce((acc, r) => (String(r.testDate) > String(acc) ? r.testDate : acc), records[0].testDate)
              : null;
            const sinceTest = lastTest ? daysBetween(lastTest, todayISO()) : null;
            const stale = sinceTest != null && sinceTest > 30;

            return (
              <div key={project.id} className="card project-card" onClick={() => onSelect(project)}>
                <div className="project-card-head">
                  <h4 className="project-card-title truncate">{project.name}</h4>
                  <span className={statusClass(project.status)}>{project.status}</span>
                </div>

                {project.description ? (
                  <p className="project-card-desc">{project.description}</p>
                ) : (
                  <p className="project-card-desc muted">暂无描述</p>
                )}

                <div className="project-meta">
                  {project.chip ? (
                    <span className="meta-item"><Icon name="chip" size={14}/>{project.chip}</span>
                  ) : null}
                  {project.platform ? (
                    <span className="meta-item"><Icon name="package" size={14}/>{project.platform}</span>
                  ) : null}
                  {project.customer ? (
                    <span className="meta-item"><Icon name="users" size={14}/>{project.customer}</span>
                  ) : null}
                </div>

                <div className="project-stats">
                  <span><strong>{versions.length}</strong> 个版本</span>
                  <span><strong>{records.length}</strong> 条测试</span>
                  {latest ? <span className="muted">最新 {latest.version}</span> : null}
                </div>

                <div className="project-card-foot">
                  <span className={stale ? 'text-warn' : 'muted'}>
                    {lastTest ? '最近测试 ' + formatRelativeDays(lastTest) : '尚未测试'}
                  </span>
                  {isAdmin ? (
                    <div className="project-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => onEdit(project)} className="btn btn-icon btn-secondary" title="编辑项目">
                        <Icon name="edit" size={16}/>
                      </button>
                      <button onClick={() => onDelete(project.id)} className="btn btn-icon btn-danger" title="删除项目">
                        <Icon name="trash" size={16}/>
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
