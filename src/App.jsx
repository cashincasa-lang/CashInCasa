import {useEffect,useState,useCallback} from 'react'
import {supabase} from './supabase'
import Auth from './Auth'
import Items from './Items'
import Plans from './Plans'
import Share from './Share'
export default function App(){
 const [session,setSession]=useState(undefined),[folders,setFolders]=useState([]),[view,setView]=useState('all'),[share,setShare]=useState(false),[menu,setMenu]=useState(false)
 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>setSession(data.session))
  const {data:l}=supabase.auth.onAuthStateChange((_,s)=>setSession(s))
  return ()=>l.subscription.unsubscribe()
 },[])
 const load=useCallback(async()=>{const {data}=await supabase.rpc('my_folders');setFolders(data||[])},[])
 useEffect(()=>{session&&load()},[session,load])
 if(session===undefined)return null
 if(!session)return <Auth/>
 const user=session.user
 const nav=v=>{setView(v);setMenu(false)}
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
 const cur=folders.find(f=>f.id===view)
 const cp=v=>view===v?'page':undefined
 const title=view==='plans'?'Planos de ação':cur?cur.name:'Todos os itens'
 const chips=<div className="chips"><button aria-current={cp('all')} onClick={()=>nav('all')}>Todos</button>{folders.map(f=><button key={f.id} aria-current={cp(f.id)} onClick={()=>nav(f.id)}>{f.my_role!=='owner'?'👥 ':''}{f.name}</button>)}<button onClick={addFolder}>+ Pasta</button></div>
 const fbtn=f=><button key={f.id} className="nav-i" aria-current={cp(f.id)} onClick={()=>nav(f.id)}><span aria-hidden="true">{f.my_role==='owner'?'📁':'👥'}</span><span className="lbl">{f.name}</span>{f.my_role!=='owner'&&<span className="role">{f.my_role==='editor'?'editor':'leitor'}</span>}</button>
 return <div className="shell">
  <header className="mbar"><strong className="mtitle">{title}</strong></header>
  {menu&&<div className="scrim" onClick={()=>setMenu(false)}/>}
  <aside className={'sidebar'+(menu?' open':'')} aria-label="Menu">
   <div className="ws"><div className="brand">cash<b>In</b>casa</div></div>
   <button className="nav-i" aria-current={cp('all')} onClick={()=>nav('all')}><span aria-hidden="true">📥</span><span className="lbl">Todos os itens</span></button>
   <button className="nav-i" aria-current={cp('plans')} onClick={()=>nav('plans')}><span aria-hidden="true">🎯</span><span className="lbl">Planos de ação</span></button>
   <div className="sec"><span>Pastas</span><button aria-label="Nova pasta" title="Nova pasta" onClick={addFolder}>+</button></div>
   {folders.filter(f=>f.my_role==='owner').map(fbtn)}
   {folders.some(f=>f.my_role!=='owner')&&<><div className="sec"><span>Compartilhadas comigo</span></div>{folders.filter(f=>f.my_role!=='owner').map(fbtn)}</>}
   <div className="foot"><span className="avatar">{user.email[0].toUpperCase()}</span><span className="e">{user.email}</span><button className="btn btn--ghost btn--sm" onClick={()=>supabase.auth.signOut()}>Sair</button></div>
  </aside>
  <main className="content"><div className="page">
   {view==='plans'?<Plans user={user}/>:<>
    <div className="head"><h1 className="page-title">{cur?cur.name:'Todos os itens'}</h1>
     {cur&&cur.my_role==='owner'&&<div className="row" style={{margin:0}}><button className="btn btn--primary btn--sm" onClick={()=>setShare(true)}>Compartilhar</button><button className="btn btn--ghost btn--sm danger" onClick={()=>delFolder(cur)}>Excluir pasta</button></div>}
     {cur&&cur.my_role!=='owner'&&<span className="badge badge--info">De {cur.owner_email}</span>}
    </div>
    {chips}<Items key={view} user={user} folder={cur||null} role={cur?.my_role}/>
    {share&&cur&&<Share folder={cur} onClose={()=>setShare(false)}/>}
   </>}
  </div></main>
  <nav className="tabbar" aria-label="Navegação">
   <button aria-current={view!=='plans'&&!menu?'page':undefined} onClick={()=>nav(view==='plans'?'all':view)}><span aria-hidden="true">📥</span><span>Itens</span></button>
   <button aria-current={view==='plans'&&!menu?'page':undefined} onClick={()=>nav('plans')}><span aria-hidden="true">🎯</span><span>Planos</span></button>
   <button aria-current={menu?'page':undefined} onClick={()=>setMenu(true)}><span aria-hidden="true">📁</span><span>Pastas</span></button>
  </nav>
 </div>
}
