import {useEffect,useState} from 'react'
import {supabase} from './supabase'
const NEXT={todo:'doing',doing:'done',done:'todo'},LABEL={todo:'A fazer',doing:'Fazendo',done:'Feito'}
export default function Plans({user}){
 const [plans,setPlans]=useState([]),[cur,setCur]=useState(null),[tasks,setTasks]=useState([]),[links,setLinks]=useState([]),[t,setT]=useState(''),[due,setDue]=useState('')
 const loadP=async()=>{const {data}=await supabase.from('action_plans').select('*').order('created_at',{ascending:false});setPlans(data||[])}
 const loadT=async id=>{const {data}=await supabase.from('tasks').select('*,task_items(item_id,items(title,url))').eq('plan_id',id).order('position').order('created_at');setTasks(data||[])}
 useEffect(()=>{loadP();supabase.from('items').select('id,title,url').eq('owner_id',user.id).eq('type','link').then(({data})=>setLinks(data||[]))},[user.id])
 useEffect(()=>{cur&&loadT(cur.id)},[cur?.id])
 const addPlan=async()=>{
  const title=prompt('Nome do plano (ex: Primeira venda online)');if(!title)return
  const {data,error}=await supabase.from('action_plans').insert({title}).select().single()
  if(error)return alert(error.message)
  await loadP();setCur(data)
 }
 const delPlan=async()=>{if(confirm('Excluir este plano e suas tarefas?')){await supabase.from('action_plans').delete().eq('id',cur.id);setCur(null);loadP()}}
 const addTask=async e=>{
  e.preventDefault()
  const {error}=await supabase.from('tasks').insert({plan_id:cur.id,title:t,due_date:due||null,position:tasks.length})
  if(error)return alert(error.message)
  setT('');setDue('');loadT(cur.id)
 }
 const cycle=async k=>{await supabase.from('tasks').update({status:NEXT[k.status]}).eq('id',k.id);loadT(cur.id)}
 const delTask=async k=>{await supabase.from('tasks').delete().eq('id',k.id);loadT(cur.id)}
 const attach=async(k,item)=>{if(!item)return;await supabase.from('task_items').insert({task_id:k.id,item_id:item});loadT(cur.id)}
 const done=tasks.filter(k=>k.status==='done').length
 return <>
  <div className="head"><h1 className="page-title">Planos de ação</h1><button className="btn btn--primary btn--sm" onClick={addPlan}>Novo plano</button></div>
  <div className="row plans-row">{plans.map(p=><button key={p.id} className={'btn btn--sm '+(cur?.id===p.id?'btn--primary':'btn--ghost')} onClick={()=>setCur(p)} style={{flex:'0 0 auto'}}>{p.title}</button>)}</div>
  {!plans.length&&<p className="empty">Crie um plano para transformar seus links e ideias em tarefas com prazo.</p>}
  {cur&&<div className="card">
   <div className="head"><h2 className="t-title">{cur.title}</h2><span className="kind">{done} de {tasks.length} tarefas feitas <button className="link danger" onClick={delPlan}>Excluir plano</button></span></div>
   <form className="row" onSubmit={addTask}>
    <input className="input" required placeholder="Nova tarefa" value={t} onChange={e=>setT(e.target.value)} style={{flex:3}}/>
    <input className="input" type="date" value={due} onChange={e=>setDue(e.target.value)}/>
    <button className="btn btn--primary btn--sm" style={{flex:'0 0 auto'}}>Adicionar</button>
   </form>
   {tasks.map(k=><div key={k.id}>
    <div className={'task '+k.status}>
     <button className={'badge st '+k.status} onClick={()=>cycle(k)} title="Mudar status">{LABEL[k.status]}</button>
     <span className="t">{k.title}{k.due_date&&<small className="kind"> · prazo {new Date(k.due_date+'T00:00').toLocaleDateString('pt-BR')}</small>}</span>
     <select className="input" style={{width:150}} value="" onChange={e=>attach(k,e.target.value)}><option value="">Vincular link</option>{links.map(l=><option key={l.id} value={l.id}>{(l.title||l.url).slice(0,40)}</option>)}</select>
     <button className="btn btn--ghost btn--sm danger" onClick={()=>delTask(k)}>Excluir</button>
    </div>
    {k.task_items?.map(x=><div key={x.item_id} className="kind" style={{paddingLeft:'6rem'}}><a href={x.items?.url} target="_blank" rel="noreferrer">{x.items?.title||x.items?.url}</a></div>)}
   </div>)}
  </div>}
 </>
}
