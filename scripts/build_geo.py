import json,math,os,urllib.request,brotli
from shapely.geometry import Polygon,MultiPolygon,mapping,shape
from shapely.ops import transform

DRIVE={
 'liegenschaften':('1YPn34i03XYSEmuo_I1f3Dl8CX_FpqUXA','sites'),
 'stouebpl':('1nMJNDLZvRXY8ExXQRr-Id-mZ-IpCD3ZV','list'),
 'truebpl':('1haIB2rx8SeTPgAPP5ajAPI2n6CScGsJx','list'),
 'bundeslaender':('1pqiPBuusg1b8SiFti29_5Fgz0VRyIdZx','geojson'),
 'kreise':('1TWIZGBxzI_1sDEQ1okP_98aciSkE106I','geojson'),
 'gemeinden':('1eyB8srsoHeOtQuQRaaHhupqFoSXkMjzq','geojson'),
 'stadtteile':('1UvAoi92PUEhKUlWI2Y-F7-GCURevHqe1','geojson')
}
PLZ_RELEASE_API='https://api.github.com/repos/yetzt/postleitzahlen/releases/latest'
SIMPLIFY={'bundeslaender':.0010,'kreise':.00065,'gemeinden':.00035,'stadtteile':.00018,'postleitzahlen':.00022,'liegenschaften':.00008,'stouebpl':.00008,'truebpl':.00008}

def merc(x,y,z=None):
 lon=x*180/20037508.34;lat=y*180/20037508.34;lat=180/math.pi*(2*math.atan(math.exp(lat*math.pi/180))-math.pi/2);return lon,lat

def download(fid):
 with urllib.request.urlopen(f'https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t',timeout=300) as r:return json.load(r)

def request(url,accept='application/json'):
 return urllib.request.Request(url,headers={'User-Agent':'LageInfo-GeoBuilder/1.1','Accept':accept})

def download_latest_plz():
 with urllib.request.urlopen(request(PLZ_RELEASE_API),timeout=60) as r:release=json.load(r)
 asset=next((a for a in release.get('assets',[]) if a.get('name')=='postleitzahlen.geojson.br'),None)
 if not asset:raise RuntimeError('Latest PLZ release has no postleitzahlen.geojson.br asset')
 print('PLZ release',release.get('tag_name'),asset.get('size'))
 with urllib.request.urlopen(request(asset['browser_download_url'],'application/octet-stream'),timeout=300) as r:raw=r.read()
 return json.loads(brotli.decompress(raw).decode('utf-8'))

def records(d,mode):
 if mode=='sites':return [f for l in d.get('layers',[]) for f in l.get('features',[])]
 if mode=='list':return d if isinstance(d,list) else d.get('features',[])
 if isinstance(d,dict) and d.get('type')=='FeatureCollection':return d.get('features',[])
 if isinstance(d,list):return d
 return d.get('features',[]) if isinstance(d,dict) else []

def clean_props(a):
 keep={'objectid','OBJECTID','we_nr','lgbez','typ','plz','PLZ','postcode','postal_code','ort','strasse','nr','bl','flaeche_qm','anzahl_gebaeude','sto','stober','GEN','gen','NAME','name','BEZ','bez','AGS','ags','ARS','ars','RS','rs','SN_L','SN_R','EWZ','ewz'}
 return {k:v for k,v in (a or {}).items() if k in keep and v is not None}

def arc_geometry(rec,name):
 rings=(rec.get('geometry') or {}).get('rings') or [];polys=[]
 for ring in rings:
  try:
   p=Polygon(ring)
   if not p.is_valid:p=p.buffer(0)
   if p.is_empty:continue
   p=transform(merc,p).simplify(SIMPLIFY[name],preserve_topology=True);polys.extend([p] if p.geom_type=='Polygon' else list(p.geoms))
  except Exception:pass
 if not polys:return None
 return polys[0] if len(polys)==1 else MultiPolygon(polys)

def geojson_geometry(rec,name):
 try:
  g=shape(rec.get('geometry'))
  if g.is_empty:return None
  if not g.is_valid:g=g.buffer(0)
  return g.simplify(SIMPLIFY[name],preserve_topology=True)
 except Exception:return None

def write_geo(name,d,mode='geojson'):
 out=[]
 for rec in records(d,mode):
  g=geojson_geometry(rec,name) if mode=='geojson' else arc_geometry(rec,name)
  if g is None or g.is_empty:continue
  props=clean_props(rec.get('properties') if mode=='geojson' else rec.get('attributes'))
  out.append({'type':'Feature','properties':props,'geometry':mapping(g)})
 os.makedirs('data',exist_ok=True);path=f'data/{name}.geojson'
 with open(path,'w',encoding='utf-8') as f:json.dump({'type':'FeatureCollection','features':out},f,ensure_ascii=False,separators=(',',':'))
 print(name,len(out),os.path.getsize(path))

def build(name,fid,mode):write_geo(name,download(fid),mode)

for name,(fid,mode) in DRIVE.items():build(name,fid,mode)
write_geo('postleitzahlen',download_latest_plz(),'geojson')
