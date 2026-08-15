/**
 * Passenger entrypoint (DirectAdmin / CloudLinux Node.js Selector).
 *
 * Phusion Passenger boots this file and hooks `listen()` itself, so the port we
 * pass is largely nominal — Passenger hands us its own socket. This is why the
 * app must NOT use Next's `standalone` output here: standalone emits its own
 * server at .next/standalone/server.js, which Passenger would never reach.
 *
 * Local dev and Docker are unaffected; they use `next dev` / `next start`.
 */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const port = parseInt(process.env.PORT, 10) || 3400;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      // Passenger can hand over a request with the app's base URI already
      // stripped; parsing defensively keeps routing correct either way.
      handle(req, res, parse(req.url, true));
    }).listen(port, (err) => {
      if (err) throw err;
      console.log(`> Twin Titans store ready on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start Next.js:', err);
    process.exit(1);
  });
