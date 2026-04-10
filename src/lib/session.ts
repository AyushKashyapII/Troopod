/** Persist builder draft across refresh (MVP). */
const KEY = 'admatch:builder'

export type BuilderSession = {
  pageTitle: string
  html: string
  originalHtml: string
  landingUrl: string
  useMock?: boolean
  adPreview?: string | null
  chatMessages: { role: 'assistant' | 'user'; content: string }[]
}

export function loadBuilderSession(): BuilderSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as BuilderSession
  } catch {
    return null
  }
}

export function saveBuilderSession(data: BuilderSession) {
  sessionStorage.setItem(KEY, JSON.stringify(data))
}

export function clearBuilderSession() {
  sessionStorage.removeItem(KEY)
}
