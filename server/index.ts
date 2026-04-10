import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { fetchJinaPage, runChatEdit, runGeneratePipeline } from './lib/ai'
import { getPublishedHtml, publishHtml } from './lib/publish'

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '12mb' }))

function parseBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1'
}

app.post('/api/generate', async (req, res) => {
  try {
    const body = req.body as {
      useMock?: unknown
      imageBase64?: string | null
      imageUrl?: string | null
      landingUrl?: string
    }
    const useMock = parseBool(body.useMock)
    const result = await runGeneratePipeline({
      useMock,
      imageBase64: body.imageBase64 ?? null,
      imageUrl: body.imageUrl ?? null,
      landingUrl: body.landingUrl ?? '',
    })
    res.json(result)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Generation failed. Try again or use mock mode.' })
  }
})

app.post('/api/chat', async (req, res) => {
  try {
    const body = req.body as { useMock?: unknown; html?: string; message?: string }
    const useMock = parseBool(body.useMock)
    const html = body.html ?? ''
    const message = body.message ?? ''
    if (!message.trim()) {
      res.status(400).json({ error: 'Message required' })
      return
    }
    const result = await runChatEdit({ useMock, html, message })
    res.json(result)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Edit failed. Try again.' })
  }
})

app.post('/api/publish', async (req, res) => {
  try {
    const body = req.body as { html?: string }
    const html = body.html ?? ''
    if (!html.trim()) {
      res.status(400).json({ error: 'HTML required' })
      return
    }
    const result = await publishHtml(html)
    res.json(result)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Publish failed.' })
  }
})

function sendPage(res: express.Response, slug: string) {
  const html = getPublishedHtml(slug)
  if (!html) {
    res.status(404).type('text/plain').send('Not found')
    return
  }
  res.type('html').send(html)
}

app.get('/api/p/:slug', (req, res) => {
  sendPage(res, req.params.slug)
})

app.get('/p/:slug', (req, res) => {
  sendPage(res, req.params.slug)
})

app.get('/api/page-meta', async (req, res) => {
  const url = String(req.query.url ?? '').trim()
  if (!url) {
    res.status(400).json({ error: 'url required' })
    return
  }
  try {
    const jina = await fetchJinaPage(url)
    if (!jina.ok) {
      res.json({ ok: false, title: null, favicon: null })
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
    res.json({ ok: true, title, favicon })
  } catch (e) {
    console.error(e)
    res.json({ ok: false, title: null, favicon: null })
  }
})

const port = Number(process.env.API_PORT) || 8787
app.listen(port, () => {
  console.log(`AdMatch API listening on http://127.0.0.1:${port}`)
})
