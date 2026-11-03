const crypto = require('crypto');

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return { passwordHash: derived.toString('hex'), salt };
}

function isLegacy(user) {
  // 旧版本直接把明文写进 passwordHash 且没有 salt 字段。
  return !!user && !user.salt && !!user.passwordHash;
}

function verifyPassword(password, user) {
  if (!user) return false;
  if (isLegacy(user)) {
    return String(password) === String(user.passwordHash);
  }
  if (!user.salt || !user.passwordHash) return false;
  const derived = crypto.scryptSync(String(password), user.salt, KEY_LENGTH, SCRYPT_OPTIONS);
  const expected = Buffer.from(user.passwordHash, 'hex');
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function needsUpgrade(user) {
  return isLegacy(user);
}

function normalizeUsername(name) {
  return String(name || '').trim();
}

function validateCredentials(username, password) {
  const problems = [];
  const name = normalizeUsername(username);
  if (!name) problems.push('用户名不能为空');
  if (!/^[A-Za-z0-9_.-]{2,32}$/.test(name)) problems.push('用户名只能包含字母、数字、下划线、点和横线（2-32 位）');
  if (!password || String(password).length < 6) problems.push('密码至少 6 位');
  return { ok: problems.length === 0, problems, username: name };
}

module.exports = {
  hashPassword,
  verifyPassword,
  needsUpgrade,
  isLegacy,
  validateCredentials,
  normalizeUsername,
};
