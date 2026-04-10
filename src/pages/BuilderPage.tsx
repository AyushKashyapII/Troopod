import {
  ArrowLeft,
  Bot,
  Code2,
  Loader2,
  Monitor,
  PencilRuler,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AdMatchLogo } from '@/components/AdMatchLogo'
import { ManualEditor } from '@/components/ManualEditor'
import { PreviewFrame, type PreviewDevice, type PreviewFrameHandle } from '@/components/PreviewFrame'
import { PublishModal } from '@/components/PublishModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { apiChat, apiGenerate, apiPublish } from '@/lib/api'
import { loadBuilderSession, saveBuilderSession } from '@/lib/session'
import { cn } from '@/lib/utils'

type GenState = {
  landingUrl: string
  imageBase64: string | null
  imageUrl: string | null
  useMock: boolean
  adPreview?: string | null
}

const SURPRISE_PROMPTS = [
  'Make the hero headline bolder and more urgent.',
  'Add a short testimonial quote to the social proof section.',
  'Change the primary CTA to a high-contrast color.',
  'Tighten benefit copy to one line each with stronger verbs.',
  'Add subtle gradient accents to section backgrounds.',
]

function ThinkingDots() {
  return (
    <span className="inline-flex gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-violet-400"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}

export default function BuilderPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as GenState | null | undefined
  const genRef = useRef<GenState | null>(null)

  const [pageTitle, setPageTitle] = useState('My Landing Page')
  const [html, setHtml] = useState('')
  const [originalHtml, setOriginalHtml] = useState('')
  const [landingUrl, setLandingUrl] = useState('')
  const [adPreview, setAdPreview] = useState<string | null>(null)
  const [useMock, setUseMock] = useState(true)

  const [loadingGen, setLoadingGen] = useState(true)
  const [progress, setProgress] = useState(0)
  const [messages, setMessages] = useState<
    { role: 'assistant' | 'user'; content: string }[]
  >([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [viewSource, setViewSource] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [renderBanner, setRenderBanner] = useState(false)
  const [past, setPast] = useState<string[]>([])
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishedSlug, setPublishedSlug] = useState('')
  const [publishedViewUrl, setPublishedViewUrl] = useState('')
  const [publishLoading, setPublishLoading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const initOnce = useRef(false)
  const previewRef = useRef<PreviewFrameHandle>(null)
  // A ref object adapter that ManualEditor can consume; proxies through previewRef → iframe
  const manualIframeRef = {
    get current() { return previewRef.current?.getIframe() ?? null },
  } as unknown as React.RefObject<HTMLIFrameElement>

  const pushHtml = useCallback((next: string) => {
    setHtml((cur) => {
      if (cur && cur !== next) setPast((p) => [...p, cur].slice(-40))
      return next
    })
  }, [])

  const runGenerate = useCallback(
    async (g: GenState) => {
      setLoadingGen(true)
      setRenderBanner(false)
      setProgress(0)
      const started = performance.now()
      const tick = window.setInterval(() => {
        const elapsed = performance.now() - started
        const pct = Math.min(95, (elapsed / 8000) * 95)
        setProgress(pct)
      }, 120)
      try {
        const res = await apiGenerate({
          useMock: g.useMock,
          imageBase64: g.imageBase64,
          imageUrl: g.imageUrl,
          landingUrl: g.landingUrl,
        })
        if (res.scrapeFailed) {
          toast.error("Couldn't read that page — generating from ad only")
        }
        setProgress(100)
        setOriginalHtml(res.html)
        pushHtml(res.html)
        setMessages([{ role: 'assistant', content: res.introMessage }])
        if (res.usedMock && !g.useMock) {
          toast.message('OpenAI key missing — showing mock page')
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Generation failed')
        setMessages([
          {
            role: 'assistant',
            content:
              'Something went wrong while generating. Use Retry or toggle mock mode from home.',
          },
        ])
      } finally {
        window.clearInterval(tick)
        setLoadingGen(false)
      }
    },
    [pushHtml],
  )

  useEffect(() => {
    if (initOnce.current) return
    const restored = loadBuilderSession()
    if (state) {
      initOnce.current = true
      genRef.current = state
      setLandingUrl(state.landingUrl)
      setUseMock(state.useMock)
      setAdPreview(state.adPreview ?? null)
      void runGenerate(state)
      navigate(location.pathname, { replace: true, state: null })
      return
    }
    if (restored && restored.html) {
      initOnce.current = true
      genRef.current = {
        landingUrl: restored.landingUrl,
        imageBase64: null,
        imageUrl: null,
        useMock: restored.useMock ?? true,
        adPreview: restored.adPreview ?? null,
      }
      setPageTitle(restored.pageTitle)
      setLandingUrl(restored.landingUrl)
      setUseMock(restored.useMock ?? true)
      setHtml(restored.html)
      setOriginalHtml(restored.originalHtml)
      setMessages(restored.chatMessages)
      setAdPreview(restored.adPreview ?? null)
      setLoadingGen(false)
      setProgress(100)
      return
    }
    navigate('/')
  }, [navigate, location.pathname, runGenerate, state])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  useEffect(() => {
    if (!html && loadingGen) return
    saveBuilderSession({
      pageTitle,
      html,
      originalHtml,
      landingUrl,
      useMock,
      adPreview,
      chatMessages: messages,
    })
  }, [pageTitle, html, originalHtml, landingUrl, useMock, adPreview, messages, loadingGen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
        return
      e.preventDefault()
      if (past.length === 0) return
      const prev = past[past.length - 1]
      setPast((p) => p.slice(0, -1))
      setHtml(prev)
      toast.message('Undid last change')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [past])

  const sendChat = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || chatLoading || loadingGen) return
    setChatInput('')
    setMessages((m) => [...m, { role: 'user', content: trimmed }])
    setChatLoading(true)
    setRenderBanner(false)
    try {
      const res = await apiChat({
        useMock,
        html,
        message: trimmed,
      })
      pushHtml(res.html)
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: 'Done — preview updated with your request.',
        },
      ])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Edit failed')
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'I could not apply that. Try rephrasing.' },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const surprise = () => {
    const pick = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)]
    void sendChat(pick)
  }

  const undo = () => {
    if (past.length === 0) {
      toast.message('Nothing to undo')
      return
    }
    const prev = past[past.length - 1]
    setPast((p) => p.slice(0, -1))
    setHtml(prev)
    toast.message('Undid last change')
  }

  const resetOriginal = () => {
    setPast([])
    setHtml(originalHtml)
    toast.success('Restored AI first draft')
  }

  const publish = async () => {
    if (!html.trim()) return
    setPublishLoading(true)
    try {
      const res = await apiPublish(html)
      setPublishedSlug(res.slug)
      setPublishedViewUrl(res.viewUrl)
      setPublishOpen(true)
      toast.success('Published')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setPublishLoading(false)
    }
  }

  const retryGen = () => {
    const g = genRef.current
    if (!g) {
      navigate('/')
      return
    }
    void runGenerate(g)
  }

  const chatPanel = (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-neutral-800/90 bg-neutral-950/90 shadow-sm">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3 shrink-0">
        <Bot className="h-4 w-4 text-violet-400" />
        <span className="font-semibold text-white text-sm">AI Agent</span>
        <span
          className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse-dot ml-1"
          title="Ready"
        />
      </div>
      <ScrollArea className="min-h-[200px] flex-1 px-3 py-3 md:min-h-0">
        <div className="space-y-3 pr-2">
          {messages.length === 0 && !loadingGen ? (
            <p className="text-sm text-neutral-500">No messages yet.</p>
          ) : null}
          {messages.map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={cn(
                'rounded-lg px-3 py-2 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'ml-4 bg-violet-600/25 text-violet-100'
                  : 'mr-4 bg-neutral-900 text-neutral-300',
              )}
            >
              {m.content}
            </div>
          ))}
          {chatLoading ? (
            <div className="mr-4 flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-neutral-400">
              Thinking
              <ThinkingDots />
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="border-t border-neutral-800 p-3">
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Make the headline bigger…"
            value={chatInput}
            disabled={chatLoading || loadingGen}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendChat(chatInput)
              }
            }}
          />
          <Button
            type="button"
            variant="gradient"
            size="icon"
            className="btn-scale shrink-0"
            disabled={chatLoading || loadingGen}
            onClick={() => void sendChat(chatInput)}
          >
            {chatLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="btn-scale mt-2 w-full text-neutral-400 hover:text-white"
          disabled={chatLoading || loadingGen}
          onClick={surprise}
        >
          <Sparkles className="h-4 w-4" />
          Surprise Me
        </Button>
      </div>
    </div>
  )

  // Tabbed left panel: AI Agent + Manual Edit
  const leftPanel = (
    <div className="flex min-h-0 flex-col h-full">
      <Tabs defaultValue="ai" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="grid w-full grid-cols-2 mb-3 shrink-0 rounded-xl bg-neutral-900 border border-neutral-800">
          <TabsTrigger
            value="ai"
            className="flex items-center gap-1.5 rounded-lg text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white"
          >
            <Bot className="h-3.5 w-3.5" />
            AI Agent
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            className="flex items-center gap-1.5 rounded-lg text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white"
          >
            <PencilRuler className="h-3.5 w-3.5" />
            Edit Manually
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ai" className="min-h-0 flex-1 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          {chatPanel}
        </TabsContent>
        <TabsContent value="manual" className="min-h-0 flex-1 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <ManualEditor
            iframeRef={manualIframeRef}
            html={html}
            onHtmlPatched={(docHtml) => pushHtml(docHtml)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )

  const previewToolbar = (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex rounded-lg border border-neutral-700 bg-neutral-900/90 p-0.5 shadow-sm">
        <Button
          type="button"
          size="sm"
          variant={device === 'desktop' ? 'secondary' : 'ghost'}
          className="btn-scale h-9 px-3"
          onClick={() => setDevice('desktop')}
        >
          <Monitor className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">Desktop</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant={device === 'tablet' ? 'secondary' : 'ghost'}
          className="btn-scale h-9 px-3"
          onClick={() => setDevice('tablet')}
        >
          <Tablet className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">Tablet</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant={device === 'mobile' ? 'secondary' : 'ghost'}
          className="btn-scale h-9 px-3"
          onClick={() => setDevice('mobile')}
        >
          <Smartphone className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">Mobile</span>
        </Button>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="btn-scale"
            onClick={() => setRefreshNonce((n) => n + 1)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refresh preview</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant={viewSource ? 'secondary' : 'outline'}
            className="btn-scale"
            onClick={() => setViewSource((v) => !v)}
          >
            <Code2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View source</TooltipContent>
      </Tooltip>
      <span className="ml-auto hidden text-xs text-neutral-500 lg:inline">
        Click image → URL or file · click text → font, size, color & copy · dashed strip = your ad if
        the page had no images
      </span>
    </div>
  )

  const previewPanel = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {renderBanner ? (
        <button
          type="button"
          onClick={retryGen}
          className="mb-3 w-full rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-left text-sm text-amber-100 hover:bg-amber-950/60"
        >
          Generation had an issue — click to retry
        </button>
      ) : null}
      {previewToolbar}
      {loadingGen ? (
        <div className="space-y-4 rounded-xl border border-neutral-800 bg-white p-6">
          <p className="text-center text-sm font-medium text-neutral-600">
            Building your personalized page…
          </p>
          <Progress value={progress} />
          <div className="space-y-3">
            <div className="skeleton-shimmer h-10 w-2/3 rounded-lg bg-neutral-200" />
            <div className="skeleton-shimmer h-4 w-full rounded bg-neutral-200" />
            <div className="skeleton-shimmer h-4 w-5/6 rounded bg-neutral-200" />
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="skeleton-shimmer h-24 rounded-lg bg-neutral-200" />
              <div className="skeleton-shimmer h-24 rounded-lg bg-neutral-200" />
              <div className="skeleton-shimmer h-24 rounded-lg bg-neutral-200" />
            </div>
          </div>
        </div>
      ) : (
        <PreviewFrame
          ref={previewRef}
          key={refreshNonce}
          html={html}
          device={device}
          viewSource={viewSource}
          heroCreativeSrc={adPreview}
          onHtmlPatched={(docHtml) => pushHtml(docHtml)}
          onRenderConcern={() => setRenderBanner(true)}
        />
      )}
    </div>
  )

  return (
    <TooltipProvider>
      <div className="bg-grid flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-neutral-950/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-3 px-4 py-3.5 md:flex-nowrap md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="btn-scale shrink-0"
                onClick={() => navigate('/')}
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <AdMatchLogo className="hidden sm:flex" />
              {adPreview ? (
                <img
                  src={adPreview}
                  alt=""
                  className="ml-1 h-9 w-9 rounded-md border border-neutral-700 object-cover"
                />
              ) : null}
            </div>
            <div className="order-last flex w-full basis-full justify-center md:order-none md:w-auto md:basis-auto md:flex-1">
              <Input
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                className="max-w-md border-neutral-700 bg-neutral-900 text-center font-medium"
              />
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="btn-scale"
                onClick={undo}
              >
                <Undo2 className="h-4 w-4" />
                Undo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="btn-scale"
                onClick={resetOriginal}
              >
                Reset to Original
              </Button>
              <Button
                type="button"
                variant="gradient"
                size="sm"
                className="btn-scale font-semibold"
                disabled={publishLoading || loadingGen || !html}
                onClick={() => void publish()}
              >
                {publishLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Publish →
              </Button>
            </div>
          </div>
        </header>

        {/* Desktop split: minmax(0,1fr) lets preview use full remaining width */}
        <div className="mx-auto hidden min-h-0 flex-1 gap-6 p-5 md:grid md:max-w-[1680px] md:grid-cols-[minmax(300px,34%)_minmax(0,1fr)] md:items-start md:gap-8 md:p-6">
          <div className="flex min-h-0 min-w-0 md:sticky md:top-[4.25rem] md:h-[calc(100dvh-4.5rem)] md:self-start">
            {leftPanel}
          </div>
          <div className="min-w-0">{previewPanel}</div>
        </div>

        {/* Mobile tabs */}
        <div className="flex min-h-0 flex-1 flex-col p-4 md:hidden">
          <Tabs defaultValue="ai" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ai">AI Agent</TabsTrigger>
              <TabsTrigger value="manual">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="ai" className="mt-3 min-h-[50vh] flex-1">
              {chatPanel}
            </TabsContent>
            <TabsContent value="manual" className="mt-3 min-h-[50vh] flex-1">
              <ManualEditor
                iframeRef={manualIframeRef}
                html={html}
                onHtmlPatched={(docHtml) => pushHtml(docHtml)}
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-3 min-h-[50vh] flex-1 overflow-auto">
              {previewPanel}
            </TabsContent>
          </Tabs>
        </div>

        <PublishModal
          open={publishOpen}
          slug={publishedSlug}
          viewUrl={publishedViewUrl}
          html={html}
          onClose={() => setPublishOpen(false)}
          onEditAgain={() => setPublishOpen(false)}
        />
      </div>
    </TooltipProvider>
  )
}
