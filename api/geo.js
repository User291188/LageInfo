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
  const urls=[`https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`,`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`];
  let last='';
  for(const url of urls){
   try{const r=await fetch(url,{redirect:'follow'});if(!r.ok){last=`Drive HTTP ${r.status}`;continue}const text=await r.text();const data=JSON.parse(text);return res.status(200).json(data)}catch(e){last=e.message}
  }
  throw new Error(last||'Drive source unavailable');
 }catch(e){console.error('geo',key,e);return res.status(502).json({error:'geo source unavailable',layer:key,detail:e.message})}
}