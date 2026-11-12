/** HTTPS relay to Apps Script. The Worker is transport-only; all permissions are checked in Apps Script. */
export const gatewayUrl=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export const validScriptUrl=(value:string)=>{
 try{const u=new URL(value.trim());return u.protocol==='https:'&&u.hostname==='script.google.com'&&/^\/macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/.test(u.pathname)&&!u.search&& !u.hash}catch{return false}
};
export type RpcResponse={ok:boolean;error?:string;[key:string]:unknown};
export async function api(action:string,data:unknown={},token='',scriptUrl=''):Promise<RpcResponse>{
 if(!gatewayUrl)throw Error('Шлюз не настроен: добавьте VITE_API_URL в GitHub Actions / .env.local');
 if(!validScriptUrl(scriptUrl))throw Error('Сначала укажите ссылку Apps Script с окончанием /exec');
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch(gatewayUrl+'/rpc',{method:'POST',mode:'cors',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({scriptUrl,action,data,token}),signal:controller.signal,cache:'no-store'});
  if(!response.ok)throw Error(`Ошибка шлюза: HTTP ${response.status}`);
  const result:RpcResponse=await response.json();
  if(!result.ok)throw Error(result.error||'Запрос отклонён сервером');
  return result;
 }catch(e){if(e instanceof DOMException&&e.name==='AbortError')throw Error('Сервер не ответил за 25 секунд');throw e}
 finally{clearTimeout(timeout)}
}
