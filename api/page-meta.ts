import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Lightweight URL validator: fetches the page directly (no Jina dependency)
 * and extracts the <title> tag + derives a favicon URL from Google S2.
 * This is much faster and more reliable for the "Test URL" use-case.
 */
async function fetchPageTitle(url: string): Promise<{ ok: boolean; title: string | null }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)

    if (!res.ok) return { ok: false, title: null }

    // Read only the first 10KB — enough to find <title> without downloading full page
    const reader = res.body?.getReader()
    if (!reader) return { ok: true, title: null }
    let chunk = ''
    let bytesRead = 0
    while (bytesRead < 10_000) {
      const { done, value } = await reader.read()
      if (done) break
      chunk += new TextDecoder().decode(value)
      bytesRead += value?.length ?? 0
      if (chunk.includes('</title>')) break
    }
    reader.cancel().catch(() => {})

    const match = chunk.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
    const title = match?.[1]?.trim().replace(/\s+/g, ' ') ?? null
    return { ok: true, title }
  } catch {
    return { ok: false, title: null }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS for browser requests
  res.setHeader('Access-Control-Allow-Origin', '*')

  const rawUrl = String(req.query.url ?? '').trim()
  if (!rawUrl) {
    res.status(400).json({ error: 'url required' })
    return
  }

  // Normalise URL
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    res.status(200).json({ ok: false, title: null, favicon: null })
    return
  }

  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`

  try {
    const { ok, title } = await fetchPageTitle(url)
    res.status(200).json({ ok, title, favicon: ok ? favicon : null })
  } catch (e) {
    console.error('[page-meta] error:', e)
    res.status(200).json({ ok: false, title: null, favicon: null })
  }
}
