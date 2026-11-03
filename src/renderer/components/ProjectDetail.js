import React, { memo, useState } from 'react';
import { Icon } from './Icon.js';
import { VersionsTab } from './VersionsTab.js';
import { TestRecordsTab } from './TestRecordsTab.js';
import { CompareModal } from './CompareModal.js';
import { formatDateShort } from '../utils/date.js';

const TABS = [
  { key: 'versions', label: '版本管理', icon: 'file' },
  { key: 'tests', label: '测试记录', icon: 'testTube' },
  { key: 'info', label: '项目信息', icon: 'package' },
];

export const ProjectDetail = memo(function ProjectDetail({
  project,
  selectedTab,
  onTabChange,
  selectedDate,
  onDateChange,
  isAdmin,
  isLoggedIn,
  onEditProject,
  onAddVersion,
  onEditVersion,
  onDeleteVersion,
  onAddTestRecord,
  onEditTestRecord,
  onDeleteTestRecord,
}) {
  const [comparing, setComparing] = useState(null);

  return (
    <div>
      <div className="detail-header card">
        <div>
          <div className="flex items-center gap-4">
            <h3 className="detail-title">{project.name}</h3>
            <span className="badge badge-info">{project.status}</span>
          </div>
          <div className="project-meta" style={{ marginTop: 8 }}>
            {project.chip ? <span className="meta-item"><Icon name="chip" size={14}/>{project.chip}</span> : null}
            {project.platform ? <span className="meta-item"><Icon name="package" size={14}/>{project.platform}</span> : null}
            {project.customer ? <span className="meta-item"><Icon name="users" size={14}/>{project.customer}</span> : null}
            <span className="meta-item"><Icon name="clock" size={14}/>创建于 {formatDateShort(project.createdAt)}</span>
          </div>
        </div>
        {isAdmin ? (
          <button className="btn btn-secondary" onClick={() => onEditProject(project)}>
            <Icon name="edit" size={16}/>
            <span>编辑项目</span>
          </button>
        ) : null}
      </div>

      <div className="card">
        <div className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={'tab ' + (selectedTab === tab.key ? 'active' : '')}
            >
              <Icon name={tab.icon} size={16}/>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {selectedTab === 'versions' ? (
          <VersionsTab
            project={project}
            onAdd={onAddVersion}
            onEdit={onEditVersion}
            onDelete={onDeleteVersion}
            onCompare={setComparing}
            isAdmin={isAdmin}
            isLoggedIn={isLoggedIn}
          />
        ) : null}

        {selectedTab === 'tests' ? (
          <TestRecordsTab
            project={project}
            onAdd={onAddTestRecord}
            onEdit={onEditTestRecord}
            onDelete={onDeleteTestRecord}
            isAdmin={isAdmin}
            isLoggedIn={isLoggedIn}
            selectedDate={selectedDate}
            onDateChange={onDateChange}
          />
        ) : null}

        {selectedTab === 'info' ? (
          <div className="info-grid">
            <div className="info-row"><span>项目名称</span><strong>{project.name}</strong></div>
            <div className="info-row"><span>项目状态</span><strong>{project.status}</strong></div>
            <div className="info-row"><span>芯片型号</span><strong>{project.chip || '—'}</strong></div>
            <div className="info-row"><span>平台/框架</span><strong>{project.platform || '—'}</strong></div>
            <div className="info-row"><span>客户</span><strong>{project.customer || '—'}</strong></div>
            <div className="info-row"><span>创建时间</span><strong>{formatDateShort(project.createdAt)}</strong></div>
            <div className="info-row"><span>最后更新</span><strong>{formatDateShort(project.updatedAt)}</strong></div>
            <div className="info-row"><span>版本数量</span><strong>{project.versions.length}</strong></div>
            <div className="info-row"><span>测试记录</span><strong>{project.testRecords.length}</strong></div>
            <div className="info-row info-row-full">
              <span>项目描述</span>
              <p>{project.description || '暂无描述'}</p>
            </div>
          </div>
        ) : null}
      </div>

      {comparing ? <CompareModal versions={comparing} onClose={() => setComparing(null)}/> : null}
    </div>
  );
});
