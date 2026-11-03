import React, { memo, useCallback, useMemo, useState } from 'react';
import { Icon } from './Icon.js';
import { EmptyState } from './EmptyState.js';
import { ModalShell } from './Dialog.js';
import { formatDateShort, todayISO } from '../utils/date.js';

export const DEVICE_STATUSES = ['待测', '合格', '不合格', '返修中', '已出货'];

function statusBadge(status) {
  if (status === '合格') return 'badge badge-success';
  if (status === '不合格') return 'badge badge-danger';
  if (status === '返修中') return 'badge badge-warn';
  if (status === '已出货') return 'badge badge-info';
  return 'badge';
}

// 单台设备编辑：SN、批次、固件版本、环境快照
export function DeviceForm({ device, project, batches, onSubmit, onClose }) {
  const [form, setForm] = useState(() => ({
    sn: device ? device.sn : '',
    batchId: device ? device.batchId : null,
    versionId: device ? device.versionId : null,
    status: device ? device.status : '待测',
    osVersion: device && device.envSnapshot ? device.envSnapshot.osVersion || '' : '',
    rootfs: device && device.envSnapshot ? device.envSnapshot.rootfs || '' : '',
    bootloader: device && device.envSnapshot ? device.envSnapshot.bootloader || '' : '',
    notes: device ? device.notes || '' : '',
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    if (!form.sn.trim()) {
      setError('请填写设备序列号 SN');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        id: device ? device.id : Date.now() + Math.floor(Math.random() * 1000),
        sn: form.sn.trim(),
        batchId: form.batchId,
        versionId: form.versionId,
        status: form.status,
        envSnapshot: {
          osVersion: form.osVersion,
          rootfs: form.rootfs,
          bootloader: form.bootloader,
        },
        notes: form.notes,
        testRecords: device ? device.testRecords : [],
        issueIds: device ? device.issueIds : [],
        createdAt: device ? device.createdAt : new Date().toISOString(),
      });
      onClose();
    } catch (e) {
      setError(e.message || '保存失败');
    } finally {
      setBusy(false);
    }
  }, [form, device, onSubmit, onClose]);

  const setV = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <ModalShell
      title={device ? '编辑设备' : '新增设备'}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button onClick={submit} className="btn btn-primary" disabled={busy}>
            <Icon name="save" size={16}/>
            <span>{busy ? '保存中…' : '保存'}</span>
          </button>
          <button onClick={onClose} className="btn btn-secondary" disabled={busy}>取消</button>
        </>
      }
    >
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">设备序列号 SN <span className="required-mark">*</span></label>
          <input data-autofocus className="form-input" value={form.sn} onChange={setV('sn')} disabled={busy}/>
        </div>
        <div className="form-group">
          <label className="form-label">所属批次</label>
          <select className="form-select" value={form.batchId == null ? '' : String(form.batchId)}
                  onChange={(e) => setForm({ ...form, batchId: e.target.value === '' ? null : Number(e.target.value) })}
                  disabled={busy || batches.length === 0}>
            <option value="">未分批</option>
            {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.code}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">实际烧录固件</label>
          <select className="form-select" value={form.versionId == null ? '' : String(form.versionId)}
                  onChange={(e) => setForm({ ...form, versionId: e.target.value === '' ? null : Number(e.target.value) })}
                  disabled={busy || project.versions.length === 0}>
            <option value="">未指定</option>
            {project.versions.map((v) => <option key={v.id} value={String(v.id)}>{v.version}</option>)}
          </select>
          <p className="form-hint">可不同于批次默认值，用于记录产线中途换版</p>
        </div>
        <div className="form-group">
          <label className="form-label">设备状态</label>
          <select className="form-select" value={form.status} onChange={setV('status')} disabled={busy}>
            {DEVICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <p className="form-section-title">系统环境快照</p>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">OS / 内核</label>
          <input className="form-input" value={form.osVersion} onChange={setV('osVersion')} disabled={busy}/>
        </div>
        <div className="form-group">
          <label className="form-label">根文件系统</label>
          <input className="form-input" value={form.rootfs} onChange={setV('rootfs')} disabled={busy}/>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Bootloader</label>
        <input className="form-input" value={form.bootloader} onChange={setV('bootloader')} disabled={busy}/>
      </div>
      <div className="form-group">
        <label className="form-label">备注</label>
        <textarea className="form-textarea" value={form.notes} onChange={setV('notes')} disabled={busy}/>
      </div>
    </ModalShell>
  );
}

export const DevicesTab = memo(function DevicesTab({
  project, isAdmin, isLoggedIn, onUpsert, onRemove, onAddRecord,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [recording, setRecording] = useState(null);

  const devices = project.devices || [];
  const batches = project.batches || [];

  const batchCode = useCallback((id) => {
    const b = batches.find((x) => x.id === id);
    return b ? b.code : '';
  }, [batches]);

  const versionLabel = useCallback((id) => {
    const v = project.versions.find((x) => x.id === id);
    return v ? v.version : '';
  }, [project.versions]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return devices.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (batchFilter !== 'all' && String(d.batchId) !== batchFilter) return false;
      if (!kw) return true;
      return [d.sn, d.notes, d.envSnapshot && d.envSnapshot.osVersion, d.envSnapshot && d.envSnapshot.rootfs]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(kw));
    });
  }, [devices, search, statusFilter, batchFilter]);

  const summary = useMemo(() => {
    const map = {};
    for (const s of DEVICE_STATUSES) map[s] = 0;
    for (const d of devices) map[d.status] = (map[d.status] || 0) + 1;
    return map;
  }, [devices]);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((d) => d.id))));
  }, [filtered]);

  // 批量改状态：产线最常用
  const bulkSetStatus = useCallback(async (status) => {
    const targets = devices.filter((d) => selected.has(d.id));
    if (!targets.length) return;
    await onUpsert(project.id, targets.map((d) => ({ ...d, status })));
    setSelected(new Set());
  }, [devices, selected, onUpsert, project.id]);

  const bulkRemove = useCallback(async () => {
    if (!selected.size) return;
    const ok = await onRemove(project.id, [...selected]);
    if (ok) setSelected(new Set());
  }, [selected, onRemove, project.id]);

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-search">
          <Icon name="search" size={18}/>
          <input className="form-input" placeholder="搜索 SN、环境、备注…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <div className="toolbar-actions">
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">全部状态</option>
            {DEVICE_STATUSES.map((s) => <option key={s} value={s}>{s}（{summary[s] || 0}）</option>)}
          </select>
          {batches.length ? (
            <select className="form-select" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="all">全部批次</option>
              {batches.map((b) => <option key={b.id} value={String(b.id)}>{b.code}</option>)}
            </select>
          ) : null}
          {isLoggedIn ? (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16}/><span>新增设备</span>
            </button>
          ) : null}
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="bulk-bar">
          <span>已选 <strong>{selected.size}</strong> 台</span>
          {isLoggedIn ? (
            <>
              <button className="btn btn-success btn-sm" onClick={() => bulkSetStatus('合格')}>标记合格</button>
              <button className="btn btn-danger btn-sm" onClick={() => bulkSetStatus('不合格')}>标记不合格</button>
              <button className="btn btn-secondary btn-sm" onClick={() => bulkSetStatus('已出货')}>标记已出货</button>
            </>
          ) : null}
          {isAdmin ? <button className="btn btn-danger btn-sm" onClick={bulkRemove}>删除</button> : null}
          <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>取消选择</button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState icon="chip" title={devices.length === 0 ? '还没有设备记录' : '没有匹配的设备'}
                    hint={devices.length === 0 ? '批量出货时可为每台设备建立记录，用 SN 追溯' : '换个关键词或清除筛选'}/>
      ) : (
        <table className="device-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll}/>
              </th>
              <th>SN</th>
              <th>批次</th>
              <th>固件</th>
              <th>环境</th>
              <th>状态</th>
              <th>测试</th>
              <th style={{ width: 120 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className={selected.has(d.id) ? 'row-selected' : ''}>
                <td><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)}/></td>
                <td className="mono">{d.sn}</td>
                <td>{batchCode(d.batchId) || '—'}</td>
                <td>{versionLabel(d.versionId) || '—'}</td>
                <td className="text-sm muted">
                  {d.envSnapshot && d.envSnapshot.osVersion ? d.envSnapshot.osVersion : '—'}
                  {d.envSnapshot && d.envSnapshot.rootfs ? ' / ' + d.envSnapshot.rootfs : ''}
                </td>
                <td><span className={statusBadge(d.status)}>{d.status}</span></td>
                <td>{d.testRecords.length}</td>
                <td>
                  <div className="row-actions">
                    {isLoggedIn ? (
                      <button className="btn btn-icon btn-secondary" title="录入测试" onClick={() => setRecording(d)}>
                        <Icon name="testTube" size={16}/>
                      </button>
                    ) : null}
                    {isLoggedIn ? (
                      <button className="btn btn-icon btn-secondary" title="编辑" onClick={() => setEditing(d)}>
                        <Icon name="edit" size={16}/>
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating ? (
        <DeviceForm project={project} batches={batches}
          onSubmit={(d) => onUpsert(project.id, [d])} onClose={() => setCreating(false)}/>
      ) : null}

      {editing ? (
        <DeviceForm project={project} device={editing} batches={batches}
          onSubmit={(d) => onUpsert(project.id, [d])} onClose={() => setEditing(null)}/>
      ) : null}

      {recording ? (
        <DeviceRecordForm
          device={recording}
          project={project}
          onSubmit={async (form) => { await onAddRecord(project.id, recording.id, form); }}
          onClose={() => setRecording(null)}
        />
      ) : null}
    </div>
  );
});

function DeviceRecordForm({ device, project, onSubmit, onClose }) {
  const [form, setForm] = useState({
    testDate: todayISO(),
    tester: '',
    category: 'software',
    result: '通过',
    notes: '',
    versionId: device.versionId,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(async () => {
    if (!form.tester.trim()) { setError('请填写测试人员'); return; }
    setBusy(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (e) { setError(e.message || '保存失败'); } finally { setBusy(false); }
  }, [form, onSubmit, onClose]);

  return (
    <ModalShell title={'录入测试 · ' + device.sn} onClose={onClose} busy={busy} maxWidth={520}
      footer={
        <>
          <button onClick={submit} className="btn btn-primary" disabled={busy}>{busy ? '保存中…' : '保存'}</button>
          <button onClick={onClose} className="btn btn-secondary" disabled={busy}>取消</button>
        </>
      }>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">测试日期</label>
          <input data-autofocus type="date" className="form-input" value={form.testDate}
                 onChange={(e) => setForm({ ...form, testDate: e.target.value })} disabled={busy}/>
        </div>
        <div className="form-group">
          <label className="form-label">测试人员</label>
          <input className="form-input" value={form.tester}
                 onChange={(e) => setForm({ ...form, tester: e.target.value })} disabled={busy}/>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">测试类型</label>
          <select className="form-select" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })} disabled={busy}>
            <option value="software">软件测试</option>
            <option value="hardware">硬件测试</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">结果</label>
          <select className="form-select" value={form.result}
                  onChange={(e) => setForm({ ...form, result: e.target.value })} disabled={busy}>
            <option value="通过">通过</option>
            <option value="失败">失败</option>
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
