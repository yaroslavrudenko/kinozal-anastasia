// TV probe (run with tv5/cdp.mjs): memory of keeping every OTT Club logo loaded (the LOGO_KEEP budget).
//   node <S>/tv5/cdp.mjs <port> <S>/logo-design/t-logos-mem.mjs
// Loads the logo of every channel of the list into Image() objects held in window.__KEEP (≈389 requests, ≈2.5 MB, 6 at a
// time), reads the device's free memory (tizen.systeminfo MEMORY) and the JS heap before, after, and 15 s after letting
// them go. Also times the loads. Nothing on screen changes; the playing stream keeps playing.
export default async function (c) {
  const mem = () => c.evp(`new Promise(function(res){try{tizen.systeminfo.getPropertyValue('MEMORY',function(m){res({availMB:Math.round(m.availableCapacity/1048576),status:m.status,heapMB:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null})},function(e){res({err:e.message})})}catch(e){res({err:String(e)})}})`);
  c.log('before', JSON.stringify(await mem()));
  const r = await c.evp(`new Promise(function(res){var urls=[],seen={};for(var i=0;i<Channels.count();i++){var u=Channels.at(i).logo;if(u&&!seen[u]){seen[u]=1;urls.push(u)}}
    window.__KEEP=[];var ok=0,bad=0,i2=0,live=0,t0=performance.now(),px=0;
    function next(){while(live<6&&i2<urls.length){(function(u){var im=new Image();live++;im.onload=function(){ok++;px+=im.naturalWidth*im.naturalHeight;live--;fin()};im.onerror=function(){bad++;live--;fin()};im.src=u;__KEEP.push(im)})(urls[i2++])}}
    function fin(){if(ok+bad===urls.length)res({urls:urls.length,ok:ok,bad:bad,ms:Math.round(performance.now()-t0),decodedMBifPainted:Math.round(px*4/1048576)});else next()}
    next()})`);
  c.log('loaded', JSON.stringify(r));
  await c.sleep(3000);
  c.log('kept', JSON.stringify(await mem()));
  await c.ev('window.__KEEP=null;1');
  await c.sleep(15000);
  c.log('released', JSON.stringify(await mem()));
}
