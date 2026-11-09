import {useEffect,useState,useCallback,useRef} from 'react'
import {supabase} from './supabase'
import Auth from './Auth'
import Items from './Items'
import Plans from './Plans'
import Share from './Share'
import Sheet from './Sheet'
import Icon from './Icon'
import Vault from './Vault'
import Cadernos from './Cadernos'
export default function App(){
 const [session,setSession]=useState(undefined),[folders,setFolders]=useState([]),[view,setView]=useState('all'),[share,setShare]=useState(false),[profile,setProfile]=useState(false),[q,setQ]=useState(''),[tick,setTick]=useState(0),[vaultOpen,setVaultOpen]=useState(false)
 const searchRef=useRef(null),taps=useRef([])
 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>setSession(data.session))
  const {data:l}=supabase.auth.onAuthStateChange((_,s)=>setSession(s))
  return ()=>l.subscription.unsubscribe()
 },[])
 const load=useCallback(async()=>{const {data}=await supabase.rpc('my_folders');setFolders(data||[])},[])
 useEffect(()=>{session&&load()},[session,load])
 if(session===undefined)return null
 if(!session)return <Auth/>
 const user=session.user,initial=user.email[0].toUpperCase()
 const nav=v=>{setVaultOpen(false);setView(v);setProfile(false);scrollTo({top:0})}
 const tapSecret=()=>{const t=Date.now();taps.current=[...taps.current.filter(x=>t-x<2000),t];if(taps.current.length>=5){taps.current=[];setProfile(false);setVaultOpen(true)}}
 const addFolder=async()=>{
  const name=prompt('Nome da pasta');if(!name)return
  const {data,error}=await supabase.from('folders').insert({name}).select().single()
  if(error)return alert(error.message)
  await load();nav(data.id)
 }
 const delFolder=async f=>{
  if(!confirm(`Excluir a pasta "${f.name}"? Os itens ficam sem pasta.`))return
  await supabase.from('folders').delete().eq('id',f.id);nav('all');load()
 }
 const renameFolder=async f=>{
  const name=prompt('Novo nome da pasta',f.name);if(!name||!name.trim()||name.trim()===f.name)return
  const {error}=await supabase.from('folders').update({name:name.trim()}).eq('id',f.id)
  if(error)return alert(error.message);load()
 }
 const dupFolder=async f=>{
  const {data:nf,error}=await supabase.from('folders').insert({name:`${f.name} (cópia)`}).select().single()
  if(error)return alert(error.message)
  const {data:its}=await supabase.from('items').select('*').eq('folder_id',f.id)
  if(its?.length){
   const rows=its.map(({id,owner_id,created_at,folder_id,...r})=>({...r,folder_id:nf.id,copied_from:id}))
   const {error:e2}=await supabase.from('items').insert(rows);if(e2)alert(e2.message)
  }
  await load();nav(nf.id)
 }
 const cur=folders.find(f=>f.id===view),plans=view==='plans'
 const cp=v=>view===v?'page':undefined
 const addItem=()=>{if(plans)setView('all');setTick(t=>t+1)}
 const goSearch=()=>{if(plans)setView('all');scrollTo({top:0,behavior:'smooth'});setTimeout(()=>(searchRef.current||document.querySelector('.searchbar input'))?.focus(),80)}
 const navItems=[
  {id:'home',icon:'home',label:'Início',on:()=>nav(plans?'all':view),cur:!plans},
  {id:'search',icon:'search',label:'Buscar',on:goSearch},
  {id:'add',icon:'plus',label:'Novo',on:addItem,add:true},
  {id:'plans',icon:'target',label:'Planos',on:()=>nav('plans'),cur:plans}
 ]
 const btns=navItems.map(it=><button key={it.id} className={'nb'+(it.add?' nb--add':'')} aria-current={it.cur?'page':undefined} onClick={it.on}><span className="ind"><Icon n={it.icon} size={it.add?24:22}/></span><span className="nl">{it.label}</span></button>)
 const me=<button className="nb" aria-label="Minha conta" onClick={()=>setProfile(true)}><span className="ind"><span className="avatar avatar--sm">{initial}</span></span><span className="nl">Conta</span></button>
 return <div className="app">
  <nav className="rail" aria-label="Navegação"><div className="mark" aria-hidden="true" onClick={tapSecret}>In</div>{btns}<span className="spacer"/>{me}</nav>
  {!plans&&!vaultOpen&&<header className="top glass"><div className="wrap">
   <label className="searchbar"><Icon n="search" size={20}/><input ref={searchRef} type="search" aria-label="Buscar" placeholder="Buscar links, ideias e prompts" value={q} onChange={e=>setQ(e.target.value)}/></label>
   <div className="tabs" role="tablist" aria-label="Pastas">
    <button role="tab" aria-current={cp('all')} onClick={()=>nav('all')}>Todos</button>
    {folders.map(f=><button role="tab" key={f.id} aria-current={cp(f.id)} onClick={()=>nav(f.id)}>{f.name}</button>)}
    <button className="tabs-add" onClick={addFolder}><Icon n="plus" size={16}/>Pasta</button>
   </div>
  </div></header>}
  <main className="content">
   {vaultOpen?<Vault user={user} tick={tick} onExit={()=>setVaultOpen(false)}/>:plans?<div className="narrow"><Plans user={user}/></div>:<div className="page">
    <h1 className="sr">{cur?cur.name:'Todos os itens'}</h1>
    {cur&&<div className="folderbar">
     {cur.my_role==='owner'?<><button className="btn btn--tonal btn--sm" onClick={()=>setShare(true)}><Icon n="share" size={16}/>Compartilhar</button><button className="btn btn--ghost btn--sm" onClick={()=>renameFolder(cur)}><Icon n="edit" size={16}/>Renomear</button><button className="btn btn--ghost btn--sm" onClick={()=>dupFolder(cur)}><Icon n="dup" size={16}/>Duplicar pasta</button><button className="btn btn--ghost btn--sm danger" onClick={()=>delFolder(cur)}><Icon n="trash" size={16}/>Excluir pasta</button></>:<span className="badge badge--info">Compartilhada por {cur.owner_email} · {cur.my_role==='editor'?'editor':'leitor'}</span>}
    </div>}
    {(()=>{const it=<Items key={view} user={user} folder={cur||null} role={cur?.my_role} q={q} addTick={tick} dests={folders.filter(f=>f.my_role==='owner'||f.my_role==='editor')}/>;return cur?<Cadernos key={view} folder={cur} role={cur.my_role}>{it}</Cadernos>:it})()}
    {share&&cur&&<Share folder={cur} onClose={()=>setShare(false)}/>}
   </div>}
  </main>
  <nav className="bottombar glass" aria-label="Navegação">{btns}{me}</nav>
  {profile&&<Sheet onClose={()=>setProfile(false)} label="Minha conta">
   <div className="prof"><span className="avatar avatar--lg" onClick={tapSecret}>{initial}</span><div><strong>Minha conta</strong><span className="kind">{user.email}</span></div></div>
   <button className="mi" onClick={()=>{setProfile(false);addFolder()}}><Icon n="folder"/>Nova pasta</button>
   <button className="mi" onClick={()=>supabase.auth.signOut()}><Icon n="logout"/>Sair</button>
  </Sheet>}
 </div>
}
