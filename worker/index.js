/** Family Finance transport gateway. NO data storage, NO financial authorization here.
 * Back-end authorization, session and ACL are enforced by Apps Script.
 */
const origins=new Set(['https://morkov-d.github.io']);
function allowed(o,env){return !!o&&(origins.has(o)||(env.ALLOW_LOCALHOST==='true'&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o)))}
function cors(origin){return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}})}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin')||'';
 if(!allowed(origin,env))return json({ok:false,error:'Origin not allowed'},403,{});
 const headers=cors(origin);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST'||new URL(request.url).pathname!=='/rpc')return json({ok:false,error:'Not found'},404,headers);
 if(Number(request.headers.get('Content-Length')||0)>131072)return json({ok:false,error:'Request too large'},413,headers);
 let raw='';try{raw=await request.text();if(raw.length>131072)throw Error('Request too large')}catch{return json({ok:false,error:'Invalid payload'},400,headers)}
 let payload;try{payload=JSON.parse(raw)}catch{return json({ok:false,error:'Malformed JSON'},400,headers)}
 if(typeof payload.scriptUrl!=='string')return json({ok:false,error:'Script URL missing'},400,headers);
 let url;try{url=new URL(payload.scriptUrl)}catch{return json({ok:false,error:'Invalid Script URL'},400,headers)}
 if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[\w-]+\/exec\/?$/.test(url.pathname)||url.search||url.hash)return json({ok:false,error:'Untrusted Script URL'},400,headers);
 if(!/^[a-zA-Z][A-Za-z0-9]{0,39}$/.test(payload.action||''))return json({ok:false,error:'Invalid RPC action'},400,headers);
 const data=JSON.stringify({action:payload.action,token:String(payload.token||''),data:payload.data||{}});
 try{
  // POST as plain text bypasses Apps Script Content-Type preflight. Cloudflare fetch is server-to-server.
  const reply=await fetch(url.toString(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:data,redirect:'follow',signal:AbortSignal.timeout(25000)});
  const responseText=await reply.text();
  if(!reply.ok||!responseText.trim().startsWith('{'))return json({ok:false,error:'Google Apps Script did not return JSON. Check Web App deployment access and /exec URL.'},502,headers);
  let body;try{body=JSON.parse(responseText)}catch{return json({ok:false,error:'Invalid reply from Apps Script'},502,headers)}
  return json(body,200,headers);
 }catch{return json({ok:false,error:'Google Apps Script unavailable or request timed out'},502,headers)}
}}
