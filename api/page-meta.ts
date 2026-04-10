import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchJinaPage } from '../server/lib/ai'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = String(req.query.url ?? '').trim()
  if (!url) {
    res.status(400).json({ error: 'url required' })
    return
  }
  try {
    const jina = await fetchJinaPage(url)
    if (!jina.ok) {
      res.status(200).json({ ok: false, title: null, favicon: null })
      return
    }
    const lines = jina.text.split('\n').filter(Boolean)
    let title: string | null = null
    const h = lines.find((l) => l.startsWith('# '))
    if (h) title = h.replace(/^#\s+/, '').slice(0, 120)
    else if (lines[0]) title = lines[0].slice(0, 120)
    let host = ''
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`)
      host = u.hostname
    } catch {
      host = url.replace(/^https?:\/\//, '').split('/')[0] ?? ''
    }
    const favicon = host
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
      : null
    res.status(200).json({ ok: true, title, favicon })
  } catch (e) {
    console.error(e)
    res.status(200).json({ ok: false, title: null, favicon: null })
  }
}
