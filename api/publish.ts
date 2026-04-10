import type { VercelRequest, VercelResponse } from '@vercel/node'
import { publishHtml } from '../server/lib/publish'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const html = body.html ?? ''
    if (!String(html).trim()) {
      res.status(400).json({ error: 'HTML required' })
      return
    }
    const result = await publishHtml(html)
    res.status(200).json(result)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Publish failed' })
  }
}
