import {useState} from 'react'
import {supabase} from './supabase'
export default function Auth(){
 const [mode,setMode]=useState('in'),[email,setEmail]=useState(''),[pw,setPw]=useState(''),[msg,setMsg]=useState('')
 const go=async e=>{
  e.preventDefault();setMsg('')
  const {error}=mode==='in'?await supabase.auth.signInWithPassword({email,password:pw}):await supabase.auth.signUp({email,password:pw})
  if(error)setMsg(error.message)
 }
 return <form className="auth" onSubmit={go}>
  <div className="brand">cash<b>In</b>casa</div>
  <p className="empty">Salve links, organize ideias e transforme tudo em plano de ação.</p>
  <div className="row"><input type="email" required placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)}/></div>
  <div className="row"><input type="password" required minLength={6} placeholder="Senha (mínimo 6 caracteres)" value={pw} onChange={e=>setPw(e.target.value)}/></div>
  <div className="row"><button className="pri">{mode==='in'?'Entrar':'Criar conta'}</button></div>
  {msg&&<p style={{color:'#b3261e'}}>{msg}</p>}
  <button type="button" className="link" onClick={()=>setMode(mode==='in'?'up':'in')}>{mode==='in'?'Não tenho conta':'Já tenho conta'}</button>
 </form>
}
