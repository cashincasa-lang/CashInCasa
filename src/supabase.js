import {createClient} from '@supabase/supabase-js'
// Estado do cofre só em memória (some ao recarregar a página)
export const vault={token:null,active:false}
const f=(u,o={})=>{
 if(vault.active&&vault.token&&String(u).includes('/rest/v1/')){
  const h=new Headers(o.headers);h.set('x-vault-token',vault.token);o={...o,headers:h}
 }
 return fetch(u,o)
}
export const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY,{global:{fetch:f}})
