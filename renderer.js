const { useState, useEffect } = React;

// SVG 图标组件
const Icon = ({ name, size = 20 }) => {
  const icons = {
    package: <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>,
    upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>,
    download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>,
    lock: <path d="M19 11h-1V7a6 6 0 1 0-12 0v4H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM8.5 7a3.5 3.5 0 1 1 7 0v4h-7V7z"/>,
    unlock: <path d="M7 11V7a5 5 0 0 1 9.9-1M19 11h-1V7a6 6 0 1 0-12 0v4H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>,
    trash: <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>,
    save: <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>,
    x: <path d="M18 6L6 18M6 6l12 12"/>,
    chevronLeft: <path d="M15 18l-6-6 6-6"/>,
    file: <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>,
    testTube: <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2"/>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// 主应用组件
const App = () => {
  const [data, setData] = useState({
    projects: [],
    users: { admin: { username: 'admin', passwordHash: 'admin123', role: 'admin' } },
    settings: { currentUser: null }
  });
  const [currentView, setCurrentView] = useState('projects');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTab, setSelectedTab] = useState('versions');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const loadedData = await window.electronAPI.loadData();
    setData(loadedData);
    setIsLoggedIn(!!loadedData.settings.currentUser);
  };

  const saveData = async (newData) => {
    const result = await window.electronAPI.saveData(newData);
    if (result.success) {
      setData(newData);
    } else {
      alert('保存失败：' + result.error);
    }
  };

  const handleLogin = (username, password) => {
    const user = data.users[username];
    if (user && user.passwordHash === password) {
      const newData = { ...data, settings: { currentUser: username } };
      saveData(newData);
      setIsLoggedIn(true);
      setShowLoginModal(false);
    } else {
      alert('用户名或密码错误');
    }
  };

  const handleLogout = () => {
    const newData = { ...data, settings: { currentUser: null } };
    saveData(newData);
    setIsLoggedIn(false);
    setSelectedProject(null);
    setCurrentView('projects');
  };

  const addProject = (project) => {
    const newProject = {
      id: Date.now(),
      ...project,
      versions: [],
      testRecords: [],
      createdAt: new Date().toISOString()
    };
    const newData = { ...data, projects: [...data.projects, newProject] };
    saveData(newData);
    setShowModal(false);
  };

  const updateProject = (projectId, updates) => {
    const newData = {
      ...data,
      projects: data.projects.map(p => p.id === projectId ? { ...p, ...updates } : p)
    };
    saveData(newData);
    if (selectedProject && selectedProject.id === projectId) {
      setSelectedProject({ ...selectedProject, ...updates });
    }
    setShowModal(false);
  };

  const deleteProject = (projectId) => {
    if (!isLoggedIn) {
      alert('需要管理员权限');
      return;
    }
    if (confirm('确定要删除这个项目吗？')) {
      const newData = { ...data, projects: data.projects.filter(p => p.id !== projectId) };
      saveData(newData);
      if (selectedProject && selectedProject.id === projectId) {
        setSelectedProject(null);
        setCurrentView('projects');
      }
    }
  };

  const addVersion = (version) => {
    const newData = {
      ...data,
      projects: data.projects.map(p => {
        if (p.id === selectedProject.id) {
          return { ...p, versions: [...p.versions, { id: Date.now(), ...version }] };
        }
        return p;
      })
    };
    saveData(newData);
    const updatedProject = newData.projects.find(p => p.id === selectedProject.id);
    setSelectedProject(updatedProject);
    setShowModal(false);
  };

  const updateVersion = (versionId, updates) => {
    const newData = {
      ...data,
      projects: data.projects.map(p => {
        if (p.id === selectedProject.id) {
          return { ...p, versions: p.versions.map(v => v.id === versionId ? { ...v, ...updates } : v) };
        }
        return p;
      })
    };
    saveData(newData);
    const updatedProject = newData.projects.find(p => p.id === selectedProject.id);
    setSelectedProject(updatedProject);
    setShowModal(false);
  };

  const deleteVersion = (versionId) => {
    if (!isLoggedIn) {
      alert('需要管理员权限');
      return;
    }
    if (confirm('确定要删除这个版本吗？')) {
      const newData = {
        ...data,
        projects: data.projects.map(p => {
          if (p.id === selectedProject.id) {
            return { ...p, versions: p.versions.filter(v => v.id !== versionId) };
          }
          return p;
        })
      };
      saveData(newData);
      const updatedProject = newData.projects.find(p => p.id === selectedProject.id);
      setSelectedProject(updatedProject);
    }
  };

  const addTestRecord = (record) => {
    const newData = {
      ...data,
      projects: data.projects.map(p => {
        if (p.id === selectedProject.id) {
          return { ...p, testRecords: [...p.testRecords, { id: Date.now(), ...record }] };
        }
        return p;
      })
    };
    saveData(newData);
    const updatedProject = newData.projects.find(p => p.id === selectedProject.id);
    setSelectedProject(updatedProject);
    setShowModal(false);
  };

  const deleteTestRecord = (recordId) => {
    if (!isLoggedIn) {
      alert('需要管理员权限');
      return;
    }
    if (confirm('确定要删除这条测试记录吗？')) {
      const newData = {
        ...data,
        projects: data.projects.map(p => {
          if (p.id === selectedProject.id) {
            return { ...p, testRecords: p.testRecords.filter(r => r.id !== recordId) };
          }
          return p;
        })
      };
      saveData(newData);
      const updatedProject = newData.projects.find(p => p.id === selectedProject.id);
      setSelectedProject(updatedProject);
    }
  };

  const exportData = async (format) => {
    let content = '';
    if (format === 'json') {
      const result = await window.electronAPI.exportData(data, 'json');
      if (result.success) {
        alert('导出成功');
      }
    } else if (format === 'csv' && selectedProject) {
      const headers = 'Version,Build Time,MD5,Changelog\n';
      const rows = selectedProject.versions.map(v => 
        `"${v.version}","${v.buildTime}","${v.md5}","${v.changelog || ''}"`
      ).join('\n');
      content = headers + rows;
      const result = await window.electronAPI.exportData(content, 'csv');
      if (result.success) {
        alert('导出成功');
      }
    }
  };

  const importData = async () => {
    if (!confirm('导入数据将覆盖现有数据，确定继续吗？')) {
      return;
    }
    const result = await window.electronAPI.importData();
    if (result.success && result.data) {
      saveData(result.data);
      alert('导入成功');
    } else if (!result.canceled) {
      alert('导入失败：' + (result.error || '未知错误'));
    }
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>项目管理系统</h1>
        </div>
        
        <nav className="sidebar-nav">
          <button
            onClick={() => {
              setCurrentView('projects');
              setSelectedProject(null);
            }}
            className={`nav-button ${currentView === 'projects' ? 'active' : ''}`}
          >
            <Icon name="package" />
            <span>项目列表</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button onClick={importData} className="nav-button">
            <Icon name="upload" />
            <span>导入备份</span>
          </button>
          
          <button onClick={() => exportData('json')} className="nav-button">
            <Icon name="download" />
            <span>导出备份</span>
          </button>
          
          <button
            onClick={() => isLoggedIn ? handleLogout() : setShowLoginModal(true)}
            className="nav-button"
          >
            <Icon name={isLoggedIn ? 'unlock' : 'lock'} />
            <span>{isLoggedIn ? '退出登录' : '管理员登录'}</span>
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="header">
          <div className="flex items-center gap-4">
            {selectedProject && (
              <button
                onClick={() => {
                  setSelectedProject(null);
                  setCurrentView('projects');
                }}
                className="btn btn-icon btn-secondary"
              >
                <Icon name="chevronLeft" size={24} />
              </button>
            )}
            <h2>{selectedProject ? selectedProject.name : '项目管理'}</h2>
          </div>
          {isLoggedIn && (
            <span className="text-sm text-gray-500">
              管理员：{data.settings.currentUser}
            </span>
          )}
        </div>

        <div className="content-area">
          {currentView === 'projects' && !selectedProject && (
            <ProjectList
              projects={data.projects}
              onSelect={(project) => {
                setSelectedProject(project);
                setCurrentView('project-detail');
              }}
              onAdd={() => {
                setModalType('add-project');
                setEditingItem(null);
                setShowModal(true);
              }}
              onEdit={(project) => {
                setModalType('edit-project');
                setEditingItem(project);
                setShowModal(true);
              }}
              onDelete={deleteProject}
              isLoggedIn={isLoggedIn}
            />
          )}

          {currentView === 'project-detail' && selectedProject && (
            <ProjectDetail
              project={selectedProject}
              selectedTab={selectedTab}
              onTabChange={setSelectedTab}
              onAddVersion={() => {
                setModalType('add-version');
                setEditingItem(null);
                setShowModal(true);
              }}
              onEditVersion={(version) => {
                setModalType('edit-version');
                setEditingItem(version);
                setShowModal(true);
              }}
              onDeleteVersion={deleteVersion}
              onAddTestRecord={() => {
                setModalType('add-test-record');
                setEditingItem(null);
                setShowModal(true);
              }}
              onDeleteTestRecord={deleteTestRecord}
              onExportCSV={() => exportData('csv')}
              isLoggedIn={isLoggedIn}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
          )}
        </div>
      </div>

      {showLoginModal && (
        <LoginModal onLogin={handleLogin} onClose={() => setShowLoginModal(false)} />
      )}

      {showModal && (
        <Modal
          type={modalType}
          item={editingItem}
          onSave={(data) => {
            if (modalType === 'add-project') addProject(data);
            else if (modalType === 'edit-project') updateProject(editingItem.id, data);
            else if (modalType === 'add-version') addVersion(data);
            else if (modalType === 'edit-version') updateVersion(editingItem.id, data);
            else if (modalType === 'add-test-record') addTestRecord(data);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

// 项目列表组件
const ProjectList = ({ projects, onSelect, onAdd, onEdit, onDelete, isLoggedIn }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">所有项目</h3>
        <button onClick={onAdd} className="btn btn-primary">
          <Icon name="plus" />
          <span>新建项目</span>
        </button>
      </div>

      <div className="card-grid">
        {projects.map(project => (
          <div key={project.id} className="card" style={{ cursor: 'pointer' }}>
            <div onClick={() => onSelect(project)}>
              <h4 className="text-lg font-semibold mb-2">{project.name}</h4>
              <p className="text-sm text-gray-600 mb-4">{project.description}</p>
              <div className="text-sm text-gray-500">
                <div>版本数: {project.versions?.length || 0}</div>
                <div>测试记录: {project.testRecords?.length || 0}</div>
                <div>创建时间: {new Date(project.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
            {isLoggedIn && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(project);
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  <Icon name="edit" size={16} />
                  <span>编辑</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project.id);
                  }}
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                >
                  <Icon name="trash" size={16} />
                  <span>删除</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="empty-state">
          <Icon name="package" size={48} />
          <p>还没有项目，点击"新建项目"开始</p>
        </div>
      )}
    </div>
  );
};

// 项目详情组件
const ProjectDetail = ({
  project, selectedTab, onTabChange, onAddVersion, onEditVersion, onDeleteVersion,
  onAddTestRecord, onDeleteTestRecord, onExportCSV, isLoggedIn, selectedDate, onDateChange
}) => {
  return (
    <div>
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">项目信息</h3>
        <p className="text-gray-600">{project.description}</p>
      </div>

      <div className="card">
        <div className="tabs">
          <button
            onClick={() => onTabChange('versions')}
            className={`tab ${selectedTab === 'versions' ? 'active' : ''}`}
          >
            版本管理
          </button>
          <button
            onClick={() => onTabChange('tests')}
            className={`tab ${selectedTab === 'tests' ? 'active' : ''}`}
          >
            测试记录
          </button>
        </div>

        {selectedTab === 'versions' && (
          <VersionsTab
            versions={project.versions || []}
            onAdd={onAddVersion}
            onEdit={onEditVersion}
            onDelete={onDeleteVersion}
            onExport={onExportCSV}
            isLoggedIn={isLoggedIn}
          />
        )}
        {selectedTab === 'tests' && (
          <TestRecordsTab
            records={project.testRecords || []}
            onAdd={onAddTestRecord}
            onDelete={onDeleteTestRecord}
            isLoggedIn={isLoggedIn}
            selectedDate={selectedDate}
            onDateChange={onDateChange}
          />
        )}
      </div>
    </div>
  );
};

// 版本管理标签页
const VersionsTab = ({ versions, onAdd, onEdit, onDelete, onExport, isLoggedIn }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold">版本列表</h4>
        <div className="flex gap-2">
          <button onClick={onExport} className="btn btn-success">
            <Icon name="download" />
            <span>导出CSV</span>
          </button>
          <button onClick={onAdd} className="btn btn-primary">
            <Icon name="plus" />
            <span>新增版本</span>
          </button>
        </div>
      </div>

      {versions.map(version => (
        <div key={version.id} className="list-item">
          <div className="list-item-header">
            <div style={{ flex: 1 }}>
              <div className="flex items-center gap-4 mb-2">
                <span className="font-semibold text-lg">{version.version}</span>
                <span className="text-sm text-gray-500">{version.buildTime}</span>
              </div>
              <div className="text-sm text-gray-600 mb-1">
                <strong>MD5:</strong> <code>{version.md5}</code>
              </div>
              {version.changelog && (
                <div className="text-sm text-gray-600">
                  <strong>变更说明:</strong> {version.changelog}
                </div>
              )}
            </div>
            {isLoggedIn && (
              <div className="list-item-actions">
                <button onClick={() => onEdit(version)} className="btn btn-icon btn-secondary">
                  <Icon name="edit" size={18} />
                </button>
                <button onClick={() => onDelete(version.id)} className="btn btn-icon btn-danger">
                  <Icon name="trash" size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {versions.length === 0 && (
        <div className="empty-state">
          <Icon name="file" size={48} />
          <p>还没有版本记录</p>
        </div>
      )}
    </div>
  );
};

// 测试记录标签页
const TestRecordsTab = ({ records, onAdd, onDelete, isLoggedIn, selectedDate, onDateChange }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    return { daysInMonth, startDayOfWeek, year, month };
  };

  const { daysInMonth, startDayOfWeek, year, month } = getDaysInMonth(currentMonth);

  const getRecordsForDate = (date) => {
    return records.filter(record => {
      const recordDate = new Date(record.testDate);
      return recordDate.toDateString() === date.toDateString();
    });
  };

  const selectedDateRecords = getRecordsForDate(selectedDate);

  const changeMonth = (offset) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold">测试记录日历</h4>
        <button onClick={onAdd} className="btn btn-primary">
          <Icon name="plus" />
          <span>新增测试记录</span>
        </button>
      </div>

      <div className="calendar mb-6">
        <div className="calendar-header">
          <button onClick={() => changeMonth(-1)} className="btn btn-secondary">←</button>
          <h5 className="font-semibold">{year}年{month + 1}月</h5>
          <button onClick={() => changeMonth(1)} className="btn btn-secondary">→</button>
        </div>

        <div className="calendar-grid">
          {['日', '一', '二', '三', '四', '五', '六'].map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="calendar-day" style={{ visibility: 'hidden' }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = new Date(year, month, day);
            const dayRecords = getRecordsForDate(date);
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={day}
                onClick={() => onDateChange(date)}
                className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
              >
                <div className="calendar-day-number">{day}</div>
                {dayRecords.length > 0 && (
                  <div>
                    {dayRecords.slice(0, 2).map((record, idx) => (
                      <div
                        key={idx}
                        className={`calendar-event ${record.result === '通过' ? 'pass' : 'fail'}`}
                      >
                        {record.tester}
                      </div>
                    ))}
                    {dayRecords.length > 2 && (
                      <div className="text-sm text-gray-500">+{dayRecords.length - 2}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h5 className="font-semibold mb-4">
          {selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} 的测试记录
        </h5>
        {selectedDateRecords.map(record => (
          <div key={record.id} className="list-item">
            <div className="list-item-header">
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-4 mb-2">
                  <span className="font-semibold">{record.tester}</span>
                  <span className={`badge ${record.result === '通过' ? 'badge-success' : 'badge-danger'}`}>
                    {record.result}
                  </span>
                </div>
                {record.notes && <p className="text-sm text-gray-600">{record.notes}</p>}
              </div>
              {isLoggedIn && (
                <button onClick={() => onDelete(record.id)} className="btn btn-icon btn-danger">
                  <Icon name="trash" size={18} />
                </button>
              )}
            </div>
          </div>
        ))}

        {selectedDateRecords.length === 0 && (
          <div className="empty-state">
            <Icon name="testTube" size={48} />
            <p>该日期没有测试记录</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 登录模态框
const LoginModal = ({ onLogin, onClose }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    onLogin(username, password);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">管理员登录</h3>
          <button onClick={onClose} className="btn btn-icon btn-secondary">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="form-input"
            placeholder="admin"
          />
        </div>

        <div className="form-group">
          <label className="form-label">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
            className="form-input"
            placeholder="admin123"
          />
        </div>

        <div className="modal-footer">
          <button onClick={handleSubmit} className="btn btn-primary">
            登录
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            取消
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          默认账号: admin / admin123
        </p>
      </div>
    </div>
  );
};

// 通用模态框
const Modal = ({ type, item, onSave, onClose }) => {
  const [formData, setFormData] = useState(() => {
    if (type === 'add-project' || type === 'edit-project') {
      return { name: item?.name || '', description: item?.description || '' };
    } else if (type === 'add-version' || type === 'edit-version') {
      return {
        version: item?.version || '',
        buildTime: item?.buildTime || new Date().toISOString().split('T')[0],
        md5: item?.md5 || '',
        changelog: item?.changelog || ''
      };
    } else if (type === 'add-test-record') {
      return {
        testDate: new Date().toISOString().split('T')[0],
        tester: '',
        result: '通过',
        notes: ''
      };
    }
    return {};
  });

  const handleSubmit = () => {
    onSave(formData);
  };

  const getTitle = () => {
    if (type === 'add-project') return '新建项目';
    if (type === 'edit-project') return '编辑项目';
    if (type === 'add-version') return '新增版本';
    if (type === 'edit-version') return '编辑版本';
    if (type === 'add-test-record') return '新增测试记录';
    return '';
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{getTitle()}</h3>
          <button onClick={onClose} className="btn btn-icon btn-secondary">
            <Icon name="x" size={20} />
          </button>
        </div>

        {(type === 'add-project' || type === 'edit-project') && (
          <>
            <div className="form-group">
              <label className="form-label">项目名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">项目描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-textarea"
              />
            </div>
          </>
        )}

        {(type === 'add-version' || type === 'edit-version') && (
          <>
            <div className="form-group">
              <label className="form-label">版本号</label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className="form-input"
                placeholder="v1.0.0"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">生成时间</label>
              <input
                type="date"
                value={formData.buildTime}
                onChange={(e) => setFormData({ ...formData, buildTime: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">MD5 校验值</label>
              <input
                type="text"
                value={formData.md5}
                onChange={(e) => setFormData({ ...formData, md5: e.target.value })}
                className="form-input"
                placeholder="32位MD5值"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">变更说明</label>
              <textarea
                value={formData.changelog}
                onChange={(e) => setFormData({ ...formData, changelog: e.target.value })}
                className="form-textarea"
                placeholder="描述本版本的主要变更内容"
              />
            </div>
          </>
        )}

        {type === 'add-test-record' && (
          <>
            <div className="form-group">
              <label className="form-label">测试日期</label>
              <input
                type="date"
                value={formData.testDate}
                onChange={(e) => setFormData({ ...formData, testDate: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">测试人员</label>
              <input
                type="text"
                value={formData.tester}
                onChange={(e) => setFormData({ ...formData, tester: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">测试结果</label>
              <select
                value={formData.result}
                onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                className="form-select"
              >
                <option value="通过">通过</option>
                <option value="失败">失败</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">备注说明</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="form-textarea"
                placeholder="测试详情、发现的问题等"
              />
            </div>
          </>
        )}

        <div className="modal-footer">
          <button onClick={handleSubmit} className="btn btn-primary">
            <Icon name="save" />
            <span>保存</span>
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

// 渲染应用
ReactDOM.render(<App />, document.getElementById('root'));