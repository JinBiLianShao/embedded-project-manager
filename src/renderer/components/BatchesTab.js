import React, { memo, useCallback, useState } from 'react';
import { Icon } from './Icon.js';
import { EmptyState } from './EmptyState.js';
import { ModalShell } from './Dialog.js';
import { formatDateShort } from '../utils/date.js';

export const STAGES = ['EVT', 'DVT', 'PVT', 'MP'];

export function BatchForm({ batch, project, onSubmit, onClose }) {
  const [form, setForm] = useState(() => ({
    code: batch ? batch.code : '',
    stage: batch ? batch.stage : 'EVT',
    quantity: batch ? String(batch.quantity) : '',
    versionId: batch ? batch.versionId : null,
    notes: batch ? batch.notes : '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(async () => {
    if (!form.code.trim()) { setError('请填写批次号'); return; }
    setBusy(true);
    try {
      await onSubmit({
        id: batch ? batch.id : Date.now() + Math.floor(Math.random() * 1000),
        code: form.code.trim(),
        stage: form.stage,
        quantity: Number(form.quantity) || 0,
        versionId: form.versionId,
        notes: form.notes,
        createdAt: batch ? batch.createdAt : new Date().toISOString(),
      });
      onClose();
    } catch (e) { setError(e.message || '保存失败'); } finally { setBusy(false); }
  }, [form, batch, onSubmit, onClose]);

  return (
    <ModalShell title={batch ? '编辑批次' : '新建批次'} onClose={onClose} busy={busy} maxWidth={520}
      footer={
        <>
          <button onClick={submit} className="btn btn-primary" disabled={busy}>{busy ? '保存中…' : '保存'}</button>
          <button onClick={onClose} className="btn btn-secondary" disabled={busy}>取消</button>
        </>
      }>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">批次号 <span className="required-mark">*</span></label>
          <input data-autofocus className="form-input" value={form.code}
                 onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={busy}/>
        </div>
        <div className="form-group">
          <label className="form-label">研发阶段</label>
          <select className="form-select" value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value })} disabled={busy}>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">计划数量</label>
          <input type="number" className="form-input" value={form.quantity}
                 onChange={(e) => setForm({ ...form, quantity: e.target.value })} disabled={busy}/>
        </div>
        <div className="form-group">
          <label className="form-label">默认固件版本</label>
          <select className="form-select" value={form.versionId == null ? '' : String(form.versionId)}
                  onChange={(e) => setForm({ ...form, versionId: e.target.value === '' ? null : Number(e.target.value) })}
                  disabled={busy || project.versions.length === 0}>
            <option value="">未指定</option>
            {project.versions.map((v) => <option key={v.id} value={String(v.id)}>{v.version}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">备注</label>
        <textarea className="form-textarea" value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={busy}/>
      </div>
    </ModalShell>
  );
}

export const BatchesTab = memo(function BatchesTab({ project, isLoggedIn, onUpsert }) {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const batches = project.batches || [];
  const devices = project.devices || [];

  const stats = useCallback((batchId) => {
    const list = devices.filter((d) => d.batchId === batchId);
    const passed = list.filter((d) => d.status === '合格').length;
    const failed = list.filter((d) => d.status === '不合格').length;
    return { total: list.length, passed, failed };
  }, [devices]);

  const versionLabel = useCallback((id) => {
    const v = project.versions.find((x) => x.id === id);
    return v ? v.version : '';
  }, [project.versions]);

  return (
    <div>
      <div className="toolbar">
        <h4 className="font-semibold">生产批次</h4>
        {isLoggedIn ? (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16}/><span>新建批次</span>
          </button>
        ) : null}
      </div>

      {batches.length === 0 ? (
        <EmptyState icon="package" title="还没有批次" hint="按投产批次分组设备，便于按阶段追踪"/>
      ) : (
        <div className="version-list">
          {batches.map((b) => {
            const s = stats(b.id);
            const progress = b.quantity ? Math.min(100, Math.round((s.total / b.quantity) * 100)) : 0;
            return (
              <div key={b.id} className="list-item">
                <div className="list-item-header">
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-4 mb-2">
                      <span className="version-tag">{b.code}</span>
                      <span className="badge badge-info">{b.stage || '—'}</span>
                      {b.versionId ? <span className="muted text-sm">固件 {versionLabel(b.versionId)}</span> : null}
                    </div>
                    <div className="text-sm text-gray-600">
                      已录入 <strong>{s.total}</strong> / 计划 {b.quantity || '—'} 台
                      {b.quantity ? '（' + progress + '%）' : ''}
                      {' · '}合格 {s.passed} · 不合格 {s.failed}
                    </div>
                    {b.quantity ? (
                      <div className="progress-bar"><div className="progress-fill" style={{ width: progress + '%' }}/></div>
                    ) : null}
                    {b.notes ? <p className="text-sm muted" style={{ marginTop: 6 }}>{b.notes}</p> : null}
                  </div>
                  {isLoggedIn ? (
                    <div className="list-item-actions">
                      <button className="btn btn-icon btn-secondary" title="编辑批次" onClick={() => setEditing(b)}>
                        <Icon name="edit" size={16}/>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating ? <BatchForm project={project} onSubmit={(b) => onUpsert(project.id, [b])} onClose={() => setCreating(false)}/> : null}
      {editing ? <BatchForm project={project} batch={editing} onSubmit={(b) => onUpsert(project.id, [b])} onClose={() => setEditing(null)}/> : null}
    </div>
  );
});
