import * as net from 'net';

/**
 * Minimal RouterOS API client (binary TLV "word" protocol), faithful to the
 * legacy routeros_api.class.php for the operations we need: modern /login (v6.43+)
 * and /ip/hotspot/user/add. Defensive: reads full reply sentences, surfaces !trap
 * as an error (avoids the node-routeros empty-reply crash class noted in the audit).
 */

function encodeLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x4000) {
    const v = len | 0x8000;
    return Buffer.from([(v >>> 8) & 0xff, v & 0xff]);
  }
  if (len < 0x200000) {
    const v = len | 0xc00000;
    return Buffer.from([(v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]);
  }
  if (len < 0x10000000) {
    const v = (len | 0xe0000000) >>> 0;
    return Buffer.from([(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]);
  }
  return Buffer.from([0xf0, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff]);
}

/** Returns [length, headerBytes] or null if not enough bytes yet. */
function decodeLength(buf: Buffer, off: number): [number, number] | null {
  if (off >= buf.length) return null;
  const b0 = buf[off];
  if ((b0 & 0x80) === 0) return [b0, 1];
  if ((b0 & 0xc0) === 0x80) {
    if (off + 1 >= buf.length) return null;
    return [((b0 & 0x3f) << 8) | buf[off + 1], 2];
  }
  if ((b0 & 0xe0) === 0xc0) {
    if (off + 2 >= buf.length) return null;
    return [((b0 & 0x1f) << 16) | (buf[off + 1] << 8) | buf[off + 2], 3];
  }
  if ((b0 & 0xf0) === 0xe0) {
    if (off + 3 >= buf.length) return null;
    return [((b0 & 0x0f) << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3], 4];
  }
  if (off + 4 >= buf.length) return null;
  return [(buf[off + 1] << 24) | (buf[off + 2] << 16) | (buf[off + 3] << 8) | buf[off + 4], 5];
}

export interface CommandResult {
  ok: boolean;
  ret?: string; // =ret= value (e.g. created id)
  error?: string; // !trap message
}

export class RouterOsClient {
  private sock!: net.Socket;
  private buf = Buffer.alloc(0);
  private words: string[] = [];
  private sentences: string[][] = [];
  private waiters: Array<(s: string[]) => void> = [];

  connect(host: string, port: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sock = net.createConnection({ host, port });
      this.sock.setTimeout(timeoutMs);
      this.sock.once('connect', () => resolve());
      this.sock.once('error', reject);
      this.sock.once('timeout', () => {
        this.sock.destroy();
        reject(new Error('connect timeout'));
      });
      this.sock.on('data', (chunk) => this.onData(chunk));
    });
  }

  private onData(chunk: Buffer): void {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const hdr = decodeLength(this.buf, 0);
      if (!hdr) break;
      const [len, headerBytes] = hdr;
      if (this.buf.length < headerBytes + len) break;
      const word = this.buf.subarray(headerBytes, headerBytes + len).toString('utf8');
      this.buf = this.buf.subarray(headerBytes + len);
      if (len === 0) {
        // sentence terminator
        const sentence = this.words;
        this.words = [];
        const w = this.waiters.shift();
        if (w) w(sentence);
        else this.sentences.push(sentence);
      } else {
        this.words.push(word);
      }
    }
  }

  private readSentence(timeoutMs: number): Promise<string[]> {
    const queued = this.sentences.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('read timeout')), timeoutMs);
      this.waiters.push((s) => {
        clearTimeout(t);
        resolve(s);
      });
    });
  }

  private writeSentence(words: string[]): void {
    const parts: Buffer[] = [];
    for (const w of words) {
      const wb = Buffer.from(w, 'utf8');
      parts.push(encodeLength(wb.length), wb);
    }
    parts.push(Buffer.from([0])); // terminator
    this.sock.write(Buffer.concat(parts));
  }

  /** Read reply sentences until !done/!fatal; collect !trap message + =ret=. */
  private async readReply(timeoutMs: number): Promise<CommandResult> {
    let trap: string | undefined;
    let ret: string | undefined;
    for (;;) {
      const s = await this.readSentence(timeoutMs);
      const type = s[0] ?? '';
      for (const w of s.slice(1)) {
        if (w.startsWith('=ret=')) ret = w.slice(5);
        if (w.startsWith('=message=')) trap = w.slice(9);
      }
      if (type === '!trap') trap = trap ?? 'trap';
      if (type === '!fatal') return { ok: false, error: 'fatal: ' + (s[1] ?? '') };
      if (type === '!done') return trap ? { ok: false, error: trap } : { ok: true, ret };
    }
  }

  async login(user: string, pass: string, timeoutMs = 8000): Promise<CommandResult> {
    this.writeSentence(['/login', `=name=${user}`, `=password=${pass}`]);
    return this.readReply(timeoutMs);
  }

  async command(words: string[], timeoutMs = 8000): Promise<CommandResult> {
    this.writeSentence(words);
    return this.readReply(timeoutMs);
  }

  /**
   * Read-only print: run a `.../print` command and collect the attribute map from
   * each `!re` row. Used by the owner "Test Koneksi" — NEVER writes to the router.
   */
  async print(
    words: string[],
    timeoutMs = 8000,
  ): Promise<{ ok: boolean; rows: Record<string, string>[]; error?: string }> {
    this.writeSentence(words);
    const rows: Record<string, string>[] = [];
    let trap: string | undefined;
    for (;;) {
      const s = await this.readSentence(timeoutMs);
      const type = s[0] ?? '';
      if (type === '!re') {
        const attrs: Record<string, string> = {};
        for (const w of s.slice(1)) {
          const eq = w.indexOf('=', 1);
          if (w.startsWith('=') && eq > 0) attrs[w.slice(1, eq)] = w.slice(eq + 1);
        }
        rows.push(attrs);
      } else if (type === '!trap') {
        for (const w of s.slice(1)) if (w.startsWith('=message=')) trap = w.slice(9);
      } else if (type === '!fatal') {
        return { ok: false, rows, error: 'fatal: ' + (s[1] ?? '') };
      } else if (type === '!done') {
        return trap ? { ok: false, rows, error: trap } : { ok: true, rows };
      }
    }
  }

  close(): void {
    try {
      this.sock?.end();
      this.sock?.destroy();
    } catch {
      /* ignore */
    }
  }
}
