/*
 * The only place that talks to the store.
 *
 * A content script inherits AliExpress's Content-Security-Policy and cannot
 * post to our domain. This worker has its own context and no such policy, which
 * is precisely why a bookmarklet could never do this job and an extension can.
 *
 * The token is the same capture token the bookmarklet uses, derived from
 * AUTH_SECRET on the server. It is kept in extension storage, which is not
 * readable by any web page — unlike a bookmarklet, where the token sits in the
 * bookmark's own URL in plain sight.
 */

/*
 * Firefox exposes `browser`, Chrome exposes `chrome`. Firefox also provides
 * `chrome` as an alias in MV3, but not in every version, and the options page
 * uses promise-style storage which only `browser` guarantees. One line at the
 * top of each file costs nothing and removes the whole question.
 */
var api = typeof browser !== 'undefined' ? browser : chrome;

const DEFAULTS = { store: 'https://twintitansemporium.store', token: '' };

async function settings() {
  const stored = await api.storage.sync.get(DEFAULTS);
  return { store: (stored.store || DEFAULTS.store).replace(/\/+$/, ''), token: stored.token || '' };
}

api.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type !== 'tt-add') return false;

  (async () => {
    const { store, token } = await settings();
    if (!token) {
      respond({ ok: false, error: 'Open the extension options and paste your capture token.' });
      return;
    }

    try {
      const res = await fetch(store + '/api/admin/import/from-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-capture-token': token },
        body: JSON.stringify({ url: message.url || message.id }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.ok) {
        respond({
          ok: false,
          error:
            res.status === 401
              ? 'Your store rejected the token. Copy it again from Admin → Add a product.'
              : body.error || 'The store could not fetch that product.',
        });
        return;
      }
      respond({ ok: true, quality: body.quality, warning: body.warning, title: body.title });
    } catch (err) {
      respond({ ok: false, error: 'Could not reach ' + store + '. Is the address right?' });
    }
  })();

  // Keeps the message channel open for the async reply above.
  return true;
});
