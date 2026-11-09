import {useEffect,useState,useCallback,useRef} from 'react'
import {supabase} from './supabase'
import Icon from './Icon'
import Sheet from './Sheet'
export function detect(url){
 let u;try{u=new URL(url)}catch{return {platform:'site'}}
 const h=u.hostname.replace('www.','')
 if((h==='youtube.com'||h.endsWith('.youtube.com'))||h==='youtu.be'){
  const parts=u.pathname.split('/').filter(Boolean)
  const id=h==='youtu.be'?parts[0]:u.searchParams.get('v')||(['embed','shorts','live'].includes(parts[0])?parts[1]:null)
  if(!id||!/^[\w-]{6,20}$/.test(id))return {platform:'youtube'}
  return {platform:'youtube',embed:`https://www.youtube.com/embed/${id}`,thumb:`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
 }
 if(h.includes('tiktok.com')){const m=u.pathname.match(/video\/(\d+)/);return {platform:'tiktok',embed:m?`https://www.tiktok.com/embed/v2/${m[1]}`:null}}
 if(h.includes('instagram.com')){
  const parts=u.pathname.split('/').filter(Boolean),i=parts.findIndex(x=>['p','reel','reels','tv'].includes(x)),code=i>=0?parts[i+1]:null
  if(!code||!/^[\w-]{5,30}$/.test(code))return {platform:'instagram'}
  return {platform:'instagram',embed:`https://www.instagram.com/${parts[i]==='p'?'p':parts[i]==='tv'?'tv':'reel'}/${code}/embed`}
 }
 if(h.includes('kwai')||h.includes('kw.ai'))return {platform:'kwai'}
 return {platform:'site'}
}
const KIND={link:'Link',note:'Nota',prompt:'Prompt',idea:'Ideia'}
const KICON={link:'link',note:'note',prompt:'prompt',idea:'idea'}
const PLAT={youtube:'YouTube',tiktok:'TikTok',instagram:'Instagram',kwai:'Kwai',site:'Site'}
const igInfo=url=>{try{const p=new URL(url).pathname.split('/').filter(Boolean),i=p.findIndex(x=>['p','reel','reels','tv'].includes(x))
 const kind=i<0?'Perfil':p[i]==='p'?'Post':p[i]==='tv'?'Vídeo':'Reel'
 const user=i>0?p[0]:(i<0&&p[0]&&!['stories','explore','accounts','direct'].includes(p[0])?p[0]:'')
 return {kind:i<0&&!user?'Link':kind,user}}catch{return {kind:'',user:''}}}
const COVER_BUCKET='item-covers',COVER_PREFIX='storage:item-covers/'
const storedCoverPath=value=>value?.startsWith(COVER_PREFIX)?value.slice(COVER_PREFIX.length):null
const AUTO_COVER=['site','tiktok','kwai'] // YouTube já tem miniatura própria; Instagram não tem via oficial
let pending=(()=>{
 const q=new URLSearchParams(location.search)
 if(!q.get('url')&&!q.get('text')&&!q.get('title'))return null
 history.replaceState(null,'',location.pathname)
 const raw=[q.get('url'),q.get('text')].filter(Boolean).join(' ').trim()
 const m=raw.match(/https?:\/\/\S+/),title=q.get('title')||''
 if(!m)return raw||title?{type:'note',title,content:raw}:null
 return {type:'link',url:m[0],title,content:raw.replace(m[0],'').trim()}
})()
const empty={type:'link',url:'',title:'',content:'',tags:'',thumb:'',platform:''}
const TILE={link:'lilac',note:'sand',prompt:'mint',idea:'rose'}
const host=u=>{try{return new URL(u).hostname.replace('www.','')}catch{return ''}}
const getPrev=async(url,signal)=>{
 const d=detect(url);let ti='',th=d.thumb||''
 try{
  const target=new URL(url)
  if(!['http:','https:'].includes(target.protocol))return {title:ti,thumb:th,platform:d.platform}
  const response=await fetch('https://noembed.com/embed?url='+encodeURIComponent(target.href),{signal})
  if(response.ok){const j=await response.json();ti=typeof j.title==='string'?j.title:'';th=th||(typeof j.thumbnail_url==='string'?j.thumbnail_url:'')}
 }catch{}
 return {title:ti,thumb:th,platform:d.platform}
}
export default function Items({user,folder,role,q,addTick,dests,allowNone=true}){
 const [adding,setAdding]=useState(()=>!!pending||addTick>0)
 const [editId,setEditId]=useState(null),[picker,setPicker]=useState(null),orig=useRef(null)
 const [items,setItems]=useState([]),[open,setOpen]=useState(null),[menu,setMenu]=useState(null),[play,setPlay]=useState(false),[previewState,setPreviewState]=useState('idle'),[f,setF]=useState(()=>{const p=pending;pending=null;return p?{...empty,...p}:empty})
 const previewUrl=useRef(f.url)
 const [coverFile,setCoverFile]=useState(null),[coverPreview,setCoverPreview]=useState(''),[removeCover,setRemoveCover]=useState(false)
 const [saving,setSaving]=useState(false)
 const canEdit=!folder||role!=='viewer'
 const load=useCallback(async()=>{
  let qy=supabase.from('items').select('*').order('created_at',{ascending:false})
  qy=folder?qy.eq('folder_id',folder.id):qy.eq('owner_id',user.id)
  const {data}=await qy
  const paths=(data||[]).map(item=>storedCoverPath(item.thumbnail)).filter(Boolean)
  const {data:covers}=paths.length?await supabase.storage.from(COVER_BUCKET).createSignedUrls(paths,300):{data:[]}
  const signed=new Map((covers||[]).map(cover=>[cover.path,cover.signedUrl]))
  const rows=(data||[]).map(item=>{
   const path=storedCoverPath(item.thumbnail)
   return {...item,coverDisplay:path?(signed.get(path)||''):(item.thumbnail||'')}
  })
  setItems(rows)
 },[folder?.id,user.id])
 useEffect(()=>{load()},[load])
 useEffect(()=>{
  if(!coverFile){setCoverPreview('');return}
  const src=URL.createObjectURL(coverFile);setCoverPreview(src)
  return ()=>URL.revokeObjectURL(src)
 },[coverFile])
 useEffect(()=>{if(addTick)setAdding(true)},[addTick])
 const set=k=>e=>setF({...f,[k]:e.target.value})
 useEffect(()=>{
  const url=f.url.trim()
  if(previewUrl.current!==url){previewUrl.current=url;setF(current=>({...current,thumb:storedCoverPath(current.thumb)?current.thumb:''}))}
  if(f.type!=='link'||!url){setPreviewState('idle');return}
  const controller=new AbortController()
  let timeout,timedOut=false
  const timer=setTimeout(async()=>{
   setPreviewState('loading')
   timeout=setTimeout(()=>{timedOut=true;controller.abort()},7000)
   const r=await getPrev(url,controller.signal)
   clearTimeout(timeout)
   if(controller.signal.aborted){if(timedOut)setPreviewState('unavailable');return}
   setF(current=>({...current,title:current.title||r.title,thumb:storedCoverPath(current.thumb)?current.thumb:r.thumb||current.thumb,platform:r.platform||current.platform}))
   setPreviewState(r.thumb||r.title?'ready':'unavailable')
  },450)
  return ()=>{clearTimeout(timer);clearTimeout(timeout);controller.abort()}
 },[f.url,f.type])
 const fetchCover=async(id,manual)=>{
  const {data,error}=await supabase.functions.invoke('link-cover',{body:{item_id:id}})
  if(!error&&data?.ok){load();return true}
  if(manual)alert(error?(error.context?.status===404?'A função link-cover ainda não foi publicada no Supabase.':'Não consegui buscar a capa agora. Tente de novo em instantes.'):'Não encontrei uma imagem nesse link. Use Editar para escolher uma foto de capa.')
  return false
 }
 const save=async e=>{
  e.preventDefault()
  if(saving)return
  setSaving(true)
  const link=f.type==='link',d=link?detect(f.url):{}
  let t=f.thumb,p=f.platform,ti=f.title
  if(link&&editId&&f.url!==orig.current?.url){const r=await getPrev(f.url);t=storedCoverPath(f.thumb)?f.thumb:r.thumb;p=r.platform;ti=ti||r.title}
  const oldCoverPath=storedCoverPath(f.thumb)
  let uploadedCoverPath=null
  if(coverFile){
   if(!['image/jpeg','image/png','image/webp'].includes(coverFile.type)||coverFile.size>5*1024*1024){setSaving(false);return alert('Escolha uma imagem JPG, PNG ou WebP de até 5 MB.')}
   const ext=coverFile.type==='image/png'?'png':coverFile.type==='image/webp'?'webp':'jpg'
   uploadedCoverPath=`${user.id}/${crypto.randomUUID()}.${ext}`
   const {error}=await supabase.storage.from(COVER_BUCKET).upload(uploadedCoverPath,coverFile,{contentType:coverFile.type,upsert:false})
   if(error){setSaving(false);alert(error.message);return}
   t=COVER_PREFIX+uploadedCoverPath
  }else if(removeCover)t=null
  const row={type:f.type,title:ti||null,url:link?(f.url||null):null,content:f.content||null,platform:link?(p||d.platform||null):null,
   thumbnail:t||(link?d.thumb:null)||null,tags:f.tags.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)}
  const {data:saved,error}=editId?await supabase.from('items').update(row).eq('id',editId).select('id').maybeSingle():await supabase.from('items').insert({...row,folder_id:folder?.id||null}).select('id').single()
  if(error){if(uploadedCoverPath)await supabase.storage.from(COVER_BUCKET).remove([uploadedCoverPath]);setSaving(false);return alert(error.message)}
  if(oldCoverPath&&(uploadedCoverPath||removeCover)&&oldCoverPath.startsWith(`${user.id}/`)){
   const {data:references,error:referenceError}=await supabase.from('items').select('id').eq('thumbnail',COVER_PREFIX+oldCoverPath).limit(1)
   if(!referenceError&&!references?.length)await supabase.storage.from(COVER_BUCKET).remove([oldCoverPath])
  }
  if(saved?.id&&link&&!uploadedCoverPath&&!removeCover&&!storedCoverPath(t)&&AUTO_COVER.includes(d.platform)&&(!editId||f.url!==orig.current?.url))fetchCover(saved.id,false)
  setCoverFile(null);setRemoveCover(false);setSaving(false)
  setF(editId?empty:{...empty,type:f.type});setAdding(false);setEditId(null);load()
 }
 const closeAll=()=>{setOpen(null);setMenu(null);setPlay(false)}
 const del=async i=>{if(confirm('Excluir este item?')){await supabase.from('items').delete().eq('id',i.id);closeAll();load()}}
 const keep=async i=>{
  const {id,owner_id,folder_id,created_at,...rest}=i
  if(storedCoverPath(rest.thumbnail)&&owner_id!==user.id)rest.thumbnail=null
  const {error}=await supabase.from('items').insert({...rest,copied_from:id,folder_id:null})
  alert(error?error.message:'Salvo na sua biblioteca.')
 }
 const canEditItem=i=>i.owner_id===user.id||role==='owner'||role==='editor'
 const closeForm=()=>{setAdding(false);setEditId(null);setCoverFile(null);setRemoveCover(false);setF(empty)}
 const openEdit=i=>{closeAll();orig.current=i;setEditId(i.id);setCoverFile(null);setRemoveCover(false);setF({type:i.type,url:i.url||'',title:i.title||'',content:i.content||'',tags:(i.tags||[]).join(', '),thumb:i.thumbnail||'',platform:i.platform||''});setAdding(true)}
 const optsFor=(i,mode)=>[...(allowNone&&i.folder_id&&(mode==='copy'||i.owner_id===user.id)?[{id:null,name:'Sem pasta (Todos os itens)'}]:[]),...(dests||[]).filter(x=>x.id!==i.folder_id)]
 const copyTo=async(i,dest,dup)=>{
  const {id,owner_id,created_at,folder_id,...rest}=i
  if(storedCoverPath(rest.thumbnail)&&owner_id!==user.id)rest.thumbnail=null
  const row={...rest,folder_id:dest,copied_from:id}
  if(dup&&row.title)row.title=row.title+' (cópia)'
  const {error}=await supabase.from('items').insert(row)
  return error
 }
 const duplicate=async i=>{const e=await copyTo(i,i.folder_id,true);if(e)alert(e.message);else load()}
 const pickDest=async d=>{
  const {item,mode}=picker;setPicker(null)
  if(mode==='move'){
   const {error}=await supabase.from('items').update({folder_id:d}).eq('id',item.id)
   if(error)return alert(error.message)
   closeAll();load()
  }else{
   const e=await copyTo(item,d,false)
   alert(e?e.message:'Cópia criada.');load()
  }
 }
 const actions=i=>[
  i.url&&{k:'open',icon:'out',label:'Abrir original',href:i.url},
  canEditItem(i)&&i.owner_id===user.id&&i.type==='link'&&i.url&&AUTO_COVER.includes(detect(i.url).platform)&&!storedCoverPath(i.thumbnail)&&{k:'autocover',icon:'link',label:'Buscar capa automática',run:()=>fetchCover(i.id,true)},
  canEditItem(i)&&{k:'edit',icon:'edit',label:'Editar',run:()=>openEdit(i)},
  canEdit&&{k:'dup',icon:'dup',label:'Duplicar',run:()=>duplicate(i)},
  canEditItem(i)&&optsFor(i,'move').length>0&&{k:'move',icon:'move',label:'Mover para…',run:()=>setPicker({item:i,mode:'move'})},
  optsFor(i,'copy').length>0&&{k:'cp',icon:'folder',label:'Copiar para…',run:()=>setPicker({item:i,mode:'copy'})},
  i.content&&{k:'copy',icon:'copy',label:'Copiar texto',run:()=>navigator.clipboard.writeText(i.content)},
  i.owner_id!==user.id&&{k:'keep',icon:'save',label:'Salvar na minha biblioteca',run:()=>keep(i)},
  (i.owner_id===user.id||role==='owner')&&{k:'del',icon:'trash',label:'Excluir',danger:true,run:()=>del(i)}
 ].filter(Boolean)
 const term=(q||'').toLowerCase()
 const shown=items.filter(i=>[i.title,i.content,i.url,...(i.tags||[])].join(' ').toLowerCase().includes(term))
 const cur=items.find(i=>i.id===open),mi=items.find(i=>i.id===menu)
 const dc=cur?.url?detect(cur.url):{}
 return <>
  {shown.length===0&&<div className="emptybox"><span className="ic"><Icon n={items.length?'search':'inbox'} size={26}/></span><h2>{items.length?'Nada encontrado':'Sua biblioteca está vazia'}</h2><p>{items.length?'Tente outra palavra, ou busque por uma tag.':'Cole um link de vídeo, escreva uma ideia ou guarde um prompt para começar.'}</p>{!items.length&&canEdit&&<button className="btn btn--primary" onClick={()=>setAdding(true)}><Icon n="plus" size={16}/>Adicionar o primeiro item</button>}</div>}
  <div className="masonry">{shown.map(i=>{
   const d=i.url?detect(i.url):{},tile=!i.coverDisplay,plat=i.platform&&i.platform!=='site'?(PLAT[i.platform]||i.platform):'',ig=d.platform==='instagram',igi=ig?igInfo(i.url):{}
   return <article className="pin" key={i.id}>
    <button className="pin-media" onClick={()=>{setOpen(i.id);setPlay(false)}} aria-label={'Abrir '+(i.title||KIND[i.type])}>
     {tile?<div className={'tile tile--'+(ig?'insta':TILE[i.type])}>
       <span className="tic"><Icon n={ig?'insta':KICON[i.type]} size={18}/></span>{ig&&<span className="igtag">Instagram · {igi.kind}</span>}
       {i.title&&<h3>{i.title}</h3>}
       {i.content&&<p>{i.content}</p>}
       {i.url&&<span className="host">{ig&&igi.user?'@'+igi.user:host(i.url)}</span>}
      </div>:<img src={i.coverDisplay} alt="" loading="lazy"/>}
     {d.embed&&<span className="playbadge"><Icon n="play" size={18}/></span>}
    </button>
    <div className="pin-foot">
     <div className="pin-t">{!tile&&i.title&&<p className="pin-title">{i.title}</p>}<span className="pin-meta">{KIND[i.type]}{plat?` · ${plat}`:''}</span></div>
     <button className="icon-btn" aria-label="Mais ações" onClick={()=>setMenu(i.id)}><Icon n="more"/></button>
    </div>
   </article>})}</div>

  {mi&&<Sheet onClose={()=>setMenu(null)} label="Ações do item">
   {actions(mi).map(a=>a.href?<a key={a.k} className="mi" href={a.href} target="_blank" rel="noreferrer" onClick={()=>setMenu(null)}><Icon n={a.icon}/>{a.label}</a>:<button key={a.k} className={'mi'+(a.danger?' danger':'')} onClick={()=>{a.run();if(!a.danger)setMenu(null)}}><Icon n={a.icon}/>{a.label}</button>)}
  </Sheet>}

  {cur&&<Sheet wide onClose={closeAll} label="Detalhes do item">
   <button className="x glass" aria-label="Fechar" onClick={closeAll}><Icon n="close"/></button>
   {play&&dc.embed?<iframe className={'dframe'+(dc.platform==='youtube'?' wide':'')} src={dc.embed} allow="autoplay; encrypted-media; fullscreen" allowFullScreen title={cur.title||'vídeo'}/>:cur.coverDisplay?<img className="dimg" src={cur.coverDisplay} alt=""/>:null}
   <div className="dbody">
    <span className="kind">{KIND[cur.type]}{cur.platform&&cur.platform!=='site'?` · ${PLAT[cur.platform]||cur.platform}`:''}</span>
    {cur.title&&<h2 className="dtitle">{cur.title}</h2>}
    {cur.content&&<pre className="dtext">{cur.content}</pre>}
    {play&&cur.url&&!dc.embed&&<span className="hint">Esta plataforma não permite player dentro do app. Use “Abrir original”.</span>}
    {cur.tags?.length>0&&<div className="tags">{cur.tags.map(t=><span className="tag" key={t}>{t}</span>)}</div>}
    <div className="dacts">
     {dc.embed&&<button className="btn btn--primary" onClick={()=>setPlay(!play)}><Icon n={play?'close':'play'} size={16}/>{play?'Fechar vídeo':'Assistir aqui'}</button>}
     {actions(cur).map(a=>a.href?<a key={a.k} className="btn btn--ghost" href={a.href} target="_blank" rel="noreferrer"><Icon n={a.icon} size={16}/>{a.label}</a>:<button key={a.k} className={'btn btn--ghost'+(a.danger?' danger':'')} onClick={a.run}><Icon n={a.icon} size={16}/>{a.label}</button>)}
    </div>
   </div>
  </Sheet>}

  {picker&&<Sheet onClose={()=>setPicker(null)} label={picker.mode==='move'?'Mover item':'Copiar item'}>
   <div className="sheet-head"><strong>{picker.mode==='move'?'Mover para…':'Copiar para…'}</strong><button type="button" className="icon-btn" aria-label="Fechar" onClick={()=>setPicker(null)}><Icon n="close"/></button></div>
   {optsFor(picker.item,picker.mode).map(o=><button key={o.id||'none'} className="mi" onClick={()=>pickDest(o.id)}><Icon n={o.id?'folder':'inbox'}/>{o.name}</button>)}
  </Sheet>}

  {(canEdit||editId)&&adding&&<Sheet onClose={closeForm} label={editId?'Editar item':'Novo item'}>
   <form className="fgrid" onSubmit={save}>
    <div className="sheet-head"><strong>{editId?'Editar item':'Novo item'}</strong><button type="button" className="icon-btn" aria-label="Fechar" onClick={closeForm}><Icon n="close"/></button></div>
    <div className="frow">
     <select className="input" aria-label="Tipo" value={f.type} onChange={set('type')}>{Object.entries(KIND).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
     {f.type==='link'?<input className="input" required type="url" inputMode="url" placeholder="Cole o link (YouTube, TikTok, Instagram, Kwai…)" value={f.url} onChange={set('url')}/>:<input className="input" placeholder="Título" value={f.title} onChange={set('title')}/>}
    </div>
    {f.type==='link'&&<input className="input" placeholder="Título (opcional)" value={f.title} onChange={set('title')}/>}
    {f.type==='link'&&f.url&&<p className="preview-status" aria-live="polite">{previewState==='loading'?'Buscando título e imagem…':previewState==='ready'?'Prévia encontrada. Você pode ajustar o título antes de salvar.':previewState==='unavailable'?'Não foi possível obter a prévia deste link; você ainda pode salvá-lo.':''}</p>}
    <div className="cover-picker">
     <label className="btn btn--ghost cover-choice">Escolher foto de capa<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>5*1024*1024){alert('A imagem deve ter até 5 MB.');e.target.value='';return}setCoverFile(file);setRemoveCover(false)}}/></label>
     <span className="hint">JPG, PNG ou WebP · até 5 MB</span>
     {(coverPreview||(storedCoverPath(f.thumb)?items.find(i=>i.id===editId)?.coverDisplay:f.thumb))&&<div className="cover-preview"><img src={coverPreview||(storedCoverPath(f.thumb)?items.find(i=>i.id===editId)?.coverDisplay:f.thumb)} alt="Prévia da capa"/><button type="button" className="btn btn--ghost btn--sm danger" onClick={()=>{setCoverFile(null);setF(current=>({...current,thumb:''}));setRemoveCover(true)}}>Remover capa</button></div>}
    </div>
    <textarea className="input" required={f.type!=='link'} rows={f.type==='link'?2:5} placeholder={f.type==='link'?'Anotação sobre este link (opcional)':f.type==='prompt'?'Escreva o prompt':'Escreva aqui'} value={f.content} onChange={set('content')}/>
    <input className="input" placeholder="Tags separadas por vírgula" value={f.tags} onChange={set('tags')}/>
    <button className="btn btn--primary btn--lg" disabled={saving}>{saving?'Salvando…':editId?'Salvar alterações':'Salvar item'}</button>
   </form>
  </Sheet>}
 </>
}
