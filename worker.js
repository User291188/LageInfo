// LageInfo Cloudflare Worker
// Cloudflare secret required: FIRMS_MAP_KEY
// Routes: /health, /presse, /firms?area=de|missions|world&days=1&source=VIIRS_NOAA21_NRT

const RSS = {
  rlp: 'https://www.presseportal.de/rss/blaulicht-rheinland-pfalz.rss2',
  bw: 'https://www.presseportal.de/rss/blaulicht-baden-wuerttemberg.rss2'
};
const ALLOWED_FIRMS_SOURCES = new Set(['VIIRS_NOAA20_NRT','VIIRS_NOAA21_NRT','MODIS_NRT']);
const AREAS = {
  de: ['5,47,16,56'],
  missions: ['18,29,48,43','18,41,27,57'],
  world: ['world']
};
const BASE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public,max-age=180'
};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...BASE_HEADERS,...extra}});
function clean(s=''){return s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim()}
function tag(item,name){return clean((item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'))||[])[1]||'')}
function parseRss(xml,state){return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((m,i)=>{const x=m[0],guid=tag(x,'guid')||tag(x,'link')||String(i);return{id:`press-${state}-${btoa(unescape(encodeURIComponent(guid))).replace(/[^a-z0-9]/gi,'').slice(0,32)}`,source:`Presseportal · ${state.toUpperCase()}`,area:state==='rlp'?'Rheinland-Pfalz':'Baden-Württemberg',title:tag(x,'title'),text:tag(x,'description'),date:tag(x,'pubDate'),type:'police',url:tag(x,'link')}})}
async function press(){const jobs=Object.entries(RSS).map(async([state,url])=>{try{const r=await fetch(url,{headers:{'User-Agent':'LageInfo/1.0'},cf:{cacheTtl:180,cacheEverything:true}});if(!r.ok)throw new Error(`${state}: HTTP ${r.status}`);return{state,items:parseRss(await r.text(),state)}}catch(e){return{state,items:[],error:e.message}}});const parts=await Promise.all(jobs);const items=parts.flatMap(x=>x.items).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,200);return{items,sources:parts.map(x=>({state:x.state,ok:!x.error,error:x.error||null,count:x.items.length})),updatedAt:new Date().toISOString()}}
function parseCsvLine(line){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===','&&!q){out.push(cur);cur=''}else cur+=c}out.push(cur);return out}
function parseFirmsCsv(csv,source){const lines=csv.trim().split(/\r?\n/);if(lines.length<2)return[];const h=parseCsvLine(lines.shift());return lines.map(line=>{const v=parseCsvLine(line),o=Object.fromEntries(h.map((k,i)=>[k,v[i]]));const lat=Number(o.latitude),lon=Number(o.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;const hh=String(o.acq_time||'').padStart(4,'0');const iso=o.acq_date?`${o.acq_date}T${hh.slice(0,2)}:${hh.slice(2,4)}:00Z`:null;return{id:`fire-${source}-${lat}-${lon}-${o.acq_date||''}-${o.acq_time||''}`,source:'NASA FIRMS',dataset:source,area:'Satellitenerkennung',title:`Wärmeanomalie · FRP ${o.frp||'?'} MW`,text:`${o.instrument||'VIIRS'} ${o.satellite||''} · Confidence ${o.confidence||'?'} · ${o.daynight==='N'?'Nacht':'Tag'}`,date:iso||o.acq_date||'',type:'fire',lat,lon,frp:Number(o.frp)||null,confidence:o.confidence||null,satellite:o.satellite||null}}).filter(Boolean)}
async function firms(env,url){if(!env.FIRMS_MAP_KEY)return{disabled:true,reason:'FIRMS_MAP_KEY ist im Worker nicht als Secret gesetzt.',items:[]};const area=(url.searchParams.get('area')||'missions').toLowerCase();const boxes=AREAS[area]||AREAS.missions;const days=Math.min(5,Math.max(1,Number(url.searchParams.get('days'))||1));const requested=url.searchParams.get('source')||'VIIRS_NOAA21_NRT';const source=ALLOWED_FIRMS_SOURCES.has(requested)?requested:'VIIRS_NOAA21_NRT';let items=[],errors=[];for(const box of boxes){const endpoint=`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(env.FIRMS_MAP_KEY)}/${source}/${box}/${days}`;try{const r=await fetch(endpoint,{cf:{cacheTtl:300,cacheEverything:true}});if(!r.ok){errors.push(`FIRMS ${box}: HTTP ${r.status}`);continue}items.push(...parseFirmsCsv(await r.text(),source))}catch(e){errors.push(`FIRMS ${box}: ${e.message}`)}}items=items.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,5000);return{disabled:false,area,source,days,count:items.length,items,errors,updatedAt:new Date().toISOString()}}
export default{async fetch(req,env){if(req.method==='OPTIONS')return new Response(null,{status:204,headers:BASE_HEADERS});if(req.method!=='GET')return json({error:'Method not allowed'},405);const u=new URL(req.url);try{if(u.pathname==='/presse')return json(await press());if(u.pathname==='/firms')return json(await firms(env,u),200,{'Cache-Control':'public,max-age=300'});if(u.pathname==='/health')return json({ok:true,service:'LageInfo API',firmsConfigured:Boolean(env.FIRMS_MAP_KEY),routes:['/presse','/firms?area=de|missions|world&days=1','/health'],time:new Date().toISOString()});return json({name:'LageInfo API',version:'1.1',routes:['/presse','/firms','/health']})}catch(e){return json({error:e.message||String(e)},500)}}};