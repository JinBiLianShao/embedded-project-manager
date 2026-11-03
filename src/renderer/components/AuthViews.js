import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ModalShell } from './Dialog.js';
import { Icon } from './Icon.js';

export function LoginModal({ onLogin, onClose }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const passwordRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => passwordRef.current && passwordRef.current.focus(), 60);
    return () => clearTimeout(timer);
  }, []);

  const submit = useCallback(async () => {
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await onLogin(username.trim(), password);
      if (response.success) onClose();
      else setError(response.error || '登录失败');
    } catch (e) {
      setError(e.message || '登录失败');
    } finally {
      setBusy(false);
    }
  }, [username, password, onLogin, onClose]);

  return (
    <ModalShell
      title="管理员登录"
      onClose={onClose}
      busy={busy}
      maxWidth={420}
      footer={
        <>
          <button onClick={submit} className="btn btn-primary" disabled={busy}>
            {busy ? '登录中…' : '登录'}
          </button>
          <button onClick={onClose} className="btn btn-secondary" disabled={busy}>取消</button>
        </>
      }
    >
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-group">
        <label className="form-label">用户名</label>
        <input
          data-autofocus
          className="form-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="form-group">
        <label className="form-label">密码</label>
        <input
          ref={passwordRef}
          type="password"
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          disabled={busy}
        />
      </div>
      <p className="form-hint">首次使用请用初始管理员账号登录，登录后建议立即修改密码。</p>
    </ModalShell>
  );
}

export function PasswordModal({ onChangePassword, onClose }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(async () => {
    if (newPassword.length < 6) {
      setError('新密码至少 6 位');
      return;
    }
    if (newPassword !== repeat) {
      setError('两次输入的新密码不一致');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await onChangePassword(oldPassword, newPassword);
      if (response.success) onClose();
      else setError(response.error || '修改失败');
    } catch (e) {
      setError(e.message || '修改失败');
    } finally {
      setBusy(false);
    }
  }, [oldPassword, newPassword, repeat, onChangePassword, onClose]);

  return (
    <ModalShell
      title="修改密码"
      onClose={onClose}
      busy={busy}
      maxWidth={440}
      footer={
        <>
          <button onClick={submit} className="btn btn-primary" disabled={busy}>
            {busy ? '提交中…' : '确认修改'}
          </button>
          <button onClick={onClose} className="btn btn-secondary" disabled={busy}>取消</button>
        </>
      }
    >
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-group">
        <label className="form-label">原密码</label>
        <input
          data-autofocus
          type="password"
          className="form-input"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="form-group">
        <label className="form-label">新密码</label>
        <input
          type="password"
          className="form-input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="form-group">
        <label className="form-label">重复新密码</label>
        <input
          type="password"
          className="form-input"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          disabled={busy}
        />
      </div>
    </ModalShell>
  );
}

export function UserForm({ user, onSubmit, onClose }) {
  const [form, setForm] = useState(() => ({
    username: user ? user.username : '',
    password: '',
    role: user ? user.role : 'viewer',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const response = await onSubmit(form);
      if (response.success) onClose();
      else setError(response.error || '保存失败');
    } catch (e) {
      setError(e.message || '保存失败');
    } finally {
      setBusy(false);
    }
  }, [form, onSubmit, onClose]);

  return (
    <ModalShell
      title={user ? '编辑用户' : '新建用户'}
      onClose={onClose}
      busy={busy}
      maxWidth={440}
      footer={
        <>
          <button onClick={submit} className="btn btn-primary" disabled={busy}>
            {busy ? '保存中…' : '保存'}
          </button>
          <button onClick={onClose} className="btn btn-secondary" disabled={busy}>取消</button>
        </>
      }
    >
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-group">
        <label className="form-label">用户名</label>
        <input
          data-autofocus
          className="form-input"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          disabled={busy || !!user}
        />
      </div>
      <div className="form-group">
        <label className="form-label">{user ? '重置密码（留空则不修改）' : '密码'}</label>
        <input
          type="password"
          className="form-input"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          disabled={busy}
        />
      </div>
      <div className="form-group">
        <label className="form-label">角色</label>
        <select
          className="form-select"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          disabled={busy}
        >
          <option value="viewer">只读（可查看，不能修改）</option>
          <option value="admin">管理员（可增删改）</option>
        </select>
      </div>
    </ModalShell>
  );
}

export function UsersView({ users, currentUser, onCreate, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const list = Object.values(users).sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return String(a.username).localeCompare(String(b.username));
  });

  return (
    <div>
      <div className="toolbar">
        <h3 className="font-semibold">用户管理</h3>
        <div className="toolbar-actions">
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16}/>
            <span>新建用户</span>
          </button>
        </div>
      </div>

      <div className="version-list">
        {list.map((user) => (
          <div key={user.username} className="list-item">
            <div className="list-item-header">
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-4">
                  <span className="font-semibold">{user.username}</span>
                  <span className={'badge ' + (user.role === 'admin' ? 'badge-info' : '')}>
                    {user.role === 'admin' ? '管理员' : '只读'}
                  </span>
                  {currentUser && currentUser.username === user.username ? (
                    <span className="badge badge-success">当前登录</span>
                  ) : null}
                </div>
              </div>
              <div className="list-item-actions">
                <button className="btn btn-icon btn-secondary" onClick={() => setEditing(user)} title="编辑用户">
                  <Icon name="edit" size={18}/>
                </button>
                <button
                  className="btn btn-icon btn-danger"
                  onClick={() => onDelete(user.username)}
                  disabled={currentUser && currentUser.username === user.username}
                  title="删除用户"
                >
                  <Icon name="trash" size={18}/>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {creating ? (
        <UserForm
          onSubmit={(form) => onCreate(form)}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {editing ? (
        <UserForm
          user={editing}
          onSubmit={(form) =>
            onUpdate({
              username: editing.username,
              role: form.role,
              password: form.password || undefined,
            })
          }
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
