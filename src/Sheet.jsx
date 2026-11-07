import {useEffect} from 'react'
export default function Sheet({onClose,children,wide,label}){
 useEffect(()=>{
  const k=e=>{if(e.key==='Escape')onClose()}
  addEventListener('keydown',k)
  const o=document.body.style.overflow;document.body.style.overflow='hidden'
  return()=>{removeEventListener('keydown',k);document.body.style.overflow=o}
 },[onClose])
 return <div className="modal" onClick={onClose}><div className={'sheet'+(wide?' sheet--wide':'')} role="dialog" aria-modal="true" aria-label={label} onClick={e=>e.stopPropagation()}><span className="grab"/>{children}</div></div>
}
