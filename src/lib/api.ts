export type GenerateResponse = {
  html: string
  introMessage: string
  scrapeFailed: boolean
  usedMock: boolean
}

export type ChatResponse = { html: string; usedMock: boolean }

export type PublishResponse = { slug: string; viewUrl: string; stored: 'blob' | 'memory' }

export async function apiGenerate(body: {
  useMock: boolean
  imageBase64: string | null
  imageUrl: string | null
  landingUrl: string
}): Promise<GenerateResponse> {
  const r = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Generate failed')
  }
  return r.json() as Promise<GenerateResponse>
}

export async function apiChat(body: {
  useMock: boolean
  html: string
  message: string
}): Promise<ChatResponse> {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Chat failed')
  }
  return r.json() as Promise<ChatResponse>
}

export async function apiPublish(html: string): Promise<PublishResponse> {
  const r = await fetch('/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Publish failed')
  }
  return r.json() as Promise<PublishResponse>
}

export async function apiPageMeta(url: string): Promise<{
  ok: boolean
  title: string | null
  favicon: string | null
}> {
  const q = encodeURIComponent(url)
  const r = await fetch(`/api/page-meta?url=${q}`)
  if (!r.ok) return { ok: false, title: null, favicon: null }
  return r.json() as Promise<{
    ok: boolean
    title: string | null
    favicon: string | null
  }>
}
