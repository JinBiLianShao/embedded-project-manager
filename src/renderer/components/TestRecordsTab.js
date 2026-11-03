import React, { memo, useCallback, useMemo, useState } from 'react';
import { Icon } from './Icon.js';
import { EmptyState } from './EmptyState.js';
import { formatDateCN, parseLocalDate, sameDay, toISODate, todayISO } from '../utils/date.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function versionLabel(project, versionId) {
  if (versionId == null) return null;
  const version = (project.versions || []).find((v) => v.id === versionId);
  return version ? version.version : null;
}

export const TestRecordsTab = memo(function TestRecordsTab({
  project,
  onAdd,
  onEdit,
  onDelete,
  isAdmin,
  isLoggedIn,
  selectedDate,
  onDateChange,
}) {
  const [monthCursor, setMonthCursor] = useState(() => parseLocalDate(selectedDate) || new Date());

  const records = project.testRecords || [];

  const recordsByDate = useMemo(() => {
    const map = new Map();
    for (const record of records) {
      const key = record.testDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(record);
    }
    return map;
  }, [records]);

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDayOfWeek = new Date(year, month, 1).getDay();

  const changeMonth = useCallback((offset) => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }, []);

  const selectedISO = toISODate(selectedDate);
  const dayRecords = recordsByDate.get(selectedISO) || [];
  const todayKey = todayISO();

  const summary = useMemo(() => {
    const monthPrefix = year + '-' + String(month + 1).padStart(2, '0');
    const monthRecords = records.filter((r) => String(r.testDate).startsWith(monthPrefix));
    const passed = monthRecords.filter((r) => r.result === '通过').length;
    const failed = monthRecords.filter((r) => r.result === '失败').length;
    return { total: monthRecords.length, passed, failed };
  }, [records, year, month]);

  return (
    <div>
      <div className="toolbar">
        <div className="month-summary">
          <span>{year}年{month + 1}月共 <strong>{summary.total}</strong> 次测试</span>
          <span className="badge badge-success">通过 {summary.passed}</span>
          <span className="badge badge-danger">失败 {summary.failed}</span>
        </div>
        <div className="toolbar-actions">
          {isLoggedIn ? (
            <button onClick={onAdd} className="btn btn-primary">
              <Icon name="plus" size={16}/>
              <span>新增测试记录</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="calendar mb-6">
        <div className="calendar-header">
          <button onClick={() => changeMonth(-1)} className="btn btn-secondary" aria-label="上个月">
            <Icon name="chevronLeft" size={16}/>
          </button>
          <h5 className="font-semibold">{year}年{month + 1}月</h5>
          <button onClick={() => changeMonth(1)} className="btn btn-secondary" aria-label="下个月">
            <Icon name="chevronRight" size={16}/>
          </button>
        </div>

        <div className="calendar-grid">
          {WEEKDAYS.map((day) => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={'blank-' + i} className="calendar-day calendar-day-blank"/>
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNumber = i + 1;
            const date = new Date(year, month, dayNumber);
            const key = toISODate(date);
            const dayItems = recordsByDate.get(key) || [];
            const hasFailure = dayItems.some((r) => r.result === '失败');

            return (
              <div
                key={dayNumber}
                onClick={() => onDateChange(date)}
                className={[
                  'calendar-day',
                  sameDay(date, selectedDate) ? 'selected' : '',
                  key === todayKey ? 'today' : '',
                ].filter(Boolean).join(' ')}
              >
                <div className="calendar-day-number">{dayNumber}</div>
                {dayItems.length > 0 ? (
                  <div className={'calendar-dot ' + (hasFailure ? 'dot-fail' : 'dot-pass')}>
                    {dayItems.length}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <h5 className="font-semibold mb-4">
        {formatDateCN(selectedDate)} 的测试记录
        <span className="text-sm muted" style={{ marginLeft: 8 }}>共 {dayRecords.length} 条</span>
      </h5>

      {dayRecords.length === 0 ? (
        <EmptyState
          icon="testTube"
          title="该日期没有测试记录"
          hint={isLoggedIn ? '点击「新增测试记录」补录，日期会自动带成当前选中的这一天' : undefined}
        />
      ) : (
        <div className="test-record-list">
          {dayRecords.map((record) => {
            const label = versionLabel(project, record.versionId);
            return (
              <div key={record.id} className="list-item">
                <div className="list-item-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-4 mb-2">
                      <span className="font-semibold">{record.tester}</span>
                      <span className={'badge ' + (record.result === '通过' ? 'badge-success' : 'badge-danger')}>
                        {record.result}
                      </span>
                      {label ? (
                        <span className="version-tag version-tag-sm">{label}</span>
                      ) : (
                        <span className="badge badge-warn">未关联版本</span>
                      )}
                    </div>
                    {record.notes ? <p className="text-sm text-gray-600">{record.notes}</p> : null}
                  </div>
                  {isAdmin ? (
                    <div className="list-item-actions">
                      <button onClick={() => onEdit(record)} className="btn btn-icon btn-secondary" title="编辑记录">
                        <Icon name="edit" size={18}/>
                      </button>
                      <button onClick={() => onDelete(record.id)} className="btn btn-icon btn-danger" title="删除记录">
                        <Icon name="trash" size={18}/>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
