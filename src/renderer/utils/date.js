// 日期统一以本地时区的 YYYY-MM-DD 字符串存储。
// new Date('2026-11-03') 会被当作 UTC 零点解析，在 UTC 以西的时区会整体退一天，
// 所以这里一律手工拆解，绝不把裸日期字符串交给 Date 构造函数。

export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function todayISO() {
  return toISODate(new Date());
}

export function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function sameDay(a, b) {
  const left = parseLocalDate(a);
  const right = parseLocalDate(b);
  if (!left || !right) return false;
  return left.getTime() === right.getTime();
}

export function formatDateCN(value) {
  const d = parseLocalDate(value);
  if (!d) return '—';
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

export function formatDateShort(value) {
  const d = parseLocalDate(value);
  if (!d) return '—';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + month + '-' + day;
}

export function daysBetween(fromValue, toValue) {
  const from = parseLocalDate(fromValue);
  const to = parseLocalDate(toValue);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function formatRelativeDays(value) {
  const days = daysBetween(value, todayISO());
  if (days == null) return '—';
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days > 1) return days + ' 天前';
  if (days === -1) return '明天';
  return Math.abs(days) + ' 天后';
}
