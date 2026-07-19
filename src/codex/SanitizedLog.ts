const secretPatterns: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/gu,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/giu,
  /\b(access[_ -]?token|refresh[_ -]?token|api[_ -]?key)\s*[:=]\s*\S+/giu
];

export function sanitizeLogLine(value: string): string {
  let result = stripTerminalControls(value);
  for (const pattern of secretPatterns) result = result.replace(pattern, '[REDACTED]');
  return result.trim();
}

function stripTerminalControls(value: string): string {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 27) {
      if (value[index + 1] === '[') {
        index += 2;
        while (index < value.length && (value.charCodeAt(index) < 64 || value.charCodeAt(index) > 126)) index += 1;
      }
      continue;
    }
    if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127) continue;
    output += value[index] ?? '';
  }
  return output;
}
