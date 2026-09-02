/*
 * Settings, kept in chrome.storage.sync so they follow the signed-in browser.
 *
 * The token is a password field and never rendered back into the page after
 * saving beyond what the user typed — it grants the right to add captures to
 * the store, so it is treated like a credential rather than a preference.
 */

/*
 * Firefox exposes `browser`, Chrome exposes `chrome`. Firefox also provides
 * `chrome` as an alias in MV3, but not in every version, and the options page
 * uses promise-style storage which only `browser` guarantees. One line at the
 * top of each file costs nothing and removes the whole question.
 */
var api = typeof browser !== 'undefined' ? browser : chrome;
const DEFAULTS = { store: 'https://twintitansemporium.store', token: '' };

const $store = document.getElementById('store');
const $token = document.getElementById('token');
const $saved = document.getElementById('saved');

api.storage.sync.get(DEFAULTS).then((s) => {
  $store.value = s.store || DEFAULTS.store;
  $token.value = s.token || '';
});

document.getElementById('save').addEventListener('click', async () => {
  await api.storage.sync.set({
    store: ($store.value || DEFAULTS.store).trim().replace(/\/+$/, ''),
    token: $token.value.trim(),
  });
  $saved.textContent = 'Saved';
  setTimeout(() => ($saved.textContent = ''), 1800);
});
