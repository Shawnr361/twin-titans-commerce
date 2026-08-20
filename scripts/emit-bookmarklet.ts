import { buildCaptureScript } from '../src/lib/suppliers/bookmarklet';
import { writeFileSync } from 'node:fs';
const url = buildCaptureScript('https://twintitanemporium.com/api/admin/capture', 'DRYRUN_TOKEN');
const src = decodeURIComponent(url.replace(/^javascript:/, ''));
writeFileSync(process.argv[2], src, 'utf8');
console.log('emitted', src.length, 'chars');
