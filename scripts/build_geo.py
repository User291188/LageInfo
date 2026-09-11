import json,math,os,urllib.request
from shapely.geometry import Polygon,MultiPolygon,mapping
from shapely.ops import transform
FILES={'liegenschaften':('1YPn34i03XYSEmuo_I1f3Dl8CX_FpqUXA','sites'),'stouebpl':('1nMJNDLZvRXY8ExXQRr-Id-mZ-IpCD3ZV','list'),'truebpl':('1haIB2rx8SeTPgAPP5ajAPI2n6CScGsJx','list')}
def merc(x,y,z=None):
 lon=x*180/20037508.34; lat=y*180/20037508.34; lat=180/math.pi*(2*math.atan(math.exp(lat*math.pi/180))-math.pi/2); return lon,lat
def records(d,mode):
 if mode=='sites': return [f for l in d.get('layers',[]) for f in l.get('features',[])]
 return d if isinstance(d,list) else d.get('features',[])
def build(name,fid,mode):
 url=f'https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t'
 with urllib.request.urlopen(url,timeout=120) as r: d=json.load(r)
 out=[]; keep={'objectid','OBJECTID','we_nr','lgbez','typ','plz','ort','strasse','nr','bl','flaeche_qm','anzahl_gebaeude','sto','stober'}
 for rec in records(d,mode):
  rings=(rec.get('geometry') or {}).get('rings') or []; polys=[]
  for ring in rings:
   try:
    p=Polygon(ring)
    if not p.is_valid:p=p.buffer(0)
    if p.is_empty:continue
    p=transform(merc,p).simplify(.00008,preserve_topology=True)
    polys.extend([p] if p.geom_type=='Polygon' else list(p.geoms))
   except Exception:pass
  if not polys:continue
  a=rec.get('attributes') or {}; props={k:v for k,v in a.items() if k in keep and v is not None}
  g=polys[0] if len(polys)==1 else MultiPolygon(polys)
  out.append({'type':'Feature','properties':props,'geometry':mapping(g)})
 os.makedirs('data',exist_ok=True)
 with open(f'data/{name}.geojson','w',encoding='utf-8') as f:json.dump({'type':'FeatureCollection','features':out},f,ensure_ascii=False,separators=(',',':'))
 print(name,len(out),os.path.getsize(f'data/{name}.geojson'))
for name,(fid,mode) in FILES.items():build(name,fid,mode)
