// Note: no dotenv import needed — Vercel injects env vars directly into process.env
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { runChatEdit } from '../server/lib/ai.js'

function parseBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const useMock = parseBool(body.useMock)
    const html = body.html ?? ''
    const message = body.message ?? ''
    if (!String(message).trim()) {
      res.status(400).json({ error: 'Message required' })
      return
    }
    const result = await runChatEdit({ useMock, html, message })
    res.status(200).json(result)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Edit failed' })
  }
}
