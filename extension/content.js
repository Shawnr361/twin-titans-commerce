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
 * So this file has two jobs: find the product id, and stay out of the way.
 */

/*
 * Firefox exposes `browser`, Chrome exposes `chrome`. Firefox also provides
 * `chrome` as an alias in MV3, but not in every version, and the options page
 * uses promise-style storage which only `browser` guarantees. One line at the
 * top of each file costs nothing and removes the whole question.
 */
var api = typeof browser !== 'undefined' ? browser : chrome;

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
  button.title = 'Click to add. Drag to move.';

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

  /* ---- dragging ---------------------------------------------------------
   *
   * The button is both draggable and clickable, which is the whole difficulty:
   * every drag ends in a click event, and firing an import because someone
   * nudged the button two pixels would be unforgivable — it spends nothing, but
   * it silently fills the queue with products nobody asked for.
   *
   * So a press only becomes a drag once the pointer has travelled past a small
   * threshold, and if it does, the click that follows is swallowed. Below the
   * threshold nothing moves and the click goes through as normal.
   */
  var DRAG_THRESHOLD = 4;
  var press = null;
  var dragged = false;

  /** Keep a good part of it on screen, whatever the window has been resized to. */
  function clamp(left, top) {
    var box = root.getBoundingClientRect();
    var maxLeft = Math.max(0, window.innerWidth - box.width - 4);
    var maxTop = Math.max(0, window.innerHeight - 44);
    return {
      left: Math.min(Math.max(4, left), maxLeft),
      top: Math.min(Math.max(4, top), maxTop),
    };
  }

  function place(left, top) {
    var at = clamp(left, top);
    root.style.left = at.left + 'px';
    root.style.top = at.top + 'px';
    return at;
  }

  // Where the merchant last left it. Per browser profile, not per page.
  try {
    api.storage.sync.get({ buttonAt: null }, function (stored) {
      if (stored && stored.buttonAt) place(stored.buttonAt.left, stored.buttonAt.top);
    });
  } catch (e) {
    /* Storage unavailable: the CSS default position still applies. */
  }

  button.addEventListener('pointerdown', function (event) {
    if (event.button !== 0) return;
    var box = root.getBoundingClientRect();
    press = {
      x: event.clientX,
      y: event.clientY,
      left: box.left,
      top: box.top,
      id: event.pointerId,
    };
    dragged = false;
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener('pointermove', function (event) {
    if (!press) return;
    var dx = event.clientX - press.x;
    var dy = event.clientY - press.y;

    if (!dragged && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    dragged = true;
    root.classList.add('tt-dragging');
    place(press.left + dx, press.top + dy);
  });

  function endPress(event) {
    if (!press) return;
    try {
      button.releasePointerCapture(press.id);
    } catch (e) {
      /* Already released — nothing to undo. */
    }
    press = null;
    root.classList.remove('tt-dragging');

    if (dragged) {
      var box = root.getBoundingClientRect();
      try {
        api.storage.sync.set({ buttonAt: { left: box.left, top: box.top } });
      } catch (e) {
        /* Not worth telling anyone: the position simply will not persist. */
      }
    }
  }

  button.addEventListener('pointerup', endPress);
  button.addEventListener('pointercancel', endPress);

  // A window that shrank must not leave the button off screen.
  window.addEventListener('resize', function () {
    var box = root.getBoundingClientRect();
    place(box.left, box.top);
  });

  button.addEventListener('click', function (event) {
    // The click that ends a drag is not a click on the button.
    if (dragged) {
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

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
    api.runtime.sendMessage({ type: 'tt-add', url: location.href, id: id }, function (reply) {
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
