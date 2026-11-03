import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from './components/Icon.js';
import { Sidebar } from './components/Sidebar.js';
import { Dashboard } from './components/Dashboard.js';
import { ProjectList } from './components/ProjectList.js';
import { ProjectDetail } from './components/ProjectDetail.js';
import { ProjectForm, VersionForm, TestRecordForm } from './components/Forms.js';
import { LoginModal, PasswordModal, UsersView } from './components/AuthViews.js';
import { ConfirmDialog, Toast } from './components/Dialog.js';
import { useConfirm } from './hooks/useConfirm.js';
import { useAppData } from './hooks/useAppData.js';
import { todayISO, toISODate } from './utils/date.js';

export default function App() {
  const { confirmState, confirm, resolveWith } = useConfirm();
  const store = useAppData(confirm);

  const [view, setView] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [tab, setTab] = useState('versions');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [modal, setModal] = useState(null);

  const selectedProject = useMemo(
    () => store.projects.find((p) => p.id === selectedProjectId) || null,
    [store.projects, selectedProjectId]
  );

  // 项目被删除后自动退回列表，避免详情页停在空白
  useEffect(() => {
    if (selectedProjectId != null && !selectedProject && view === 'project') {
      setView('projects');
      setSelectedProjectId(null);
    }
  }, [selectedProjectId, selectedProject, view]);

  const navigate = useCallback((next) => {
    setView(next);
    if (next !== 'project') setSelectedProjectId(null);
  }, []);

  const openProject = useCallback((project, targetTab) => {
    setSelectedProjectId(project.id);
    setTab(targetTab || 'versions');
    setView('project');
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  if (store.loading) {
    return (
      <div className="app-container">
        <div className="main-content center-fill">
          <div className="spinner"/>
          <p className="muted">加载中…</p>
        </div>
      </div>
    );
  }

  if (store.fatalError) {
    return (
      <div className="app-container">
        <div className="main-content center-fill">
          <div className="error-state">
            <Icon name="alert" size={40}/>
            <p className="form-error">{store.fatalError}</p>
            <button onClick={store.reload} className="btn btn-primary mt-4">重试</button>
          </div>
        </div>
      </div>
    );
  }

  const loggedIn = !!store.user;

  return (
    <div className="app-container">
      <Sidebar
        view={view}
        onNavigate={navigate}
        user={store.user}
        isLoggedIn={loggedIn}
        projectCount={store.projects.length}
        onLoginClick={() => setModal({ type: 'login' })}
        onLogout={store.logout}
        onPasswordClick={() => setModal({ type: 'password' })}
        onImport={store.importData}
        onExport={store.exportData}
      />

      <div className="main-content">
        <div className="header">
          <div className="flex items-center gap-4">
            {view === 'project' ? (
              <button onClick={() => navigate('projects')} className="btn btn-icon btn-secondary" aria-label="返回">
                <Icon name="chevronLeft" size={22}/>
              </button>
            ) : null}
            <h2>
              {view === 'dashboard' ? '概览' : null}
              {view === 'projects' ? '项目管理' : null}
              {view === 'users' ? '用户管理' : null}
              {view === 'project' && selectedProject ? selectedProject.name : null}
            </h2>
          </div>
          {loggedIn ? (
            <span className="text-sm text-gray-500">
              {store.user.role === 'admin' ? '管理员' : '只读用户'}：{store.user.username}
            </span>
          ) : (
            <span className="text-sm muted">只读模式（未登录）</span>
          )}
        </div>

        {store.recoveryNotice ? (
          <div className="banner banner-warn">
            <Icon name="alert" size={18}/>
            <span>
              检测到数据文件损坏，
              {store.recoveryNotice.recovered ? '已从最近的自动备份恢复。' : '已重置为空数据，原文件已另存到备份目录。'}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={store.dismissRecoveryNotice}>知道了</button>
          </div>
        ) : null}

        <div className="content-area">
          {view === 'dashboard' ? (
            <Dashboard
              projects={store.projects}
              onOpenProject={(project) => openProject(project)}
              onOpenProjectTab={openProject}
            />
          ) : null}

          {view === 'projects' ? (
            <ProjectList
              projects={store.projects}
              isAdmin={store.isAdmin}
              isLoggedIn={loggedIn}
              onSelect={(project) => openProject(project)}
              onAdd={() => setModal({ type: 'add-project' })}
              onEdit={(project) => setModal({ type: 'edit-project', project })}
              onDelete={store.deleteProject}
            />
          ) : null}

          {view === 'users' && store.isAdmin ? (
            <UsersView
              users={store.users}
              currentUser={store.user}
              onCreate={store.createUser}
              onUpdate={store.updateUser}
              onDelete={store.deleteUser}
            />
          ) : null}

          {view === 'project' && selectedProject ? (
            <ProjectDetail
              project={selectedProject}
              selectedTab={tab}
              onTabChange={setTab}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              isAdmin={store.isAdmin}
              isLoggedIn={loggedIn}
              onEditProject={(project) => setModal({ type: 'edit-project', project })}
              onAddVersion={() => setModal({ type: 'add-version' })}
              onEditVersion={(version) => setModal({ type: 'edit-version', version })}
              onDeleteVersion={(versionId) => store.deleteVersion(selectedProject.id, versionId)}
              onAddTestRecord={() => setModal({ type: 'add-test-record' })}
              onEditTestRecord={(record) => setModal({ type: 'edit-test-record', record })}
              onDeleteTestRecord={(recordId) => store.deleteTestRecord(selectedProject.id, recordId)}
              onUpsertDevices={store.upsertDevices}
              onRemoveDevices={store.removeDevices}
              onAddDeviceRecord={store.addDeviceTestRecord}
              onUpsertBatches={store.upsertBatches}
              onUpsertIssues={store.upsertIssues}
              onRemoveIssue={store.removeIssue}
            />
          ) : null}
        </div>
      </div>

      {modal && modal.type === 'login' ? (
        <LoginModal onLogin={store.login} onClose={closeModal}/>
      ) : null}

      {modal && modal.type === 'password' ? (
        <PasswordModal onChangePassword={store.changePassword} onClose={closeModal}/>
      ) : null}

      {modal && modal.type === 'add-project' ? (
        <ProjectForm onSubmit={store.addProject} onClose={closeModal}/>
      ) : null}

      {modal && modal.type === 'edit-project' ? (
        <ProjectForm
          project={modal.project}
          onSubmit={(form) => store.updateProject(modal.project.id, form)}
          onClose={closeModal}
        />
      ) : null}

      {modal && modal.type === 'add-version' && selectedProject ? (
        <VersionForm
          project={selectedProject}
          versionExists={store.versionExists}
          onSubmit={(form) => store.addVersion(selectedProject.id, form)}
          onClose={closeModal}
        />
      ) : null}

      {modal && modal.type === 'edit-version' && selectedProject ? (
        <VersionForm
          project={selectedProject}
          version={modal.version}
          versionExists={store.versionExists}
          onSubmit={(form) => store.updateVersion(selectedProject.id, modal.version.id, form)}
          onClose={closeModal}
        />
      ) : null}

      {modal && modal.type === 'add-test-record' && selectedProject ? (
        <TestRecordForm
          project={selectedProject}
          defaultDate={toISODate(selectedDate) || todayISO()}
          onSubmit={(form) => store.addTestRecord(selectedProject.id, form)}
          onClose={closeModal}
        />
      ) : null}

      {modal && modal.type === 'edit-test-record' && selectedProject ? (
        <TestRecordForm
          project={selectedProject}
          record={modal.record}
          onSubmit={(form) => store.updateTestRecord(selectedProject.id, modal.record.id, form)}
          onClose={closeModal}
        />
      ) : null}

      <ConfirmDialog state={confirmState} onResolve={resolveWith}/>
      <Toast toast={store.toast}/>
    </div>
  );
}
