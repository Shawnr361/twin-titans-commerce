"use strict";exports.id=1441,exports.ids=[1441],exports.modules={41861:(a,b,c)=>{function d(a){return a.replace(/<(script|style)[\s\S]*?<\/\1>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g," ").trim()}function e(a,b=155){if(a.length<=b)return a;let c=a.slice(0,b+1),d=Math.max(c.lastIndexOf(". "),c.lastIndexOf("! "),c.lastIndexOf("? "));if(d>.55*b)return c.slice(0,d+1);let f=c.lastIndexOf(" ");return`${c.slice(0,f>0?f:b).replace(/[,;:\-–—]$/,"")}…`}function f(a,b){let c=a.seoDescription?.trim();if(c)return e(c);let f=d(a.descriptionHtml??"");if(f.length>=60)return e(f);let g=a.title.length>62?`${a.title.slice(0,62).trimEnd()}…`:a.title;return e(`${g} — sourced, checked and delivered across Nigeria by ${b}. Tracked on every order.`)}function g(){return"https://twintitansemporium.store".replace(/\/$/,"")}c.d(b,{G9:()=>d,eD:()=>f,ii:()=>g})},45249:(a,b,c)=>{c.d(b,{I:()=>o,s:()=>q});var d=c(77030),e=c.n(d),f=c(41692),g=c.n(f);let h=process.env.SMTP_HOST||"127.0.0.1",i=Number(process.env.SMTP_PORT||25),j=process.env.SMTP_USER||"",k=process.env.SMTP_PASS||"";function l(a){return a.replace(/[\r\n]+/g," ").trim()}function m(a){return(Buffer.from(a,"utf8").toString("base64").match(/.{1,76}/g)??[]).join("\r\n")}async function n(a,b,c){b&&a.socket.write(b+"\r\n");let d=await a.read();if(Number(d.slice(0,3))!==c)throw Error(`SMTP: expected ${c}, got ${d.trim().slice(0,120)}`);return d}function o(){return!!(h&&i)}async function p(a,b){let{existsSync:d}=await Promise.resolve().then(c.t.bind(c,73024,23)),e=["/usr/sbin/sendmail","/usr/lib/sendmail","/usr/bin/sendmail"].find(a=>{try{return d(a)}catch{return!1}});if(!e)return!1;let{spawn:f}=await Promise.resolve().then(c.t.bind(c,31421,23));return new Promise(c=>{let d=f(e,["-t","-i","-f",b],{stdio:["pipe","ignore","ignore"]});d.on("error",()=>c(!1)),d.on("close",a=>c(0===a)),d.stdin.on("error",()=>c(!1)),d.stdin.write(a),d.stdin.end()})}async function q(a){let b=l(process.env.SMTP_FROM||a.from||a.to),c=l(a.to),d=function(a){if(!a.html)return{headers:["Content-Type: text/plain; charset=utf-8"],body:a.text};let b=`--=_tt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,12)}`;return{headers:[`Content-Type: multipart/alternative; boundary="${b}"`],body:["This is a message in MIME format.","",`--${b}`,"Content-Type: text/plain; charset=utf-8","Content-Transfer-Encoding: base64","",m(a.text),`--${b}`,"Content-Type: text/html; charset=utf-8","Content-Transfer-Encoding: base64","",m(a.html),`--${b}--`,""].join("\r\n")}}(a),f=[`From: Twin Titans Emporium <${b}>`,`To: <${c}>`,a.replyTo?`Reply-To: <${l(a.replyTo)}>`:"",`Subject: ${l(a.subject)}`,"MIME-Version: 1.0",...d.headers,`Date: ${new Date().toUTCString()}`].filter(Boolean).join("\r\n");if("smtp"!==process.env.MAIL_TRANSPORT&&await p(`${f}\r
\r
${d.body}\r
`,b))return;let o=await new Promise((a,b)=>{let c=465===i?g().connect({host:h,port:i,servername:h,rejectUnauthorized:!1}):e().connect({host:h,port:i});c.setTimeout(15e3);let d="",f=null,j=null,k=()=>{if(!f)return;let a=d.match(/^\d{3} [^\r\n]*\r?\n/m);if(!a)return;let b=d.indexOf(a[0]),c=d.slice(0,b+a[0].length);d=d.slice(b+a[0].length);let e=f;f=null,e(c)};c.on("data",a=>{d+=a.toString("utf8"),k()}),c.on("error",a=>{j?j(a):b(a)}),c.on("timeout",()=>c.destroy(Error("SMTP timed out.")));let l=()=>new Promise((a,b)=>{f=a,j=b,k()});c.on("connect",()=>a({socket:c,read:l})),465===i&&c.on("secureConnect",()=>a({socket:c,read:l}))});try{await n(o,"",220);let a=await n(o,`EHLO ${function(){if(process.env.SMTP_EHLO)return process.env.SMTP_EHLO;try{let a=new URL("https://twintitansemporium.store").hostname;if(a.includes("."))return a}catch{}return/^[0-9.]+$/.test(h)?`[${h}]`:h}()}`,250);j&&k&&/AUTH[ -=]/i.test(a)&&(await n(o,"AUTH LOGIN",334),await n(o,Buffer.from(j).toString("base64"),334),await n(o,Buffer.from(k).toString("base64"),235)),await n(o,`MAIL FROM:<${b}>`,250),await n(o,`RCPT TO:<${c}>`,250),await n(o,"DATA",354),o.socket.write(`${f}\r
\r
${d.body.replace(/\r?\n/g,"\r\n").replace(/^\./gm,"..")}\r
.\r
`),await n(o,"",250),await n(o,"QUIT",221).catch(()=>void 0)}finally{o.socket.destroy()}}},97169:(a,b,c)=>{c.d(b,{th:()=>i});var d=c(41861);let e={bg:"#0E0C09",band:"#14110D",paper:"#1A1611",inset:"#221D16",onyx:"#F2EDE3",ink:"#E6E0D4",greige:"#A8A091",quiet:"#8A8274",rule:"#2D271F",gold:"#C9A227"},f="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";function g(a){return a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function h(a,b){return a.filter(Boolean).map(a=>`<p style="margin:0 0 13px;font-family:${f};font-size:14px;line-height:1.65;color:${b};">${g(a)}</p>`).join("")}function i(a){var b,c,i;let{storeName:j,preheader:k,heading:l,intro:m,items:n=[],totals:o=[],callout:p=null,cta:q=null,address:r=null,outro:s=[],supportEmail:t}=a,u=(0,d.ii)(),v=n.length>0?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-collapse:collapse;">
           <tr><td colspan="3" bgcolor="${e.rule}" style="background-color:${e.rule};height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
           ${n.map(a=>{var b;let c=(b=a.imageUrl)&&b.toLowerCase().startsWith("https://")?`${(0,d.ii)()}/api/og-image?src=${encodeURIComponent(b)}`:null,h=c?`<img src="${c}" width="62" alt=""
                style="display:block;width:62px;height:auto;border:0;border-radius:6px;background-color:${e.inset};" />`:`<div style="width:62px;height:62px;border-radius:6px;background-color:${e.inset};"></div>`,i=a.variant&&"Default"!==a.variant?`<div style="font-family:${f};font-size:12px;color:${e.quiet};padding-top:3px;">${g(a.variant)}</div>`:"",j=a.price?`<td align="right" valign="top" style="font-family:${f};font-size:13px;color:${e.ink};white-space:nowrap;padding:14px 0 14px 10px;">${g(a.price)}</td>`:"<td></td>";return`
      <tr>
        <td valign="top" width="62" style="padding:14px 14px 14px 0;">${h}</td>
        <td valign="top" style="padding:14px 0;">
          <div style="font-family:${f};font-size:14px;line-height:1.45;color:${e.onyx};">${g(a.title)}</div>
          ${i}
          <div style="font-family:${f};font-size:12px;color:${e.greige};padding-top:4px;">Qty ${a.quantity}</div>
        </td>
        ${j}
      </tr>
      <tr><td colspan="3" bgcolor="${e.rule}" style="background-color:${e.rule};height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>`}).join("")}
         </table>`:"",w=o.length>0?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-collapse:collapse;">
           ${o.map(a=>{let b=a.strong?"15px":"13px",c=a.strong?"700":"400";return`
      <tr>
        <td style="font-family:${f};font-size:${b};font-weight:${c};color:${a.strong?e.onyx:e.greige};padding:5px 0;">${g(a.label)}</td>
        <td align="right" style="font-family:${f};font-size:${b};font-weight:${c};color:${a.strong?e.gold:e.ink};padding:5px 0;white-space:nowrap;">${g(a.value)}</td>
      </tr>`}).join("")}
         </table>`:"",x=p?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-collapse:collapse;">
         <tr>
           <td bgcolor="${e.inset}" style="background-color:${e.inset};border-left:3px solid ${e.gold};padding:16px 18px;">
             <div style="font-family:${f};font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${e.gold};padding-bottom:7px;">${g(p.label)}</div>
             ${p.lines.filter(Boolean).map(a=>`<div style="font-family:${f};font-size:14px;line-height:1.6;color:${e.onyx};">${g(a)}</div>`).join("")}
           </td>
         </tr>
       </table>`:"",y=r&&r.length>0?(b=e.greige,`<div style="margin-top:26px;">
    <div style="font-family:${f};font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${e.quiet};padding-bottom:8px;">${g("Delivering to")}</div>
    ${r.filter(Boolean).map(a=>`<div style="font-family:${f};font-size:13px;line-height:1.6;color:${b};">${g(a)}</div>`).join("")}
  </div>`):"",z=t?`Questions? Just reply to this email, or write to <a href="mailto:${g(t)}" style="color:${e.gold};text-decoration:none;">${g(t)}</a>.<br />`:"";return{html:`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${g(l)}</title>
</head>
<body style="margin:0;padding:0;background-color:${e.bg};">
  <!-- The line a phone shows beside the subject, and nowhere else. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${g(k)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         bgcolor="${e.bg}" style="background-color:${e.bg};">
    <tr>
      <td align="center" style="padding:24px 12px 40px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:600px;border-collapse:collapse;">
          ${function(a){let b=(0,d.ii)();return`
  <tr>
    <td align="center" bgcolor="${e.band}" style="background-color:${e.band};padding:28px 24px 24px;">
      <a href="${b}" style="text-decoration:none;display:block;">
        <img src="${b}/apple-icon.png" width="64" alt=""
             style="display:block;width:64px;height:auto;margin:0 auto 14px;border:0;border-radius:10px;" />
        <div style="font-family:${f};font-size:16px;font-weight:700;letter-spacing:3.5px;color:${e.gold};text-transform:uppercase;line-height:1.3;">
          ${g(a)}
        </div>
      </a>
    </td>
  </tr>
  <tr><td bgcolor="${e.gold}" style="background-color:${e.gold};height:2px;line-height:2px;font-size:0;">&nbsp;</td></tr>`}(j)}

          <tr>
            <td bgcolor="${e.paper}" style="background-color:${e.paper};padding:32px 30px 34px;">

              <h1 style="margin:0 0 16px;font-family:${f};font-size:21px;line-height:1.3;font-weight:700;color:${e.onyx};">
                ${g(l)}
              </h1>

              ${h(m,e.ink)}
              ${v}
              ${w}
              ${x}
              ${q?(c=q.label,i=q.href,`
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">
    <tr>
      <td bgcolor="${e.gold}" style="background-color:${e.gold};border-radius:4px;">
        <a href="${g(i)}"
           style="display:inline-block;padding:13px 30px;font-family:${f};font-size:14px;font-weight:700;letter-spacing:0.4px;color:${e.bg};text-decoration:none;">
          ${g(c)}
        </a>
      </td>
    </tr>
  </table>`):""}
              ${y}
              ${s.length>0?`<div style="margin-top:24px;">${h(s,e.greige)}</div>`:""}

            </td>
          </tr>

          <tr>
            <td bgcolor="${e.band}" style="background-color:${e.band};padding:22px 30px 26px;border-top:1px solid ${e.rule};">
              <div style="font-family:${f};font-size:12px;line-height:1.7;color:${e.quiet};">
                ${z}
                <a href="${u}" style="color:${e.greige};text-decoration:none;">${g(j)}</a>
                &nbsp;&middot;&nbsp;
                <a href="${u}/orders/track" style="color:${e.greige};text-decoration:none;">Track an order</a>
                &nbsp;&middot;&nbsp;
                <a href="${u}/policies/returns" style="color:${e.greige};text-decoration:none;">Returns</a>
              </div>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`,text:[l,"",...m,...n.length>0?["","What you ordered:",...n.map(a=>`  ${a.quantity} x ${a.title}`+(a.variant&&"Default"!==a.variant?` (${a.variant})`:"")+(a.price?` - ${a.price}`:""))]:[],...o.length>0?["",...o.map(a=>`${a.label}: ${a.value}`)]:[],...p?["",p.label.toUpperCase(),...p.lines.filter(Boolean)]:[],...q?["",`${q.label}: ${q.href}`]:[],...r&&r.length>0?["","Delivering to:",...r.map(a=>`  ${a}`)]:[],...s.length>0?["",...s]:[],"",t?`Questions? Reply to this email or write to ${t}.`:"",j,u].filter(a=>void 0!==a).join("\n")}}}};