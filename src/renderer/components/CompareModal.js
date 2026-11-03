import React, { memo, useMemo, useState } from 'react';
import { ModalShell } from './Dialog.js';
import { formatDateShort } from '../utils/date.js';
import { formatFileSize } from '../utils/format.js';

const ROWS = [
  { key: 'version', label: '版本号' },
  { key: 'buildTime', label: '生成时间', format: formatDateShort },
  { key: 'changelog', label: '变更说明' },
  { key: 'binary', label: '二进制文件' },
  { key: 'binarySize', label: '二进制大小' },
  { key: 'md5', label: 'MD5' },
  { key: 'config', label: '配置文件' },
];

function cellValue(version, key) {
  switch (key) {
    case 'binary':
      return version.binaryFile ? version.binaryFile.fileName : '—';
    case 'binarySize':
      return version.binaryFile ? formatFileSize(version.binaryFile.fileSize) : '—';
    case 'md5':
      return (version.binaryFile && version.binaryFile.md5) || version.md5 || '—';
    case 'config':
      return version.configFile ? version.configFile.fileName : '—';
    default:
      return version[key] ? String(version[key]) : '—';
  }
}

export const CompareModal = memo(function CompareModal({ versions, onClose }) {
  const [leftId, setLeftId] = useState(() => (versions[1] ? versions[1].id : versions[0].id));
  const [rightId, setRightId] = useState(() => versions[0].id);

  const left = useMemo(() => versions.find((v) => v.id === leftId) || versions[0], [versions, leftId]);
  const right = useMemo(() => versions.find((v) => v.id === rightId) || versions[0], [versions, rightId]);

  return (
    <ModalShell
      title="版本对比"
      onClose={onClose}
      maxWidth={860}
      footer={<button onClick={onClose} className="btn btn-secondary">关闭</button>}
    >
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">左侧版本</label>
          <select className="form-select" value={leftId} onChange={(e) => setLeftId(Number(e.target.value))}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>{v.version}（{formatDateShort(v.buildTime)}）</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">右侧版本</label>
          <select className="form-select" value={rightId} onChange={(e) => setRightId(Number(e.target.value))}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>{v.version}（{formatDateShort(v.buildTime)}）</option>
            ))}
          </select>
        </div>
      </div>

      <table className="compare-table">
        <thead>
          <tr>
            <th>字段</th>
            <th>{left.version}</th>
            <th>{right.version}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const format = row.format || ((v) => v);
            const leftValue = format(cellValue(left, row.key));
            const rightValue = format(cellValue(right, row.key));
            const changed = leftValue !== rightValue;
            return (
              <tr key={row.key} className={changed ? 'row-changed' : ''}>
                <th>{row.label}</th>
                <td>{leftValue}</td>
                <td>{rightValue}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ModalShell>
  );
});
