// Edge Function "link-cover": busca a capa de um link e guarda uma cópia no bucket privado item-covers.
// Chamada pelo app com { item_id }. A URL é lida do banco (não confia no cliente).
// Não faz nada para Instagram e YouTube (Instagram: sem via oficial; YouTube: o app já usa a miniatura pública).
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const MAX_HTML = 1_500_000
const MAX_IMG = 5 * 1024 * 1024 // mesmo limite do bucket
const UA = 'Mozilla/5.0 (compatible; CashInCasaBot/1.0)'

// ---------- proteção contra SSRF (o servidor nunca deve buscar endereços internos) ----------
function privV4(ip: string) {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !(n >= 0 && n <= 255))) return true
  const [a, b] = p
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}
function privV6(ip: string) {
  const x = ip.toLowerCase()
  if (x === '::' || x === '::1') return true
  const m = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (m) return privV4(m[1])
  if (x.startsWith('::ffff:')) return true
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x)
}
async function assertPublic(u: URL) {
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('protocolo')
  if (u.username || u.password) throw new Error('credenciais')
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('porta')
  const h = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (h === 'localhost' || /\.(localhost|local|internal)$/.test(h)) throw new Error('host')
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) { if (privV4(h)) throw new Error('ip'); return }
  if (h.includes(':')) { if (privV6(h)) throw new Error('ip'); return }
  const ips: string[] = []
  if (typeof Deno.resolveDns === 'function') {
    for (const t of ['A', 'AAAA'] as const) {
      try { ips.push(...await Deno.resolveDns(h, t)) } catch { /* sem registro desse tipo */ }
    }
  }
  if (ips.some((ip) => (ip.includes(':') ? privV6(ip) : privV4(ip)))) throw new Error('ip')
}
async function safeFetch(url: string, accept: string, hops = 3) {
  let u = new URL(url)
  for (let i = 0; i <= hops; i++) {
    await assertPublic(u)
    const res = await fetch(u, {
      redirect: 'manual',
      headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
      signal: AbortSignal.timeout(8000),
    })
    const loc = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && loc) { u = new URL(loc, u); continue }
    return { res, final: u }
  }
  throw new Error('redirecionamentos')
}
async function readCapped(res: Response, max: number) {
  const r = res.body?.getReader()
  if (!r) return { bytes: new Uint8Array(), truncated: false }
  const chunks: Uint8Array[] = []
  let n = 0
  while (true) {
    const { done, value } = await r.read()
    if (done) break
    chunks.push(value); n += value.length
    if (n > max) { await r.cancel(); break }
  }
  const all = new Uint8Array(n)
  let o = 0
  for (const c of chunks) { all.set(c, o); o += c.length }
  return { bytes: all.slice(0, max), truncated: n > max }
}

// ---------- leitura de título e imagem ----------
const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

function metas(html: string) {
  const out: Record<string, string> = {}
  for (const m of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const attrs: Record<string, string> = {}
    for (const a of m[0].matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[a[1].toLowerCase()] = a[3] ?? a[4]
    const key = (attrs.property || attrs.name || '').toLowerCase()
    if (key && attrs.content && !(key in out)) out[key] = decode(attrs.content)
  }
  const t = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (t && !out['title']) out['title'] = decode(t[1].trim())
  return out
}
type Meta = { title?: string; image?: string }
async function pageMeta(url: string): Promise<Meta> {
  const { res, final } = await safeFetch(url, 'text/html,application/xhtml+xml')
  if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return {}
  const { bytes } = await readCapped(res, MAX_HTML)
  const m = metas(new TextDecoder().decode(bytes))
  const img = m['og:image:secure_url'] || m['og:image'] || m['twitter:image'] || m['twitter:image:src']
  let image: string | undefined
  try { image = img ? new URL(img, final).href : undefined } catch { /* url inválida */ }
  return { title: m['og:title'] || m['twitter:title'] || m['title'], image }
}
async function tiktokMeta(url: string): Promise<Meta> {
  const r = await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url), { signal: AbortSignal.timeout(8000) })
  if (!r.ok) return {}
  const j = await r.json()
  return {
    title: typeof j.title === 'string' ? j.title : undefined,
    image: typeof j.thumbnail_url === 'string' ? j.thumbnail_url : undefined,
  }
}
function sniff(b: Uint8Array) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' }
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', type: 'image/png' }
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP')
    return { ext: 'webp', type: 'image/webp' }
  return null
}
async function downloadImage(url: string) {
  const { res } = await safeFetch(url, 'image/jpeg,image/png,image/webp')
  if (!res.ok) return null
  const { bytes, truncated } = await readCapped(res, MAX_IMG)
  if (truncated || bytes.length < 500) return null
  const k = sniff(bytes) // confere o conteúdo real, não só o cabeçalho
  return k ? { bytes, ...k } : null
}

// ---------- função ----------
// chave secreta: formato antigo (SERVICE_ROLE) ou o novo (SECRET_KEYS, um JSON)
function secretKey(): string | undefined {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default as string | undefined } catch { return undefined }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'método' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const svc = secretKey()
  if (!url || !svc) return json({ error: 'configuração do servidor' }, 500)
  const admin = createClient(url, svc)

  // confere o login do usuário (a função não depende da verificação do gateway)
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: u, error: ue } = jwt ? await admin.auth.getUser(jwt) : { data: null, error: new Error('sem token') }
  if (ue || !u?.user) return json({ error: 'não autenticado' }, 401)

  let body: { item_id?: unknown }
  try { body = await req.json() } catch { return json({ error: 'json' }, 400) }
  const id = body?.item_id
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'item_id' }, 400)

  const { data: item } = await admin.from('items').select('id,owner_id,type,url,title,thumbnail').eq('id', id).maybeSingle()
  if (!item || item.owner_id !== u.user.id) return json({ error: 'item não encontrado' }, 404)
  if (item.type !== 'link' || !item.url) return json({ ok: false, reason: 'sem_link' })
  if (item.thumbnail?.startsWith('storage:')) return json({ ok: false, reason: 'ja_tem_capa' }) // nunca sobrescreve capa existente

  let host = ''
  try { host = new URL(item.url).hostname.replace(/^www\./, '') } catch { return json({ ok: false, reason: 'url' }) }
  if (host.includes('instagram.com')) return json({ ok: false, reason: 'instagram' })
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return json({ ok: false, reason: 'youtube' })

  try {
    let meta: Meta = {}
    if (host.includes('tiktok.com')) meta = await tiktokMeta(item.url).catch(() => ({}))
    if (!meta.image) {
      const m2 = await pageMeta(item.url).catch(() => ({} as Meta))
      meta = { title: meta.title || m2.title, image: m2.image }
    }
    if (!meta.image) return json({ ok: false, reason: 'sem_imagem' })
    const img = await downloadImage(meta.image)
    if (!img) return json({ ok: false, reason: 'imagem_invalida' })

    const path = `${item.owner_id}/${crypto.randomUUID()}.${img.ext}`
    const { error: upErr } = await admin.storage.from('item-covers').upload(path, img.bytes, { contentType: img.type, upsert: false })
    if (upErr) return json({ ok: false, reason: 'upload' })

    // reconfere: se o usuário escolheu uma capa enquanto buscávamos, não sobrescreve
    const { data: cur } = await admin.from('items').select('thumbnail').eq('id', id).maybeSingle()
    if (!cur || cur.thumbnail?.startsWith('storage:')) {
      await admin.storage.from('item-covers').remove([path])
      return json({ ok: false, reason: 'ja_tem_capa' })
    }
    const patch: Record<string, unknown> = { thumbnail: 'storage:item-covers/' + path }
    if (!item.title && meta.title) patch.title = meta.title.slice(0, 300)
    const { error: dbErr } = await admin.from('items').update(patch).eq('id', id)
    if (dbErr) { await admin.storage.from('item-covers').remove([path]); return json({ ok: false, reason: 'salvar' }) }
    return json({ ok: true })
  } catch {
    return json({ ok: false, reason: 'erro' })
  }
})
