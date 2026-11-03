import React, { memo, useCallback, useMemo, useState } from 'react';
import { Icon } from './Icon.js';
import { EmptyState } from './EmptyState.js';
import { ModalShell } from './Dialog.js';
import { formatDateShort } from '../utils/date.js';

export const SEVERITIES = ['致命', '严重', '一般', '轻微'];
export const ISSUE_STATUSES = ['打开', '处理中', '已解决', '已关闭', '不修复'];

function severityBadge(s) {
  if (s === '致命') return 'badge badge-danger';
  if (s === '严重') return 'badge badge-warn';
  return 'badge';
}
function issueStatusBadge(s) {
  if (s === '已解决' || s === '已关闭') return 'badge badge-success';
  if (s === '处理中') return 'badge badge-info';
  if (s === '不修复') return 'badge';
  return 'badge badge-danger';
}

export function IssueForm({ issue, project, onSubmit, onClose }) {
  const [form, setForm] = useState(() => ({
    scope: issue ? issue.scope : 'device',
    batchId: issue ? issue.batchId : null,
    deviceIds: issue ? issue.deviceIds : [],
    severity: issue ? issue.severity : '一般',
    status: issue ? issue.status : '打开',
    title: issue ? issue.title : '',
    description: issue ? issue.description : '',
    resolution: issue ? issue.resolution : '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const batches = project.batches || [];
  const devices = project.devices || [];

  const toggleDevice = (id) => {
    setForm((prev) => ({
      ...prev,
      deviceIds: prev.deviceIds.includes(id) ? prev.deviceIds.filter((x) => x !== id) : [...prev.deviceIds, id],
    }));
  };

  const submit = useCallback(async () => {
    if (!form.title.trim()) { setError('请填写问题标题'); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await onSubmit({
        id: issue ? issue.id : Date.now() + Math.floor(Math.random() * 1000),
        scope: form.scope,
        batchId: form.scope === 'batch' ? form.batchId : null,
        deviceIds: form.scope === 'device' ? form.deviceIds : [],
        severity: form.severity,
        status: form.status,
        title: form.title.trim(),
        description: form.description,
        resolution: form.resolution,
        createdAt: issue ? issue.createdAt : now,
        resolvedAt: form.status === '已解决' || form.status === '已关闭' ? (issue && issue.resolvedAt) || now : '',
      });
      onClose();
    } catch (e) { setError(e.message || '保存失败'); } finally { setBusy(false); }
  }, [form, issue, onSubmit, onClose]);

  return (
    <ModalShell title={issue ? '编辑问题单' : '新建问题单'} onClose={onClose} busy={busy} maxWidth={620}
      footer={
        <>
          <button onClick={submit} className="btn btn-primary" disabled={busy}>{busy ? '保存中…' : '保存'}</button>
          <button onClick={onClose} className="btn btn-secondary" disabled={busy}>取消</button>
        </>
      }>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-group">
        <label className="form-label">影响范围</label>
        <div className="radio-row">
          <label className="radio-item">
            <input type="radio" checked={form.scope === 'device'} onChange={() => setForm({ ...form, scope: 'device' })} disabled={busy}/>
            <span>单机问题（个别设备）</span>
          </label>
          <label className="radio-item">
            <input type="radio" checked={form.scope === 'batch'} onChange={() => setForm({ ...form, scope: 'batch' })} disabled={busy}/>
            <span>批次性问题（整批受影响）</span>
          </label>
        </div>
        <p className="form-hint">批次性问题一条记录覆盖整批，不必逐台建单</p>
      </div>

      {form.scope === 'batch' ? (
        <div className="form-group">
          <label className="form-label">受影响批次</label>
          <select className="form-select" value={form.batchId == null ? '' : String(form.batchId)}
                  onChange={(e) => setForm({ ...form, batchId: e.target.value === '' ? null : Number(e.target.value) })}
                  disabled={busy || batches.length === 0}>
            <option value="">未指定</option>
            {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.code}</option>)}
          </select>
        </div>
      ) : (
        <div className="form-group">
          <label className="form-label">受影响设备（已选 {form.deviceIds.length} 台）</label>
          <div className="device-picker">
            {devices.length === 0 ? <p className="muted text-sm">该项目还没有设备</p> :
              devices.slice(0, 200).map((d) => (
                <label key={d.id} className="device-pick-item">
                  <input type="checkbox" checked={form.deviceIds.includes(d.id)} onChange={() => toggleDevice(d.id)} disabled={busy}/>
                  <span className="mono">{d.sn}</span>
                </label>
              ))}
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">严重程度</label>
          <select className="form-select" value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })} disabled={busy}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">状态</label>
          <select className="form-select" value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={busy}>
            {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">问题标题 <span className="required-mark">*</span></label>
        <input data-autofocus className="form-input" value={form.title}
               onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={busy}/>
      </div>
      <div className="form-group">
        <label className="form-label">详细描述</label>
        <textarea className="form-textarea" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={busy}/>
      </div>
      {form.status === '已解决' || form.status === '已关闭' ? (
        <div className="form-group">
          <label className="form-label">解决方案</label>
          <textarea className="form-textarea" value={form.resolution}
                    onChange={(e) => setForm({ ...form, resolution: e.target.value })} disabled={busy}/>
        </div>
      ) : null}
    </ModalShell>
  );
}

export const IssuesTab = memo(function IssuesTab({ project, isLoggedIn, isAdmin, onUpsert, onRemove }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const issues = project.issues || [];
  const batches = project.batches || [];
  const devices = project.devices || [];

  const filtered = useMemo(() => {
    return issues
      .filter((i) => statusFilter === 'all' || i.status === statusFilter)
      .sort((a, b) => {
        const order = { 致命: 0, 严重: 1, 一般: 2, 轻微: 3 };
        const d = (order[a.severity] || 9) - (order[b.severity] || 9);
        return d !== 0 ? d : String(b.createdAt).localeCompare(String(a.createdAt));
      });
  }, [issues, statusFilter]);

  const openCount = issues.filter((i) => i.status === '打开' || i.status === '处理中').length;

  return (
    <div>
      <div className="toolbar">
        <div className="month-summary">
          <span>共 <strong>{issues.length}</strong> 条</span>
          {openCount ? <span className="badge badge-danger">未关闭 {openCount}</span> : null}
        </div>
        <div className="toolbar-actions">
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">全部状态</option>
            {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {isLoggedIn ? (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16}/><span>新建问题单</span>
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="alert" title={issues.length === 0 ? '还没有问题单' : '没有匹配的问题单'}
                    hint="区分批次性问题和单机问题，避免重复建单"/>
      ) : (
        <div className="version-list">
          {filtered.map((i) => {
            const batch = batches.find((b) => b.id === i.batchId);
            return (
              <div key={i.id} className="list-item">
                <div className="list-item-header">
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-4 mb-2">
                      <span className={severityBadge(i.severity)}>{i.severity}</span>
                      <span className="font-semibold">{i.title}</span>
                      <span className={issueStatusBadge(i.status)}>{i.status}</span>
                    </div>
                    <div className="text-sm muted">
                      {i.scope === 'batch'
                        ? '批次性问题' + (batch ? ' · ' + batch.code : '')
                        : '单机问题 · 影响 ' + i.deviceIds.length + ' 台'}
                      {' · '}创建于 {formatDateShort(i.createdAt)}
                    </div>
                    {i.description ? <p className="text-sm text-gray-600" style={{ marginTop: 6 }}>{i.description}</p> : null}
                    {i.resolution ? <p className="text-sm" style={{ marginTop: 6, color: 'var(--success)' }}>解决方案：{i.resolution}</p> : null}
                  </div>
                  {isLoggedIn ? (
                    <div className="list-item-actions">
                      <button className="btn btn-icon btn-secondary" title="编辑" onClick={() => setEditing(i)}>
                        <Icon name="edit" size={16}/>
                      </button>
                      {isAdmin ? (
                        <button className="btn btn-icon btn-danger" title="删除" onClick={() => onRemove(project.id, i.id)}>
                          <Icon name="trash" size={16}/>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating ? <IssueForm project={project} onSubmit={(i) => onUpsert(project.id, [i])} onClose={() => setCreating(false)}/> : null}
      {editing ? <IssueForm project={project} issue={editing} onSubmit={(i) => onUpsert(project.id, [i])} onClose={() => setEditing(null)}/> : null}
    </div>
  );
});
