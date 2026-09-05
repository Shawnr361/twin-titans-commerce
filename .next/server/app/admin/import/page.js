(()=>{var a={};a.id=9462,a.ids=[9462],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},1880:(a,b,c)=>{"use strict";c.r(b),c.d(b,{GlobalError:()=>E.a,__next_app__:()=>K,handler:()=>M,pages:()=>J,routeModule:()=>L,tree:()=>I});var d=c(49754),e=c(9117),f=c(46595),g=c(32324),h=c(39326),i=c(38928),j=c(20175),k=c(12),l=c(54290),m=c(12696),n=c(52574),o=c(82802),p=c(77533),q=c(45229),r=c(32822),s=c(261),t=c(26453),u=c(52474),v=c(26713),w=c(51356),x=c(62685),y=c(36225),z=c(63446),A=c(2762),B=c(45742),C=c(86439),D=c(81170),E=c.n(D),F=c(62506),G=c(91203),H={};for(let a in F)0>["default","tree","pages","GlobalError","__next_app__","routeModule","handler"].indexOf(a)&&(H[a]=()=>F[a]);c.d(b,H);let I={children:["",{children:["admin",{children:["import",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(c.bind(c,86241)),"C:\\Users\\User\\twin-titans-commerce\\src\\app\\admin\\import\\page.tsx"]}]},{}]},{layout:[()=>Promise.resolve().then(c.bind(c,93972)),"C:\\Users\\User\\twin-titans-commerce\\src\\app\\admin\\layout.tsx"],metadata:{icon:[async a=>(await Promise.resolve().then(c.bind(c,78162))).default(a)],apple:[async a=>(await Promise.resolve().then(c.bind(c,94650))).default(a)],openGraph:[async a=>(await Promise.resolve().then(c.bind(c,98558))).default(a)],twitter:[async a=>(await Promise.resolve().then(c.bind(c,67488))).default(a)],manifest:"/manifest.webmanifest"}}]},{layout:[()=>Promise.resolve().then(c.bind(c,90986)),"C:\\Users\\User\\twin-titans-commerce\\src\\app\\layout.tsx"],"global-error":[()=>Promise.resolve().then(c.t.bind(c,81170,23)),"next/dist/client/components/builtin/global-error.js"],"not-found":[()=>Promise.resolve().then(c.bind(c,59732)),"C:\\Users\\User\\twin-titans-commerce\\src\\app\\not-found.tsx"],forbidden:[()=>Promise.resolve().then(c.t.bind(c,90461,23)),"next/dist/client/components/builtin/forbidden.js"],unauthorized:[()=>Promise.resolve().then(c.t.bind(c,32768,23)),"next/dist/client/components/builtin/unauthorized.js"],metadata:{icon:[async a=>(await Promise.resolve().then(c.bind(c,78162))).default(a)],apple:[async a=>(await Promise.resolve().then(c.bind(c,94650))).default(a)],openGraph:[async a=>(await Promise.resolve().then(c.bind(c,98558))).default(a)],twitter:[async a=>(await Promise.resolve().then(c.bind(c,67488))).default(a)],manifest:"/manifest.webmanifest"}}]}.children,J=["C:\\Users\\User\\twin-titans-commerce\\src\\app\\admin\\import\\page.tsx"],K={require:c,loadChunk:()=>Promise.resolve()},L=new d.AppPageRouteModule({definition:{kind:e.RouteKind.APP_PAGE,page:"/admin/import/page",pathname:"/admin/import",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:I},distDir:".next",relativeProjectDir:""});async function M(a,b,d){var D;let H="/admin/import/page";"/index"===H&&(H="/");let N=(0,h.getRequestMeta)(a,"postponed"),O=(0,h.getRequestMeta)(a,"minimalMode"),P=await L.prepare(a,b,{srcPage:H,multiZoneDraftMode:!1});if(!P)return b.statusCode=400,b.end("Bad Request"),null==d.waitUntil||d.waitUntil.call(d,Promise.resolve()),null;let{buildId:Q,query:R,params:S,parsedUrl:T,pageIsDynamic:U,buildManifest:V,nextFontManifest:W,reactLoadableManifest:X,serverActionsManifest:Y,clientReferenceManifest:Z,subresourceIntegrityManifest:$,prerenderManifest:_,isDraftMode:aa,resolvedPathname:ab,revalidateOnlyGenerated:ac,routerServerContext:ad,nextConfig:ae,interceptionRoutePatterns:af}=P,ag=T.pathname||"/",ah=(0,s.normalizeAppPath)(H),{isOnDemandRevalidate:ai}=P,aj=L.match(ag,_),ak=!!_.routes[ab],al=!!(aj||ak||_.routes[ah]),am=a.headers["user-agent"]||"",an=(0,v.getBotType)(am),ao=(0,q.isHtmlBotRequest)(a),ap=(0,h.getRequestMeta)(a,"isPrefetchRSCRequest")??"1"===a.headers[u.NEXT_ROUTER_PREFETCH_HEADER],aq=(0,h.getRequestMeta)(a,"isRSCRequest")??(0,n.f)(a.headers[u.RSC_HEADER]),ar=(0,t.getIsPossibleServerAction)(a),as=(0,m.checkIsAppPPREnabled)(ae.experimental.ppr)&&(null==(D=_.routes[ah]??_.dynamicRoutes[ah])?void 0:D.renderingMode)==="PARTIALLY_STATIC",at=!1,au=!1,av=as?N:void 0,aw=as&&aq&&!ap,ax=(0,h.getRequestMeta)(a,"segmentPrefetchRSCRequest"),ay=!am||(0,q.shouldServeStreamingMetadata)(am,ae.htmlLimitedBots);ao&&as&&(al=!1,ay=!1);let az=!0===L.isDev||!al||"string"==typeof N||aw,aA=ao&&as,aB=null;aa||!al||az||ar||av||aw||(aB=ab);let aC=aB;!aC&&L.isDev&&(aC=ab),L.isDev||aa||!al||!aq||aw||(0,k.d)(a.headers);let aD={...F,tree:I,pages:J,GlobalError:E(),handler:M,routeModule:L,__next_app__:K};Y&&Z&&(0,p.setReferenceManifestsSingleton)({page:H,clientReferenceManifest:Z,serverActionsManifest:Y,serverModuleMap:(0,r.createServerModuleMap)({serverActionsManifest:Y})});let aE=a.method||"GET",aF=(0,g.getTracer)(),aG=aF.getActiveScopeSpan();try{let f=L.getVaryHeader(ab,af);b.setHeader("Vary",f);let k=async(c,d)=>{let e=new l.NodeNextRequest(a),f=new l.NodeNextResponse(b);return L.render(e,f,d).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=aF.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==i.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${aE} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${aE} ${a.url}`)})},m=async({span:e,postponed:f,fallbackRouteParams:g})=>{let i={query:R,params:S,page:ah,sharedContext:{buildId:Q},serverComponentsHmrCache:(0,h.getRequestMeta)(a,"serverComponentsHmrCache"),fallbackRouteParams:g,renderOpts:{App:()=>null,Document:()=>null,pageConfig:{},ComponentMod:aD,Component:(0,j.T)(aD),params:S,routeModule:L,page:H,postponed:f,shouldWaitOnAllReady:aA,serveStreamingMetadata:ay,supportsDynamicResponse:"string"==typeof f||az,buildManifest:V,nextFontManifest:W,reactLoadableManifest:X,subresourceIntegrityManifest:$,serverActionsManifest:Y,clientReferenceManifest:Z,setIsrStatus:null==ad?void 0:ad.setIsrStatus,dir:c(33873).join(process.cwd(),L.relativeProjectDir),isDraftMode:aa,isRevalidate:al&&!f&&!aw,botType:an,isOnDemandRevalidate:ai,isPossibleServerAction:ar,assetPrefix:ae.assetPrefix,nextConfigOutput:ae.output,crossOrigin:ae.crossOrigin,trailingSlash:ae.trailingSlash,previewProps:_.preview,deploymentId:ae.deploymentId,enableTainting:ae.experimental.taint,htmlLimitedBots:ae.htmlLimitedBots,devtoolSegmentExplorer:ae.experimental.devtoolSegmentExplorer,reactMaxHeadersLength:ae.reactMaxHeadersLength,multiZoneDraftMode:!1,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:ae.experimental.cacheLife,basePath:ae.basePath,serverActions:ae.experimental.serverActions,...at?{nextExport:!0,supportsDynamicResponse:!1,isStaticGeneration:!0,isRevalidate:!0,isDebugDynamicAccesses:at}:{},experimental:{isRoutePPREnabled:as,expireTime:ae.expireTime,staleTimes:ae.experimental.staleTimes,cacheComponents:!!ae.experimental.cacheComponents,clientSegmentCache:!!ae.experimental.clientSegmentCache,clientParamParsing:!!ae.experimental.clientParamParsing,dynamicOnHover:!!ae.experimental.dynamicOnHover,inlineCss:!!ae.experimental.inlineCss,authInterrupts:!!ae.experimental.authInterrupts,clientTraceMetadata:ae.experimental.clientTraceMetadata||[]},waitUntil:d.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:()=>{},onInstrumentationRequestError:(b,c,d)=>L.onRequestError(a,b,d,ad),err:(0,h.getRequestMeta)(a,"invokeError"),dev:L.isDev}},l=await k(e,i),{metadata:m}=l,{cacheControl:n,headers:o={},fetchTags:p}=m;if(p&&(o[z.NEXT_CACHE_TAGS_HEADER]=p),a.fetchMetrics=m.fetchMetrics,al&&(null==n?void 0:n.revalidate)===0&&!L.isDev&&!as){let a=m.staticBailoutInfo,b=Object.defineProperty(Error(`Page changed from static to dynamic at runtime ${ab}${(null==a?void 0:a.description)?`, reason: ${a.description}`:""}
see more here https://nextjs.org/docs/messages/app-static-to-dynamic-error`),"__NEXT_ERROR_CODE",{value:"E132",enumerable:!1,configurable:!0});if(null==a?void 0:a.stack){let c=a.stack;b.stack=b.message+c.substring(c.indexOf("\n"))}throw b}return{value:{kind:w.CachedRouteKind.APP_PAGE,html:l,headers:o,rscData:m.flightData,postponed:m.postponed,status:m.statusCode,segmentData:m.segmentData},cacheControl:n}},n=async({hasResolved:c,previousCacheEntry:f,isRevalidating:g,span:i})=>{let j,k=!1===L.isDev,l=c||b.writableEnded;if(ai&&ac&&!f&&!O)return(null==ad?void 0:ad.render404)?await ad.render404(a,b):(b.statusCode=404,b.end("This page could not be found")),null;if(aj&&(j=(0,x.parseFallbackField)(aj.fallback)),j===x.FallbackMode.PRERENDER&&(0,v.isBot)(am)&&(!as||ao)&&(j=x.FallbackMode.BLOCKING_STATIC_RENDER),(null==f?void 0:f.isStale)===-1&&(ai=!0),ai&&(j!==x.FallbackMode.NOT_FOUND||f)&&(j=x.FallbackMode.BLOCKING_STATIC_RENDER),!O&&j!==x.FallbackMode.BLOCKING_STATIC_RENDER&&aC&&!l&&!aa&&U&&(k||!ak)){let b;if((k||aj)&&j===x.FallbackMode.NOT_FOUND)throw new C.NoFallbackError;if(as&&!aq){let c="string"==typeof(null==aj?void 0:aj.fallback)?aj.fallback:k?ah:null;if(b=await L.handleResponse({cacheKey:c,req:a,nextConfig:ae,routeKind:e.RouteKind.APP_PAGE,isFallback:!0,prerenderManifest:_,isRoutePPREnabled:as,responseGenerator:async()=>m({span:i,postponed:void 0,fallbackRouteParams:k||au?(0,o.u)(ah):null}),waitUntil:d.waitUntil}),null===b)return null;if(b)return delete b.cacheControl,b}}let n=ai||g||!av?void 0:av;if(at&&void 0!==n)return{cacheControl:{revalidate:1,expire:void 0},value:{kind:w.CachedRouteKind.PAGES,html:y.default.EMPTY,pageData:{},headers:void 0,status:void 0}};let p=U&&as&&((0,h.getRequestMeta)(a,"renderFallbackShell")||au)?(0,o.u)(ag):null;return m({span:i,postponed:n,fallbackRouteParams:p})},p=async c=>{var f,g,i,j,k;let l,o=await L.handleResponse({cacheKey:aB,responseGenerator:a=>n({span:c,...a}),routeKind:e.RouteKind.APP_PAGE,isOnDemandRevalidate:ai,isRoutePPREnabled:as,req:a,nextConfig:ae,prerenderManifest:_,waitUntil:d.waitUntil});if(aa&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate"),L.isDev&&b.setHeader("Cache-Control","no-store, must-revalidate"),!o){if(aB)throw Object.defineProperty(Error("invariant: cache entry required but not generated"),"__NEXT_ERROR_CODE",{value:"E62",enumerable:!1,configurable:!0});return null}if((null==(f=o.value)?void 0:f.kind)!==w.CachedRouteKind.APP_PAGE)throw Object.defineProperty(Error(`Invariant app-page handler received invalid cache entry ${null==(i=o.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E707",enumerable:!1,configurable:!0});let p="string"==typeof o.value.postponed;al&&!aw&&(!p||ap)&&(O||b.setHeader("x-nextjs-cache",ai?"REVALIDATED":o.isMiss?"MISS":o.isStale?"STALE":"HIT"),b.setHeader(u.NEXT_IS_PRERENDER_HEADER,"1"));let{value:q}=o;if(av)l={revalidate:0,expire:void 0};else if(O&&aq&&!ap&&as)l={revalidate:0,expire:void 0};else if(!L.isDev)if(aa)l={revalidate:0,expire:void 0};else if(al){if(o.cacheControl)if("number"==typeof o.cacheControl.revalidate){if(o.cacheControl.revalidate<1)throw Object.defineProperty(Error(`Invalid revalidate configuration provided: ${o.cacheControl.revalidate} < 1`),"__NEXT_ERROR_CODE",{value:"E22",enumerable:!1,configurable:!0});l={revalidate:o.cacheControl.revalidate,expire:(null==(j=o.cacheControl)?void 0:j.expire)??ae.expireTime}}else l={revalidate:z.CACHE_ONE_YEAR,expire:void 0}}else b.getHeader("Cache-Control")||(l={revalidate:0,expire:void 0});if(o.cacheControl=l,"string"==typeof ax&&(null==q?void 0:q.kind)===w.CachedRouteKind.APP_PAGE&&q.segmentData){b.setHeader(u.NEXT_DID_POSTPONE_HEADER,"2");let c=null==(k=q.headers)?void 0:k[z.NEXT_CACHE_TAGS_HEADER];O&&al&&c&&"string"==typeof c&&b.setHeader(z.NEXT_CACHE_TAGS_HEADER,c);let d=q.segmentData.get(ax);return void 0!==d?(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:y.default.fromStatic(d,u.RSC_CONTENT_TYPE_HEADER),cacheControl:o.cacheControl}):(b.statusCode=204,(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:y.default.EMPTY,cacheControl:o.cacheControl}))}let r=(0,h.getRequestMeta)(a,"onCacheEntry");if(r&&await r({...o,value:{...o.value,kind:"PAGE"}},{url:(0,h.getRequestMeta)(a,"initURL")}))return null;if(p&&av)throw Object.defineProperty(Error("Invariant: postponed state should not be present on a resume request"),"__NEXT_ERROR_CODE",{value:"E396",enumerable:!1,configurable:!0});if(q.headers){let a={...q.headers};for(let[c,d]of(O&&al||delete a[z.NEXT_CACHE_TAGS_HEADER],Object.entries(a)))if(void 0!==d)if(Array.isArray(d))for(let a of d)b.appendHeader(c,a);else"number"==typeof d&&(d=d.toString()),b.appendHeader(c,d)}let s=null==(g=q.headers)?void 0:g[z.NEXT_CACHE_TAGS_HEADER];if(O&&al&&s&&"string"==typeof s&&b.setHeader(z.NEXT_CACHE_TAGS_HEADER,s),!q.status||aq&&as||(b.statusCode=q.status),!O&&q.status&&G.RedirectStatusCode[q.status]&&aq&&(b.statusCode=200),p&&b.setHeader(u.NEXT_DID_POSTPONE_HEADER,"1"),aq&&!aa){if(void 0===q.rscData){if(q.postponed)throw Object.defineProperty(Error("Invariant: Expected postponed to be undefined"),"__NEXT_ERROR_CODE",{value:"E372",enumerable:!1,configurable:!0});return(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:q.html,cacheControl:aw?{revalidate:0,expire:void 0}:o.cacheControl})}return(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:y.default.fromStatic(q.rscData,u.RSC_CONTENT_TYPE_HEADER),cacheControl:o.cacheControl})}let t=q.html;if(!p||O||aq)return(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:t,cacheControl:o.cacheControl});if(at)return t.push(new ReadableStream({start(a){a.enqueue(A.ENCODED_TAGS.CLOSED.BODY_AND_HTML),a.close()}})),(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:t,cacheControl:{revalidate:0,expire:void 0}});let v=new TransformStream;return t.push(v.readable),m({span:c,postponed:q.postponed,fallbackRouteParams:null}).then(async a=>{var b,c;if(!a)throw Object.defineProperty(Error("Invariant: expected a result to be returned"),"__NEXT_ERROR_CODE",{value:"E463",enumerable:!1,configurable:!0});if((null==(b=a.value)?void 0:b.kind)!==w.CachedRouteKind.APP_PAGE)throw Object.defineProperty(Error(`Invariant: expected a page response, got ${null==(c=a.value)?void 0:c.kind}`),"__NEXT_ERROR_CODE",{value:"E305",enumerable:!1,configurable:!0});await a.value.html.pipeTo(v.writable)}).catch(a=>{v.writable.abort(a).catch(a=>{console.error("couldn't abort transformer",a)})}),(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:t,cacheControl:{revalidate:0,expire:void 0}})};if(!aG)return await aF.withPropagatedContext(a.headers,()=>aF.trace(i.BaseServerSpan.handleRequest,{spanName:`${aE} ${a.url}`,kind:g.SpanKind.SERVER,attributes:{"http.method":aE,"http.target":a.url}},p));await p(aG)}catch(b){throw b instanceof C.NoFallbackError||await L.onRequestError(a,b,{routerKind:"App Router",routePath:H,routeType:"render",revalidateReason:(0,f.c)({isRevalidate:al,isOnDemandRevalidate:ai})},ad),b}}},3034:(a,b,c)=>{"use strict";function d(a){let b=(a??"").trim();return b&&"default"!==b.toLowerCase()?b:null}function e(a){let b=a.map(a=>d(a.split(" / ").map(a=>{let b=a.indexOf(": ");return b>-1?a.slice(b+2):a}).join(" / "))??""),c=new Map;for(let a of b)a&&c.set(a,(c.get(a)??0)+1);let e=new Map;return b.map((a,b)=>{if(!a)return`Option ${b+1}`;if((c.get(a)??0)===1)return a;let d=(e.get(a)??0)+1;return e.set(a,d),`${a} (${d})`})}c.d(b,{WM:()=>e,_q:()=>d})},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},4573:a=>{"use strict";a.exports=require("node:buffer")},10250:(a,b,c)=>{Promise.resolve().then(c.t.bind(c,3991,23)),Promise.resolve().then(c.bind(c,54487))},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},21925:(a,b,c)=>{"use strict";c.d(b,{ImportFromUrl:()=>d});let d=(0,c(97954).registerClientReference)(function(){throw Error("Attempted to call ImportFromUrl() from the server but ImportFromUrl is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"C:\\Users\\User\\twin-titans-commerce\\src\\components\\admin\\ImportFromUrl.tsx","ImportFromUrl")},26713:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/is-bot")},27933:(a,b,c)=>{"use strict";c.d(b,{ImportWorkspace:()=>d});let d=(0,c(97954).registerClientReference)(function(){throw Error("Attempted to call ImportWorkspace() from the server but ImportWorkspace is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"C:\\Users\\User\\twin-titans-commerce\\src\\components\\admin\\ImportWorkspace.tsx","ImportWorkspace")},28354:a=>{"use strict";a.exports=require("util")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{"use strict";a.exports=require("path")},37335:(a,b,c)=>{Promise.resolve().then(c.bind(c,81403)),Promise.resolve().then(c.bind(c,45767))},41025:a=>{"use strict";a.exports=require("next/dist/server/app-render/dynamic-access-async-storage.external.js")},45767:(a,b,c)=>{"use strict";c.d(b,{ImportWorkspace:()=>q});var d=c(21124),e=c(38301),f=c(5374);function g({href:a}){let[b,c]=(0,e.useState)(!1),g=(0,e.useRef)(null),h=async()=>{try{await navigator.clipboard.writeText(a),c(!0),setTimeout(()=>c(!1),2500)}catch{}};return(0,d.jsxs)("section",{className:"card p-6",children:[(0,d.jsxs)("div",{className:"flex items-start gap-3",children:[(0,d.jsx)(f.ls,{size:20,className:"mt-0.5 shrink-0 text-gold"}),(0,d.jsxs)("div",{className:"min-w-0",children:[(0,d.jsx)("h3",{className:"font-display text-d2 text-onyx",children:"Capture from your browser"}),(0,d.jsx)("p",{className:"mt-2 max-w-2xl text-body text-greige",children:"Supplier sites serve automated requests a stripped page with no prices, variants or videos. Your browser sees the real thing — so the capture runs there. This is the same approach DSers and Oberlo use."})]})]}),(0,d.jsxs)("ol",{className:"mt-6 space-y-4 text-body text-greige",children:[(0,d.jsxs)("li",{className:"flex gap-3",children:[(0,d.jsx)("span",{className:"text-label shrink-0 text-gold",children:"01"}),(0,d.jsxs)("span",{children:["Show your bookmarks bar — ",(0,d.jsx)("kbd",{className:"text-onyx",children:"Ctrl"})," +"," ",(0,d.jsx)("kbd",{className:"text-onyx",children:"Shift"})," + ",(0,d.jsx)("kbd",{className:"text-onyx",children:"B"}),"."]})]}),(0,d.jsxs)("li",{className:"flex gap-3",children:[(0,d.jsx)("span",{className:"text-label shrink-0 text-gold",children:"02"}),(0,d.jsxs)("span",{className:"flex flex-wrap items-center gap-3",children:["Drag this button onto it:",(0,d.jsx)("a",{ref:g,onClick:a=>a.preventDefault(),draggable:!0,className:"btn btn-primary cursor-grab px-5 py-2.5 active:cursor-grabbing",title:"Drag me to your bookmarks bar",children:"Capture to Twin Titans"}),(0,d.jsx)("button",{type:"button",onClick:h,className:"link text-label",children:b?"Copied":"or copy the code"})]})]}),(0,d.jsxs)("li",{className:"flex gap-3",children:[(0,d.jsx)("span",{className:"text-label shrink-0 text-gold",children:"03"}),(0,d.jsxs)("span",{children:["Open any AliExpress, Alibaba or 1688 product page, ",(0,d.jsx)("strong",{className:"text-onyx",children:"wait until prices are visible"}),", then click the bookmark. A confirmation appears on the page."]})]}),(0,d.jsxs)("li",{className:"flex gap-3",children:[(0,d.jsx)("span",{className:"text-label shrink-0 text-gold",children:"04"}),(0,d.jsx)("span",{children:"Come back here — the capture appears below, ready to price."})]})]}),(0,d.jsxs)("p",{className:"mt-6 flex items-start gap-2 text-label !normal-case !tracking-normal text-quiet",children:[(0,d.jsx)(f.iW,{size:15,className:"mt-0.5 shrink-0 text-verdigris"}),"Captures land as raw supplier data. Nothing is priced, published or charged until you review it."]})]})}var h=c(42378);function i(){let a=(0,h.useRouter)(),[b,c]=(0,e.useState)(""),[g,i]=(0,e.useState)(!1),[j,k]=(0,e.useState)(null),l=async()=>{let d=b.trim();if(d){i(!0),k(null);try{let b;try{b=JSON.parse(d)}catch{throw Error("That is not valid JSON. Copy the whole clipboard contents.")}let e=await fetch("/api/admin/capture",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)}),f=await e.json().catch(()=>({}));if(!e.ok)throw Error(f?.error??`Rejected (${e.status}).`);k({ok:!0,message:`Saved: ${f.variantCount??0} variants (${f.pricedVariantCount??0} priced), ${f.imageCount??0} images, ${f.videoCount??0} videos.`}),c(""),a.refresh()}catch(a){k({ok:!1,message:a instanceof Error?a.message:"Could not save."})}finally{i(!1)}}};return(0,d.jsxs)("section",{className:"card p-6",children:[(0,d.jsx)("h3",{className:"font-display text-d2 text-onyx",children:"Paste a capture"}),(0,d.jsx)("p",{className:"mt-2 max-w-2xl text-body text-greige",children:"If the bookmarklet says the site blocked sending, it copied the data to your clipboard instead. Paste it here."}),(0,d.jsx)("textarea",{value:b,onChange:a=>c(a.target.value),rows:4,spellCheck:!1,placeholder:'{"sourceUrl":"https://www.aliexpress.com/item/...","variants":[...]}',className:"field mt-4 resize-y font-mono text-micro","aria-label":"Captured product JSON"}),(0,d.jsxs)("div",{className:"mt-4 flex flex-wrap items-center gap-4",children:[(0,d.jsx)("button",{type:"button",onClick:l,disabled:g||!b.trim(),className:"btn btn-primary",children:g?"Saving…":"Save capture"}),b&&(0,d.jsx)("button",{type:"button",onClick:()=>{c(""),k(null)},className:"link text-label",children:"Clear"})]}),j&&(0,d.jsxs)("p",{role:j.ok?"status":"alert",className:`mt-4 flex items-start gap-2 text-body ${j.ok?"text-verdigris":"text-danger"}`,children:[j.ok?(0,d.jsx)(f.iW,{size:16,className:"mt-1 shrink-0"}):(0,d.jsx)(f.gz,{size:16,className:"mt-1 shrink-0"}),j.message]})]})}function j(a){return a.importedProductId?"ACTIVE"===a.productStatus?"live":"DRAFT"===a.productStatus?"draft":"deleted":0===a.pricedVariantCount?"unpriceable":"ready"}let k={live:"Live in store",draft:"Draft — not visible",deleted:"Product deleted",unpriceable:"No prices captured",ready:"Not yet priced"},l={live:"border-verdigris/50 text-verdigris",draft:"border-warn/50 text-warn",deleted:"border-rule text-quiet",unpriceable:"border-danger/50 text-danger",ready:"border-gold/40 text-gold"};function m({captures:a,onUse:b,onDelete:c,busyId:e=null,arrivedIds:f=[]}){if(0===a.length)return(0,d.jsx)("div",{className:"card p-10 text-center",children:(0,d.jsx)("p",{className:"text-body text-greige",children:"No captures yet. Use the bookmark on a supplier product page and it will appear here."})});let g=a.reduce((a,b)=>{let c=j(b);return a[c]=(a[c]??0)+1,a},{});return(0,d.jsxs)("div",{className:"space-y-3",children:[(0,d.jsxs)("div",{className:"flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-quiet",children:[(0,d.jsxs)("span",{children:[a.length," captures"]}),g.live>0&&(0,d.jsxs)("span",{className:"text-verdigris",children:[g.live," live"]}),g.draft>0&&(0,d.jsxs)("span",{className:"text-warn",children:[g.draft," draft"]}),g.ready>0&&(0,d.jsxs)("span",{className:"text-gold",children:[g.ready," to price"]}),g.unpriceable>0&&(0,d.jsxs)("span",{className:"text-danger",children:[g.unpriceable," with no prices"]}),g.deleted>0&&(0,d.jsxs)("span",{children:[g.deleted," deleted"]})]}),(0,d.jsx)("ul",{className:"max-h-[65vh] space-y-3 overflow-y-auto pr-1",children:a.map(a=>{let g=a.pricedVariantCount<a.variantCount||0===a.pricedVariantCount,h=j(a);return(0,d.jsxs)("li",{className:["card flex flex-wrap items-center gap-4 p-4 transition-opacity",e===a.id?"opacity-50":"",f.includes(a.id)?"capture-arrived":""].filter(Boolean).join(" "),children:[(0,d.jsx)("div",{className:"media aspect-product w-16 shrink-0",children:a.thumbnail&&(0,d.jsx)("img",{src:a.thumbnail,alt:"",loading:"lazy"})}),(0,d.jsxs)("div",{className:"min-w-0 flex-1",children:[(0,d.jsx)("p",{className:"line-clamp-1 text-body text-onyx",children:a.title}),(0,d.jsxs)("div",{className:"mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-quiet",children:[(0,d.jsx)("span",{className:"tag",children:a.platform}),(0,d.jsxs)("span",{className:g?"text-danger":"text-verdigris",children:[a.pricedVariantCount,"/",a.variantCount," priced"]}),(0,d.jsxs)("span",{children:[a.imageCount," images"]}),a.videoCount>0&&(0,d.jsxs)("span",{className:"text-gold",children:[a.videoCount," video"]}),a.reviewCount>0&&(0,d.jsxs)("span",{children:[a.reviewCount," reviews"]}),(0,d.jsx)("span",{children:new Date(a.createdAt).toLocaleString()})]})]}),(0,d.jsxs)("div",{className:"flex shrink-0 items-center gap-2",children:[(0,d.jsx)("span",{className:`tag ${l[h]}`,children:k[h]}),"live"===h&&a.productHandle&&(0,d.jsx)("a",{href:`/products/${a.productHandle}`,target:"_blank",rel:"noreferrer",className:"link text-label",children:"View"}),"draft"===h&&(0,d.jsx)("a",{href:"/admin/products",className:"link text-label",children:"Publish it"}),("ready"===h||"unpriceable"===h)&&(0,d.jsx)("button",{type:"button",onClick:()=>b(a.id),disabled:"unpriceable"===h,title:"unpriceable"===h?"This capture has no prices, so it cannot be costed. Re-capture it from the supplier page.":void 0,className:"btn btn-primary px-5 py-2.5 disabled:opacity-40",children:"Price it"}),(0,d.jsx)("button",{type:"button",onClick:()=>c(a.id),disabled:e===a.id,className:"link text-label",children:"Delete"})]})]},a.id)})})]})}var n=c(3034),o=c(82094);let p=(0,e.forwardRef)(function({baseCurrency:a,defaultMarginPct:b},c){let f=(0,h.useRouter)(),[g,i]=(0,e.useState)(""),[j,k]=(0,e.useState)(b),[l,m]=(0,e.useState)(null),[p,q]=(0,e.useState)(""),[r,s]=(0,e.useState)({}),[t,u]=(0,e.useState)({}),[v,w]=(0,e.useState)(!1),[x,y]=(0,e.useState)(null),[z,A]=(0,e.useState)(null),B=(0,e.useCallback)(async a=>{w(!0),y(null),A(null);try{let b=await fetch("/api/admin/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"preview-capture",captureId:a,marginPct:j})}),c=await b.json();if(!b.ok)throw Error(c?.error??"Could not load that capture.");m(c),q(c.product.title),s({}),u({})}catch(a){y(a instanceof Error?a.message:"Could not load that capture."),m(null)}finally{w(!1)}},[j]);(0,e.useImperativeHandle)(c,()=>({loadCapture:a=>void B(a)}),[B]);let C=async()=>{w(!0),y(null),A(null);try{let a=await fetch("/api/admin/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"preview",url:g,marginPct:j})}),b=await a.json();if(!a.ok)throw Error(b?.error??"Could not read that listing.");m(b),q(b.product.title),s({})}catch(a){y(a instanceof Error?a.message:"Import failed."),m(null)}finally{w(!1)}},D=async()=>{if(l){w(!0),y(null);try{let b={};for(let[c,d]of Object.entries(r)){let e=parseFloat(d);Number.isFinite(e)&&e>0&&(b[c]=(0,o.Rg)(e,a))}let c={};for(let[b,d]of Object.entries(t)){let e=parseFloat(d);Number.isFinite(e)&&e>0&&(c[b]=(0,o.Rg)(e,a))}let d=await fetch("/api/admin/import",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"commit",preview:l,title:p,priceOverrides:b,costOverrides:c})}),e=await d.json();if(!d.ok)throw Error(e?.error??"Could not save the product.");A({handle:e.handle,warnings:e.warnings??[]}),m(null),f.refresh()}catch(a){y(a instanceof Error?a.message:"Save failed.")}finally{w(!1)}}},E=(l?.pricing??[]).map((b,c)=>{let d=((b,c)=>{let d=parseFloat(t[c]??"");return Number.isFinite(d)&&d>0?(0,o.Rg)(d,a):b.landedCostMinor})(b,c),e=((b,c)=>{let d=parseFloat(r[c]??"");return Number.isFinite(d)&&d>0?(0,o.Rg)(d,a):b.priceMinor})(b,c),f=d>0;return{cost:d,price:e,known:f,profit:f?e-d:0,margin:f&&e>0?(e-d)/e*100:0,loss:f&&e-d<=0}}),F=E.some(a=>!a.known),G=E.some(a=>a.loss),H=F||G;return(0,d.jsxs)("div",{className:"space-y-6",children:[(0,d.jsxs)("div",{className:"card space-y-4 p-6",children:[(0,d.jsxs)("div",{children:[(0,d.jsx)("label",{className:"field-label",htmlFor:"supplier-url",children:"Supplier product URL"}),(0,d.jsxs)("div",{className:"flex flex-col gap-3 sm:flex-row",children:[(0,d.jsx)("input",{id:"supplier-url",className:"field flex-1",placeholder:"https://www.aliexpress.com/item/1005007635123586.html",value:g,onChange:a=>i(a.target.value),onKeyDown:a=>{"Enter"===a.key&&g.trim()&&C()}}),(0,d.jsx)("button",{type:"button",onClick:C,disabled:v||!g.trim(),className:"btn btn-primary sm:w-40",children:v?"Reading…":"Fetch listing"})]}),(0,d.jsx)("p",{className:"mt-2 text-xs text-greige",children:"AliExpress, Alibaba and 1688 links are all understood, including short share links."})]}),(0,d.jsxs)("div",{className:"max-w-xs",children:[(0,d.jsxs)("label",{className:"field-label",htmlFor:"margin",children:["Target margin: ",j,"%"]}),(0,d.jsx)("input",{id:"margin",type:"range",min:10,max:80,value:j,onChange:a=>k(Number(a.target.value)),className:"w-full accent-[rgb(124,92,255)]"})]})]}),x&&(0,d.jsx)("div",{role:"alert",className:"card border-danger/40 bg-danger/10 p-4 text-sm text-danger",children:x}),z&&(0,d.jsxs)("div",{className:"card border-verdigris/40 bg-verdigris/10 p-5 text-sm",children:[(0,d.jsxs)("p",{className:"font-semibold text-onyx",children:["Saved as a draft: ",(0,d.jsx)("code",{className:"text-verdigris",children:z.handle})]}),(0,d.jsx)("p",{className:"mt-1 text-greige",children:"It is not live yet. Review it under Products, then publish when you are happy."}),z.warnings.length>0&&(0,d.jsx)("ul",{className:"mt-3 space-y-1 text-xs text-warn",children:z.warnings.map((a,b)=>(0,d.jsxs)("li",{children:["• ",a]},b))})]}),l&&(0,d.jsxs)("div",{className:"space-y-5",children:[l.alreadyImported&&(0,d.jsxs)("div",{className:"card border-warn/40 bg-warn/10 p-4 text-sm text-warn",children:["You already imported this listing as"," ",(0,d.jsx)("strong",{children:l.alreadyImported.title}),". Importing again creates a duplicate."]}),"manual"===l.product.provenance&&(0,d.jsxs)("div",{className:"card border-warn/40 bg-warn/10 p-4 text-sm text-warn",children:[(0,d.jsx)("p",{className:"font-semibold",children:"The supplier blocked the automated read."}),(0,d.jsx)("ul",{className:"mt-2 space-y-1 text-xs",children:l.product.warnings.map((a,b)=>(0,d.jsxs)("li",{children:["• ",a]},b))})]}),(0,d.jsxs)("div",{className:"card space-y-5 p-6",children:[(0,d.jsxs)("div",{className:"flex flex-wrap items-center gap-2",children:[(0,d.jsx)("span",{className:"tag border-verdigris/40 text-verdigris",children:l.product.platform}),(0,d.jsxs)("span",{className:"tag",children:["Read from: ",l.product.provenance]}),l.product.supplierName&&(0,d.jsx)("span",{className:"tag",children:l.product.supplierName}),null!=l.product.rating&&(0,d.jsxs)("span",{className:"tag",children:["★ ",l.product.rating]}),null!=l.product.ordersCount&&(0,d.jsxs)("span",{className:"tag",children:[l.product.ordersCount.toLocaleString()," sold"]})]}),(0,d.jsxs)("div",{className:"grid gap-5 sm:grid-cols-[160px_1fr]",children:[(0,d.jsx)("div",{className:"aspect-square overflow-hidden rounded-sm bg-bone2",children:l.product.images[0]?(0,d.jsx)("img",{src:l.product.images[0],alt:"",className:"h-full w-full object-cover"}):(0,d.jsx)("div",{className:"grid h-full place-items-center text-xs text-greige",children:"No image"})}),(0,d.jsxs)("div",{className:"space-y-3",children:[(0,d.jsxs)("div",{children:[(0,d.jsx)("label",{className:"field-label",htmlFor:"product-title",children:"Product title (rewrite this — supplier titles are keyword spam)"}),(0,d.jsx)("textarea",{id:"product-title",rows:2,className:"field resize-none",value:p,onChange:a=>q(a.target.value)})]}),(0,d.jsxs)("p",{className:"text-xs text-greige",children:[l.product.images.length," image(s) \xb7 costs in ",l.product.currency," \xb7 converted at ",l.fxRateUsed.toFixed(2)," ",a," per"," ",l.product.currency]})]})]})]}),(0,d.jsxs)("div",{className:"card overflow-hidden",children:[(0,d.jsxs)("div",{className:"flex items-center justify-between border-b border-rule p-5",children:[(0,d.jsxs)("h3",{className:"text-sm font-bold",children:["Pricing — ",l.pricing.length," variant",1===l.pricing.length?"":"s"]}),G&&(0,d.jsx)("span",{className:"tag border-danger/50 text-danger",children:"Loss-making variants"})]}),(0,d.jsx)("div",{className:"scroll-x",children:(0,d.jsxs)("table",{className:"w-full min-w-[720px] text-sm",children:[(0,d.jsx)("thead",{children:(0,d.jsxs)("tr",{className:"border-b border-rule text-left text-xs uppercase tracking-wide text-greige",children:[(0,d.jsx)("th",{className:"p-4 font-medium",children:"Variant"}),(0,d.jsx)("th",{className:"p-4 font-medium",children:"Landed cost"}),(0,d.jsx)("th",{className:"p-4 font-medium",children:"Your price"}),(0,d.jsx)("th",{className:"p-4 font-medium",children:"Profit"}),(0,d.jsx)("th",{className:"p-4 font-medium",children:"Margin"})]})}),(0,d.jsx)("tbody",{children:l.pricing.map((b,c)=>{let e=E[c],f=e.loss;return(0,d.jsxs)("tr",{className:"border-b border-rule/60 last:border-0",children:[(0,d.jsxs)("td",{className:"p-4",children:[(0,d.jsx)("span",{className:"font-medium",children:(0,n._q)(b.optionLabel)??"This product"}),b.warnings.length>0&&(0,d.jsx)("ul",{className:"mt-1 space-y-0.5 text-[11px] text-warn",children:b.warnings.map((a,b)=>(0,d.jsx)("li",{children:a},b))})]}),(0,d.jsxs)("td",{className:"p-4",children:[(0,d.jsx)("input",{className:`field w-32 py-2 ${!e.known?"border-danger":""}`,inputMode:"decimal",placeholder:"required",value:t[c]??(b.landedCostMinor>0?String((0,o.Ai)(b.landedCostMinor,a)):""),onChange:a=>u(b=>({...b,[c]:a.target.value})),"aria-label":`Landed cost for ${(0,n._q)(b.optionLabel)??"this product"}`}),!e.known&&(0,d.jsx)("span",{className:"mt-1 block text-[11px] text-danger",children:"Enter what this costs you"})]}),(0,d.jsx)("td",{className:"p-4",children:(0,d.jsx)("input",{className:"field w-32 py-2",inputMode:"decimal",value:r[c]??String((0,o.Ai)(b.priceMinor,a)),onChange:a=>s(b=>({...b,[c]:a.target.value})),"aria-label":`Price for ${(0,n._q)(b.optionLabel)??"this product"}`})}),(0,d.jsx)("td",{className:`p-4 font-semibold ${f?"text-danger":"text-onyx"}`,children:e.known?(0,o.up)(e.profit,a):"—"}),(0,d.jsx)("td",{className:`p-4 ${f?"text-danger":"text-verdigris"}`,children:e.known?`${e.margin.toFixed(1)}%`:"—"})]},c)})})]})})]}),(0,d.jsxs)("div",{className:"flex flex-wrap items-center gap-3",children:[(0,d.jsx)("button",{type:"button",onClick:D,disabled:v||H,title:F?"Enter the landed cost for every variant first":G?"A variant would sell at or below cost":void 0,className:"btn btn-primary",children:v?"Saving…":"Save as draft product"}),(0,d.jsx)("button",{type:"button",onClick:()=>m(null),className:"btn btn-secondary",children:"Discard"}),(0,d.jsx)("p",{className:"text-xs text-greige",children:F?"Enter the landed cost for every variant — a product cannot be priced without it.":G?"At least one variant would sell at or below cost. Fix the price or the cost.":"Imports always land as drafts — nothing goes live until you publish it."})]})]})]})});function q({baseCurrency:a,defaultMarginPct:b,bookmarklet:c,captures:f}){let h=(0,e.useRef)(null),[j,k]=(0,e.useState)(null),{rows:l,arrivedIds:n,busyId:o,remove:q}=function(a,b=5e3){let[c,d]=(0,e.useState)(a),[f,g]=(0,e.useState)([]),[h,i]=(0,e.useState)(null),j=(0,e.useRef)({count:a.length,latestId:a[0]?.id??null});return(0,e.useRef)(c),{rows:c,arrivedIds:f,busyId:h,remove:(0,e.useCallback)(async a=>{i(a);try{(await fetch(`/api/admin/capture/${a}`,{method:"DELETE"})).ok&&d(b=>{let c=b.filter(b=>b.id!==a);return j.current={count:c.length,latestId:c[0]?.id??null},c})}finally{i(null)}},[])}}(f);return(0,d.jsxs)("div",{className:"space-y-8",children:[c?(0,d.jsx)(g,{href:c}):(0,d.jsx)("div",{className:"card border-warn/40 p-6",children:(0,d.jsx)("p",{className:"text-body text-warn",children:"AUTH_SECRET is not set on the server, so the capture bookmarklet cannot be generated."})}),(0,d.jsx)(i,{}),(0,d.jsxs)("section",{className:"space-y-4",children:[(0,d.jsxs)("h3",{className:"font-display text-d2 text-onyx",children:["Captures",l.length>0&&(0,d.jsx)("span",{className:"ml-2 text-label text-quiet",children:l.length})]}),(0,d.jsx)(m,{captures:l,onUse:a=>{k(a),h.current?.loadCapture(a),requestAnimationFrame(()=>{document.getElementById("pricing")?.scrollIntoView({behavior:"smooth",block:"start"})})},onDelete:q,busyId:o,arrivedIds:n})]}),(0,d.jsx)("section",{id:"pricing",className:"scroll-mt-24 space-y-4",children:(0,d.jsx)(p,{ref:h,baseCurrency:a,defaultMarginPct:b,activeCaptureId:j})})]})}},54487:(a,b,c)=>{"use strict";function d(){return null}c.d(b,{RegisterServiceWorker:()=>d}),c(38301)},55511:a=>{"use strict";a.exports=require("crypto")},57975:a=>{"use strict";a.exports=require("node:util")},58101:(a,b,c)=>{"use strict";c.d(b,{RegisterServiceWorker:()=>d});let d=(0,c(97954).registerClientReference)(function(){throw Error("Attempted to call RegisterServiceWorker() from the server but RegisterServiceWorker is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"C:\\Users\\User\\twin-titans-commerce\\src\\components\\admin\\RegisterServiceWorker.tsx","RegisterServiceWorker")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},67360:(a,b,c)=>{"use strict";c.d(b,{D_:()=>p,Ht:()=>n,QF:()=>q,ZT:()=>o,jw:()=>l,lx:()=>m});var d=c(87082),e=c.n(d),f=c(42570),g=c(94069),h=c(86802),i=c(35552);let j="tt_admin";function k(){let a=process.env.AUTH_SECRET;if(!a||a.length<16)throw Error("AUTH_SECRET is missing or too short. Generate one with: openssl rand -base64 48");return new TextEncoder().encode(a)}async function l(a){let b=await new f.P({...a}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("43200s").sign(k());(await (0,h.UL)()).set(j,b,{httpOnly:!0,secure:!0,sameSite:"lax",path:"/",maxAge:43200})}async function m(){(await (0,h.UL)()).delete(j)}async function n(){try{let a=(await (0,h.UL)()).get(j)?.value;if(!a)return null;let{payload:b}=await (0,g.V)(a,k());return{userId:String(b.userId),email:String(b.email),name:b.name?String(b.name):void 0,role:String(b.role??"owner")}}catch{return null}}async function o(){let a=await n();if(!a)throw new p;return a}class p extends Error{constructor(){super("Not signed in."),this.name="UnauthorizedError"}}async function q(a,b){var c;let d=await i.prisma.adminUser.findUnique({where:{email:a.toLowerCase().trim()}});return d?await (c=d.passwordHash,Promise.resolve(e().compareSync(b,c)))?(await i.prisma.adminUser.update({where:{id:d.id},data:{lastLoginAt:new Date}}),{userId:d.id,email:d.email,name:d.name??void 0,role:d.role}):null:(e().compareSync(b,"$2a$12$xzR2b2x6X7EvXTMV2p.WfuKdz72SgZOxMjL8GlDG8ANDkkgO3fmAO"),null)}},77087:(a,b,c)=>{Promise.resolve().then(c.bind(c,21925)),Promise.resolve().then(c.bind(c,27933))},77598:a=>{"use strict";a.exports=require("node:crypto")},81403:(a,b,c)=>{"use strict";c.d(b,{ImportFromUrl:()=>g});var d=c(21124),e=c(42378),f=c(38301);function g({captureToken:a}){let b=(0,e.useRouter)(),[c,g]=(0,f.useState)(""),[h,i]=(0,f.useState)(!1),[j,k]=(0,f.useState)(null),l=async a=>{if(a.preventDefault(),c.trim()&&!h){i(!0),k(null);try{let a=await fetch("/api/admin/import/from-url",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:c.trim()})}),d=await a.json().catch(()=>({}));if(a.ok&&d.ok){let a=d.quality;k({ok:!0,text:`Fetched "${String(d.title).slice(0,60)}" — ${a.variantCount} variants (${a.pricedVariantCount} priced), ${a.imageCount} images. It is in the queue below.`,warning:d.warning}),g(""),b.refresh()}else k({ok:!1,text:String(d.error??"Could not fetch that product.")})}catch{k({ok:!1,text:"Could not reach the server."})}finally{i(!1)}}};return(0,d.jsxs)("form",{onSubmit:l,className:"card space-y-3 p-6",children:[(0,d.jsxs)("div",{children:[(0,d.jsx)("label",{className:"field-label",htmlFor:"import-url",children:"Import from a link"}),(0,d.jsx)("p",{className:"mb-2 text-micro text-greige",children:"Paste an AliExpress product link (or just its number). Nothing to install — the store asks AliExpress directly, so prices and options come from the source."}),(0,d.jsxs)("div",{className:"flex flex-wrap gap-2",children:[(0,d.jsx)("input",{id:"import-url",value:c,onChange:a=>g(a.target.value),placeholder:"https://www.aliexpress.com/item/1005005457763997.html",className:"field min-w-[16rem] flex-1",autoComplete:"off"}),(0,d.jsx)("button",{type:"submit",disabled:h||!c.trim(),className:"btn btn-primary !rounded-full px-5 py-2 text-xs disabled:opacity-60",children:h?"Fetching…":"Fetch product"})]})]}),a&&(0,d.jsxs)("details",{className:"border-t border-rule pt-3",children:[(0,d.jsx)("summary",{className:"cursor-pointer text-micro text-greige",children:"Browser extension — one-click from AliExpress"}),(0,d.jsx)("p",{className:"mt-2 text-micro text-greige",children:"Paste this into the extension’s options, with the store address. It is the same token the bookmarklet uses; it lets a request add a capture and nothing else."}),(0,d.jsx)("code",{className:"mt-2 block break-all border border-rule p-2 text-micro text-onyx",children:a})]}),j&&(0,d.jsxs)("div",{className:"space-y-1",children:[(0,d.jsx)("p",{className:`text-micro ${j.ok?"text-verdigris":"text-warn"}`,children:j.text}),j.warning&&(0,d.jsx)("p",{className:"text-micro text-warn",children:j.warning})]})]})}},86241:(a,b,c)=>{"use strict";c.r(b),c.d(b,{default:()=>l,dynamic:()=>k,metadata:()=>j});var d=c(75338),e=c(27933),f=c(21925),g=c(97195),h=c(92317),i=c(74823);let j={title:"Import product"},k="force-dynamic";async function l(){let[a,b]=await Promise.all([(0,i.r5)(),(0,i.gq)()]),c="https://twintitansemporium.store".replace(/\/$/,""),j="",k="";try{k=(0,g.W)(),j=function(a,b){let c=`(async function(){
  var OUT = ${JSON.stringify(a)};
  var TOKEN = ${JSON.stringify(b)};

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
    /*
     * The same photo is served two ways: /kf/<id>.jpeg and, for SEO,
     * /kf/<id>/<product-slug>.jpeg. They are different strings for one
     * picture, so deduplicating without collapsing them puts every image in
     * the gallery twice.
     */
    var k = u.indexOf('/kf/');
    if(k > -1){
      var rest = u.slice(k + 4);
      var slash = rest.indexOf('/');
      if(slash > -1){
        var id = rest.slice(0, slash);
        if(id.indexOf('.') < 0){
          var dot = rest.lastIndexOf('.');
          u = u.slice(0, k + 4) + id + (dot > -1 ? rest.slice(dot) : '');
        }
      }
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
    /*
     * Two passes, and a trailing-number strip between them: og:title arrives as
     * "... Home Kitchen Tools - AliExpress 15", so matching the suffix alone
     * misses and the storefront heading keeps " - AliExpress" on it.
     */
    for(var pass = 0; pass < 2; pass++){
      for(var i = 0; i < tails.length; i++){
        var tail = tails[i];
        if(t.length > tail.length && t.slice(-tail.length).toLowerCase() === tail.toLowerCase()){
          t = t.slice(0, -tail.length).trim();
        }
      }
      var parts = t.split(' ');
      if(parts.length > 1 && /^[0-9]+$/.test(parts[parts.length - 1])){
        t = parts.slice(0, -1).join(' ').trim();
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
                      '₦':'NGN', '$':'USD', '€':'EUR', '\xa3':'GBP', '₽':'RUB',
                      '₹':'INR', '\xa5':'CNY', '₩':'KRW', '₺':'TRY', '₪':'ILS',
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
     * Single-SKU listings render no option picker at all, so there is no
     * skuInstance anywhere in the tree and the capture came back with zero
     * variants — the quality gate then rejected a product that was perfectly
     * good, just optionless. A cabbage slicer with 10,000+ sold and 2,553
     * reviews failed exactly this way. The price header still carries both
     * figures, so fall back to a single optionless variant.
     */
    if(!out.variants.length){
      try{
        var priceProps = null;
        var fiberAt = function(el){
          var ks = Object.keys(el);
          for(var i = 0; i < ks.length; i++){
            if(ks[i].indexOf('__reactFiber') === 0 || ks[i].indexOf('__reactInternalInstance') === 0) return el[ks[i]];
          }
          return null;
        };
        var nodes = document.querySelectorAll('div,span');
        for(var ni = 0; ni < nodes.length && !priceProps; ni++){
          var pf = fiberAt(nodes[ni]), ph = 0;
          while(pf && ph < 10){
            if(pf.memoizedProps && pf.memoizedProps.priceText){ priceProps = pf.memoizedProps; break; }
            pf = pf.return; ph++;
          }
        }
        if(priceProps){
          var onePromo = num(priceProps.priceText);
          var oneList = num(priceProps.originalPriceText) || onePromo;
          var oneCost = oneList > onePromo ? oneList : onePromo;
          if(oneCost > 0){
            out.variants.push({
              options: {},
              price: oneCost,
              promoPrice: onePromo < oneCost ? onePromo : undefined,
              stock: 0
            });
            var shown1 = String(priceProps.priceText || '');
            var code1 = shown1.match(/[A-Z]{3}/);
            if(code1) out.currency = code1[0];
            else if(shown1.indexOf('₦') > -1) out.currency = 'NGN';
          }
        }
      }catch(e){}
    }

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
    /*
     * A duplicate is said FIRST and on its own. Appending it to the success
     * line would bury the one fact that changes what the merchant does next,
     * which is that this product is already in the store.
     */
    if (body.duplicateOf) {
      note('ALREADY IN YOUR STORE: "' + String(body.duplicateOf.title).slice(0, 50) + '" ('
        + String(body.duplicateOf.status).toLowerCase() + '). The capture was saved so you can'
        + ' refresh prices or images, but do not import it again as a new product.', true);
      return;
    }
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
})();`;return`javascript:${encodeURIComponent(c)}`}(`${c}/api/admin/capture`,k)}catch{}let l=await (0,h.E)();return(0,d.jsxs)("div",{className:"space-y-8",children:[(0,d.jsxs)("header",{className:"space-y-2",children:[(0,d.jsx)("h2",{className:"font-display text-d3 text-onyx",children:"Add a product"}),(0,d.jsxs)("p",{className:"max-w-2xl text-body text-greige",children:["Paste a link, or capture from your browser, then price every variant against its own landed cost in ",a.baseCurrency,". Nothing can be published below what it costs you."]})]}),(0,d.jsx)(f.ImportFromUrl,{captureToken:k}),(0,d.jsx)(e.ImportWorkspace,{baseCurrency:a.baseCurrency,defaultMarginPct:b.marginPct,bookmarklet:j,captures:l})]})}},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},92098:(a,b,c)=>{Promise.resolve().then(c.t.bind(c,65169,23)),Promise.resolve().then(c.bind(c,58101))},92317:(a,b,c)=>{"use strict";c.d(b,{E:()=>e});var d=c(35552);async function e(a=300){let b=await d.prisma.supplierCapture.findMany({orderBy:{createdAt:"desc"},take:a}).catch(()=>[]),c=b.map(a=>a.importedProductId).filter(a=>!!a),f=b.filter(a=>!a.importedProductId&&a.externalId),g=new Map((f.length?await d.prisma.supplierProduct.findMany({where:{OR:f.map(a=>({platform:a.platform,externalId:a.externalId}))},select:{productId:!0,platform:!0,externalId:!0}}).catch(()=>[]):[]).map(a=>[`${a.platform}:${a.externalId}`,a.productId])),h=[...new Set([...c,...g.values()])],i=new Map((h.length?await d.prisma.product.findMany({where:{id:{in:h}},select:{id:!0,status:!0,handle:!0}}).catch(()=>[]):[]).map(a=>[a.id,a]));return b.map(a=>{let b=a.payload,c=a.importedProductId??(a.externalId?g.get(`${a.platform}:${a.externalId}`)??null:null),d=c?i.get(c):void 0;return{id:a.id,title:a.title,platform:a.platform,sourceUrl:a.sourceUrl,currency:a.currency,variantCount:a.variantCount,pricedVariantCount:a.pricedVariantCount,imageCount:a.imageCount,videoCount:a.videoCount,reviewCount:a.reviewCount,importedProductId:c,productStatus:d?.status??null,productHandle:d?.handle??null,createdAt:a.createdAt.toISOString(),thumbnail:b?.images?.[0]??null}})}},93972:(a,b,c)=>{"use strict";c.r(b),c.d(b,{default:()=>l,dynamic:()=>i,metadata:()=>j});var d=c(75338),e=c(58101),f=c(65169),g=c.n(f),h=c(67360);let i="force-dynamic",j={title:"Admin",robots:{index:!1,follow:!1}},k=[["/admin","Dashboard"],["/admin/import","Import product"],["/admin/products","Products"],["/admin/orders","Orders"],["/admin/fulfilment","Supplier queue"],["/admin/margins","Margin audit"],["/admin/reviews","Reviews"],["/admin/customers","Customers"],["/admin/subscribers","Mailing list"],["/admin/settings","Settings"]];async function l({children:a}){let b=await (0,h.Ht)();return b?(0,d.jsxs)("div",{className:"shell py-8",children:[(0,d.jsx)(e.RegisterServiceWorker,{}),(0,d.jsxs)("div",{className:"mb-8 flex flex-wrap items-center justify-between gap-4",children:[(0,d.jsxs)("div",{children:[(0,d.jsx)("h1",{className:"text-xl font-bold tracking-tight",children:"Store admin"}),(0,d.jsxs)("p",{className:"text-xs text-greige",children:["Signed in as ",b.email]})]}),(0,d.jsx)("form",{action:"/api/admin/logout",method:"post",children:(0,d.jsx)("button",{type:"submit",className:"btn btn-secondary text-xs",children:"Sign out"})})]}),(0,d.jsx)("nav",{className:"scroll-x mb-8 flex gap-2 border-b border-rule pb-3",children:k.map(([a,b])=>(0,d.jsx)(g(),{href:a,className:"shrink-0 rounded-sm px-3.5 py-2 text-sm text-greige transition hover:bg-paper hover:text-onyx",children:b},a))}),a]}):(0,d.jsx)(d.Fragment,{children:a})}},96330:a=>{"use strict";a.exports=require("@prisma/client")},97195:(a,b,c)=>{"use strict";c.d(b,{W:()=>e});var d=c(77598);function e(){let a=process.env.AUTH_SECRET??"";if(a.length<16)throw Error("AUTH_SECRET missing or too short");return(0,d.createHash)("sha256").update(`${a}:capture`).digest("hex").slice(0,32)}}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[5873,577,2995,2532,5479,4955],()=>b(b.s=1880));module.exports=c})();