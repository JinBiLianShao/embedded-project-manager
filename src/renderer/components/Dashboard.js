import React, { memo, useMemo } from 'react';
import { Icon } from './Icon.js';
import { EmptyState } from './EmptyState.js';
import { daysBetween, formatDateShort, formatRelativeDays, todayISO } from '../utils/date.js';

export const Dashboard = memo(function Dashboard({ projects, onOpenProject, onOpenProjectTab }) {
  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status === '进行中').length;
    const done = projects.filter((p) => p.status === '已完成').length;
    let versionCount = 0;
    let testCount = 0;
    let failedCount = 0;
    const recent = [];
    const stale = [];

    for (const project of projects) {
      versionCount += project.versions.length;
      testCount += project.testRecords.length;
      failedCount += project.testRecords.filter((r) => r.result === '失败').length;

      const latest = project.versions[0];
      if (latest) {
        recent.push({ project, version: latest, at: latest.createdAt || latest.buildTime });
      }

      const lastTest = project.testRecords.length
        ? project.testRecords.reduce(
            (acc, r) => (String(r.testDate) > String(acc) ? r.testDate : acc),
            project.testRecords[0].testDate
          )
        : null;
      const since = lastTest ? daysBetween(lastTest, todayISO()) : null;
      if (project.status === '进行中' && (since == null || since > 30)) {
        stale.push({ project, lastTest, since });
      }
    }

    recent.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    stale.sort((a, b) => (b.since == null ? 99999 : b.since) - (a.since == null ? 99999 : a.since));

    return {
      active,
      done,
      versionCount,
      testCount,
      failedCount,
      recent: recent.slice(0, 6),
      stale: stale.slice(0, 6),
    };
  }, [projects]);

  if (projects.length === 0) {
    return (
      <EmptyState
        icon="dashboard"
        title="还没有项目数据"
        hint="新建项目后，这里会显示项目概览、最近版本和待测提醒"
      />
    );
  }

  return (
    <div className="dashboard">
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon"><Icon name="package" size={22}/></div>
          <div>
            <div className="stat-value">{projects.length}</div>
            <div className="stat-label">项目总数</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icon name="clock" size={22}/></div>
          <div>
            <div className="stat-value">{stats.active}</div>
            <div className="stat-label">进行中</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icon name="file" size={22}/></div>
          <div>
            <div className="stat-value">{stats.versionCount}</div>
            <div className="stat-label">版本总数</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icon name="testTube" size={22}/></div>
          <div>
            <div className="stat-value">{stats.testCount}</div>
            <div className="stat-label">测试记录</div>
          </div>
        </div>
      </div>

      <div className="dashboard-columns">
        <div className="card">
          <h4 className="section-title"><Icon name="clock" size={16}/>最近发布的版本</h4>
          {stats.recent.length === 0 ? (
            <p className="muted text-sm">还没有任何版本记录</p>
          ) : (
            <div className="compact-list">
              {stats.recent.map(({ project, version }) => (
                <button
                  key={project.id + '-' + version.id}
                  className="compact-row"
                  onClick={() => onOpenProject(project)}
                >
                  <span className="version-tag version-tag-sm">{version.version}</span>
                  <span className="compact-title truncate">{project.name}</span>
                  <span className="muted text-sm">{formatDateShort(version.buildTime)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h4 className="section-title"><Icon name="alert" size={16}/>待测提醒</h4>
          <p className="text-sm muted" style={{ marginBottom: 12 }}>进行中且超过 30 天没有测试记录的项目</p>
          {stats.stale.length === 0 ? (
            <p className="muted text-sm">所有进行中的项目近期都有测试记录</p>
          ) : (
            <div className="compact-list">
              {stats.stale.map(({ project, lastTest }) => (
                <button
                  key={project.id}
                  className="compact-row"
                  onClick={() => onOpenProjectTab(project, 'tests')}
                >
                  <span className="compact-title truncate">{project.name}</span>
                  <span className="text-warn text-sm">
                    {lastTest ? '上次 ' + formatRelativeDays(lastTest) : '从未测试'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {stats.failedCount > 0 ? (
        <div className="card warn-card">
          <Icon name="alert" size={18}/>
          <span>共有 <strong>{stats.failedCount}</strong> 条结果为「失败」的测试记录，建议优先跟进。</span>
        </div>
      ) : null}
    </div>
  );
});
