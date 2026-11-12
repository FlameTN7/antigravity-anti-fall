import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONV_DIR = join(homedir(), '.gemini', 'antigravity', 'conversations');

/**
 * Extracts latest routed model info from gen_metadata table in SQLite DB.
 * Uses sqlite3 CLI if available, with a pure binary scanner fallback.
 */
export function getLatestModel(conversationId) {
  if (!conversationId) return null;
  const dbPath = join(CONV_DIR, `${conversationId}.db`);
  if (!existsSync(dbPath)) return null;

  // Try sqlite3 CLI first (fast and handles WAL locking transparently)
  try {
    const raw = execFileSync('sqlite3', [
      '-batch',
      '-noheader',
      '-readonly',
      dbPath,
      'SELECT idx, hex(substr(data, -1200)) FROM gen_metadata ORDER BY idx DESC LIMIT 1;'
    ], { encoding: 'utf8', timeout: 2000 }).trim();

    if (raw) {
      const [idxStr, hex] = raw.split('|');
      if (hex) {
        const buf = Buffer.from(hex, 'hex');
        const parsed = parseGenMetadataTail(buf);
        if (parsed.routedModel) {
          return {
            idx: parseInt(idxStr, 10),
            routedModel: parsed.routedModel,
            displayName: parsed.displayName || parsed.routedModel,
            updatedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false })
          };
        }
      }
    }
  } catch (err) {
    // Fall back to direct file inspection
  }

  // Fallback: Read end of wal / db file directly
  try {
    const walPath = join(CONV_DIR, `${conversationId}.db-wal`);
    const targetFile = existsSync(walPath) ? walPath : dbPath;
    const buf = readFileSync(targetFile);
    // Scan backwards in the buffer
    const parsed = parseGenMetadataTail(buf);
    if (parsed.routedModel) {
      return {
        idx: 0,
        routedModel: parsed.routedModel,
        displayName: parsed.displayName || parsed.routedModel,
        updatedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false })
      };
    }
  } catch {}

  return null;
}

/**
 * Parses protobuf tag 19 (response_model) and tag 21 (model_name)
 */
function parseGenMetadataTail(buf) {
  let routedModel = '';
  let displayName = '';

  // Tag 19: (19 << 3) | 2 = 154 = [0x9a, 0x01]
  const tag19 = Buffer.from([0x9a, 0x01]);
  const mIdx = buf.lastIndexOf(tag19);
  if (mIdx !== -1 && mIdx + 3 <= buf.length) {
    const len = buf[mIdx + 2];
    if (len > 0 && len < 64 && mIdx + 3 + len <= buf.length) {
      const s = buf.subarray(mIdx + 3, mIdx + 3 + len).toString('utf8');
      if (/^[a-zA-Z0-9_.-]+$/.test(s)) {
        routedModel = s;
      }
    }
  }

  // Tag 21: (21 << 3) | 2 = 170 = [0xaa, 0x01]
  const tag21 = Buffer.from([0xaa, 0x01]);
  const nIdx = buf.lastIndexOf(tag21);
  if (nIdx !== -1 && nIdx + 3 <= buf.length) {
    const len = buf[nIdx + 2];
    if (len > 0 && len < 64 && nIdx + 3 + len <= buf.length) {
      displayName = buf.subarray(nIdx + 3, nIdx + 3 + len).toString('utf8');
    }
  }

  return { routedModel, displayName };
}
