import {useEffect,useState,useCallback} from 'react'
import {supabase} from './supabase'
export function detect(url){
 let u;try{u=new URL(url)}catch{return {platform:'site'}}
 const h=u.hostname.replace('www.','')
 if(h.includes('youtube.com')||h==='youtu.be'){
  const id=h==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop()
  return {platform:'youtube',embed:`https://www.youtube.com/embed/${id}`,thumb:`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
 }
 if(h.includes('tiktok.com')){const m=u.pathname.match(/video\/(\d+)/);return {platform:'tiktok',embed:m?`https://www.tiktok.com/embed/v2/${m[1]}`:null}}
 if(h.includes('instagram.com'))return {platform:'instagram'}
 if(h.includes('kwai')||h.includes('kw.ai'))return {platform:'kwai'}
 return {platform:'site'}
}
const KIND={link:'Link',note:'Nota',prompt:'Prompt',idea:'Ideia'}
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
export default function Items({user,folder,role}){
 const [items,setItems]=useState([]),[q,setQ]=useState(''),[open,setOpen]=useState(null),[f,setF]=useState(()=>{const p=pending;pending=null;return p?{...empty,...p}:empty})
 const canEdit=!folder||role!=='viewer'
 const load=useCallback(async()=>{
  let qy=supabase.from('items').select('*').order('created_at',{ascending:false})
  qy=folder?qy.eq('folder_id',folder.id):qy.eq('owner_id',user.id)
  const {data}=await qy;setItems(data||[])
 },[folder?.id,user.id])
 useEffect(()=>{load()},[load])
 const set=k=>e=>setF({...f,[k]:e.target.value})
 const preview=async()=>{
  if(f.type!=='link'||!f.url)return
  const d=detect(f.url);let title=f.title,thumb=d.thumb||''
  try{const j=await (await fetch('https://noembed.com/embed?url='+encodeURIComponent(f.url))).json();title=title||j.title||'';thumb=thumb||j.thumbnail_url||''}catch{}
  setF(x=>({...x,title,thumb,platform:d.platform}))
 }
 useEffect(()=>{if(f.url)preview()},[])
 const save=async e=>{
  e.preventDefault()
  const d=f.type==='link'?detect(f.url):{}
  const row={type:f.type,title:f.title||null,url:f.url||null,content:f.content||null,platform:f.platform||d.platform||null,
   thumbnail:f.thumb||d.thumb||null,tags:f.tags.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean),folder_id:folder?.id||null}
  const {error}=await supabase.from('items').insert(row)
  if(error)return alert(error.message)
  setF({...f,url:'',title:'',content:'',tags:'',thumb:'',platform:''});load()
 }
 const del=async i=>{if(confirm('Excluir este item?')){await supabase.from('items').delete().eq('id',i.id);load()}}
 const keep=async i=>{
  const {id,owner_id,folder_id,created_at,...rest}=i
  const {error}=await supabase.from('items').insert({...rest,copied_from:id,folder_id:null})
  alert(error?error.message:'Salvo na sua biblioteca.')
 }
 const shown=items.filter(i=>[i.title,i.content,i.url,...i.tags].join(' ').toLowerCase().includes(q.toLowerCase()))
 return <>
  {canEdit&&<form className="box" onSubmit={save}>
   <div className="row">
    <select value={f.type} onChange={set('type')} style={{maxWidth:160}}>{Object.entries(KIND).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
    {f.type==='link'&&<input required placeholder="Cole o link (YouTube, TikTok, Instagram, Kwai ou site)" value={f.url} onChange={set('url')} onBlur={preview} style={{flex:3}}/>}
    <input placeholder="Título" value={f.title} onChange={set('title')} style={{flex:2}}/>
   </div>
   {f.type!=='link'&&<div className="row"><textarea required rows={4} placeholder={f.type==='prompt'?'Escreva o prompt':'Escreva aqui'} value={f.content} onChange={set('content')}/></div>}
   {f.type==='link'&&<div className="row"><textarea rows={2} placeholder="Anotação sobre este link (opcional)" value={f.content} onChange={set('content')}/></div>}
   <div className="row"><input placeholder="Tags separadas por vírgula" value={f.tags} onChange={set('tags')}/><button className="pri" style={{flex:'0 0 auto'}}>Salvar</button></div>
  </form>}
  <div className="row"><input placeholder="Buscar por título, texto ou tag" value={q} onChange={e=>setQ(e.target.value)}/></div>
  {shown.length===0&&<p className="empty">{items.length?'Nada encontrado para essa busca.':'Nenhum item ainda. Cole um link ou escreva uma nota acima.'}</p>}
  <div className="grid">{shown.map(i=>{
   const d=i.url?detect(i.url):{},mine=i.owner_id===user.id
   return <div className="card" key={i.id}>
    {open===i.id&&d.embed?<iframe src={d.embed} allow="autoplay; encrypted-media; fullscreen" allowFullScreen title={i.title||'vídeo'}/>:i.thumbnail&&<img src={i.thumbnail} alt="" loading="lazy"/>}
    <div className="in">
     <span className="kind">{KIND[i.type]}{i.platform?` · ${i.platform}`:''}</span>
     {i.title&&<h3 style={{fontSize:'1.05rem'}}>{i.title}</h3>}
     {i.content&&<pre>{i.content}</pre>}
     {open===i.id&&i.url&&!d.embed&&<span className="kind">Esta plataforma não permite player dentro do app. Use “Abrir original”.</span>}
     <div>{i.tags.map(t=><span className="tag" key={t}>{t}</span>)}</div>
     <div className="acts">
      {d.embed&&<button onClick={()=>setOpen(open===i.id?null:i.id)}>{open===i.id?'Fechar vídeo':'Assistir aqui'}</button>}
      {i.url&&<a href={i.url} target="_blank" rel="noreferrer"><button>Abrir original</button></a>}
      {(i.type==='prompt'||i.type==='note'||i.type==='idea')&&<button onClick={()=>navigator.clipboard.writeText(i.content||'')}>Copiar</button>}
      {!mine&&<button onClick={()=>keep(i)}>Salvar na minha biblioteca</button>}
      {(mine||role==='owner')&&<button className="danger" onClick={()=>del(i)}>Excluir</button>}
     </div>
    </div>
   </div>})}</div>
 </>
}
