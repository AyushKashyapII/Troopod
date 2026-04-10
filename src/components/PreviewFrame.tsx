import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { cn } from '@/lib/utils'

/** Exclude `a` so nav labels are not treated as in-preview navigation / accidental contenteditable. */
const TEXT_SELECTOR =
  'h1,h2,h3,h4,h5,h6,p,button,li,span,label,figcaption,blockquote'

const HERO_FALLBACK_ID = 'admatch-hero-fallback'
const IMG_UI_ID = 'admatch-img-replace-ui'
const TEXT_UI_ID = 'admatch-text-style-ui'

const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'System UI', value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'SF / Apple', value: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia (serif)', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Monospace', value: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace' },
]

const SIZE_OPTIONS_PX = [
  '10px',
  '12px',
  '14px',
  '16px',
  '18px',
  '20px',
  '24px',
  '28px',
  '32px',
  '36px',
  '40px',
  '48px',
  '56px',
  '64px',
  '72px',
]

function rgbToHex(rgb: string): string {
  const s = rgb.trim()
  if (s.startsWith('#')) {
    const h = s.slice(1, 7)
    if (/^[0-9a-fA-F]{6}$/.test(h)) return `#${h}`
  }
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) return '#1a1a1a'
  const r = Number(m[1])
  const g = Number(m[2])
  const b = Number(m[3])
  const to = (n: number) => n.toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function nearestFontOption(computedFamily: string): string {
  const norm = computedFamily.replace(/['"]/g, '').toLowerCase()
  for (const { value } of FONT_OPTIONS) {
    const key = value.split(',')[0]?.replace(/['"]/g, '').trim().toLowerCase()
    if (key && norm.includes(key)) return value
  }
  return FONT_OPTIONS[0]!.value
}

function nearestSizeOption(computedSize: string): string {
  const px = computedSize.match(/^([\d.]+)px$/)
  if (px) {
    const n = parseFloat(px[1]!)
    let best = SIZE_OPTIONS_PX[0]!
    let bestDiff = Infinity
    for (const opt of SIZE_OPTIONS_PX) {
      const v = parseFloat(opt)
      const d = Math.abs(v - n)
      if (d < bestDiff) {
        bestDiff = d
        best = opt
      }
    }
    return best
  }
  return '16px'
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
}

/** Clicks usually hit a Text node; Text has no .closest(), so resolve to a real Element first. */
function elementFromEventTarget(target: EventTarget | null): Element | null {
  if (!target || !(target instanceof Node)) return null
  if (target.nodeType === Node.TEXT_NODE) return target.parentElement
  return target instanceof Element ? target : null
}

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile'

export interface PreviewFrameHandle {
  getIframe: () => HTMLIFrameElement | null
}

type PreviewFrameProps = {
  html: string
  device: PreviewDevice
  viewSource: boolean
  /** Data URL or https URL of the user's ad — used if the document has no <img> (e.g. old session HTML). */
  heroCreativeSrc?: string | null
  onHtmlPatched: (fullDocumentHtml: string) => void
  onRenderConcern?: () => void
}

export const PreviewFrame = forwardRef<PreviewFrameHandle, PreviewFrameProps>(function PreviewFrame({
  html,
  device,
  viewSource,
  heroCreativeSrc = null,
  onHtmlPatched,
  onRenderConcern,
}: PreviewFrameProps, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useImperativeHandle(ref, () => ({
    getIframe: () => iframeRef.current,
  }))
  const hoveredRef = useRef<HTMLElement | null>(null)
  const onPatchRef = useRef(onHtmlPatched)
  const onConcernRef = useRef(onRenderConcern)
  const heroCreativeRef = useRef<string | null>(null)
  onPatchRef.current = onHtmlPatched
  onConcernRef.current = onRenderConcern
  heroCreativeRef.current = heroCreativeSrc?.trim() || null

  const attach = useCallback(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    const win = doc?.defaultView
    if (!doc?.body || !win) return

    let lastImgHover: HTMLImageElement | null = null

    const style = doc.createElement('style')
    style.textContent = `
      [data-admatch-hover="1"] { outline: 2px solid rgba(59,130,246,.85) !important; outline-offset: 2px; cursor: pointer; position: relative; }
      [data-admatch-edit-icon] { position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; border-radius: 6px;
        background: #3b82f6; color: white; font-size: 12px; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,.2); pointer-events: none; z-index: 9999; }
      img.admatch-img-hover { outline: 3px solid rgba(59,130,246,.95) !important; outline-offset: 3px; cursor: pointer !important; }
      #${IMG_UI_ID} *, #${TEXT_UI_ID} * { box-sizing: border-box; }
    `
    doc.head.appendChild(style)

    const isTextLike = (el: Element | null): el is HTMLElement => {
      if (!el || !(el instanceof HTMLElement)) return false
      if (!el.matches(TEXT_SELECTOR)) return false
      const t = el.textContent?.trim() ?? ''
      return t.length > 0
    }

    const clearImgOutline = () => {
      if (lastImgHover) {
        lastImgHover.classList.remove('admatch-img-hover')
        lastImgHover = null
      }
    }

    const clearHover = () => {
      if (hoveredRef.current) {
        hoveredRef.current.removeAttribute('data-admatch-hover')
        hoveredRef.current.querySelectorAll('[data-admatch-edit-icon]').forEach((n) => n.remove())
        hoveredRef.current = null
      }
      clearImgOutline()
    }

    const setHover = (el: HTMLElement) => {
      clearHover()
      hoveredRef.current = el
      el.setAttribute('data-admatch-hover', '1')
      const icon = doc.createElement('span')
      icon.setAttribute('data-admatch-edit-icon', '1')
      icon.textContent = '✎'
      const pos = win.getComputedStyle(el).position
      if (pos === 'static') el.style.position = 'relative'
      el.appendChild(icon)
    }

    const closeAllEditorUIs = () => {
      doc.getElementById(IMG_UI_ID)?.remove()
      doc.getElementById(TEXT_UI_ID)?.remove()
    }

    const pushDoc = () => {
      const root = iframe?.contentDocument?.documentElement
      if (root) onPatchRef.current(root.outerHTML)
    }

    const showImgReplaceUI = (img: HTMLImageElement) => {
      closeAllEditorUIs()
      clearHover()
      img.classList.remove('admatch-img-hover')

      const wrap = doc.createElement('div')
      wrap.id = IMG_UI_ID
      wrap.setAttribute(
        'style',
        `position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483647;background:#171717;color:#fafafa;padding:14px 16px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.45);font-family:system-ui,-apple-system,sans-serif;font-size:13px;width:min(420px,calc(100vw - 32px));border:1px solid #333;`,
      )
      wrap.addEventListener('mousedown', (e) => e.stopPropagation())
      wrap.addEventListener('click', (e) => e.stopPropagation())

      const title = doc.createElement('div')
      title.textContent = 'Replace image'
      title.setAttribute('style', 'font-weight:600;margin-bottom:4px;')
      wrap.appendChild(title)
      const sub = doc.createElement('div')
      sub.textContent = 'Use a URL or pick a file from your computer.'
      sub.setAttribute('style', 'font-size:12px;color:#a3a3a3;margin-bottom:12px;')
      wrap.appendChild(sub)

      const pickBtn = doc.createElement('button')
      pickBtn.type = 'button'
      pickBtn.textContent = 'Choose image from computer…'
      pickBtn.setAttribute(
        'style',
        'width:100%;padding:10px 12px;margin-bottom:10px;border-radius:8px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-weight:600;',
      )
      const fileInput = doc.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'image/*'
      fileInput.setAttribute('style', 'display:none')
      pickBtn.addEventListener('click', () => fileInput.click())

      const status = doc.createElement('div')
      status.setAttribute('style', 'font-size:11px;color:#86efac;margin-bottom:8px;min-height:14px;')

      fileInput.addEventListener('change', () => {
        const f = fileInput.files?.[0]
        if (!f?.type.startsWith('image/')) {
          status.textContent = ''
          return
        }
        status.textContent = `Selected: ${f.name} — click Apply`
      })
      wrap.appendChild(pickBtn)
      wrap.appendChild(fileInput)
      wrap.appendChild(status)

      const urlLabel = doc.createElement('div')
      urlLabel.textContent = 'Or image URL'
      urlLabel.setAttribute('style', 'font-size:11px;color:#737373;margin-bottom:4px;')
      wrap.appendChild(urlLabel)
      const urlInput = doc.createElement('input')
      urlInput.type = 'url'
      urlInput.placeholder = 'https://…'
      urlInput.setAttribute(
        'style',
        'width:100%;padding:8px 10px;margin-bottom:12px;border-radius:8px;border:1px solid #444;background:#262626;color:#fff;',
      )
      wrap.appendChild(urlInput)

      const row = doc.createElement('div')
      row.setAttribute('style', 'display:flex;gap:8px;justify-content:flex-end;')
      const cancel = doc.createElement('button')
      cancel.type = 'button'
      cancel.textContent = 'Cancel'
      cancel.setAttribute(
        'style',
        'padding:8px 14px;border-radius:8px;border:1px solid #555;background:transparent;color:#fff;cursor:pointer;',
      )
      cancel.addEventListener('click', () => closeAllEditorUIs())
      const apply = doc.createElement('button')
      apply.type = 'button'
      apply.textContent = 'Apply'
      apply.setAttribute(
        'style',
        'padding:8px 14px;border-radius:8px;border:none;background:#22c55e;color:#0f172a;cursor:pointer;font-weight:600;',
      )
      apply.addEventListener('click', async () => {
        const u = urlInput.value.trim()
        const file = fileInput.files?.[0]
        try {
          if (file?.type.startsWith('image/')) {
            img.src = await readFileAsDataUrl(file)
          } else if (u && /^https?:\/\//i.test(u)) {
            img.src = u
          } else {
            return
          }
          closeAllEditorUIs()
          pushDoc()
        } catch {
          status.textContent = 'Could not read file.'
        }
      })
      row.appendChild(cancel)
      row.appendChild(apply)
      wrap.appendChild(row)

      doc.body.appendChild(wrap)
      pickBtn.focus()
    }

    const showTextStyleUI = (el: HTMLElement) => {
      closeAllEditorUIs()
      clearHover()

      const cs = win.getComputedStyle(el)
      const initialText = el.innerText

      const wrap = doc.createElement('div')
      wrap.id = TEXT_UI_ID
      wrap.setAttribute(
        'style',
        `position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483647;background:#171717;color:#fafafa;padding:14px 16px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.45);font-family:system-ui,-apple-system,sans-serif;font-size:13px;width:min(440px,calc(100vw - 32px));border:1px solid #333;`,
      )
      wrap.addEventListener('mousedown', (e) => e.stopPropagation())
      wrap.addEventListener('click', (e) => e.stopPropagation())

      const title = doc.createElement('div')
      title.textContent = 'Edit text & style'
      title.setAttribute('style', 'font-weight:600;margin-bottom:4px;')
      wrap.appendChild(title)
      const hint = doc.createElement('div')
      hint.textContent =
        'Changes are saved as inline HTML (font, size, color, copy). Nested tags in this block become plain text if you edit content.'
      hint.setAttribute('style', 'font-size:11px;color:#a3a3a3;margin-bottom:12px;line-height:1.35;')
      wrap.appendChild(hint)

      const grid = doc.createElement('div')
      grid.setAttribute(
        'style',
        'display:grid;grid-template-columns:88px 1fr;gap:10px 12px;align-items:center;margin-bottom:12px;',
      )

      const lab = (t: string) => {
        const x = doc.createElement('div')
        x.textContent = t
        x.setAttribute('style', 'font-size:12px;color:#d4d4d4;')
        return x
      }

      grid.appendChild(lab('Content'))
      const ta = doc.createElement('textarea')
      ta.value = initialText
      ta.setAttribute(
        'style',
        'width:100%;min-height:72px;padding:8px 10px;border-radius:8px;border:1px solid #444;background:#262626;color:#fff;resize:vertical;font-size:13px;',
      )
      grid.appendChild(ta)

      grid.appendChild(lab('Font'))
      const fontSel = doc.createElement('select')
      fontSel.setAttribute(
        'style',
        'width:100%;padding:8px 10px;border-radius:8px;border:1px solid #444;background:#262626;color:#fff;',
      )
      const matchedFont = nearestFontOption(cs.fontFamily)
      for (const { label, value } of FONT_OPTIONS) {
        const o = doc.createElement('option')
        o.value = value
        o.textContent = label
        fontSel.appendChild(o)
      }
      fontSel.value = FONT_OPTIONS.some((f) => f.value === matchedFont) ? matchedFont : FONT_OPTIONS[0]!.value
      grid.appendChild(fontSel)

      grid.appendChild(lab('Size'))
      const sizeSel = doc.createElement('select')
      sizeSel.setAttribute(
        'style',
        'width:100%;padding:8px 10px;border-radius:8px;border:1px solid #444;background:#262626;color:#fff;',
      )
      for (const s of SIZE_OPTIONS_PX) {
        const o = doc.createElement('option')
        o.value = s
        o.textContent = s
        sizeSel.appendChild(o)
      }
      sizeSel.value = nearestSizeOption(cs.fontSize)
      grid.appendChild(sizeSel)

      grid.appendChild(lab('Color'))
      const colorRow = doc.createElement('div')
      colorRow.setAttribute('style', 'display:flex;gap:8px;align-items:center;')
      const colorPick = doc.createElement('input')
      colorPick.type = 'color'
      const hex0 = rgbToHex(cs.color)
      colorPick.value = hex0
      colorPick.setAttribute('style', 'width:44px;height:36px;padding:2px;border:1px solid #444;border-radius:6px;cursor:pointer;background:#262626;')
      const colorHex = doc.createElement('input')
      colorHex.type = 'text'
      colorHex.value = hex0
      colorHex.setAttribute(
        'style',
        'flex:1;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid #444;background:#262626;color:#fff;font-size:12px;',
      )
      colorPick.addEventListener('input', () => {
        colorHex.value = colorPick.value
      })
      colorHex.addEventListener('input', () => {
        const v = colorHex.value.trim()
        if (/^#[0-9a-fA-F]{6}$/.test(v)) colorPick.value = v
      })
      colorRow.appendChild(colorPick)
      colorRow.appendChild(colorHex)
      grid.appendChild(colorRow)

      wrap.appendChild(grid)

      const row = doc.createElement('div')
      row.setAttribute('style', 'display:flex;gap:8px;justify-content:flex-end;')
      const cancel = doc.createElement('button')
      cancel.type = 'button'
      cancel.textContent = 'Cancel'
      cancel.setAttribute(
        'style',
        'padding:8px 14px;border-radius:8px;border:1px solid #555;background:transparent;color:#fff;cursor:pointer;',
      )
      cancel.addEventListener('click', () => closeAllEditorUIs())
      const apply = doc.createElement('button')
      apply.type = 'button'
      apply.textContent = 'Apply to HTML'
      apply.setAttribute(
        'style',
        'padding:8px 14px;border-radius:8px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-weight:600;',
      )
      apply.addEventListener('click', () => {
        const hex =
          /^#[0-9a-fA-F]{6}$/.test(colorHex.value.trim()) ? colorHex.value.trim() : colorPick.value
        el.textContent = ta.value
        el.style.fontFamily = fontSel.value
        el.style.fontSize = sizeSel.value
        el.style.color = hex
        closeAllEditorUIs()
        pushDoc()
      })
      row.appendChild(cancel)
      row.appendChild(apply)
      wrap.appendChild(row)

      doc.body.appendChild(wrap)
      ta.focus()
      ta.select()
    }

    const onMove = (e: MouseEvent) => {
      if (doc.getElementById(IMG_UI_ID) || doc.getElementById(TEXT_UI_ID)) return
      const host = elementFromEventTarget(e.target)
      if (!host) {
        clearImgOutline()
        clearHover()
        return
      }
      if (host instanceof HTMLImageElement) {
        clearHover()
        if (lastImgHover && lastImgHover !== host) {
          lastImgHover.classList.remove('admatch-img-hover')
        }
        host.classList.add('admatch-img-hover')
        lastImgHover = host
        return
      }
      clearImgOutline()
      const el = host.closest(TEXT_SELECTOR) as HTMLElement | null
      if (el && isTextLike(el)) setHover(el)
      else clearHover()
    }

    const onClick = (e: MouseEvent) => {
      const host = elementFromEventTarget(e.target)
      if (!host) return

      const link = host.closest('a[href]')
      if (link && doc.body.contains(link)) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      const imgEl =
        host instanceof HTMLImageElement ? host : (host.closest('img') as HTMLImageElement | null)
      if (imgEl instanceof HTMLImageElement && doc.body.contains(imgEl)) {
        e.preventDefault()
        e.stopPropagation()
        showImgReplaceUI(imgEl)
        return
      }
      if (doc.getElementById(IMG_UI_ID) || doc.getElementById(TEXT_UI_ID)) return

      const el = host.closest(TEXT_SELECTOR) as HTMLElement | null
      if (!el || !isTextLike(el)) return
      e.preventDefault()
      e.stopPropagation()
      showTextStyleUI(el)
    }

    doc.addEventListener('mousemove', onMove)
    doc.addEventListener('click', onClick, true)
    doc.defaultView?.addEventListener('scroll', clearHover, true)

    const hero = heroCreativeRef.current
    if (
      hero &&
      doc.body.querySelectorAll('img').length === 0 &&
      !doc.getElementById(HERO_FALLBACK_ID)
    ) {
      const heroWrap = doc.createElement('div')
      heroWrap.id = HERO_FALLBACK_ID
      heroWrap.setAttribute(
        'style',
        'padding:16px 20px;background:#f1f5f9;border-bottom:2px dashed #64748b;text-align:center;font-family:system-ui,-apple-system,sans-serif;',
      )
      const hintEl = doc.createElement('p')
      hintEl.setAttribute(
        'style',
        'margin:0 0 10px;font-size:13px;font-weight:600;color:#334155;',
      )
      hintEl.textContent =
        'Your ad creative — click the image to replace (URL or upload)'
      const im = doc.createElement('img')
      im.src = hero
      im.alt = 'Ad creative'
      im.setAttribute(
        'style',
        'max-height:min(360px,50vh);width:auto;max-width:100%;object-fit:contain;border-radius:12px;cursor:pointer;box-shadow:0 8px 24px rgba(15,23,42,.15);',
      )
      heroWrap.appendChild(hintEl)
      heroWrap.appendChild(im)
      doc.body.insertBefore(heroWrap, doc.body.firstChild)
      pushDoc()
    }
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || viewSource || !html.trim()) return
    iframe.srcdoc = html
    const onLoad = () => {
      attach()
      const doc = iframe.contentDocument
      const bodyText = doc?.body?.innerText?.trim() ?? ''
      if (bodyText.length < 8) onConcernRef.current?.()
    }
    iframe.addEventListener('load', onLoad)
    return () => iframe.removeEventListener('load', onLoad)
  }, [html, viewSource, attach])

  if (viewSource) {
    return (
      <pre className="h-[min(78vh,900px)] w-full min-w-0 overflow-auto rounded-xl border border-neutral-700 bg-neutral-950 p-4 text-xs text-emerald-200/90">
        <code>{html}</code>
      </pre>
    )
  }

  return (
    <div
      className={cn(
        'flex h-[min(78vh,900px)] min-w-0 flex-col overflow-hidden rounded-xl',
        device === 'desktop' && 'w-full max-w-none',
        device === 'tablet' && 'mx-auto w-full max-w-[820px]',
        device === 'mobile' && 'mx-auto w-full max-w-[400px]',
      )}
    >
      <iframe
        ref={iframeRef}
        title="Preview"
        className="min-h-[min(78vh,900px)] w-full rounded-xl bg-white shadow-lg"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
})
