/*
 * The button on an AliExpress product page.
 *
 * IT READS THE URL AND NOTHING ELSE.
 *
 * No scraping. Everything about the product — title, images, video, variants,
 * prices, SKUs — is fetched by the store from the AliExpress API, which is the
 * source of truth. Reading the page would put us back in the business of
 * guessing at markup that changes without warning, and of trusting whatever had
 * finished rendering, which is exactly the bug that left every product in the
 * catalogue without a supplier SKU.
 *
 * So this file has one job: find the product id, and hand it over.
 */

(function () {
  'use strict';

  /** AliExpress puts the id in the path on every product URL shape it uses. */
  function productId() {
    var m = location.pathname.match(/\/item\/(?:[^/]+\/)?(\d{6,})/);
    return m ? m[1] : null;
  }

  var id = productId();
  if (!id || document.getElementById('tt-add-root')) return;

  var root = document.createElement('div');
  root.id = 'tt-add-root';

  var button = document.createElement('button');
  button.id = 'tt-add-button';
  button.type = 'button';
  button.textContent = 'Add to Twin Titans';

  var note = document.createElement('p');
  note.id = 'tt-add-note';
  note.hidden = true;

  root.appendChild(button);
  root.appendChild(note);
  document.body.appendChild(root);

  function say(text, kind) {
    note.textContent = text;
    note.hidden = false;
    note.className = kind || '';
  }

  button.addEventListener('click', function () {
    button.disabled = true;
    button.textContent = 'Adding…';
    note.hidden = true;

    /*
     * The request is made by the background worker, not from here. A content
     * script runs inside the AliExpress page and inherits its
     * Content-Security-Policy, which blocks calls to our domain — the same wall
     * the bookmarklet hits. A service worker has its own context and no such
     * policy, which is the whole reason this is an extension.
     */
    chrome.runtime.sendMessage({ type: 'tt-add', url: location.href, id: id }, function (reply) {
      button.disabled = false;
      button.textContent = 'Add to Twin Titans';

      if (!reply || !reply.ok) {
        say((reply && reply.error) || 'Could not reach your store.', 'tt-bad');
        return;
      }
      if (reply.warning) {
        say(reply.warning, 'tt-warn');
        return;
      }
      var q = reply.quality || {};
      say(
        'Added — ' +
          (q.variantCount || 0) +
          ' variants, ' +
          (q.imageCount || 0) +
          ' images' +
          (q.videoCount ? ', ' + q.videoCount + ' video' : '') +
          '. Price it in your admin.',
        'tt-good'
      );
    });
  });
})();
