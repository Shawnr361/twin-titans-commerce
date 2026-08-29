import { buildCaptureScript } from './src/lib/suppliers/bookmarklet';
const s = buildCaptureScript('https://twintitanemporium.com/api/admin/capture', '9b8f40572346186099ff53529cee05df');
console.log(s.length);
require('fs').writeFileSync('capture-script.js', s);
