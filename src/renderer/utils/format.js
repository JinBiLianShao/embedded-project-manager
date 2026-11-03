export function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size <= 0) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return Math.round((size / Math.pow(1024, index)) * 100) / 100 + ' ' + units[index];
}

export function truncateMiddle(text, head = 10, tail = 8) {
  const value = String(text || '');
  if (value.length <= head + tail + 3) return value;
  return value.slice(0, head) + '…' + value.slice(-tail);
}
