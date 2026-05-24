const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  const fractionDigits = value >= 10 || exponent === 0 ? 0 : 1;

  return `${value.toFixed(fractionDigits)} ${BYTE_UNITS[exponent]}`;
}

export function shortHash(hash: string): string {
  return hash.slice(0, 8);
}
