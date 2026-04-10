const { randomBytes, scryptSync, timingSafeEqual } = require("crypto");

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, storedHash] = String(passwordHash ?? "").split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const derived = scryptSync(password, salt, 64);
  const known = Buffer.from(storedHash, "hex");

  if (derived.length !== known.length) {
    return false;
  }

  return timingSafeEqual(derived, known);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
