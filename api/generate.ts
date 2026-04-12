// Note: no dotenv import needed — Vercel injects env vars directly into process.env
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { runGeneratePipeline } from '../server/lib/ai'

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
    const result = await runGeneratePipeline({
      useMock,
      imageBase64: body.imageBase64 ?? null,
      imageUrl: body.imageUrl ?? null,
      landingUrl: body.landingUrl ?? '',
    })
    res.status(200).json(result)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Generation failed' })
  }
}
