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
 const btn=f=><button key={f.id} className={view===f.id?'on':''} onClick={()=>setView(f.id)}>{f.name}{f.my_role!=='owner'&&<small> · {f.my_role==='editor'?'editor':'leitor'}</small>}</button>
 return <div className="app">
  <aside>
   <div className="brand">cash<b>In</b>casa</div>
   <button className={view==='all'?'on':''} onClick={()=>setView('all')}>Todos os meus itens</button>
   <button className={view==='plans'?'on':''} onClick={()=>setView('plans')}>Planos de ação</button>
   <h4>Minhas pastas</h4>{folders.filter(f=>f.my_role==='owner').map(btn)}
   <button onClick={addFolder}>+ Nova pasta</button>
   {folders.some(f=>f.my_role!=='owner')&&<><h4>Compartilhadas comigo</h4>{folders.filter(f=>f.my_role!=='owner').map(btn)}</>}
   <div className="user">{user.email}<br/><button onClick={()=>supabase.auth.signOut()}>Sair</button></div>
  </aside>
  <main>
   {view==='plans'?<Plans user={user}/>:<>
    <div className="head"><h1>{cur?cur.name:'Todos os meus itens'}</h1>
     {cur&&cur.my_role==='owner'&&<div><button onClick={()=>setShare(true)}>Compartilhar</button> <button className="danger" onClick={()=>delFolder(cur)}>Excluir pasta</button></div>}
     {cur&&cur.my_role!=='owner'&&<span className="kind">De {cur.owner_email}</span>}
    </div>
    <Items key={view} user={user} folder={cur||null} role={cur?.my_role}/>
    {share&&cur&&<Share folder={cur} onClose={()=>setShare(false)}/>}
   </>}
  </main>
 </div>
}
