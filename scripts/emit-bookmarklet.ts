/*
 * Emit the capture bookmarklet and prove it parses.
 *
 * The script is a string inside a template literal, so a backslash in it is
 * consumed before it ever reaches the browser: `\s` became `s`, and `\n`
 * became a real newline that terminated a string mid-statement. Both shipped
 * silently, because nothing type-checks the inside of a template literal.
 *
 * new Function() compiles without executing, which is enough to catch it.
 * Run with a path to also write the script out for inspection.
 */
import { writeFileSync } from 'node:fs';
import { buildCaptureScript } from '../src/lib/suppliers/bookmarklet';

const url = buildCaptureScript('https://twintitanemporium.com/api/admin/capture', 'DRYRUN_TOKEN');
const src = decodeURIComponent(url.replace(/^javascript:/, ''));

const out = process.argv[2];
if (out) writeFileSync(out, src, 'utf8');

try {
  new Function(src);
} catch (err) {
  console.error(`FATAL: the generated bookmarklet does not parse: ${(err as Error).message}`);
  console.error('This is almost always a backslash that did not survive the template literal.');
  process.exit(1);
}

console.log(`bookmarklet OK — ${src.length} chars, parses cleanly`);
