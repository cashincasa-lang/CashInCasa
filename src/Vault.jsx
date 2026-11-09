import {useEffect,useState,useCallback} from 'react'
import {supabase,vault} from './supabase'
import Items from './Items'
import Cadernos from './Cadernos'
import Sheet from './Sheet'
import Icon from './Icon'
export default function Vault({user,tick,onExit}){
 const [stage,setStage]=useState('loading'),[pin,setPin]=useState(''),[pin2,setPin2]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[folders,setFolders]=useState([]),[sel,setSel]=useState(null),[q,setQ]=useState(''),[base,setBase]=useState(tick)
 vault.active=stage==='open'
 useEffect(()=>{
  supabase.rpc('vault_has_pin').then(({data,error})=>{if(error){setMsg(error.message);setStage('error')}else setStage(data?'pin':'setup')})
  const hide=()=>document.hidden&&onExit()
  document.addEventListener('visibilitychange',hide)
  return ()=>{document.removeEventListener('visibilitychange',hide);vault.active=false;vault.token=null;supabase.rpc('vault_lock').then(()=>{})}
 },[])
 const loadF=useCallback(async()=>{
  const {data}=await supabase.rpc('my_secret_folders');const l=data||[]
  setFolders(l);setSel(s=>(s&&l.find(f=>f.id===s.id))||l[0]||null)
 },[])
 useEffect(()=>{if(stage==='open')loadF()},[stage,loadF])
 const pick=f=>{setSel(f);setBase(tick)}
 const submit=async e=>{
  e.preventDefault();setMsg('')
  if(!/^\d{4,8}$/.test(pin))return setMsg('Use de 4 a 8 números.')
  if(stage==='setup'&&pin!==pin2)return setMsg('Os PINs não são iguais.')
  setBusy(true)
  if(stage==='setup'){
   const {error}=await supabase.rpc('vault_set_pin',{p_pin:pin})
   if(error){setBusy(false);return setMsg(error.message)}
  }
  const {data,error}=await supabase.rpc('vault_unlock',{p_pin:pin})
  setBusy(false);setPin('');setPin2('')
  if(error)return setMsg(error.message)
  if(!data.ok)return setMsg(data.msg)
  vault.token=data.token;setStage('open')
 }
 const addF=async()=>{
  const name=prompt('Nome da pasta secreta');if(!name)return
  const {data,error}=await supabase.from('folders').insert({name,is_secret:true}).select().single()
  if(error)return alert(error.message)
  await loadF();pick(data)
 }
 const delF=async()=>{
  if(!sel||!confirm(`Excluir a pasta secreta "${sel.name}" e TODOS os itens dela?`))return
  await supabase.from('folders').delete().eq('id',sel.id);setSel(null);loadF()
 }
 const renameF=async()=>{
  const name=prompt('Novo nome da pasta secreta',sel.name);if(!name||!name.trim()||name.trim()===sel.name)return
  const {error}=await supabase.from('folders').update({name:name.trim()}).eq('id',sel.id)
  if(error)return alert(error.message);loadF()
 }
 const dupF=async()=>{
  const {data:nf,error}=await supabase.from('folders').insert({name:`${sel.name} (cópia)`,is_secret:true}).select().single()
  if(error)return alert(error.message)
  const {data:its}=await supabase.from('items').select('*').eq('folder_id',sel.id)
  if(its?.length){
   const rows=its.map(({id,owner_id,created_at,folder_id,...r})=>({...r,folder_id:nf.id,copied_from:id}))
   const {error:e2}=await supabase.from('items').insert(rows);if(e2)alert(e2.message)
  }
  await loadF();pick(nf)
 }
 const chg=async()=>{
  const p=prompt('Novo PIN (4 a 8 números)');if(!p)return
  const {error}=await supabase.rpc('vault_change_pin',{p_new:p});alert(error?error.message:'PIN alterado.')
 }
 if(stage==='loading')return null
 if(stage==='error')return <Sheet onClose={onExit} label="Cofre"><div className="sheet-head"><strong>Cofre indisponível</strong><button type="button" className="icon-btn" aria-label="Fechar" onClick={onExit}><Icon n="close"/></button></div><p className="auth-err">{msg}</p><p className="hint">Rode o schema_cofre.sql no Supabase e tente de novo.</p></Sheet>
 if(stage!=='open'){
  const setup=stage==='setup',num=set=>e=>set(e.target.value.replace(/\D/g,''))
  return <Sheet onClose={onExit} label="Cofre">
   <form className="fgrid" onSubmit={submit}>
    <div className="sheet-head"><strong>{setup?'Criar PIN do cofre':'Cofre'}</strong><button type="button" className="icon-btn" aria-label="Fechar" onClick={onExit}><Icon n="close"/></button></div>
    <p className="hint">{setup?'Escolha de 4 a 8 números. Você vai precisar dele toda vez.':'Digite seu PIN.'}</p>
    <input className="input pin-input" type="password" inputMode="numeric" autoComplete="off" maxLength={8} autoFocus placeholder="PIN" aria-label="PIN" value={pin} onChange={num(setPin)}/>
    {setup&&<input className="input pin-input" type="password" inputMode="numeric" autoComplete="off" maxLength={8} placeholder="Repita o PIN" aria-label="Repita o PIN" value={pin2} onChange={num(setPin2)}/>}
    {msg&&<p className="auth-err">{msg}</p>}
    <button className="btn btn--primary btn--lg" disabled={busy}>{setup?'Criar PIN':'Abrir'}</button>
   </form>
  </Sheet>
 }
 return <>
  <header className="top glass"><div className="wrap">
   <label className="searchbar"><Icon n="search" size={20}/><input type="search" aria-label="Buscar" placeholder="Buscar no cofre" value={q} onChange={e=>setQ(e.target.value)}/></label>
   <div className="tabs" role="tablist" aria-label="Pastas secretas">
    {folders.map(f=><button role="tab" key={f.id} aria-current={sel?.id===f.id?'page':undefined} onClick={()=>pick(f)}>{f.name}</button>)}
    <button className="tabs-add" onClick={addF}><Icon n="plus" size={16}/>Pasta secreta</button>
   </div>
  </div></header>
  <div className="page">
   <h1 className="sr">Cofre</h1>
   <div className="folderbar">
    <span className="badge badge--success">Cofre aberto</span>
    <button className="btn btn--tonal btn--sm" onClick={onExit}><Icon n="lock" size={16}/>Bloquear</button>
    <button className="btn btn--ghost btn--sm" onClick={chg}>Alterar PIN</button>
    {sel&&<><button className="btn btn--ghost btn--sm" onClick={renameF}><Icon n="edit" size={16}/>Renomear</button><button className="btn btn--ghost btn--sm" onClick={dupF}><Icon n="dup" size={16}/>Duplicar pasta</button></>}
    {sel&&<button className="btn btn--ghost btn--sm danger" onClick={delF}><Icon n="trash" size={16}/>Excluir pasta</button>}
   </div>
   {sel?<Cadernos key={sel.id} folder={sel} role="owner"><Items key={sel.id} user={user} folder={sel} role="owner" q={q} addTick={tick>base?tick-base:0} dests={folders} allowNone={false}/></Cadernos>
    :<div className="emptybox"><span className="ic"><Icon n="lock" size={26}/></span><h2>Seu cofre está vazio</h2><p>Crie uma pasta secreta para guardar links, ideias e prompts que só aparecem com o PIN.</p><button className="btn btn--primary" onClick={addF}><Icon n="plus" size={16}/>Criar pasta secreta</button></div>}
  </div>
 </>
}
