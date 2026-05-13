export function randomId16() {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function toAmount(value: string) {
  const cleaned = value.trim().replace(/[^0-9.-]/g, "");
  const n = Number(cleaned || "0");
  return Number.isFinite(n) ? n : 0;
}
