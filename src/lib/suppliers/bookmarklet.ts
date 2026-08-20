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

  out.images = out.images.filter(Boolean).slice(0, 20);
  out.videos = out.videos.filter(Boolean).slice(0, 5);
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
