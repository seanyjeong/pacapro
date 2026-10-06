import pathlib,json,hashlib,subprocess,tarfile,shutil,sqlite3,datetime,os,gzip,time,urllib.request
os.umask(0o077)
stage=pathlib.Path('/tmp/peak-pack-20261006')
meta=json.loads((stage/'release.json').read_text())
rows=json.loads((stage/'manifest.json').read_text())
current=pathlib.Path('/opt/max-business-mcp/current');old=pathlib.Path(meta['previous_release'])
roots={'paca':pathlib.Path('/root/pacapro'),'peak':pathlib.Path('/root/peak'),'mcp':old}
services=['paca-failover.service','paca-mcp.service','peak-mcp.service']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None
def guard():
 assert current.resolve()==old,'STOP MCP pointer drift'
 for r in rows:assert sha(roots[r['provider']]/r['path'])==r['before'],'STOP source drift '+r['provider']+'/'+r['path']
def health(url):
 with urllib.request.urlopen(url,timeout=5) as r:return r.status,json.loads(r.read())
guard()
assert len(rows)==13 and {r['provider'] for r in rows}=={'paca','mcp'}
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup=pathlib.Path('/root/backups/peak-mcp-pack-'+stamp);backup.mkdir(mode=0o700)
(backup/'manifest.json').write_text(json.dumps(rows,indent=2));(backup/'previous-mcp.txt').write_text(str(old)+'\n')
env_paths=[pathlib.Path('/root/pacapro/backend/.env'),pathlib.Path('/root/peak/backend/.env'),pathlib.Path('/etc/paca-mcp.env'),pathlib.Path('/etc/peak-mcp.env')]
env_before={str(p):sha(p) for p in env_paths}
for i,p in enumerate(env_paths):
 if p.exists():shutil.copy2(p,backup/('env-'+str(i)))
for provider in ['paca','peak','mcp']:
 with tarfile.open(backup/(provider+'-code.tgz'),'w:gz') as t:
  for r in rows:
   if r['provider']==provider and r['before'] is not None:t.add(roots[provider]/r['path'],arcname=r['path'])
 subprocess.run(['tar','-tzf',str(backup/(provider+'-code.tgz'))],stdout=subprocess.DEVNULL,check=True)
for provider in ['paca','peak']:
 # An online read snapshot preserves live OAuth state without stopping authentication.
 values={}
 for line in pathlib.Path('/etc/'+provider+'-mcp.env').read_text().splitlines():
  if '=' in line and not line.lstrip().startswith('#'):
   k,v=line.split('=',1);values[k.strip()]=v.strip().strip('\"').strip("'")
 db_path=values.get('MCP_DB_PATH','/var/lib/'+provider+'-mcp/oauth.db')
 source=sqlite3.connect('file:'+db_path+'?mode=ro',uri=True);dest=sqlite3.connect(str(backup/(provider+'-oauth.db')))
 source.backup(dest);assert dest.execute('PRAGMA integrity_check').fetchone()[0]=='ok';source.close();dest.close()
with open(backup/'paca-peak.sql.gz','wb') as dst:
 dump=subprocess.Popen(['mysqldump','--single-transaction','--quick','--triggers','--no-tablespaces','--databases','paca','peak'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 with gzip.GzipFile(fileobj=dst,mode='wb') as gz:shutil.copyfileobj(dump.stdout,gz)
 dump.communicate();assert dump.returncode==0,'STOP database dump failed'
subprocess.run(['gzip','-t',str(backup/'paca-peak.sql.gz')],check=True)
(backup/'checksums.json').write_text(json.dumps({p.name:sha(p) for p in backup.iterdir() if p.is_file()},indent=2))
candidate=backup/'candidate';candidate.mkdir()
with tarfile.open(stage/'candidate.tgz') as t:
 assert set(t.getnames())=={r['provider']+'/'+r['path'] for r in rows} and all(m.isfile() for m in t.getmembers());t.extractall(candidate)
for r in rows:
 p=candidate/r['provider']/r['path'];assert sha(p)==r['after']
 if p.suffix=='.js':subprocess.run(['/opt/max-business-mcp/node/bin/node' if r['provider']=='mcp' else '/usr/bin/node','--check',str(p)],check=True)
new=pathlib.Path(meta['release']);assert not new.exists(),'STOP release already exists'
shutil.copytree(old,new,symlinks=True)
for r in rows:
 if r['provider']=='mcp':
  dst=new/r['path'];dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(candidate/'mcp'/r['path'],dst)
guard();assert all(sha(pathlib.Path(p))==h for p,h in env_before.items()),'STOP environment drift before replacement'
changed=[];switched=False
try:
 for r in rows:
  if r['provider']!='mcp':
   dst=roots[r['provider']]/r['path'];dst.parent.mkdir(parents=True,exist_ok=True);changed.append(r);shutil.copy2(candidate/r['provider']/r['path'],dst)
 temp=current.with_name('current.pack-new');temp.symlink_to(new);os.replace(temp,current);switched=True
 for unit in services:subprocess.run(['systemctl','restart',unit],check=True)
 for _ in range(20):
  try:
   checks={}
   for name,url in [('paca','http://127.0.0.1:8320/health'),('peak','http://127.0.0.1:8330/health'),('paca_mcp','http://127.0.0.1:8342/health'),('peak_mcp','http://127.0.0.1:8343/health')]:
    status,body=health(url);assert status==200;checks[name]=body
   assert checks['paca_mcp']['version']==checks['peak_mcp']['version']=='0.4.1';break
  except Exception:time.sleep(1)
 else:raise RuntimeError('health verification failed')
 for unit in services:assert subprocess.check_output(['systemctl','is-active',unit],text=True).strip()=='active'
 for r in rows:assert sha((new if r['provider']=='mcp' else roots[r['provider']])/r['path'])==r['after'],'deployed hash mismatch'
 assert all(sha(pathlib.Path(p))==h for p,h in env_before.items()),'environment changed'
 public={}
 for name,url in [('paca','https://supermax.kr/paca-health'),('peak','https://supermax.kr/peak-health'),('paca_mcp','https://paca-mcp.supermax.kr/health'),('peak_mcp','https://peak-mcp.supermax.kr/health')]:
  status,body=health(url);assert status==200;public[name]=body
 assert public['paca_mcp']['version']==public['peak_mcp']['version']=='0.4.1'
 result={'status':'deployed_verified','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.4.1','backup':str(backup),'previous_release':str(old),'release':str(new),'candidate_files':len(rows),'services':services,'env_unchanged':True,'schema_migrations':0,'operational_business_confirm_calls':0,'candidate_commits':meta['commits'],'health':checks,'public_health':public,'source_hashes_matched':True,'backup_integrity_verified':True,'authenticated_catalog':'pending'}
 (backup/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
except Exception:
 for provider in ['paca','peak']:
  restored=backup/('restore-'+provider);restored.mkdir()
  with tarfile.open(backup/(provider+'-code.tgz')) as t:t.extractall(restored)
  for r in changed:
   if r['provider']!=provider:continue
   target=roots[provider]/r['path'];original=restored/r['path']
   if original.exists():shutil.copy2(original,target)
   else:target.unlink(missing_ok=True)
 if switched:
  temp=current.with_name('current.pack-rollback');temp.symlink_to(old);os.replace(temp,current)
 for unit in services:subprocess.run(['systemctl','restart',unit],check=True)
 (backup/'result.json').write_text(json.dumps({'status':'deploy_failed_runtime_rolled_back','backup':str(backup),'previous_release':str(old)}));raise
