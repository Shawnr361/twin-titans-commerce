/**
 * The in-page capture script.
 *
 * This string is served to the admin, who saves it as a bookmark. Clicking it
 * on any supplier product page runs it IN THAT PAGE — same origin, same
 * session, same rendered state as a human sees. It reads the product globals
 * directly, so there is no scraping, no anti-bot wall, and no guessing from
 * HTML: the data is simply already there as JavaScript objects.
 *
 * It handles the three shapes AliExpress serves (they A/B test heavily), plus
 * Alibaba and 1688, and falls back to JSON-LD for anything else.
 *
 * Kept as a plain string rather than a real module because it must execute in
 * a foreign page with no bundler, no imports and no build step.
 */
export function buildCaptureScript(endpoint: string, token: string): string {
  const src = `(async function(){
  var OUT = ${JSON.stringify(endpoint)};
  var TOKEN = ${JSON.stringify(token)};

  function note(msg, bad){
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;z-index:2147483647;top:16px;right:16px;max-width:340px;padding:14px 16px;'
      + 'font:14px/1.5 system-ui,sans-serif;color:#F2EDE3;background:' + (bad ? '#7a2018' : '#16150F')
      + ';border:1px solid ' + (bad ? '#c0503f' : '#C9A227') + ';border-radius:2px;box-shadow:0 10px 40px rgba(0,0,0,.5)';
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function(){ d.remove(); }, 7000);
  }

  function abs(u){
    if(!u) return '';
    u = String(u);
    if(u.indexOf('//') === 0) return 'https:' + u;
    if(u.indexOf('http') === 0) return u;
    return 'https://' + u.replace(/^\\/+/, '');
  }
  // AliExpress appends display transforms; strip them for the original file.
  function bigImage(u){ return abs(u).replace(/_\\d+x\\d+.*$/, '').replace(/\\.jpg_.*$/, '.jpg'); }
  function num(v){
    if(v === null || v === undefined) return 0;
    var n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isFinite(n) ? n : 0;
  }

  // Different sized renditions of one photo normalise to the same URL, so the
  // gallery ends up holding the same picture several times over. The storefront
  // takes images[1] as the hover image and showed the main shot twice.
  function uniq(list){
    var seen = {}, out = [];
    for(var i = 0; i < list.length; i++){
      var u = list[i];
      if(u && !seen[u]){ seen[u] = 1; out.push(u); }
    }
    return out;
  }

  // AliExpress serves the same photo at many sizes: "....png_640x640.png".
  // bigImage only understood the .jpg form, so .png renditions of one picture
  // stayed distinct and the gallery filled up with duplicates.
  function normUrl(u){
    u = String(u || '').trim();
    if(u.indexOf('//') === 0) u = 'https:' + u;
    var exts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    var low = u.toLowerCase();
    for(var i = 0; i < exts.length; i++){
      var p = low.indexOf(exts[i] + '_');
      if(p > -1){ u = u.slice(0, p + exts[i].length); break; }
    }
    return u;
  }

  // Product photos live under /kf/ on the supplier CDN. The rest of the page is
  // chrome, icons and other sellers' recommendations - importing those would
  // show the buyer pictures of something they are not buying.
  function isProductImage(u){
    if(!u) return false;
    if(u.indexOf('/kf/') < 0) return false;
    if(u.indexOf('48x48') > -1 || u.indexOf('50x50') > -1 || u.indexOf('64x64') > -1) return false;
    return true;
  }

  // Supplier sites append their own brand to <title>. It is not part of the
  // product name and reads badly as a storefront heading.
  function cleanTitle(t){
    t = String(t || '').trim();
    var tails = [' - AliExpress', ' | AliExpress', ' - Alibaba.com', ' - 1688.com'];
    for(var i = 0; i < tails.length; i++){
      var tail = tails[i];
      if(t.length > tail.length && t.slice(-tail.length).toLowerCase() === tail.toLowerCase()){
        t = t.slice(0, -tail.length).trim();
      }
    }
    return t;
  }

  // "Sold ByHarvester Hair Store(Trader)" -> "Harvester Hair Store".
  function cleanStore(s){
    s = String(s || '').trim();
    if(s.slice(0, 7).toLowerCase() === 'sold by') s = s.slice(7).trim();
    var p = s.indexOf('(');
    if(p > 0) s = s.slice(0, p).trim();
    return s.slice(0, 80);
  }

  var host = location.hostname;
  var platform = /aliexpress/i.test(host) ? 'ALIEXPRESS'
    : /alibaba/i.test(host) ? 'ALIBABA'
    : /1688/.test(host) ? 'C1688' : 'OTHER';

  var out = {
    sourceUrl: location.href, platform: platform,
    title: '', descriptionHtml: '', currency: 'USD',
    images: [], videos: [], variants: [], reviews: []
  };

  var idm = location.href.match(/(?:item|offer|product-detail)[^0-9]*(\\d{6,})/);
  if(idm) out.externalId = idm[1];

  // --- AliExpress -------------------------------------------------------
  var rp = window.runParams || (window._d_c_ && window._d_c_.DCData) || window.__AER_DATA__ || null;
  var d = rp && (rp.data || rp);

  if(d && (d.skuModule || d.priceModule || d.titleModule)){
    if(d.titleModule){
      out.title = d.titleModule.subject || '';
      if(d.titleModule.feedbackRating){
        out.rating = num(d.titleModule.feedbackRating.averageStar) || undefined;
        out.reviewCount = parseInt(d.titleModule.feedbackRating.totalValidNum, 10) || undefined;
      }
      var tc = d.titleModule.formatTradeCount || d.titleModule.tradeCount;
      if(tc) out.ordersCount = parseInt(String(tc).replace(/\\D/g, ''), 10) || undefined;
    }
    if(d.imageModule && d.imageModule.imagePathList){
      out.images = d.imageModule.imagePathList.map(bigImage);
    }
    // Video: the field name differs by page version.
    var vid = (d.imageModule && (d.imageModule.videoUrl || d.imageModule.videoId))
      || (d.videoModule && d.videoModule.videoUrl);
    if(vid) out.videos.push(abs(vid));

    if(d.storeModule){
      out.supplierName = d.storeModule.storeName;
      if(d.storeModule.storeURL) out.supplierStoreUrl = abs(d.storeModule.storeURL);
    }
    if(d.priceModule && d.priceModule.currencyCode) out.currency = d.priceModule.currencyCode;

    // Ship cost + origin.
    try{
      var fr = d.shippingModule.generalFreightInfo.originalLayoutResultList[0].bizData;
      out.shippingCost = num(fr.displayAmount || fr.freightAmount && fr.freightAmount.value);
      if(fr.shipFrom) out.shipsFrom = fr.shipFrom;
      if(fr.deliveryDate) out.deliveryEstimate = String(fr.deliveryDate);
    }catch(e){}

    // Variants: map propertyValueId -> readable name, then walk the SKU list.
    var names = {};
    try{
      (d.skuModule.productSKUPropertyList || []).forEach(function(p){
        (p.skuPropertyValues || []).forEach(function(v){
          names[p.skuPropertyId + ':' + v.propertyValueId] = {
            prop: p.skuPropertyName,
            val: v.propertyValueDisplayName || v.propertyValueName,
            img: v.skuPropertyImagePath ? bigImage(v.skuPropertyImagePath) : ''
          };
        });
      });
    }catch(e){}

    try{
      (d.skuModule.skuPriceList || []).forEach(function(s){
        var opts = {}, img = '';
        String(s.skuPropIds || '').split(',').filter(Boolean).forEach(function(pid){
          for(var k in names){
            if(k.split(':')[1] === pid){ opts[names[k].prop] = names[k].val; if(!img) img = names[k].img; }
          }
        });
        var sv = s.skuVal || {};
        out.variants.push({
          skuId: String(s.skuId || s.skuIdStr || ''),
          options: opts,
          price: num(sv.skuActivityAmount && sv.skuActivityAmount.value) || num(sv.skuAmount && sv.skuAmount.value),
          compareAtPrice: num(sv.skuAmount && sv.skuAmount.value) || undefined,
          stock: parseInt(sv.availQuantity, 10) || undefined,
          imageUrl: img || undefined
        });
      });
    }catch(e){}

    // Description lives on a separate endpoint; fetch it with the page's session.
    try{
      var du = d.descriptionModule && d.descriptionModule.descriptionUrl;
      if(du){
        var r = await fetch(abs(du), { credentials: 'omit' });
        if(r.ok) out.descriptionHtml = (await r.text()).slice(0, 200000);
      }
    }catch(e){}

    // Reviews, best effort — never invent them.
    try{
      var rr = await fetch('https://feedback.aliexpress.com/display/productEvaluation.htm?productId='
        + out.externalId + '&page=1', { credentials: 'omit' });
      if(rr.ok){
        var doc = new DOMParser().parseFromString(await rr.text(), 'text/html');
        doc.querySelectorAll('.feedback-item').forEach(function(el){
          var starEl = el.querySelector('.star-view > span');
          out.reviews.push({
            author: (el.querySelector('.user-name') || {}).textContent || undefined,
            country: ((el.querySelector('.user-country') || {}).textContent || '').trim() || undefined,
            body: ((el.querySelector('.buyer-feedback span') || {}).textContent || '').trim() || undefined,
            date: ((el.querySelector('.r-time-new') || {}).textContent || '').trim() || undefined,
            rating: starEl ? num(starEl.style.width) / 20 : undefined,
            images: Array.prototype.map.call(el.querySelectorAll('.pic-view-item img'), function(i){
              return bigImage(i.getAttribute('src'));
            })
          });
        });
      }
    }catch(e){}
  }

  // --- AliExpress client-rendered PDP -----------------------------------
  // Newer product pages render entirely client-side: runParams is an empty
  // object, _d_c_.DCData holds only the gallery, and NOTHING is embedded in
  // the HTML. The whole SKU matrix lives on a React prop named skuInstance,
  // so reach it through the fiber that React leaves on the DOM node.
  if(platform === 'ALIEXPRESS' && !out.variants.length){
    try{
      var fiberOf = function(el){
        var ks = Object.keys(el);
        for(var i = 0; i < ks.length; i++){
          if(ks[i].indexOf('__reactFiber') === 0 || ks[i].indexOf('__reactInternalInstance') === 0) return el[ks[i]];
        }
        return null;
      };
      var si = null;
      var pool = document.querySelectorAll('[class*="sku"]');
      if(!pool.length) pool = document.querySelectorAll('div');
      for(var pi = 0; pi < pool.length && !si; pi++){
        var f = fiberOf(pool[pi]), hops = 0;
        while(f && hops < 40){
          if(f.memoizedProps && f.memoizedProps.skuInstance){ si = f.memoizedProps.skuInstance; break; }
          f = f.return; hops++;
        }
      }

      var sd = si && si.data;
      if(sd && sd.info){
        // propertyId -> { name, vals: { valueId: label } }
        var props = {};
        // Each option value carries its own photo. Discarding these was why a
        // 16-colour listing imported with only the handful of gallery shots and
        // no way to show the buyer the colour they actually chose.
        var valueImages = {};
        (sd.ids || []).forEach(function(pid){
          var p = sd[pid];
          if(!p) return;
          var vals = {};
          (p.ids || []).forEach(function(vid){
            var v = p[vid];
            if(!v) return;
            vals[vid] = v.name;
            var img = v.image || v.thumbnail || (v.data && v.data.skuPropertyImagePath);
            if(img) valueImages[vid] = normUrl(img);
          });
          props[pid] = { name: p.name, vals: vals };
        });

        // "NGN 12,345.67" and "R$ 1.234,56" both defeat naive parsing, so use
        // the pre-split local form when present: "<display>|<int>|<fraction>".
        var priceOf = function(rec){
          var loc = rec.skuCurrentPriceLocal;
          if(loc && String(loc).indexOf('|') > -1){
            var a = String(loc).split('|');
            var n = parseFloat(a[1] + '.' + (a[2] || '0'));
            if(isFinite(n)) return n;
          }
          return num(String(rec.skuCurrentPrice || '').replace(/,/g, ''));
        };

        var variantImages = [];
        Object.keys(sd.info).forEach(function(key){
          var rec = sd.info[key], opts = {}, vimg = '';
          key.split(',').forEach(function(vid){
            for(var pid in props){
              if(props[pid].vals[vid] !== undefined) opts[props[pid].name] = props[pid].vals[vid];
            }
            if(!vimg && valueImages[vid]) vimg = valueImages[vid];
          });
          /*
           * A listing whose properties are known but whose key resolves to no
           * option at all is a placeholder row, not a buyable SKU. Imported as
           * one it becomes a "Default" button sitting beside the real colours,
           * which is what a shopper then has to guess about. Products with no
           * properties are left alone: there, one optionless SKU IS the
           * product.
           */
          if(sd.ids && sd.ids.length && !Object.keys(opts).length) return;

          if(vimg) variantImages.push(vimg);

          /*
           * Cost is the regular price, not the countdown-sale one. These
           * listings are on "sale" almost permanently, so costing at today's
           * figure prices the whole catalogue against a number that expires -
           * a 45% margin becomes 27% the week the timer runs out. The sale
           * price travels alongside as promoPrice, for information.
           */
          var promoPrice = priceOf(rec);
          var listPrice = num(rec.skuOriginalPriceValue) || promoPrice;
          var cost = listPrice > promoPrice ? listPrice : promoPrice;

          out.variants.push({
            skuId: String(rec.skuId || ''),
            options: opts,
            price: cost,
            promoPrice: promoPrice < cost ? promoPrice : undefined,
            stock: parseInt(rec.skuStock, 10) || 0,
            imageUrl: vimg || undefined
          });
        });
        // Every distinct swatch belongs in the gallery too, after the main shots.
        out.images = out.images.concat(uniq(variantImages));

        // These prices are in the VIEWER's currency, not USD. Getting this
        // wrong prices every variant against the wrong cost, so read it off
        // the rendered string rather than assuming.
        var sample = sd.info[Object.keys(sd.info)[0]] || {};
        var shown = String(sample.skuCurrentPrice || '');
        var code = shown.match(/[A-Z]{3}/);
        if(code){ out.currency = code[0]; }
        else {
          // Longest symbol first: 'R$' must beat '$', or a real is costed
          // as a dollar and every variant prices below cost.
          var SYM = { 'R$':'BRL', 'US$':'USD', 'A$':'AUD', 'C$':'CAD', 'NZ$':'NZD',
                      'HK$':'HKD', 'NT$':'TWD', 'S$':'SGD', 'MX$':'MXN',
                      '₦':'NGN', '$':'USD', '€':'EUR', '£':'GBP', '₽':'RUB',
                      '₹':'INR', '¥':'CNY', '₩':'KRW', '₺':'TRY', '₪':'ILS',
                      '₫':'VND', '฿':'THB', '₱':'PHP' };
          var sym = shown.replace(/[0-9.,]/g, '').trim();
          var syms = Object.keys(SYM).sort(function(a, b){ return b.length - a.length; });
          var matched = '';
          for(var ki = 0; ki < syms.length; ki++){
            if(sym.indexOf(syms[ki]) > -1){ matched = SYM[syms[ki]]; break; }
          }
          // Never silently claim USD. XXX is the ISO code for "no currency",
          // so an unrecognised symbol travels as an explicit unknown and the
          // raw text below records what was actually on the page.
          // raw.priceSample below preserves the exact string either way.
          out.currency = matched || 'XXX';
        }
        out.raw = { shape: 'skuInstance', priceSample: shown, propertyOrder: sd.ids || [] };
      }
    }catch(e){}

    /*
     * _d_c_.DCData is one mutable slot holding whichever component rendered
     * into it last, so reading the gallery from it alone is a race: it yielded
     * 2 images on a listing that actually carries 6. Merge it with the rendered
     * thumbnail rail and keep anything that looks like a product photo. Main
     * gallery goes first so the hero image stays the hero image.
     */
    try{
      var pool = [];
      var dcd = window._d_c_ && window._d_c_.DCData;
      if(dcd) pool = pool.concat(dcd.imagePathList || [], dcd.summImagePathList || []);
      var rail = document.querySelectorAll(
        '[class*="slider--item"] img, [class*="gallery"] img, [class*="image-view"] img, [class*="magnifier"] img'
      );
      Array.prototype.forEach.call(rail, function(i){
        pool.push(i.getAttribute('src') || i.getAttribute('data-src'));
      });
      out.images = uniq(pool.map(normUrl).filter(isProductImage)).concat(out.images);
    }catch(e){}

    /*
     * Shipping. The freight module the old layout exposed is gone, and what
     * replaced it is conditional: "Free shipping over N" means this item on its
     * own is NOT free. Only an unconditional "Free shipping" can be stated as
     * zero. Anything else is left unset, and the importer asks rather than
     * quietly pricing delivery at nothing.
     */
    try{
      // String.fromCharCode(10) rather than an escape: a backslash does not
      // survive the template literal this script is embedded in.
      var lines = (document.body.innerText || '').split(String.fromCharCode(10));
      for(var li = 0; li < lines.length; li++){
        var t = lines[li].trim().toLowerCase();
        if(t.indexOf('free shipping') === 0 && t.indexOf('over') < 0 && t.indexOf('add') < 0){
          out.shippingCost = 0;
          break;
        }
      }
      for(var lj = 0; lj < lines.length; lj++){
        if(lines[lj].indexOf('Delivery:') > -1){
          out.deliveryEstimate = lines[lj].split('Delivery:')[1].trim().slice(0, 80);
          break;
        }
      }
    }catch(e){}

    // Store name, when the layout renders a store link.
    try{
      if(!out.supplierName){
        var sl = document.querySelector('a[href*="/store/"]');
        if(sl) out.supplierName = sl.textContent.trim().replace(/^Sold By/i, '').slice(0, 80);
      }
    }catch(e){}
  }

  // --- Alibaba / 1688 / anything else: JSON-LD + og fallback -------------
  if(!out.title){
    var ld = document.querySelector('script[type="application/ld+json"]');
    if(ld){
      try{
        var j = JSON.parse(ld.textContent);
        j = Array.isArray(j) ? j[0] : j;
        out.title = j.name || '';
        if(j.image) out.images = [].concat(j.image).map(bigImage);
        if(j.offers){
          var o = [].concat(j.offers)[0];
          if(o.priceCurrency) out.currency = o.priceCurrency;
          if(o.price) out.variants.push({ options: {}, price: num(o.price) });
        }
      }catch(e){}
    }
  }
  if(!out.title){
    var og = document.querySelector('meta[property="og:title"]');
    out.title = (og && og.content) || document.title || '';
  }
  if(!out.images.length){
    out.images = Array.prototype.slice.call(document.querySelectorAll('meta[property="og:image"]'))
      .map(function(m){ return bigImage(m.content); });
  }
  // Any <video> the page rendered.
  Array.prototype.forEach.call(document.querySelectorAll('video source, video'), function(v){
    var s = v.getAttribute('src'); if(s && out.videos.indexOf(abs(s)) < 0) out.videos.push(abs(s));
  });
  /*
   * The player usually boots with an empty src and resolves the file later, so
   * reading the <video> element alone finds nothing. The real URL is sitting in
   * the page source. [/] and [.] stand in for escaped characters on purpose:
   * a backslash does not survive the template literal this script lives in.
   */
  try{
    var found = document.documentElement.outerHTML.match(/https?:[/][/][^"' <>]+[.]mp4/g) || [];
    found.forEach(function(u){ if(out.videos.indexOf(u) < 0) out.videos.push(u); });
  }catch(e){}

  out.title = cleanTitle(out.title);
  if(out.supplierName) out.supplierName = cleanStore(out.supplierName);
  // Deduplicate, and leave room for per-variant photos: a 16-colour listing
  // legitimately carries more than the old cap of 20.
  out.images = uniq(out.images.filter(Boolean)).slice(0, 60);
  out.videos = uniq(out.videos.filter(Boolean)).slice(0, 8);
  out.reviews = out.reviews.slice(0, 40);

  if(!out.title){ note('Could not read this page. Is it a product page, fully loaded?', true); return; }

  var priced = out.variants.filter(function(v){ return v.price > 0; }).length;
  try{
    var res = await fetch(OUT, {
      method: 'POST', mode: 'cors',
      headers: { 'content-type': 'application/json', 'x-capture-token': TOKEN },
      body: JSON.stringify(out)
    });
    var body = await res.json().catch(function(){ return {}; });
    if(!res.ok) { note('Capture rejected: ' + (body.error || res.status), true); return; }
    note('Captured "' + out.title.slice(0, 40) + '" — ' + out.variants.length + ' variants ('
      + priced + ' priced), ' + out.images.length + ' images, ' + out.videos.length + ' videos, '
      + out.reviews.length + ' reviews. Open Import in your admin.');
  }catch(e){
    /*
     * Supplier pages set a Content-Security-Policy whose connect-src blocks
     * requests to our domain. A bookmarklet runs INSIDE the page and inherits
     * that policy, so the browser kills the fetch before it leaves — this is
     * exactly why DSers and Oberlo ship extensions, which are CSP-exempt.
     *
     * The clipboard is not governed by connect-src, so it always works. Copy
     * the payload and let the merchant paste it into the admin.
     */
    try{
      await navigator.clipboard.writeText(JSON.stringify(out));
      note("Captured " + out.variants.length + " variants (" + priced + " priced), " +
        out.images.length + " images, " + out.videos.length + " videos. This site blocks" +
        " direct sending, so it is COPIED to your clipboard - paste it into Import.");
    }catch(e2){
      note("Blocked by this site and clipboard unavailable. Error: " + e.message, true);
    }
  }
})();`;

  return `javascript:${encodeURIComponent(src)}`;
}
