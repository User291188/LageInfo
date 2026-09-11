const IDS={sites:'1YPn34i03XYSEmuo_I1f3Dl8CX_FpqUXA',sto:'1nMJNDLZvRXY8ExXQRr-Id-mZ-IpCD3ZV',tr:'1haIB2rx8SeTPgAPP5ajAPI2n6CScGsJx'};
const BKG={states:'vg25_lan',districts:'vg25_krs',municipalities:'vg25_gem'};
export default async function handler(req,res){
 const key=String(req.query.layer||'');
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
 try{
  if(BKG[key]){
   const p=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:BKG[key],outputFormat:'application/json',srsName:'EPSG:4326'});
   const r=await fetch(`https://sgx.geodatenzentrum.de/wfs_vg25?${p}`);
   if(!r.ok)throw new Error(`BKG WFS ${r.status}`);
   return res.status(200).json(await r.json());
  }
  const id=IDS[key];
  if(!id)return res.status(400).json({error:'unknown layer',layer:key});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
   const url=`https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
   const r=await fetch(url,{redirect:'follow',signal:controller.signal});
   if(!r.ok)throw new Error(`Drive HTTP ${r.status}`);
   const type=r.headers.get('content-type')||'';
   if(type.includes('text/html'))throw new Error('Google Drive liefert statt JSON eine Download-Seite');
   const text=await r.text();
   return res.status(200).json(JSON.parse(text));
  }finally{clearTimeout(timer)}
 }catch(e){console.error('geo',key,e);const msg=e?.name==='AbortError'?'Quelldatei zu groß für Live-Abruf. Optimierte Kartendatei erforderlich.':e.message;return res.status(502).json({error:'geo source unavailable',layer:key,detail:msg})}
}