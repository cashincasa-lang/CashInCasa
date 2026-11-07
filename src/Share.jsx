import {useEffect,useState,useCallback} from 'react'
import {supabase} from './supabase'
export default function Share({folder,onClose}){
 const [list,setList]=useState([]),[email,setEmail]=useState(''),[role,setRole]=useState('viewer')
 const load=useCallback(async()=>{const {data}=await supabase.rpc('list_folder_shares',{p_folder_id:folder.id});setList(data||[])},[folder.id])
 useEffect(()=>{load()},[load])
 const add=async e=>{
  e.preventDefault()
  const {error}=await supabase.rpc('share_folder',{p_folder_id:folder.id,p_email:email,p_role:role})
  if(error)return alert(error.message)
  setEmail('');load()
 }
 const remove=async u=>{await supabase.from('folder_shares').delete().eq('folder_id',folder.id).eq('user_id',u);load()}
 return <div className="modal" onClick={onClose}><div className="card" onClick={e=>e.stopPropagation()}>
  <h3 className="t-title">Compartilhar "{folder.name}"</h3>
  <form className="row" onSubmit={add} style={{marginTop:'1rem'}}>
   <input className="input" type="email" required placeholder="E-mail do usuário" value={email} onChange={e=>setEmail(e.target.value)}/>
   <select className="input" value={role} onChange={e=>setRole(e.target.value)}><option value="viewer">Leitor</option><option value="editor">Editor</option></select>
   <button className="btn btn--primary btn--sm">Compartilhar</button>
  </form>
  {list.length===0&&<p className="empty">Esta pasta ainda é só sua.</p>}
  {list.map(s=><div className="task" key={s.user_id}><span className="t">{s.email} <small className="kind">{s.role==='editor'?'editor':'leitor'}</small></span><button className="btn btn--ghost btn--sm danger" onClick={()=>remove(s.user_id)}>Remover acesso</button></div>)}
  <div className="row" style={{marginTop:'1rem'}}><button className="btn btn--ghost btn--sm" onClick={onClose}>Fechar</button></div>
 </div></div>
}
