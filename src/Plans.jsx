import {useEffect,useState} from 'react'
import {supabase} from './supabase'
import Icon from './Icon'
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
 const pct=tasks.length?Math.round(done/tasks.length*100):0
 return <>
  <div className="head"><div><h1 className="page-title">Planos de ação</h1><p className="sub">Quebre uma meta em tarefas com prazo e ligue cada uma aos seus links.</p></div><button className="btn btn--primary btn--sm" onClick={addPlan}><Icon n="plus" size={16}/>Novo plano</button></div>
  {plans.length>0&&<div className="plans-row">{plans.map(p=><button key={p.id} className={'btn btn--sm '+(cur?.id===p.id?'btn--primary':'btn--ghost')} onClick={()=>setCur(p)}>{p.title}</button>)}</div>}
  {!plans.length&&<div className="emptybox"><span className="ic"><Icon n="target" size={26}/></span><h2>Nenhum plano ainda</h2><p>Crie um plano, por exemplo “Primeira venda online”, e divida em tarefas com prazo.</p><button className="btn btn--primary" onClick={addPlan}><Icon n="plus" size={16}/>Criar primeiro plano</button></div>}
  {plans.length>0&&!cur&&<p className="empty">Escolha um plano acima para ver as tarefas.</p>}
  {cur&&<div className="card">
   <div className="head" style={{alignItems:'center'}}><h2 className="t-title">{cur.title}</h2><button className="btn btn--ghost btn--sm danger" onClick={delPlan}><Icon n="trash" size={15}/>Excluir plano</button></div>
   <p className="kind" style={{margin:'6px 0 8px'}}>{done} de {tasks.length} tarefas feitas{tasks.length>0&&` · ${pct}%`}</p>
   <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><div className="progress__bar" style={{width:pct+'%'}}/></div>
   <form className="addtask" onSubmit={addTask}>
    <input className="input" required placeholder="Nova tarefa" value={t} onChange={e=>setT(e.target.value)}/>
    <input className="input" type="date" aria-label="Prazo" value={due} onChange={e=>setDue(e.target.value)}/>
    <button className="btn btn--primary">Adicionar</button>
   </form>
   {tasks.length===0&&<p className="empty" style={{padding:'12px 0'}}>Adicione a primeira tarefa deste plano.</p>}
   {tasks.map(k=><div key={k.id} className={'task '+k.status}>
    <button className={'badge st '+k.status} onClick={()=>cycle(k)} title="Mudar status">{LABEL[k.status]}</button>
    <div className="t"><span>{k.title}</span>{k.due_date&&<small className="kind">Prazo: {new Date(k.due_date+'T00:00').toLocaleDateString('pt-BR')}</small>}{k.task_items?.map(x=><a key={x.item_id} href={x.items?.url} target="_blank" rel="noreferrer">{x.items?.title||x.items?.url}</a>)}</div>
    <button className="icon-btn danger" aria-label="Excluir tarefa" title="Excluir tarefa" onClick={()=>delTask(k)}><Icon n="trash" size={18}/></button>
    <select className="input attach" aria-label="Vincular link" value="" onChange={e=>attach(k,e.target.value)}><option value="">Vincular link</option>{links.map(l=><option key={l.id} value={l.id}>{(l.title||l.url).slice(0,40)}</option>)}</select>
   </div>)}
  </div>}
 </>
}
