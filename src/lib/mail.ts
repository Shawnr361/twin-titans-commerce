import net from 'node:net';
import tls from 'node:tls';

/**
 * A minimal SMTP client.
 *
 * WHY THIS IS HAND-WRITTEN AND NOT NODEMAILER
 * -------------------------------------------
 * The deploy ships only `.next`; scripts/server-deploy.sh never runs an
 * install, so node_modules on the server is whatever was put there long ago.
 * Adding a dependency would therefore build cleanly here and then throw
 * MODULE_NOT_FOUND in production — the worst possible failure mode for the one
 * path a customer uses to report a problem. Everything below is node builtins.
 *
 * The default target is the local mail server on 127.0.0.1:25, because the
 * support mailbox lives on this same host, so a contact message is a LOCAL
 * delivery and needs no relaying, no credentials and no third-party service.
 * Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS to send somewhere else.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

const HOST = process.env.SMTP_HOST || '127.0.0.1';
const PORT = Number(process.env.SMTP_PORT || 25);
const USER = process.env.SMTP_USER || '';
const PASS = process.env.SMTP_PASS || '';
const TIMEOUT_MS = 15_000;

/**
 * Strip CR and LF from anything that goes into a header.
 *
 * Without this, a newline in the subject or a reply-to address lets a sender
 * inject extra headers — including Bcc — and turn the contact form into an
 * open relay for spam. The customer's own message body is safe: it lives after
 * the header block and is dot-stuffed below.
 */
function header(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** SMTP wants CRLF, and a lone "." would end the DATA stage early. */
function dotStuff(body: string): string {
  return body.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

interface Conn {
  socket: net.Socket | tls.TLSSocket;
  read(): Promise<string>;
}

function connect(): Promise<Conn> {
  return new Promise((resolve, reject) => {
    const socket: net.Socket =
      PORT === 465
        ? tls.connect({ host: HOST, port: PORT, servername: HOST, rejectUnauthorized: false })
        : net.connect({ host: HOST, port: PORT });

    socket.setTimeout(TIMEOUT_MS);

    let buffer = '';
    let waiting: ((line: string) => void) | null = null;
    let failed: ((err: Error) => void) | null = null;

    const flush = () => {
      if (!waiting) return;
      /*
       * A reply may span several lines: "250-SIZE" then "250 HELP". Only the
       * line whose code is followed by a SPACE ends it, so waiting for a
       * newline alone would read a continuation and desynchronise every
       * command after it.
       */
      const match = buffer.match(/^\d{3} [^\r\n]*\r?\n/m);
      if (!match) return;
      const idx = buffer.indexOf(match[0]);
      const reply = buffer.slice(0, idx + match[0].length);
      buffer = buffer.slice(idx + match[0].length);
      const done = waiting;
      waiting = null;
      done(reply);
    };

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      flush();
    });
    socket.on('error', (err) => {
      if (failed) failed(err);
      else reject(err);
    });
    socket.on('timeout', () => socket.destroy(new Error('SMTP timed out.')));

    const read = () =>
      new Promise<string>((res, rej) => {
        waiting = res;
        failed = rej;
        flush();
      });

    socket.on('connect', () => resolve({ socket, read }));
    if (PORT === 465) socket.on('secureConnect', () => resolve({ socket, read }));
  });
}

async function say(conn: Conn, command: string, expect: number): Promise<string> {
  if (command) conn.socket.write(command + '\r\n');
  const reply = await conn.read();
  const code = Number(reply.slice(0, 3));
  if (code !== expect) {
    throw new Error(`SMTP: expected ${expect}, got ${reply.trim().slice(0, 120)}`);
  }
  return reply;
}

/** True when a send can even be attempted. */
export function isMailConfigured(): boolean {
  return Boolean(HOST && PORT);
}

/**
 * Send one message. Throws on failure — callers decide what the customer sees,
 * and must never report success for a message that was not accepted.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const from = header(process.env.SMTP_FROM || `no-reply@${(message.to.split('@')[1] ?? 'localhost')}`);
  const to = header(message.to);

  const conn = await connect();
  try {
    await say(conn, '', 220);
    const greeting = await say(conn, `EHLO ${HOST}`, 250);

    if (USER && PASS && /AUTH[ -=]/i.test(greeting)) {
      await say(conn, 'AUTH LOGIN', 334);
      await say(conn, Buffer.from(USER).toString('base64'), 334);
      await say(conn, Buffer.from(PASS).toString('base64'), 235);
    }

    await say(conn, `MAIL FROM:<${from}>`, 250);
    await say(conn, `RCPT TO:<${to}>`, 250);
    await say(conn, 'DATA', 354);

    const headers = [
      `From: Twin Titans Emporium <${from}>`,
      `To: <${to}>`,
      message.replyTo ? `Reply-To: <${header(message.replyTo)}>` : '',
      `Subject: ${header(message.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      `Date: ${new Date().toUTCString()}`,
    ]
      .filter(Boolean)
      .join('\r\n');

    conn.socket.write(`${headers}\r\n\r\n${dotStuff(message.text)}\r\n.\r\n`);
    await say(conn, '', 250);
    await say(conn, 'QUIT', 221).catch(() => undefined);
  } finally {
    conn.socket.destroy();
  }
}
