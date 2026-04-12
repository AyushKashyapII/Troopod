import { put } from '@vercel/blob'
import { nanoid } from 'nanoid'
import { pageMemory } from './store.js'

export type PublishResult = { slug: string; viewUrl: string; stored: 'blob' | 'memory' }

export async function publishHtml(html: string): Promise<PublishResult> {
  const slug = nanoid(10)
  const token = process.env.BLOB_READ_WRITE_TOKEN

  if (token) {
    const blob = await put(`admatch-pages/${slug}.html`, html, {
      access: 'public',
      token,
      contentType: 'text/html; charset=utf-8',
    })
    return { slug, viewUrl: blob.url, stored: 'blob' }
  }

  pageMemory.set(slug, html)
  const base =
    process.env.PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.VERCEL_URL?.replace(/^(?!https?:\/\/)/, 'https://') ||
    ''
  const origin = base.startsWith('http') ? base : base ? `https://${base}` : ''
  const path = `/p/${slug}`
  return {
    slug,
    viewUrl: origin ? `${origin}${path}` : path,
    stored: 'memory',
  }
}

export function getPublishedHtml(slug: string): string | undefined {
  return pageMemory.get(slug)
}
