import {useEffect,useState,useCallback} from 'react'
import {supabase} from './supabase'
import Auth from './Auth'
import Items from './Items'
import Plans from './Plans'
import Share from './Share'
export default function App(){
 const [session,setSession]=useState(undefined),[folders,setFolders]=useState([]),[view,setView]=useState('all'),[share,setShare]=useState(false)
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
 const addFolder=async()=>{
  const name=prompt('Nome da pasta');if(!name)return
  const {data,error}=await supabase.from('folders').insert({name}).select().single()
  if(error)return alert(error.message)
  await load();setView(data.id)
 }
 const delFolder=async f=>{
  if(!confirm(`Excluir a pasta "${f.name}"? Os itens ficam sem pasta.`))return
  await supabase.from('folders').delete().eq('id',f.id);setView('all');load()
 }
 const cur=folders.find(f=>f.id===view)
 const cp=v=>view===v?'page':undefined
 const btn=f=><button key={f.id} aria-current={cp(f.id)} onClick={()=>setView(f.id)}><span>{f.name}</span>{f.my_role!=='owner'&&<span className="role">{f.my_role==='editor'?'editor':'leitor'}</span>}</button>
 const go=v=>e=>{e.preventDefault();setView(v)}
 return <div className="screen">
  <header className="topbar">
   <div className="brand">cash<b>In</b>casa</div>
   <nav className="navpill" aria-label="Principal">
    <a href="#" aria-current={view!=='plans'?'page':undefined} onClick={go('all')}>Itens</a>
    <a href="#" aria-current={view==='plans'?'page':undefined} onClick={go('plans')}>Planos de ação</a>
   </nav>
   <div className="tools"><span className="t-caption user-email">{user.email}</span><span className="avatar">{user.email[0].toUpperCase()}</span><button className="btn btn--ghost btn--sm" onClick={()=>supabase.auth.signOut()}>Sair</button></div>
  </header>
  <div className="board">
   <nav className="card side" aria-label="Pastas">
    <button aria-current={cp('all')} onClick={()=>setView('all')}>Todos os meus itens</button>
    <h4>Minhas pastas</h4>{folders.filter(f=>f.my_role==='owner').map(btn)}
    <button className="add" onClick={addFolder}>+ Nova pasta</button>
    {folders.some(f=>f.my_role!=='owner')&&<><h4>Compartilhadas comigo</h4>{folders.filter(f=>f.my_role!=='owner').map(btn)}</>}
   </nav>
   <main>
    {view==='plans'?<Plans user={user}/>:<>
     <div className="head"><h1 className="page-title">{cur?cur.name:'Todos os meus itens'}</h1>
      {cur&&cur.my_role==='owner'&&<div className="row" style={{margin:0}}><button className="btn btn--accent btn--sm" onClick={()=>setShare(true)}>Compartilhar</button><button className="btn btn--ghost btn--sm danger" onClick={()=>delFolder(cur)}>Excluir pasta</button></div>}
      {cur&&cur.my_role!=='owner'&&<span className="badge badge--info">De {cur.owner_email}</span>}
     </div>
     <Items key={view} user={user} folder={cur||null} role={cur?.my_role}/>
     {share&&cur&&<Share folder={cur} onClose={()=>setShare(false)}/>}
    </>}
   </main>
  </div>
 </div>
}
