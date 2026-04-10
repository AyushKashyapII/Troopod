import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Image as ImageIcon,
  Type,
  Square,
  Layers,
  Link,
  List,
  Minus,
  RotateCcw,
  Upload,
  Trash2,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TreeNode {
  id: string
  tag: string
  label: string
  children: TreeNode[]
  hasText: boolean
  isImage: boolean
  isContainer: boolean
}

export interface SelectedElementProps {
  id: string
  tag: string
  isImage?: boolean
  hasText?: boolean
  text?: string
  fontFamily?: string
  fontSize?: string
  color?: string
  src?: string
  alt?: string
  href?: string
  backgroundColor?: string
  padding?: string
  margin?: string
  borderRadius?: string
}

interface ManualEditorProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  html: string
  onHtmlPatched: (html: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TAG_ICONS: Record<string, React.ReactNode> = {
  img: <ImageIcon className="h-3.5 w-3.5 text-amber-400" />,
  svg: <ImageIcon className="h-3.5 w-3.5 text-amber-300" />,
  a: <Link className="h-3.5 w-3.5 text-blue-400" />,
  ul: <List className="h-3.5 w-3.5 text-neutral-400" />,
  ol: <List className="h-3.5 w-3.5 text-neutral-400" />,
  li: <Minus className="h-3.5 w-3.5 text-neutral-400" />,
  h1: <Type className="h-3.5 w-3.5 text-violet-400" />,
  h2: <Type className="h-3.5 w-3.5 text-violet-400" />,
  h3: <Type className="h-3.5 w-3.5 text-violet-300" />,
  h4: <Type className="h-3.5 w-3.5 text-violet-300" />,
  h5: <Type className="h-3.5 w-3.5 text-violet-300" />,
  h6: <Type className="h-3.5 w-3.5 text-violet-300" />,
  p: <Type className="h-3.5 w-3.5 text-neutral-300" />,
  span: <Type className="h-3.5 w-3.5 text-neutral-400" />,
  button: <Square className="h-3.5 w-3.5 text-green-400" />,
  section: <Layers className="h-3.5 w-3.5 text-indigo-400" />,
  div: <Square className="h-3.5 w-3.5 text-neutral-500" />,
  header: <Layers className="h-3.5 w-3.5 text-indigo-400" />,
  footer: <Layers className="h-3.5 w-3.5 text-indigo-400" />,
  nav: <Layers className="h-3.5 w-3.5 text-indigo-400" />,
  main: <Layers className="h-3.5 w-3.5 text-indigo-400" />,
}

const FONT_OPTIONS = [
  { label: 'System UI', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Monospace', value: 'ui-monospace, "Cascadia Code", monospace' },
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Roboto', value: 'Roboto, system-ui, sans-serif' },
]

const SIZE_OPTIONS = ['10px','12px','14px','16px','18px','20px','24px','28px','32px','36px','40px','48px','56px','64px','72px']

function rgbToHex(rgb: string): string {
  const s = rgb.trim()
  if (s.startsWith('#')) return s.slice(0, 7)
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) return '#1a1a1a'
  const to = (n: number) => Number(n).toString(16).padStart(2, '0')
  return `#${to(Number(m[1]))}${to(Number(m[2]))}${to(Number(m[3]))}`
}

// Build a safe DOM tree from the iframe document (skip script/style/meta etc)
const SKIP_TAGS = new Set(['script','style','meta','link','noscript','head','#text','#comment','SCRIPT','STYLE','META','LINK','NOSCRIPT'])
const MEANINGFUL_TAGS = new Set(['body','div','section','article','main','header','footer','nav','aside','h1','h2','h3','h4','h5','h6','p','span','a','button','ul','ol','li','table','tr','td','th','img','svg','figure','figcaption','blockquote','form','input','label','select','textarea'])

let _nodeCounter = 0
function buildTree(el: Element, depth = 0): TreeNode | null {
  const tag = el.tagName?.toLowerCase() ?? ''
  if (SKIP_TAGS.has(tag) || SKIP_TAGS.has(el.tagName)) return null
  if (depth > 12) return null

  // Only include meaningful tags to keep tree clean
  const isMeaningful = MEANINGFUL_TAGS.has(tag)
  if (!isMeaningful && depth > 0) return null

  const id = `mn-${++_nodeCounter}`
  el.setAttribute('data-mn-id', id)

  const directText = Array.from(el.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => n.textContent?.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 40)

  const label = tag === 'img'
    ? (el.getAttribute('alt') || el.getAttribute('src')?.split('/').pop() || 'image').slice(0, 30)
    : directText
      ? `${tag} · "${directText}${directText.length >= 40 ? '…' : ''}"`
      : (el.id ? `${tag}#${el.id}` : el.className ? `${tag}.${String(el.className).split(' ')[0]}` : tag)

  const children: TreeNode[] = []
  for (const child of Array.from(el.children)) {
    const sub = buildTree(child as Element, depth + 1)
    if (sub) children.push(sub)
  }

  return {
    id,
    tag,
    label,
    children,
    hasText: !!directText || ['h1','h2','h3','h4','h5','h6','p','span','button','a','li'].includes(tag),
    isImage: tag === 'img' || tag === 'svg',
    isContainer: children.length > 0,
  }
}

// ─── TreeItem ─────────────────────────────────────────────────────────────────

function TreeItem({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: TreeNode
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const isSelected = selectedId === node.id
  const hasChildren = node.children.length > 0

  return (
    <div className="min-w-0 w-full">
      <div
        className={cn(
          'flex min-w-0 items-center gap-1 rounded px-1 py-[3px] cursor-pointer select-none group',
          'hover:bg-neutral-800/70 transition-colors',
          isSelected && 'bg-violet-600/20 border border-violet-500/40',
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            className="shrink-0 text-neutral-500 hover:text-neutral-300"
            onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="shrink-0">
          {TAG_ICONS[node.tag] ?? <Square className="h-3.5 w-3.5 text-neutral-600" />}
        </span>
        <span className={cn(
          'text-xs truncate min-w-0 flex-1',
          isSelected ? 'text-violet-200' : 'text-neutral-400 group-hover:text-neutral-200',
        )}>
          {node.label}
        </span>
      </div>
      {open && hasChildren && (
        <div className="min-w-0 w-full">
          {node.children.map(child => (
            <TreeItem key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PropertyPanel ────────────────────────────────────────────────────────────

function PropertyPanel({
  props,
  onApply,
  onRemoveImage,
}: {
  props: SelectedElementProps
  onApply: (updated: Partial<SelectedElementProps> & { action?: string }) => void
  onRemoveImage: () => void
}) {
  const [text, setText] = useState(props.text ?? '')
  const [font, setFont] = useState(props.fontFamily ?? FONT_OPTIONS[0]!.value)
  const [size, setSize] = useState(props.fontSize ?? '16px')
  const [color, setColor] = useState(props.color ?? '#000000')
  const [bg, setBg] = useState(props.backgroundColor ?? '')
  const [src, setSrc] = useState(props.src ?? '')
  const [alt, setAlt] = useState(props.alt ?? '')
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [fileData, setFileData] = useState<string | null>(null)

  useEffect(() => {
    setText(props.text ?? '')
    setFont(props.fontFamily ?? FONT_OPTIONS[0]!.value)
    setSize(props.fontSize ?? '16px')
    setColor(props.color ?? '#000000')
    setBg(props.backgroundColor ?? '')
    setSrc(props.src ?? '')
    setAlt(props.alt ?? '')
    setFileName('')
    setFileData(null)
  }, [props.id]) // reset when element changes

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = () => {
      setFileData(String(reader.result))
    }
    reader.readAsDataURL(f)
  }

  const isImg = props.isImage || props.tag === 'img'
  const hasText = props.hasText

  const inputCls = 'w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors'
  const labelCls = 'text-xs font-medium text-neutral-400 mb-1 block'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600/20">
          {isImg ? <ImageIcon className="h-4 w-4 text-amber-400" /> : <Type className="h-4 w-4 text-violet-400" />}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">&lt;{props.tag}&gt;</div>
          <div className="text-[10px] text-neutral-500">{props.id}</div>
        </div>
      </div>

      {isImg && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Image</div>
          <div>
            <label className={labelCls}>Alt Text</label>
            <input className={inputCls} value={alt} onChange={e => setAlt(e.target.value)} placeholder="Describe the image…" />
          </div>
          <div>
            <label className={labelCls}>Image URL</label>
            <input className={inputCls} value={src} onChange={e => setSrc(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className={labelCls}>Or upload from computer</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-600 bg-neutral-900/50 py-3 text-sm text-neutral-400 hover:border-violet-500 hover:text-violet-300 transition-colors cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              {fileName ? fileName : 'Choose file…'}
            </button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white"
              onClick={() => {
                if (fileData) onApply({ src: fileData, alt, action: 'img' })
                else if (src) onApply({ src, alt, action: 'img' })
              }}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Apply Image
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-800/50 text-red-400 hover:bg-red-950/30"
              onClick={onRemoveImage}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {hasText && !isImg && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Content</div>
          <div>
            <label className={labelCls}>Text</label>
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Font</label>
              <select className={inputCls} value={font} onChange={e => setFont(e.target.value)}>
                {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Size</label>
              <select className={inputCls} value={size} onChange={e => setSize(e.target.value)}>
                {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Text Color</label>
              <div className="flex gap-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900 p-1" />
                <input className={inputCls} value={color} onChange={e => {
                  if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setColor(e.target.value)
                }} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Background</label>
              <div className="flex gap-2">
                <input type="color" value={bg || '#ffffff'} onChange={e => setBg(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900 p-1" />
                <input className={inputCls} value={bg} placeholder="transparent"
                  onChange={e => setBg(e.target.value)} />
              </div>
            </div>
          </div>
          <Button
            size="sm"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white"
            onClick={() => onApply({ text, fontFamily: font, fontSize: size, color, backgroundColor: bg, action: 'text' })}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Apply Changes
          </Button>
        </div>
      )}

      {!isImg && !hasText && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Container Styles</div>
          <div>
            <label className={labelCls}>Background Color</label>
            <div className="flex gap-2">
              <input type="color" value={bg || '#ffffff'} onChange={e => setBg(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900 p-1" />
              <input className={inputCls} value={bg} placeholder="transparent"
                onChange={e => setBg(e.target.value)} />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white"
            onClick={() => onApply({ backgroundColor: bg, action: 'container' })}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Apply Background
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── ManualEditor (main export) ───────────────────────────────────────────────

export function ManualEditor({ iframeRef, html, onHtmlPatched }: ManualEditorProps) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedProps, setSelectedProps] = useState<SelectedElementProps | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Rebuild tree whenever html changes (new generation or patch)
  const rebuildTree = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body) return
    _nodeCounter = 0
    const bodyNode = buildTree(doc.body, 0)
    setTree(bodyNode ? [bodyNode] : [])
    setSelectedId(null)
    setSelectedProps(null)
  }, [iframeRef])

  // Listen for iframe load to build tree
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const onLoad = () => {
      setTimeout(rebuildTree, 100)
    }
    iframe.addEventListener('load', onLoad)
    // If already loaded
    if (iframe.contentDocument?.readyState === 'complete') rebuildTree()
    return () => iframe.removeEventListener('load', onLoad)
  }, [iframeRef, rebuildTree, html, refreshKey])

  const clearHighlights = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    doc.querySelectorAll('[data-mn-selected]').forEach(el => {
      el.removeAttribute('data-mn-selected')
      ;(el as HTMLElement).style.outline = ''
      ;(el as HTMLElement).style.outlineOffset = ''
    })
  }, [iframeRef])

  const handleSelect = useCallback((id: string) => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    clearHighlights()
    setSelectedId(id)

    const el = doc.querySelector(`[data-mn-id="${id}"]`) as HTMLElement | null
    if (!el) return

    // Highlight
    el.setAttribute('data-mn-selected', '1')
    el.style.outline = '2px solid #7c3aed'
    el.style.outlineOffset = '2px'
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

    const tag = el.tagName.toLowerCase()
    const cs = doc.defaultView?.getComputedStyle(el) ?? null

    const props: SelectedElementProps = {
      id,
      tag,
      isImage: tag === 'img' || tag === 'svg',
      hasText: ['h1','h2','h3','h4','h5','h6','p','span','button','a','li','label','th','td'].includes(tag),
      text: (el as HTMLElement).innerText?.trim(),
      fontFamily: cs?.fontFamily,
      fontSize: cs ? nearestSize(cs.fontSize) : '16px',
      color: cs ? rgbToHex(cs.color) : '#000000',
      backgroundColor: cs?.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? rgbToHex(cs.backgroundColor) : '',
      src: (el as HTMLImageElement).src ?? '',
      alt: (el as HTMLImageElement).alt ?? '',
    }
    setSelectedProps(props)
  }, [iframeRef, clearHighlights])

  function nearestSize(computed: string) {
    const px = computed.match(/^([\d.]+)px$/)
    if (!px) return '16px'
    const n = parseFloat(px[1]!)
    let best = '16px', bestD = Infinity
    for (const s of SIZE_OPTIONS) {
      const d = Math.abs(parseFloat(s) - n)
      if (d < bestD) { bestD = d; best = s }
    }
    return best
  }

  const handleApply = useCallback((updates: Partial<SelectedElementProps> & { action?: string }) => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !selectedId) return

    const el = doc.querySelector(`[data-mn-id="${selectedId}"]`) as HTMLElement | null
    if (!el) return

    if (updates.action === 'img' && updates.src) {
      ;(el as HTMLImageElement).src = updates.src
      if (updates.alt !== undefined) (el as HTMLImageElement).alt = updates.alt
    } else if (updates.action === 'text') {
      if (updates.text !== undefined) el.innerText = updates.text
      if (updates.fontFamily) el.style.fontFamily = updates.fontFamily
      if (updates.fontSize) el.style.fontSize = updates.fontSize
      if (updates.color) el.style.color = updates.color
      if (updates.backgroundColor !== undefined) el.style.backgroundColor = updates.backgroundColor || ''
    } else if (updates.action === 'container') {
      if (updates.backgroundColor !== undefined) el.style.backgroundColor = updates.backgroundColor || ''
    }

    // Push the updated HTML back
    const root = iframeRef.current?.contentDocument?.documentElement
    if (root) onHtmlPatched(root.outerHTML)
  }, [iframeRef, selectedId, onHtmlPatched])

  const handleRemoveImage = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !selectedId) return
    const el = doc.querySelector(`[data-mn-id="${selectedId}"]`)
    if (!el) return
    el.parentElement?.removeChild(el)
    setSelectedId(null)
    setSelectedProps(null)
    const root = iframeRef.current?.contentDocument?.documentElement
    if (root) onHtmlPatched(root.outerHTML)
    setTimeout(rebuildTree, 100)
  }, [iframeRef, selectedId, onHtmlPatched, rebuildTree])

  const handleRefresh = () => {
    setRefreshKey(k => k + 1)
    setTimeout(rebuildTree, 200)
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col rounded-xl border border-neutral-800/90 bg-neutral-950/90 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-violet-400" />
          <span className="font-semibold text-white text-sm">Page Structure</span>
        </div>
        <button
          onClick={handleRefresh}
          className="rounded-md p-1 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
          title="Refresh tree"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Tree */}
        <ScrollArea className="flex-1 min-h-[120px] border-b border-neutral-800/50 w-full">
          <div className="py-2 pr-1 w-full overflow-hidden">
            {tree.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-neutral-600 text-xs gap-2">
                <Layers className="h-8 w-8 opacity-30" />
                <span>Generate a page to see the structure</span>
              </div>
            ) : (
              tree.map(node => (
                <TreeItem key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={handleSelect} />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Property/Edit Panel */}
        <ScrollArea className="shrink-0 max-h-[55%]">
          <div className="p-4">
            {selectedProps ? (
              <PropertyPanel
                props={selectedProps}
                onApply={handleApply}
                onRemoveImage={handleRemoveImage}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-neutral-600 text-xs gap-2">
                <X className="h-6 w-6 opacity-20" />
                <span>Select an element above to edit it</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
