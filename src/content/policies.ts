import { formatMoney } from '@/lib/money';
import type { StoreSettings } from '@/lib/settings';

/**
 * The store's legal pages, generated from live settings.
 *
 * WHY THESE ARE GENERATED AND NOT TYPED INTO THE DATABASE BY HAND
 * ---------------------------------------------------------------
 * The shipping threshold, the flat rate and the settlement currency all appear
 * in the terms. Hand-written pages go stale the first time any of those change
 * in admin Settings, and a policy that contradicts what checkout actually
 * charges is worse than no policy — it is the document a customer quotes back
 * at you in a chargeback. These read from StoreSettings, so republishing after
 * a settings change keeps the two in step.
 *
 * HOW FAR THESE GO IN THE STORE'S FAVOUR
 * --------------------------------------
 * As far as they can while staying enforceable, which is quite far: the
 * contract does not form until dispatch, delivery windows are estimates rather
 * than promises, mispricing is cancellable, liability is capped at what the
 * customer paid, and complaints run through support before anyone goes to court.
 *
 * What they deliberately do NOT do is purport to sign away rights that Nigerian
 * law does not let a seller sign away. Under the FCCPA 2018 a term that strips a
 * consumer's statutory rights is void — so "all sales final, no refunds under
 * any circumstances" buys nothing: it fails the moment it is tested, and it is
 * the kind of term that attracts the FCCPC rather than deterring a claim. A cap
 * that holds is worth more than a waiver that evaporates, which is why the
 * limitation clause carries the standard carve-out that keeps it standing.
 */

/**
 * Trading details. Fill in what applies; anything left empty is omitted from the
 * rendered page rather than printed as a placeholder, because "[RC number]"
 * sitting on a live policy page reads as an abandoned store.
 */
export const BUSINESS = {
  legalName: 'THE TWIN TITANS LTD',
  rcNumber: '8177973',
  /*
   * As filed with the Corporate Affairs Commission on 14 January 2025.
   * "Prinnacle" is the CAC record's own spelling and is reproduced rather than
   * corrected — the identity statement should match the register.
   */
  address:
    'Shop 1 and 2, Late Ganiyu Adegboyega Shopping Complex, Prinnacle Junction, Ijaye-Titun Rounder, Ogun State, Nigeria',
};

const EFFECTIVE = '25 August 2026';

function contact(settings: StoreSettings): string {
  const email = settings.supportEmail || 'support@twintitanemporium.com';
  const bits = [`by email at <a href="mailto:${email}">${email}</a>`];
  if (settings.supportPhone) bits.push(`by phone on ${settings.supportPhone}`);
  return bits.join(', or ');
}

function identity(settings: StoreSettings): string {
  const parts: string[] = [];
  if (BUSINESS.legalName) parts.push(BUSINESS.legalName);
  if (BUSINESS.rcNumber) parts.push(`RC ${BUSINESS.rcNumber}`);
  if (BUSINESS.address) parts.push(BUSINESS.address);
  if (parts.length === 0) return `${settings.storeName} ("we", "us", "our")`;
  return `${settings.storeName}, operated by ${parts.join(', ')} ("we", "us", "our")`;
}

export interface PolicyDoc {
  handle: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  bodyHtml: string;
}

/** The delivery charge sentence, phrased for whatever the settings actually say. */
function shippingLine(s: StoreSettings): string {
  const flat = formatMoney(s.shippingFlatMinor, s.baseCurrency);
  const over = formatMoney(s.freeShippingOverMinor, s.baseCurrency);
  if (s.shippingFlatMinor <= 0) return 'Delivery is currently free on every order.';
  if (s.freeShippingOverMinor <= 0) return `Delivery is charged at a flat ${flat} per order.`;
  return `Delivery is charged at a flat ${flat} per order, and is free on orders of ${over} or more, calculated on the order value before delivery charges.`;
}

export function buildPolicies(settings: StoreSettings): PolicyDoc[] {
  const who = identity(settings);
  const how = contact(settings);
  const store = settings.storeName;
  const base = settings.baseCurrency;
  const settle = settings.paypalCurrency;

  const terms: PolicyDoc = {
    handle: 'terms',
    title: 'Terms of service',
    seoTitle: `Terms of service — ${store}`,
    seoDescription: `The terms on which ${store} sells and delivers goods, covering ordering, pricing, delivery, returns and liability.`,
    bodyHtml: `
<p><strong>Effective ${EFFECTIVE}.</strong> These terms govern your use of this website and every order you place with ${who}. Please read them before ordering — by placing an order you accept them.</p>

<h2>1. About these terms</h2>
<p>We may update these terms from time to time. The version that applies to your order is the one published here when you place it, and later changes do not apply retrospectively to orders we have already accepted. We recommend keeping a copy of these terms together with your order confirmation.</p>

<h2>2. How a contract is formed</h2>
<p>Placing an order is an <strong>offer to buy</strong>, not a concluded contract. Our acknowledgement email confirms that we have received your order; it does not accept it. A contract comes into being only when we confirm that your item has been <strong>dispatched</strong>.</p>
<p>Until dispatch we may decline or cancel an order in whole or in part and refund you in full, including where:</p>
<ul>
  <li>the item is out of stock or has been withdrawn by our supplier;</li>
  <li>the price or the description was published in error;</li>
  <li>we are unable to deliver to your address;</li>
  <li>payment cannot be verified, or the order is flagged by our fraud checks; or</li>
  <li>we reasonably believe the order is for resale without our agreement.</li>
</ul>
<p>Where we cancel in these circumstances, a refund of what you paid is the full extent of our responsibility to you for that order.</p>

<h2>3. Prices and currency</h2>
<p>Prices are set in ${base} and include applicable Nigerian taxes unless stated otherwise. Delivery is charged separately and is shown to you before you pay.</p>
<p>Where the site displays a price in another currency, that display is a <strong>convenience conversion and is indicative only</strong>. It uses a periodically updated reference rate and is not the rate your bank or card issuer will apply. The amount actually charged is taken in ${base}, or in ${settle} where you pay by PayPal, as shown at checkout. Any difference arising from your provider's exchange rate, cross-border fees or card charges is a matter between you and them.</p>
<p><strong>Pricing errors.</strong> If an item's price is obviously wrong — for example, materially below the cost of supply — we are not required to sell at that price. We will contact you and either confirm the correct price for your approval or cancel the order and refund you in full.</p>

<h2>4. Products, images and descriptions</h2>
<p>We take care to describe products accurately. Photographs, videos and colour swatches are <strong>illustrative</strong>: screens render colour differently, and packaging, minor styling and manufacturer branding may change between production batches. Reasonable variation of this kind is not a defect and does not by itself entitle you to a refund. Stated dimensions and weights are approximate and subject to normal manufacturing tolerance.</p>
<p>Nothing on this site is medical, health, cosmetic or safety advice. Where a product carries manufacturer instructions, warnings or age restrictions, you are responsible for reading and following them.</p>

<h2>5. Delivery</h2>
<p>${shippingLine(settings)} Our current dispatch and delivery windows are set out on our <a href="/pages/shipping">Shipping &amp; delivery</a> page.</p>
<p>All delivery times are <strong>good-faith estimates, not guarantees</strong>, and time is not of the essence. Many of our items ship directly from suppliers, including from outside Nigeria, and we are not responsible for delays caused by customs or regulatory inspection, carrier backlogs, incorrect or incomplete address details, refusal or failure to accept delivery, industrial action, extreme weather, or other matters outside our reasonable control.</p>
<p>You are responsible for giving a complete and accurate delivery address and a reachable phone number. Where a parcel is returned to sender, held, or has to be redelivered because the details you gave were wrong or because delivery was not accepted, any further delivery cost is payable by you, and any refund is net of the delivery costs already incurred.</p>
<p><strong>Risk</strong> in the goods passes to you on delivery to the address you gave, or to any person at that address who accepts the parcel. <strong>Title</strong> passes to you when we have received payment in full.</p>
<p>Orders containing items from more than one supplier may arrive as <strong>separate parcels on different dates</strong>. This is normal and is not a partial cancellation of your order.</p>

<h2>6. Import duties and charges</h2>
<p>Where an item is shipped from outside Nigeria, any customs duty, import VAT, clearance fee or handling charge levied by the authorities or by the carrier is <strong>payable by you</strong> as importer of record and is not included in the price you paid us. If a parcel is refused, abandoned or returned because such a charge was not paid, we may deduct the delivery and return costs we incur from any refund.</p>

<h2>7. Cancellation, returns and refunds</h2>
<p>Your rights to return items and obtain a refund, and the conditions and time limits that apply to them, are set out in our <a href="/pages/returns">Returns &amp; refunds</a> policy, which forms part of these terms. Nothing in these terms removes or limits any right you have under the Federal Competition and Consumer Protection Act 2018 or other applicable Nigerian law.</p>

<h2>8. Payment, fraud and chargebacks</h2>
<p>Payment is taken through our payment providers. We do not receive or store your full card details. We may carry out identity, address and anti-fraud verification before dispatch and may withhold dispatch until it is complete.</p>
<p>If you believe a charge is wrong, contact us first — most disputes are resolved considerably faster that way than through your bank. Raising a chargeback in respect of goods that were delivered as described, or that you have not returned in accordance with our returns policy, is a breach of these terms, and we may recover the disputed amount together with any fee charged to us and decline to accept future orders from you.</p>

<h2>9. Use of this website</h2>
<p>The content of this site, including its text, product copy, page design, the photographs we produce, and our name and logo, belongs to us or to our licensors and may not be copied, scraped or republished for commercial purposes without our written permission. You may not use the site unlawfully, attempt to gain unauthorised access to it, interfere with its operation, or place orders using false details.</p>
<p>The site is provided on an "as available" basis. We do not warrant that it will be uninterrupted or error-free, and we may suspend, withdraw or change any part of it without notice.</p>

<h2>10. Our liability</h2>
<p>We are responsible for loss you suffer that is a foreseeable result of our breaking this contract or failing to use reasonable care and skill. We are not responsible for loss that is not foreseeable.</p>
<p>Subject to the paragraph below, and to the fullest extent permitted by law:</p>
<ul>
  <li>we are not liable for indirect or consequential loss, loss of profit, loss of business, loss of opportunity, loss of data, or wasted expenditure; and</li>
  <li>our total liability arising out of or in connection with any order is limited to <strong>the amount you paid for the item or items concerned</strong>, together with any delivery charge you paid on them.</li>
</ul>
<p><strong>What we never exclude.</strong> Nothing in these terms excludes or limits our liability for death or personal injury caused by our negligence, for fraud or fraudulent misrepresentation, or for any other liability that cannot lawfully be excluded or limited, including your statutory rights as a consumer under Nigerian law. If any part of this clause is found to be unenforceable, the remainder continues to apply.</p>
<p>We supply goods for domestic and private use. If you use them for any commercial or resale purpose, we have no liability to you for loss of profit, loss of business, business interruption or loss of business opportunity.</p>

<h2>11. Events outside our control</h2>
<p>We are not liable for any failure or delay in performing our obligations that is caused by an event outside our reasonable control, including supplier or carrier failure, customs action, power or network outage, currency or import restriction, civil disruption, epidemic, fire, flood or extreme weather. Where such an event continues for more than 30 days, you may cancel any undelivered part of your order and receive a refund for it.</p>

<h2>12. Complaints, and the law that applies</h2>
<p>If something has gone wrong, contact us ${how}. We aim to acknowledge complaints within two business days and to resolve them within 14 days.</p>
<p>You agree to raise any dispute with us first and to allow us <strong>30 days</strong> from your written complaint in which to resolve it before commencing proceedings. This does not prevent either of us from seeking urgent injunctive relief.</p>
<p>These terms, and any dispute arising out of them, are governed by the laws of the <strong>Federal Republic of Nigeria</strong>, and the courts of <strong>Lagos State</strong> have jurisdiction — without prejudice to any right you have to bring a complaint before the Federal Competition and Consumer Protection Commission.</p>

<h2>13. General</h2>
<p>If any provision of these terms is held to be invalid or unenforceable, the remaining provisions continue in full force. Our failure to enforce a term is not a waiver of it. We may transfer our rights and obligations under these terms to another business, and your rights will not be affected. No one other than you and us has any right to enforce these terms.</p>
<p>These terms, together with our <a href="/pages/returns">Returns &amp; refunds</a>, <a href="/pages/shipping">Shipping &amp; delivery</a> and <a href="/pages/privacy">Privacy</a> policies, form the entire agreement between us in relation to your order.</p>
`.trim(),
  };

  const privacy: PolicyDoc = {
    handle: 'privacy',
    title: 'Privacy policy',
    seoTitle: `Privacy policy — ${store}`,
    seoDescription: `How ${store} collects, uses, shares and protects your personal data, and the rights you have under the Nigeria Data Protection Act 2023.`,
    bodyHtml: `
<p><strong>Effective ${EFFECTIVE}.</strong> This policy explains what we do with your personal data when you visit this site or place an order. ${who} is the <strong>data controller</strong> for that data under the Nigeria Data Protection Act 2023 (the "NDPA").</p>
<p>You can reach us about anything in this policy ${how}.</p>

<h2>What we collect</h2>
<ul>
  <li><strong>Order and contact details</strong> — your name, email address, phone number, delivery address and order history.</li>
  <li><strong>Payment information</strong> — the fact, amount, currency and status of a payment, and the last digits and card type where our provider reports them. <strong>We do not receive or store your full card number, CVV or bank credentials</strong>; those go directly to our payment provider.</li>
  <li><strong>Communications</strong> — messages you send us and our replies, so that we can deal with your query and keep a record of it.</li>
  <li><strong>Technical and usage data</strong> — IP address, device and browser type, pages viewed and referring site, collected to keep the site working, secure and reasonably fast.</li>
</ul>
<p>We do not seek sensitive personal data, and you should not send it to us. We do not knowingly collect data from anyone under 18.</p>

<h2>Why we use it, and on what basis</h2>
<ul>
  <li><strong>To perform our contract with you</strong> — taking and confirming your order, arranging delivery, handling returns and refunds, and providing support.</li>
  <li><strong>To comply with legal obligations</strong> — tax, accounting and record-keeping duties, and responding to lawful requests.</li>
  <li><strong>For our legitimate interests</strong> — preventing fraud and abuse, securing the site, understanding which products sell, and improving what we offer. We balance these against your own interests and rights.</li>
  <li><strong>With your consent</strong> — marketing emails, where you have asked for them. You can withdraw consent at any time using the unsubscribe link or by contacting us. Withdrawal does not affect messages already sent, and we will still send transactional messages about orders you have placed.</li>
</ul>

<h2>Who we share it with</h2>
<p>We share only what is necessary, and only with:</p>
<ul>
  <li><strong>payment providers</strong>, who process your payment and run their own fraud checks;</li>
  <li><strong>suppliers and fulfilment partners</strong>, who receive your name, delivery address and phone number in order to pack and ship your item;</li>
  <li><strong>couriers and postal operators</strong>, for delivery and tracking;</li>
  <li><strong>our hosting, email and analytics providers</strong>, who process data on our instructions; and</li>
  <li><strong>professional advisers and authorities</strong>, where we are required to disclose by law or need to establish or defend legal claims.</li>
</ul>
<p>We do not sell your personal data, and we do not share it with third parties for their own marketing.</p>

<h2>Transfers outside Nigeria</h2>
<p>Many of our products ship directly from suppliers and carriers located outside Nigeria, and some of our service providers host data abroad. Your delivery details are therefore transferred to those recipients. Where a transfer is not to a country recognised as providing adequate protection, we rely on the grounds the NDPA permits — principally that the transfer is <strong>necessary for the performance of the contract you have entered into with us</strong> — and we share the minimum needed to get your parcel to you.</p>

<h2>How long we keep it</h2>
<p>Order, payment and tax records are kept for <strong>six years</strong> after the end of the relevant financial year, as required for accounting and tax purposes. Support correspondence is kept for up to <strong>two years</strong> after your query is closed. Marketing consents are kept until you withdraw them. Technical logs are kept for up to <strong>12 months</strong>. After that, data is deleted or anonymised.</p>

<h2>Your rights</h2>
<p>Under the NDPA you have the right to:</p>
<ul>
  <li>ask what personal data we hold about you, and receive a copy of it;</li>
  <li>have inaccurate data corrected;</li>
  <li>ask us to delete data we no longer have a lawful reason to keep;</li>
  <li>ask us to restrict how we use it, or object to use based on our legitimate interests;</li>
  <li>receive data you gave us in a portable form; and</li>
  <li>withdraw consent at any time, where consent is the basis we rely on.</li>
</ul>
<p>Contact us ${how} to exercise any of these, and we will respond within <strong>30 days</strong>. We may ask you to confirm your identity first, so that we do not disclose your data to someone else. These rights are not absolute — for example, we cannot delete records we are legally required to retain — and we will explain where that applies.</p>
<p>If you are not satisfied with our response, you may complain to the <strong>Nigeria Data Protection Commission</strong>.</p>

<h2>Cookies</h2>
<p>We use cookies and similar storage that are <strong>necessary</strong> for the site to function: keeping your basket, remembering your chosen display currency, and maintaining your session. We also use limited analytics to understand how the site is used. You can block or delete cookies in your browser settings, but the basket and checkout will not work correctly without the necessary ones.</p>

<h2>Keeping it secure</h2>
<p>The site is served over encrypted connections, payment details are handled by our provider rather than by us, and access to order data is restricted to those who need it. No system is perfectly secure, and we cannot guarantee the security of data while it is in transit to us over the internet, but we take reasonable technical and organisational measures to protect it and will notify you and the Commission of a breach where the NDPA requires it.</p>

<h2>Changes</h2>
<p>If we change this policy we will publish the revised version here and update the effective date shown above.</p>
`.trim(),
  };

  const returns: PolicyDoc = {
    handle: 'returns',
    title: 'Returns & refunds',
    seoTitle: `Returns & refunds — ${store}`,
    seoDescription: `How to return an item to ${store}, what can and cannot be returned, and how refunds are processed.`,
    bodyHtml: `
<p><strong>Effective ${EFFECTIVE}.</strong> This policy forms part of our <a href="/pages/terms">Terms of service</a>. Nothing in it removes your statutory rights under the Federal Competition and Consumer Protection Act 2018.</p>

<h2>Start every return with us first</h2>
<p>Contact us ${how} <strong>before</strong> sending anything back, quoting your order number. We will confirm whether the item is returnable and give you a return address and a reference.</p>
<p>Items sent back without being authorised first may not be traceable to your order, and we cannot accept responsibility for them or guarantee a refund.</p>

<h2>If something is wrong with your item</h2>
<p>If your item arrives <strong>damaged, faulty, incomplete, or materially different from its description</strong>, tell us within <strong>7 days of delivery</strong> and include:</p>
<ul>
  <li>your order number;</li>
  <li>clear photographs of the item and of the fault; and</li>
  <li>a photograph of the outer packaging and the shipping label, which is what any carrier claim depends on.</li>
</ul>
<p>Once we have verified the fault we will, at our option, send a replacement or refund you in full including the delivery you paid, and we cover the cost of returning a faulty item. Telling us later than 7 days does not necessarily end your claim, but it makes damage in transit considerably harder to establish, so please tell us promptly.</p>

<h2>If you have changed your mind</h2>
<p>You may request to return an unwanted item within <strong>7 days of delivery</strong>, provided that it is:</p>
<ul>
  <li>unused, unworn and undamaged;</li>
  <li>complete with all parts, accessories, tags and free gifts; and</li>
  <li>in its original packaging, with any manufacturer seal or shrink-wrap intact.</li>
</ul>
<p>For change-of-mind returns the <strong>return postage is paid by you</strong>, the original delivery charge is not refunded, and we recommend a tracked service — the item remains your responsibility until it reaches us. Where a returned item arrives used, incomplete or damaged, we may refuse the return or reduce the refund to reflect the loss in value.</p>

<h2>What cannot be returned for change of mind</h2>
<p>For hygiene, safety and legal reasons, the following cannot be returned once opened, unsealed or used, unless they are faulty:</p>
<ul>
  <li>skincare, cosmetics, haircare and other personal-care products;</li>
  <li>items that come into contact with the ears, nose or mouth, and intimate or grooming items;</li>
  <li>underwear, swimwear and pierced jewellery;</li>
  <li>consumables, supplements and anything perishable;</li>
  <li>made-to-order, personalised or custom-configured items; and</li>
  <li>digital products and gift cards.</li>
</ul>
<p>This restriction never applies where the item is faulty or is not as described.</p>

<h2>Cancelling before dispatch</h2>
<p>If you need to cancel, tell us as soon as possible. We can usually cancel and refund in full if the item has not yet been dispatched. Once an item has left the supplier it has to be handled as a return.</p>

<h2>Parcels that do not arrive</h2>
<p>If tracking has not moved or your parcel has not arrived, contact us within <strong>30 days of the latest estimated delivery date</strong> so that we can open a claim with the carrier while the claim window is still open. Claims raised after that point may not be recoverable, which limits what we are able to do for you.</p>
<p>Where tracking shows an item as delivered to the address you gave, we may ask you to check with your household, your neighbours and any building security before we investigate further.</p>

<h2>How refunds are paid</h2>
<p>Approved refunds are paid to the <strong>original payment method</strong> — we cannot refund to a different account — and are issued within <strong>14 days</strong> of our receiving the returned item, or of our agreeing the refund where no return is needed. Your bank or card issuer may take several further working days to show it.</p>
<p>Refunds are made in the currency in which you were charged. Where you paid in a currency other than ${base}, the amount you receive may differ slightly from the amount you paid because of exchange-rate movement between the two dates. That difference is applied by your provider and is outside our control.</p>
<p>Where a refund follows a delivery that failed because of incorrect address details, refusal to accept delivery, or unpaid customs charges, the delivery and return costs we incurred may be deducted from it.</p>
`.trim(),
  };

  const shipping: PolicyDoc = {
    handle: 'shipping',
    title: 'Shipping & delivery',
    seoTitle: `Shipping & delivery — ${store}`,
    seoDescription: `Dispatch times, delivery estimates, charges, tracking and customs information for ${store} orders.`,
    bodyHtml: `
<p><strong>Effective ${EFFECTIVE}.</strong> This policy forms part of our <a href="/pages/terms">Terms of service</a>.</p>

<h2>What delivery costs</h2>
<p>${shippingLine(settings)} The exact charge for your order is shown at checkout before you pay.</p>

<h2>Dispatch and delivery times</h2>
<p>Orders are prepared for dispatch within <strong>1–3 business days</strong>. Delivery then typically takes <strong>7–21 days</strong>, depending on the item and on your location. Business days exclude weekends and public holidays.</p>
<p>These are <strong>estimates, not guaranteed dates</strong>. We do not offer guaranteed or timed delivery and cannot be held to a specific arrival date. Delivery may take longer because of customs or regulatory inspection, carrier delays or backlogs at peak periods, incomplete address details, industrial action, or extreme weather. Where a delay becomes unreasonable, contact us and we will chase the carrier or, if the item cannot be delivered at all, cancel and refund it.</p>

<h2>Orders that arrive in more than one parcel</h2>
<p>We source from more than one supplier, so items in the same order may be dispatched separately and <strong>arrive on different days</strong>, sometimes under different tracking numbers. If part of your order has arrived and part has not, this is usually why. Nothing is missing from your order until every parcel has been accounted for.</p>

<h2>Tracking</h2>
<p>You receive a tracking number by email as soon as your parcel ships, and you can check it at any time on our <a href="/track">tracking page</a>. Tracking can take a few days to begin updating after dispatch, and international tracking often shows no movement at all while a parcel is in transit between countries or awaiting customs clearance. A quiet tracking page is not by itself a sign that anything is wrong.</p>

<h2>Your address</h2>
<p>Please check your delivery address and phone number carefully before you pay — couriers in many areas will call before delivering. We dispatch to the address given on the order, and we can only change it before dispatch.</p>
<p>If a parcel is returned to sender, held, or has to be redelivered because the address or phone number was wrong, or because delivery was not accepted, any further delivery cost is payable by you, and a refund of the order is net of the delivery costs already incurred.</p>

<h2>Customs, duties and import charges</h2>
<p>Where an item ships from outside Nigeria, any customs duty, import VAT, clearance or handling fee is set by the authorities or by the carrier, is <strong>payable by you</strong>, and is not included in the price you paid us. We cannot tell you in advance what it will be, and we cannot mark parcels as gifts or declare a value other than the true one.</p>

<h2>Where we deliver</h2>
<p>We deliver throughout Nigeria. Some remote or restricted locations may not be served by our carriers, and certain items cannot be shipped by air because of battery, liquid or aerosol restrictions. If your order is affected we will contact you and refund it in full.</p>

<h2>Risk</h2>
<p>Risk in the goods passes to you on delivery to the address you gave, or to any person at that address who accepts the parcel. If your parcel has not arrived, our <a href="/pages/returns">Returns &amp; refunds</a> policy explains how and when to raise it with us.</p>
`.trim(),
  };

  return [terms, returns, shipping, privacy];
}
