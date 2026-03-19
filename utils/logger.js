/**
 * Lightweight structured console logger with ANSI colour and timestamps.
 * No external dependencies – just process.stdout + console.log.
 */

const C = {
  reset:   '\x1b[0m',
  dim:     '\x1b[2m',
  bold:    '\x1b[1m',
  red:     '\x1b[31m',
  yellow:  '\x1b[33m',
  green:   '\x1b[32m',
  cyan:    '\x1b[36m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
};

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function write(labelColor, label, ...args) {
  process.stdout.write(`${C.dim}[${ts()}]${C.reset} ${labelColor}${label}${C.reset} `);
  // Use console.log for the rest so objects/errors are pretty-printed
  console.log(...args);
}

export const logger = {
  info:    (...a) => write(C.cyan,    '[INFO ]', ...a),
  ok:      (...a) => write(C.green,   '[OK   ]', ...a),
  warn:    (...a) => write(C.yellow,  '[WARN ]', ...a),
  error:   (...a) => write(C.red,     '[ERROR]', ...a),
  debug:   (...a) => write(C.magenta, '[DEBUG]', ...a),

  /** Formatted HTTP access log line */
  http(method, url, status, ms, userId) {
    const sc = status >= 500 ? C.red : status >= 400 ? C.yellow : C.green;
    const user = userId ? `${C.dim} [uid:${userId}]${C.reset}` : '';
    process.stdout.write(
      `${C.dim}[${ts()}]${C.reset} ${C.blue}[HTTP ]${C.reset} ` +
      `${C.bold}${method.padEnd(7)}${C.reset}` +
      `${url.padEnd(45)} ` +
      `${sc}${status}${C.reset} ${C.dim}${ms}ms${C.reset}` +
      `${user}\n`
    );
  },
};
