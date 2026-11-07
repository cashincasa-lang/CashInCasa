import {useEffect,useState,useCallback} from 'react'
import {supabase} from './supabase'
import Icon from './Icon'
import Sheet from './Sheet'
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
 return <Sheet onClose={onClose} label="Compartilhar pasta">
  <div className="sheet-head"><strong>Compartilhar “{folder.name}”</strong><button className="icon-btn" aria-label="Fechar" onClick={onClose}><Icon n="close"/></button></div>
  <form className="share-form" onSubmit={add}>
   <input className="input" type="email" required placeholder="E-mail da pessoa" value={email} onChange={e=>setEmail(e.target.value)}/>
   <select className="input" aria-label="Permissão" value={role} onChange={e=>setRole(e.target.value)}><option value="viewer">Leitor</option><option value="editor">Editor</option></select>
   <button className="btn btn--primary">Convidar</button>
  </form>
  {list.length===0&&<p className="empty">Esta pasta ainda é só sua.</p>}
  {list.map(s=><div className="person" key={s.user_id}><span className="t">{s.email} <small className="kind">{s.role==='editor'?'editor':'leitor'}</small></span><button className="btn btn--ghost btn--sm danger" onClick={()=>remove(s.user_id)}>Remover</button></div>)}
 </Sheet>
}
