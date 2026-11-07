import {useState} from 'react'
import {supabase} from './supabase'
import Icon from './Icon'
export default function Auth(){
 const [mode,setMode]=useState('in'),[email,setEmail]=useState(''),[pw,setPw]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false)
 const go=async e=>{
  e.preventDefault();setMsg('');setBusy(true)
  const {error}=mode==='in'?await supabase.auth.signInWithPassword({email,password:pw}):await supabase.auth.signUp({email,password:pw})
  setBusy(false);if(error)setMsg(error.message)
 }
 return <div className="auth-wrap">
  <section className="auth-hero">
   <div className="brand">cash<b>In</b>casa</div>
   <div><h1>Transforme o que você salva em dinheiro.</h1><p>Guarde vídeos, ideias e prompts num só lugar. Organize em pastas e acompanhe cada tarefa até virar resultado.</p></div>
   <ul><li><Icon n="link" size={18}/>Links de YouTube, TikTok, Instagram e Kwai</li><li><Icon n="folder" size={18}/>Pastas que você pode compartilhar</li><li><Icon n="target" size={18}/>Planos de ação com prazo</li></ul>
  </section>
  <form className="auth-form" onSubmit={go}>
   <h2>{mode==='in'?'Entrar na sua conta':'Criar sua conta'}</h2>
   <label>E-mail<input className="input" type="email" required autoComplete="email" placeholder="voce@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Senha<input className="input" type="password" required minLength={6} autoComplete={mode==='in'?'current-password':'new-password'} placeholder="Mínimo de 6 caracteres" value={pw} onChange={e=>setPw(e.target.value)}/></label>
   {msg&&<p className="auth-err" role="alert">{msg}</p>}
   <button className="btn btn--primary" disabled={busy}>{busy?'Aguarde…':mode==='in'?'Entrar':'Criar conta'}</button>
   <p className="auth-switch">{mode==='in'?'Ainda não tem conta?':'Já tem conta?'} <button type="button" className="link" onClick={()=>{setMode(mode==='in'?'up':'in');setMsg('')}}>{mode==='in'?'Criar conta':'Entrar'}</button></p>
  </form>
 </div>
}
