import React, { memo } from 'react';
import { Icon } from './Icon.js';

export const Sidebar = memo(function Sidebar({
  view,
  onNavigate,
  user,
  isLoggedIn,
  onLoginClick,
  onLogout,
  onImport,
  onExport,
  onPasswordClick,
  projectCount,
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>项目管理系统</h1>
        <p className="sidebar-sub">嵌入式开发</p>
      </div>

      <nav className="sidebar-nav">
        <button
          onClick={() => onNavigate('dashboard')}
          className={'nav-button ' + (view === 'dashboard' ? 'active' : '')}
        >
          <Icon name="dashboard" size={18}/>
          <span>概览</span>
        </button>
        <button
          onClick={() => onNavigate('projects')}
          className={'nav-button ' + (view === 'projects' ? 'active' : '')}
        >
          <Icon name="package" size={18}/>
          <span>项目列表</span>
          {projectCount > 0 ? <span className="nav-count">{projectCount}</span> : null}
        </button>
        {isLoggedIn && user && user.role === 'admin' ? (
          <button
            onClick={() => onNavigate('users')}
            className={'nav-button ' + (view === 'users' ? 'active' : '')}
          >
            <Icon name="users" size={18}/>
            <span>用户管理</span>
          </button>
        ) : null}
      </nav>

      <div className="sidebar-footer">
        <button onClick={onImport} className="nav-button" disabled={!isLoggedIn}>
          <Icon name="upload" size={18}/>
          <span>导入备份</span>
        </button>
        <button onClick={() => onExport('json')} className="nav-button">
          <Icon name="download" size={18}/>
          <span>导出备份</span>
        </button>
        <button onClick={() => onExport('csv')} className="nav-button">
          <Icon name="fileText" size={18}/>
          <span>导出 CSV</span>
        </button>

        {isLoggedIn && user ? (
          <div className="user-box">
            <div className="user-line">
              <Icon name="unlock" size={16}/>
              <span className="truncate">{user.username}</span>
              <span className="badge badge-info">{user.role === 'admin' ? '管理员' : '只读'}</span>
            </div>
            <div className="user-actions">
              <button onClick={onPasswordClick} className="btn btn-secondary btn-sm">
                <Icon name="key" size={14}/>
                <span>改密</span>
              </button>
              <button onClick={onLogout} className="btn btn-secondary btn-sm">
                <Icon name="lock" size={14}/>
                <span>退出</span>
              </button>
            </div>
          </div>
        ) : (
          <button onClick={onLoginClick} className="nav-button nav-button-accent">
            <Icon name="lock" size={18}/>
            <span>管理员登录</span>
          </button>
        )}
      </div>
    </div>
  );
});
