import {useEffect,useState,useCallback,useRef} from 'react'
import {supabase} from './supabase'
import Icon from './Icon'
const BUCKET='notebook-files',MAX=50*1024*1024
const MIMES=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','application/pdf','application/zip','application/x-zip-compressed','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','text/csv']
const fmt=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round((n||0)/1024))+' KB'

// campo de texto que cresce sozinho e salva ao parar de digitar ou ao sair do campo
function Txt({value,onSave,className,placeholder,readOnly,autoFocus}){
 const [v,setV]=useState(value),ref=useRef(null),t=useRef(null)
 useEffect(()=>{const el=ref.current;if(el){el.style.height='auto';el.style.height=el.scrollHeight+'px'}},[v])
 const change=e=>{const x=e.target.value;setV(x);clearTimeout(t.current);t.current=setTimeout(()=>onSave(x),700)}
 const blur=()=>{clearTimeout(t.current);if(v!==value)onSave(v)}
 return <textarea ref={ref} rows={1} className={className} value={v} placeholder={placeholder} readOnly={readOnly} autoFocus={autoFocus} onChange={change} onBlur={blur}/>
}

function Notebook({nb,canEdit,onBack,onGone}){
 const [title,setTitle]=useState(nb.title),[blocks,setBlocks]=useState([]),[urls,setUrls]=useState({}),[busy,setBusy]=useState(false),[fresh,setFresh]=useState(null)
 const saved=useRef(nb.title),pos=useRef(0),media=useRef(null),docs=useRef(null)
 const sign=useCallback(async list=>{
  const paths=list.filter(b=>b.file_path).map(b=>b.file_path);if(!paths.length)return
  const {data}=await supabase.storage.from(BUCKET).createSignedUrls(paths,3600)
  setUrls(u=>({...u,...Object.fromEntries((data||[]).filter(x=>x.signedUrl).map(x=>[x.path,x.signedUrl]))}))
 },[])
 const load=useCallback(async()=>{
  const {data}=await supabase.from('notebook_blocks').select('*').eq('notebook_id',nb.id).order('position').order('created_at')
  const l=data||[];setBlocks(l);pos.current=l.length?Math.max(...l.map(b=>b.position))+1:0;sign(l)
 },[nb.id,sign])
 useEffect(()=>{load()},[load])
 const saveTitle=async()=>{
  const t=title.trim()||'Sem título';setTitle(t);if(t===saved.current)return;saved.current=t
  const {error}=await supabase.from('notebooks').update({title:t,updated_at:new Date().toISOString()}).eq('id',nb.id);if(error)alert(error.message)
 }
 const addBlock=async b=>{
  const {data,error}=await supabase.from('notebook_blocks').insert({notebook_id:nb.id,position:pos.current++,...b}).select().single()
  if(error){alert(error.message);return null}
  setBlocks(l=>[...l,data]);if(['text','h','todo'].includes(b.type))setFresh(data.id);return data
 }
 const patch=async(id,p)=>{
  setBlocks(l=>l.map(b=>b.id===id?{...b,...p}:b))
  const {error}=await supabase.from('notebook_blocks').update(p).eq('id',id);if(error)alert(error.message)
 }
 const del=async b=>{
  if(b.file_path&&!confirm(`Excluir "${b.file_name||'arquivo'}"?`))return
  const {error}=await supabase.from('notebook_blocks').delete().eq('id',b.id);if(error)return alert(error.message)
  if(b.file_path)supabase.storage.from(BUCKET).remove([b.file_path]).then(()=>{})
  setBlocks(l=>l.filter(x=>x.id!==b.id))
 }
 const move=async(i,d)=>{
  const j=i+d;if(j<0||j>=blocks.length)return
  const a=blocks[i],c=blocks[j]
  setBlocks(l=>{const n=[...l];n[i]={...c,position:a.position};n[j]={...a,position:c.position};return n})
  await Promise.all([supabase.from('notebook_blocks').update({position:c.position}).eq('id',a.id),supabase.from('notebook_blocks').update({position:a.position}).eq('id',c.id)])
 }
 const upload=async files=>{
  setBusy(true)
  for(const f of files){
   if(f.size>MAX){alert(`"${f.name}" passa de 50 MB.`);continue}
   if(!MIMES.includes(f.type)){alert(`Tipo de arquivo não permitido: ${f.name}`);continue}
   const ext=(f.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'bin'
   const path=`${nb.id}/${crypto.randomUUID()}.${ext}`
   const {error}=await supabase.storage.from(BUCKET).upload(path,f,{contentType:f.type})
   if(error){alert(error.message);continue}
   const type=f.type.startsWith('image/')?'image':f.type.startsWith('video/')?'video':'file'
   const b=await addBlock({type,file_path:path,file_name:f.name,mime:f.type,size:f.size})
   if(b)sign([b]);else supabase.storage.from(BUCKET).remove([path]).then(()=>{})
  }
  setBusy(false)
 }
 const delNb=async()=>{
  if(!confirm(`Excluir o caderno "${title}" e tudo dentro dele?`))return
  const paths=blocks.filter(b=>b.file_path).map(b=>b.file_path)
  const {error}=await supabase.from('notebooks').delete().eq('id',nb.id);if(error)return alert(error.message)
  if(paths.length)supabase.storage.from(BUCKET).remove(paths).then(()=>{})
  onGone()
 }
 const render=b=>{
  const ro=!canEdit,url=urls[b.file_path],tx=(cls,ph)=><Txt className={cls} value={b.text||''} placeholder={ph} readOnly={ro} autoFocus={fresh===b.id} onSave={x=>patch(b.id,{text:x})}/>
  if(b.type==='h')return tx('nb-h','Título')
  if(b.type==='text')return tx('nb-p','Escreva algo…')
  if(b.type==='todo')return <div className="nb-todo"><input type="checkbox" aria-label="Concluído" checked={!!b.checked} disabled={ro} onChange={e=>patch(b.id,{checked:e.target.checked})}/>{tx('nb-t'+(b.checked?' done':''),'Tarefa')}</div>
  if(b.type==='image')return url?<a href={url} target="_blank" rel="noreferrer"><img className="nb-img" src={url} alt={b.file_name||''} loading="lazy"/></a>:<div className="nb-skel"/>
  if(b.type==='video')return url?<video className="nb-video" src={url} controls playsInline preload="metadata"/>:<div className="nb-skel"/>
  return <a className="nb-file" href={url||'#'} target="_blank" rel="noreferrer"><Icon n="file"/><span><b>{b.file_name}</b><small>{fmt(b.size)}</small></span><Icon n="out" size={18}/></a>
 }
 return <div className="nbook">
  <div className="nb-top">
   <button className="btn btn--ghost btn--sm" onClick={onBack}>‹ Cadernos</button>
   <input className="nb-title" value={title} readOnly={!canEdit} aria-label="Título do caderno" onChange={e=>setTitle(e.target.value)} onBlur={saveTitle}/>
   {canEdit&&<button className="icon-btn danger" aria-label="Excluir caderno" onClick={delNb}><Icon n="trash"/></button>}
  </div>
  {blocks.length===0&&<p className="hint">{canEdit?'Caderno vazio. Adicione texto, fotos, vídeos ou arquivos abaixo.':'Este caderno está vazio.'}</p>}
  {blocks.map((b,i)=><div className="nb-row" key={b.id}>
   <div className="nb-body">{render(b)}</div>
   {canEdit&&<div className="nb-ctl">
    <button className="icon-btn" aria-label="Subir" disabled={i===0} onClick={()=>move(i,-1)}><Icon n="up" size={18}/></button>
    <button className="icon-btn" aria-label="Descer" disabled={i===blocks.length-1} onClick={()=>move(i,1)}><Icon n="down" size={18}/></button>
    <button className="icon-btn danger" aria-label="Excluir bloco" onClick={()=>del(b)}><Icon n="trash" size={18}/></button>
   </div>}
  </div>)}
  {canEdit&&<div className="nb-add">
   <button className="btn btn--ghost btn--sm" onClick={()=>addBlock({type:'text',text:''})}><Icon n="note" size={16}/>Texto</button>
   <button className="btn btn--ghost btn--sm" onClick={()=>addBlock({type:'h',text:''})}>Título</button>
   <button className="btn btn--ghost btn--sm" onClick={()=>addBlock({type:'todo',text:''})}><Icon n="check" size={16}/>Checklist</button>
   <button className="btn btn--tonal btn--sm" disabled={busy} onClick={()=>media.current.click()}><Icon n="image" size={16}/>Foto ou vídeo</button>
   <button className="btn btn--tonal btn--sm" disabled={busy} onClick={()=>docs.current.click()}><Icon n="file" size={16}/>Arquivo</button>
   <input ref={media} type="file" hidden multiple accept="image/*,video/*" onChange={e=>{upload([...e.target.files]);e.target.value=''}}/>
   <input ref={docs} type="file" hidden multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onChange={e=>{upload([...e.target.files]);e.target.value=''}}/>
  </div>}
  {busy&&<p className="hint">Enviando…</p>}
 </div>
}

// faixa de cadernos da pasta; ao abrir um, ele ocupa o lugar do conteúdo (children)
export default function Cadernos({folder,role,children}){
 const [list,setList]=useState([]),[open,setOpen]=useState(null),canEdit=role!=='viewer'
 const load=useCallback(async()=>{
  const {data}=await supabase.from('notebooks').select('id,title').eq('folder_id',folder.id).order('created_at',{ascending:false});setList(data||[])
 },[folder.id])
 useEffect(()=>{load()},[load])
 const add=async()=>{
  const title=prompt('Nome do caderno','Novo caderno');if(title===null)return
  const {data,error}=await supabase.from('notebooks').insert({folder_id:folder.id,title:title.trim()||'Sem título'}).select('id,title').single()
  if(error)return alert(error.message)
  setList(l=>[data,...l]);setOpen(data.id)
 }
 const cur=list.find(n=>n.id===open)
 if(cur)return <Notebook key={cur.id} nb={cur} canEdit={canEdit} onBack={()=>{setOpen(null);load()}} onGone={()=>{setOpen(null);load()}}/>
 return <>
  {(list.length>0||canEdit)&&<section className="nbstrip" aria-label="Cadernos">
   {list.map(n=><button key={n.id} className="nbcard" onClick={()=>setOpen(n.id)}><Icon n="note" size={18}/><span>{n.title}</span></button>)}
   {canEdit&&<button className="nbcard nbcard--add" onClick={add}><Icon n="plus" size={18}/><span>Novo caderno</span></button>}
  </section>}
  {children}
 </>
}
