import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ModalShell } from './Dialog.js';
import { Icon } from './Icon.js';
import { formatFileSize } from '../utils/format.js';
import { PROJECT_STATUSES } from './ProjectList.js';
import { todayISO } from '../utils/date.js';

function Field({ label, required, children, hint }) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}
        {required ? <span className="required-mark"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="form-hint">{hint}</p> : null}
    </div>
  );
}

export function ProjectForm({ project, onSubmit, onClose }) {
  const [form, setForm] = useState(() => ({
    name: project ? project.name : '',
    description: project ? project.description : '',
    chip: project ? project.chip || '' : '',
    platform: project ? project.platform || '' : '',
    customer: project ? project.customer || '' : '',
    status: project ? project.status || '进行中' : '进行中',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(async () => {
    if (!form.name.trim()) {
      setError('请填写项目名称');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(form);
      onClose();
    } catch (e) {
      setError(e.message || '保存失败');
    } finally {
      setBusy(false);
    }
  }, [form, onSubmit, onClose]);

  return (
    <ModalShell
      title={project ? '编辑项目' : '新建项目'}
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
      <Field label="项目名称" required>
        <input
          data-autofocus
          className="form-input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          disabled={busy}
        />
      </Field>
      <Field label="项目描述">
        <textarea
          className="form-textarea"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          disabled={busy}
        />
      </Field>
      <div className="form-row">
        <Field label="芯片型号" hint="例如 STM32F407、ESP32-S3">
          <input
            className="form-input"
            value={form.chip}
            onChange={(e) => setForm({ ...form, chip: e.target.value })}
            disabled={busy}
          />
        </Field>
        <Field label="平台/框架">
          <input
            className="form-input"
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            disabled={busy}
          />
        </Field>
      </div>
      <div className="form-row">
        <Field label="客户">
          <input
            className="form-input"
            value={form.customer}
            onChange={(e) => setForm({ ...form, customer: e.target.value })}
            disabled={busy}
          />
        </Field>
        <Field label="项目状态">
          <select
            className="form-select"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            disabled={busy}
          >
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </Field>
      </div>
    </ModalShell>
  );
}

function FilePicker({ label, value, fileType, onChange, disabled }) {
  const [busy, setBusy] = useState(false);

  const pick = useCallback(async () => {
    setBusy(true);
    try {
      const result = await window.api.selectFile(fileType);
      if (result.success) {
        onChange({
          fileName: result.fileName,
          fileSize: result.fileSize,
          md5: result.md5,
          tempPath: result.tempPath,
        });
      }
    } catch (e) {
      window.alert('选择文件失败：' + e.message);
    } finally {
      setBusy(false);
    }
  }, [fileType, onChange]);

  return (
    <Field label={label}>
      {value ? (
        <div className="file-upload-result">
          <div className="file-upload-info">
            <Icon name={fileType === 'binary' ? 'chip' : 'fileText'} size={20}/>
            <div>
              <div className="font-semibold">{value.fileName}</div>
              <div className="text-sm text-gray-500">{formatFileSize(value.fileSize)}</div>
              {value.md5 ? (
                <div className="text-sm text-gray-600"><strong>MD5:</strong> <code>{value.md5}</code></div>
              ) : null}
            </div>
          </div>
          <button
            onClick={() => onChange(null)}
            className="btn btn-icon btn-danger"
            disabled={disabled || busy}
            aria-label="移除文件"
          >
            <Icon name="x" size={16}/>
          </button>
        </div>
      ) : (
        <button onClick={pick} className="btn btn-secondary" disabled={disabled || busy}>
          <Icon name="upload" size={16}/>
          <span>{busy ? '读取中…' : '选择文件'}</span>
        </button>
      )}
    </Field>
  );
}

export function VersionForm({ version, project, onSubmit, onClose, versionExists }) {
  const [form, setForm] = useState(() => ({
    version: version ? version.version : '',
    buildTime: version ? version.buildTime || todayISO() : todayISO(),
    changelog: version ? version.changelog : '',
    binaryFile: version ? version.binaryFile : null,
    configFile: version ? version.configFile : null,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const duplicate = useMemo(
    () => form.version.trim() && versionExists(project.id, form.version, version ? version.id : undefined),
    [form.version, versionExists, project.id, version]
  );

  const submit = useCallback(async () => {
    if (!form.version.trim()) {
      setError('请填写版本号');
      return;
    }
    if (!form.buildTime) {
      setError('请选择生成时间');
      return;
    }
    if (duplicate) {
      setError('该项目下已存在相同版本号：' + form.version.trim());
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ok = await onSubmit(form);
      if (ok !== false) onClose();
    } catch (e) {
      setError(e.message || '保存失败');
    } finally {
      setBusy(false);
    }
  }, [form, duplicate, onSubmit, onClose]);

  return (
    <ModalShell
      title={version ? '编辑版本' : '新增版本'}
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
        <Field label="版本号" required>
          <input
            data-autofocus
            className="form-input"
            placeholder="v1.0.0"
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            disabled={busy}
          />
        </Field>
        <Field label="生成时间" required>
          <input
            type="date"
            className="form-input"
            value={form.buildTime}
            onChange={(e) => setForm({ ...form, buildTime: e.target.value })}
            disabled={busy}
          />
        </Field>
      </div>
      {duplicate ? <p className="form-warn">该项目下已存在版本号 {form.version.trim()}</p> : null}

      <FilePicker
        label="二进制文件"
        value={form.binaryFile}
        fileType="binary"
        onChange={(file) => setForm({ ...form, binaryFile: file })}
        disabled={busy}
      />
      <FilePicker
        label="配置文件"
        value={form.configFile}
        fileType="config"
        onChange={(file) => setForm({ ...form, configFile: file })}
        disabled={busy}
      />
      <Field label="变更说明">
        <textarea
          className="form-textarea"
          placeholder="描述本版本的主要变更内容"
          value={form.changelog}
          onChange={(e) => setForm({ ...form, changelog: e.target.value })}
          disabled={busy}
        />
      </Field>
    </ModalShell>
  );
}

export function TestRecordForm({ record, project, defaultDate, onSubmit, onClose }) {
  const [form, setForm] = useState(() => ({
    // 关键修复：新增时用日历上选中的那天，而不是永远「今天」
    testDate: record ? record.testDate : defaultDate || todayISO(),
    tester: record ? record.tester : '',
    result: record ? record.result : '通过',
    notes: record ? record.notes : '',
    versionId: record ? record.versionId : null,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const versions = project.versions || [];

  const submit = useCallback(async () => {
    if (!form.testDate) {
      setError('请选择测试日期');
      return;
    }
    if (!form.tester.trim()) {
      setError('请填写测试人员');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ok = await onSubmit(form);
      if (ok !== false) onClose();
    } catch (e) {
      setError(e.message || '保存失败');
    } finally {
      setBusy(false);
    }
  }, [form, onSubmit, onClose]);

  return (
    <ModalShell
      title={record ? '编辑测试记录' : '新增测试记录'}
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
        <Field label="测试日期" required>
          <input
            data-autofocus
            type="date"
            className="form-input"
            value={form.testDate}
            onChange={(e) => setForm({ ...form, testDate: e.target.value })}
            disabled={busy}
          />
        </Field>
        <Field label="测试人员" required>
          <input
            className="form-input"
            value={form.tester}
            onChange={(e) => setForm({ ...form, tester: e.target.value })}
            disabled={busy}
          />
        </Field>
      </div>
      <div className="form-row">
        <Field label="关联版本" hint={versions.length === 0 ? '该项目还没有版本，可稍后再关联' : '记录本次测试针对哪个版本'}>
          <select
            className="form-select"
            value={form.versionId == null ? '' : String(form.versionId)}
            onChange={(e) => setForm({ ...form, versionId: e.target.value === '' ? null : Number(e.target.value) })}
            disabled={busy || versions.length === 0}
          >
            <option value="">不关联版本</option>
            {versions.map((v) => (
              <option key={v.id} value={String(v.id)}>{v.version}（{v.buildTime}）</option>
            ))}
          </select>
        </Field>
        <Field label="测试结果">
          <select
            className="form-select"
            value={form.result}
            onChange={(e) => setForm({ ...form, result: e.target.value })}
            disabled={busy}
          >
            <option value="通过">通过</option>
            <option value="失败">失败</option>
          </select>
        </Field>
      </div>
      <Field label="备注说明">
        <textarea
          className="form-textarea"
          placeholder="测试详情、发现的问题等"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          disabled={busy}
        />
      </Field>
    </ModalShell>
  );
}
