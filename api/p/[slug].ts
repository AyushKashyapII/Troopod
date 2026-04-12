import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPublishedHtml } from '../../server/lib/publish.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  const slug = req.query.slug
  const s = Array.isArray(slug) ? slug[0] : slug
  if (!s) {
    res.setHeader('Content-Type', 'text/plain')
    res.status(400).send('Bad request')
    return
  }
  const html = getPublishedHtml(s)
  if (!html) {
    res.setHeader('Content-Type', 'text/plain')
    res.status(404).send('Not found — use Blob storage on Vercel for persistent pages.')
    return
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(html)
}
