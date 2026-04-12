import OpenAI from 'openai'
import { MOCK_AD_ANALYSIS, MOCK_HTML, MOCK_INTRO_MESSAGE, mockChatResponse } from './mock'

// ─── SYSTEM PROMPTS ──────────────────────────────────────────────────────────

const visionSystem = `You are an expert creative director and OCR analyst. Study the ENTIRE ad image carefully.

Return ONE valid JSON object only — no markdown, no fences. Be exhaustive.

Required keys:
- headline_text: string (main headline, largest visible text)
- subheadline_text: string | null
- supporting_copy_lines: string[] (every other readable line, top-to-bottom)
- cta_button_text: string | null (exact CTA if visible)
- fine_print: string[] (legal, disclaimers — empty if none)
- logo_or_brand_text: string | null
- primary_colors_hex: string[] (3–5 dominant hex codes, most important first)
- secondary_accent_hex: string[]
- tone: string (one word: urgent | playful | luxurious | minimal | bold | calm | professional)
- mood_keywords: string[] (5–8 words)
- visual_style: string (photo | illustration | 3D | flat-graphic | mixed)
- product_or_service_name: string
- target_audience: string
- value_proposition: string (core promise in one sentence)
- has_human_faces: boolean
- has_product_shot: boolean
- key_phrases_verbatim: string[] (exact short strings as they appear)
- typography_on_image: string (serif/sans, weight, casing)
- offer_structure: string | null (e.g. "percent off", "free trial", "bundle")
- urgency_or_scarcity_cues: string[] (empty if none)
- stock_photo_search_queries: string[] (6 short English queries matching the product/lifestyle for Unsplash)
- inferred_industry_vertical: string (e.g. "consumer electronics", "fitness SaaS", "DTC skincare")`

// ─── CRITICAL FIX: Split the generator into TWO clear priorities.
// Old prompt tried to do "match reference site AND use ad colors" simultaneously — model compromised both.
// New approach: brand shell from reference URL, ad messaging as overlay. Much cleaner mental model for the model.
const generatorSystem = `You are a senior front-end engineer building a high-converting marketing landing page.

## YOUR TWO INPUTS HAVE DIFFERENT JOBS

**BRAND_DESIGN_SPEC_JSON** → controls the SHELL:
  fonts, background colors, surface colors, border-radius, shadow style, nav layout, section spacing.
  Implement these literally. The page should feel like it belongs to the reference website.

**AD_ANALYSIS_JSON** → controls the CONTENT LAYER overlaid on that shell:
  headline, subheadline, CTA label, tone, urgency, bullet benefits, hero image.
  Ad's primary_colors_hex[0] is used ONLY on CTA buttons and key accents — not the background.

Think of it as: "What if the reference site ran a campaign for this ad?"

---

## ABSOLUTE REQUIREMENTS (violations = immediate retry)

1. OUTPUT a single complete HTML document. Starts with <!DOCTYPE html>. Ends with </html>. Nothing else.
2. ALL CSS in one <style> block in <head>. No external CSS frameworks.
3. NO <iframe>, <object>, <embed>, or <meta http-equiv="refresh"> — ever.
4. HERO must contain: an <h1>, at least 2 sentences of subtext, and a CTA <button> or <a>.
5. If HERO_IMAGE_SRC is provided, include it as <img src="EXACT_SRC_VALUE"> in the hero. Do not omit it.
6. At minimum 150 words of visible body copy (not counting nav labels).
7. Page must look correct at 1280px wide desktop. Inner content: max-width: 1140px; margin: 0 auto.
8. Mobile responsive via @media (max-width: 768px).

---

## REQUIRED PAGE SECTIONS (all 5, no exceptions)

### 1. NAV
- Horizontal flex bar (NOT a vertical stack of blue links)
- Brand name/logo on left, links on right
- Use BRAND_DESIGN_SPEC nav_background and link colors
- Links: <a href="#features">, <a href="#cta"> etc — no localhost links

### 2. HERO (100vh or min-height: 600px)
- Layout: 2-column split on desktop (text left, image right) OR full-bleed depending on hero_pattern in BRAND_DESIGN_SPEC
- H1: headline from AD_ANALYSIS, font-size clamp(40px, 5.5vw, 68px), font-weight: 800, line-height: 1.1
- Subtext: 2–3 sentences from value_proposition + supporting_copy_lines
- CTA button: exact cta_button_text from AD_ANALYSIS, background = ad primary_colors_hex[0], color = white, padding: 16px 36px, border-radius from brand spec, font-size: 18px, font-weight: 700
- Hero image: <img src="HERO_IMAGE_SRC"> if provided, max-height: 520px, border-radius: 16px, object-fit: cover, box-shadow: 0 20px 60px rgba(0,0,0,0.15)
- Trust row below CTA: 3 small items with emoji icons (e.g. "✓ Free shipping", "★ 4.8 rated", "🔒 Secure checkout")

### 3. FEATURES GRID (3 cards, CSS grid 1fr 1fr 1fr)
- Section heading: "Why [product_or_service_name]?" — large, centered
- Each card: 1 relevant emoji icon, bold title (from key_benefits or mood_keywords), 2-sentence description
- Each card includes an <img> from Unsplash using stock_photo_search_queries:
  https://images.unsplash.com/photo-[REAL-PHOTO-ID]?w=600&q=80&auto=format&fit=crop
  Use REAL Unsplash photo IDs that match the industry. Examples:
  - Tech/phones: photo-1512941937938-a37f7cf3a1e4, photo-1574944985070-8f3ebc6b79d2
  - Fashion: photo-1483985988355-763728e1935b, photo-1490481651871-ab68de25d43d
  - Fitness: photo-1517836357463-d25dfeac3438, photo-1571019614242-c5c5dee9f50b
  - Food: photo-1504674900247-0877df9cc836, photo-1567620905732-2d1ec7ab7445
  - Business: photo-1521791136064-7986c2920216, photo-1552664730-d307ca884978
  Match the query to the ad's inferred_industry_vertical.
- Card style: background white or surface_card from brand spec, border-radius from spec, box-shadow: 0 4px 20px rgba(0,0,0,0.08), overflow: hidden
- Card image: width 100%, height: 200px, object-fit: cover
- Card hover: transform: translateY(-6px), transition: 0.25s ease

### 4. CLOSING CTA BAND (full-width)
- Background: ad primary_colors_hex[0]
- Large centered headline: "Ready to [value_proposition short version]?"
- 1 line urgency subtext (use urgency_or_scarcity_cues if present, else "Join thousands of happy customers")
- White CTA button with ad-color text
- Optional: countdown timer div styled as "⏰ Offer ends soon"

### 5. FOOTER
- Dark background (#111 or brand dark)
- Brand name left, 3 links right: Privacy · Terms · Contact
- Copyright line: "© 2025 [brand name]. All rights reserved."
- White text at 60% opacity

---

## MICRO-INTERACTIONS (include ALL)

\`\`\`css
/* Add to <style> */
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }

/* CTA pulse */
@keyframes pulse-cta { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
.cta-primary { animation: pulse-cta 2.5s ease-in-out infinite; }
.cta-primary:hover { animation: none; transform: scale(1.05); }

/* Card hover */
.feature-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
.feature-card:hover { transform: translateY(-6px); box-shadow: 0 12px 40px rgba(0,0,0,0.15); }

/* Hero fade-in */
@keyframes fadeUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
.hero-content { animation: fadeUp 0.75s ease forwards; }
\`\`\`

---

## FONT LOADING (MANDATORY)
Extract font_family_heading from BRAND_DESIGN_SPEC. If it references a Google Font:
\`<link rel="preconnect" href="https://fonts.googleapis.com">\`
\`<link href="https://fonts.googleapis.com/css2?family=FONT_NAME:wght@400;600;700;800&display=swap" rel="stylesheet">\`
Apply the font to all headings and body via CSS custom properties.

---

## BRAND FIDELITY CHECKLIST — verify before outputting
- [ ] page_background from BRAND_DESIGN_SPEC applied to <body> background
- [ ] nav_background from BRAND_DESIGN_SPEC applied to <nav>
- [ ] font_family_heading from BRAND_DESIGN_SPEC on all h1/h2/h3
- [ ] surface_card from BRAND_DESIGN_SPEC on feature cards
- [ ] border_radius_base from BRAND_DESIGN_SPEC on cards, buttons
- [ ] Ad primary_colors_hex[0] ONLY on CTA buttons and closing band — nowhere else

---

## WHAT NOT TO DO
❌ Never output a page with only a nav and blank space below it
❌ Never use plain white (#fff) for the entire hero background — use a gradient or the brand background color
❌ Never use placeholder text like "Lorem ipsum" or "[Insert headline here]"
❌ Never use relative image paths or example.com image URLs
❌ Never output markdown, explanation text, or code fences — HTML only
❌ Never ignore BRAND_DESIGN_SPEC colors and fonts — they are the law`

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function stripCodeFences(s: string): string {
  return s
    .replace(/^```(?:html|json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

/**
 * FIX: Raised minimum thresholds significantly.
 * Old: 45 words / 200 chars. New: 100 words / 600 chars.
 * Also checks for at least 1 CTA button/link, not just an h1.
 */
export function isGeneratedHtmlDegenerate(html: string, hadHeroImage: boolean): boolean {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const bodyMatch = stripped.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const inner = bodyMatch ? bodyMatch[1] : stripped
  const text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const wordCount = text.split(/\s+/).filter(Boolean).length

  // Hard minimums
  if (wordCount < 100) return true
  if (text.length < 600) return true
  if (!(html.match(/<h1\b/gi) ?? []).length) return true
  if (hadHeroImage && !(html.match(/<img\b/gi) ?? []).length) return true

  // Must have at least one CTA
  const hasCta =
    /<button\b/i.test(html) ||
    /<a\b[^>]*class="[^"]*cta/i.test(html) ||
    /<a\b[^>]*btn/i.test(html)
  if (!hasCta) return true

  // Black void: dark background with almost no content
  const lower = html.toLowerCase()
  const hasDarkBg =
    lower.includes('background:#000') ||
    lower.includes('background: #000') ||
    lower.includes('background:black') ||
    lower.includes('background-color:#000') ||
    lower.includes('background-color:#111') ||
    lower.includes('background:#0a0a0a')
  if (hasDarkBg && wordCount < 120) return true

  // Must have at least 2 sections (nav + hero at minimum)
  const sectionCount = (html.match(/<section\b|<div\b[^>]*id="/gi) ?? []).length
  if (sectionCount < 2) return true

  return false
}

/** When Jina returns little text (SPA sites like Apple), steer layout from the URL. */
export function referenceSiteGuidance(landingUrl: string, pageText: string): string {
  let host = ''
  try {
    const u = new URL(landingUrl.startsWith('http') ? landingUrl : `https://${landingUrl}`)
    host = u.hostname.toLowerCase()
  } catch {
    host = landingUrl.toLowerCase()
  }

  const thin = pageText.trim().length < 3500
  const parts: string[] = []

  if (host.includes('apple.')) {
    parts.push(
      'REFERENCE IS APPLE: Use Apple marketing aesthetic — background #f5f5f7 or #ffffff, text #1d1d1f, font: -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif. Minimal top nav (text links only, hairline bottom border). Large editorial hero (text left, image right). Below: 3-column feature grid, wide CTA band, slim footer. Ad colors on CTA buttons and accents ONLY — not the page background.',
    )
  } else if (host.includes('samsung.')) {
    parts.push(
      'REFERENCE IS SAMSUNG: Dark navy/black shell (#1c1c1c background), white text, blue accents (#1428A0). Bold product-forward hero. Tech grid layout.',
    )
  } else if (host.includes('nike.') || host.includes('adidas.')) {
    parts.push(
      'REFERENCE IS SPORTSWEAR BRAND: Bold full-bleed hero, heavy sans-serif (Futura/Impact style), high contrast black/white shell, ad color as accent. Athletic energy.',
    )
  }

  if (thin) {
    parts.push(
      'SCRAPE IS THIN (JS-heavy site): Infer brand-appropriate marketing layout from the URL hostname. Still output a COMPLETE filled page with all 5 required sections. Do not skip sections because data is thin.',
    )
  }

  return parts.join('\n\n')
}

/** Data-URL or https URL suitable for <img src>. */
export function resolveHeroImageSrc(
  imageBase64: string | null,
  imageUrl: string | null,
): string | null {
  if (imageBase64?.startsWith('data:')) return imageBase64
  if (imageBase64?.trim()) {
    const t = imageBase64.trim()
    if (!t.includes('data:') && /^[A-Za-z0-9+/=\s]+$/.test(t.slice(0, 200))) {
      return `data:image/jpeg;base64,${t.replace(/\s/g, '')}`
    }
    return t
  }
  return imageUrl?.trim() || null
}

/** Merge default Reader output + markdown variant for richer structure on SPAs. */
export async function fetchJinaPage(url: string): Promise<{ ok: boolean; text: string }> {
  try {
    const u = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
    const endpoint = `https://r.jina.ai/${encodeURIComponent(u)}`
    const baseHeaders: Record<string, string> = {
      Accept: 'text/plain',
      'X-Timeout': '25',
    }

    const pull = async (extra: Record<string, string> = {}) => {
      const res = await fetch(endpoint, {
        headers: { ...baseHeaders, ...extra },
        signal: AbortSignal.timeout(25000),
      })
      if (!res.ok) return ''
      return await res.text()
    }

    const [primary, markdown] = await Promise.all([
      pull(),
      pull({ 'X-Return-Format': 'markdown' }).catch(() => ''),
    ])

    const chunks: string[] = []
    if (primary.trim()) chunks.push(primary.trim())
    if (markdown.trim() && markdown.trim() !== primary.trim()) {
      chunks.push('--- JINA_MARKDOWN ---\n' + markdown.trim())
    }

    const merged = chunks.join('\n\n')
    return { ok: merged.length > 0, text: merged.slice(0, 180_000) }
  } catch {
    return { ok: false, text: '' }
  }
}

/**
 * Fetch the raw HTML of a page so we can extract real CSS design tokens.
 * We use Jina's html format to get a clean rendition of the source.
 * Falls back gracefully to an empty string if anything fails.
 */
export async function fetchPageRawHtml(url: string): Promise<string> {
  try {
    const u = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
    // Jina with X-Return-Format: html gives us the actual page HTML
    const endpoint = `https://r.jina.ai/${encodeURIComponent(u)}`
    const res = await fetch(endpoint, {
      headers: {
        Accept: 'text/html',
        'X-Return-Format': 'html',
        'X-Timeout': '20',
      },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    // Extract just the style blocks and relevant attributes — trim to 60k chars
    return html.slice(0, 60_000)
  } catch {
    // Fallback: try direct fetch with a browser-like UA
    try {
      const u = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
      const res = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return ''
      return (await res.text()).slice(0, 60_000)
    } catch {
      return ''
    }
  }
}

/**
 * Extract visual design tokens from raw page HTML/CSS text.
 * Returns a structured string summary of colors, fonts, border-radii found.
 */
export function extractVisualTokensFromHtml(rawHtml: string): string {
  if (!rawHtml) return ''

  const findings: string[] = []

  // Extract colors from CSS (hex codes)
  const hexColors = [...new Set(
    (rawHtml.match(/#([0-9a-fA-F]{3}){1,2}\b/g) ?? [])
      .filter(c => {
        // Filter out very dark/light trivial colors only if we have many others
        const h = c.slice(1).padEnd(6, c.slice(1))
        const r = parseInt(h.slice(0,2),16)
        const g = parseInt(h.slice(2,4),16)
        const b = parseInt(h.slice(4,6),16)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        return brightness > 10 && brightness < 245 // exclude pure black/white
      })
  )].slice(0, 20)
  if (hexColors.length > 0) findings.push(`Actual page hex colors (from CSS): ${hexColors.join(', ')}`)

  // Extract font-family declarations
  const fontMatches = [...new Set(
    (rawHtml.match(/font-family\s*:\s*([^;}"']+)/gi) ?? [])
      .map(m => m.replace(/font-family\s*:\s*/i, '').trim().slice(0, 80))
  )].slice(0, 6)
  if (fontMatches.length > 0) findings.push(`Actual CSS font-family values: ${fontMatches.join(' | ')}`)

  // Extract Google Fonts links (very reliable signal)
  const gFonts = (rawHtml.match(/fonts\.googleapis\.com\/css[^"'\s>]+/g) ?? []).slice(0, 3)
  if (gFonts.length > 0) findings.push(`Google Fonts loaded: ${gFonts.join(', ')}`)

  // Extract border-radius values
  const radii = [...new Set(
    (rawHtml.match(/border-radius\s*:\s*([0-9]+(?:\.\d+)?(?:px|rem|em|%))/g) ?? [])
      .map(m => m.replace(/border-radius\s*:\s*/i, '').trim())
  )].slice(0, 5)
  if (radii.length > 0) findings.push(`Border-radius values found: ${radii.join(', ')}`)

  // Detect navbar/header background colors
  const navBg = rawHtml.match(/(?:nav|header|navbar)[^{]*\{[^}]*background(?:-color)?\s*:\s*([^;}\/]+)/gi)
  if (navBg) {
    const navColors = navBg.map(m => {
      const match = m.match(/background(?:-color)?\s*:\s*([^;}\/]+)/i)
      return match?.[1]?.trim()
    }).filter(Boolean).slice(0, 3)
    if (navColors.length) findings.push(`Nav/header background: ${navColors.join(', ')}`)
  }

  // Detect primary button colors
  const btnColors = rawHtml.match(/(?:btn|button|cta)[^{]*\{[^}]*background(?:-color)?\s*:\s*([^;}\/]+)/gi)
  if (btnColors) {
    const colors = btnColors.map(m => {
      const match = m.match(/background(?:-color)?\s*:\s*([^;}\/]+)/i)
      return match?.[1]?.trim()
    }).filter(Boolean).slice(0, 3)
    if (colors.length) findings.push(`Button/CTA background colors: ${colors.join(', ')}`)
  }

  // Meta theme-color
  const themeColor = rawHtml.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)/i)
  if (themeColor?.[1]) findings.push(`Meta theme-color: ${themeColor[1]}`)

  return findings.join('\n')
}

/** Remove embeds that nest the whole app inside the preview. */
export function sanitizeGeneratedHtml(html: string): string {
  return html
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe\b[^>]*/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh[^>]*>/gi, '')
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/**
 * If we have a hero image but the model produced no <img>, inject a visible fallback strip.
 */
export function ensureHeroImgInHtml(html: string, heroSrc: string | null): string {
  const src = heroSrc?.trim()
  if (!src) return html
  if ((html.match(/<img\b/gi) ?? []).length > 0) return html
  if (!/<body[^>]*>/i.test(html)) return html
  const block = `\n<div id="admatch-hero-fallback" style="padding:16px 20px;background:#f1f5f9;border-bottom:2px dashed #64748b;text-align:center;font-family:system-ui,sans-serif;">
<p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#334155;">Your ad creative — click to replace</p>
<img src="${escapeHtmlAttr(src)}" alt="Ad creative" style="max-height:min(360px,50vh);width:auto;max-width:100%;object-fit:contain;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.15);" />
</div>\n`
  return html.replace(/<body[^>]*>/i, (open) => open + block)
}

// ─── API CALLS ────────────────────────────────────────────────────────────────

export async function analyzeAdWithVision(
  openai: OpenAI,
  imageBase64: string | null,
  imageUrl: string | null,
): Promise<unknown> {
  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: 'text', text: 'Analyze this ad image and return the JSON as specified.' },
  ]
  if (imageBase64) {
    const url = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`
    parts.unshift({ type: 'image_url', image_url: { url } })
  } else if (imageUrl) {
    parts.unshift({ type: 'image_url', image_url: { url: imageUrl } })
  } else {
    return MOCK_AD_ANALYSIS
  }

  const r = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1, // FIX: Low temp for consistent structured extraction
    messages: [
      { role: 'system', content: visionSystem },
      { role: 'user', content: parts },
    ],
    max_tokens: 3000,
  })
  const text = r.choices[0]?.message?.content ?? '{}'
  try {
    return JSON.parse(stripCodeFences(text))
  } catch {
    return { raw: text }
  }
}

export async function analyzeLandingPageContent(
  openai: OpenAI,
  pageText: string,
  landingUrl: string,
): Promise<string> {
  const excerpt = pageText.slice(0, 80_000)
  let host = ''
  try {
    host = new URL(landingUrl.startsWith('http') ? landingUrl : `https://${landingUrl}`).hostname
  } catch {
    host = landingUrl
  }

  const r = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: `You analyze scraped website text. Return valid JSON only (no markdown).

Keys required:
- page_title_guess: string
- product_or_service_name: string
- one_liner_value_prop: string
- key_benefits: string[] (max 6, short phrases)
- pricing_or_plans_mentioned: string | null
- social_proof: string | null
- trust_signals: string[]
- target_audience: string
- phrases_to_keep_verbatim: string[] (max 10, exact short snippets from source)
- section_blueprint: array of { id: string, role: string, layout_hint: string }
- hero_pattern: "split_image_right" | "split_image_left" | "stacked" | "full_bleed_background" | "minimal_center"
- visual_vibe: string (describe the brand's visual personality)
- whitespace: "tight" | "balanced" | "airy"
- source_color_hints: string[]`,
      },
      {
        role: 'user',
        content: `URL: ${landingUrl}\nHostname: ${host}\n\nPage text:\n${excerpt}`,
      },
    ],
    max_tokens: 2000,
  })
  return stripCodeFences(r.choices[0]?.message?.content ?? '{}')
}

export async function inferReferenceSiteDesign(
  openai: OpenAI,
  landingUrl: string,
  jinaExcerpt: string,
  adJson: unknown,
  imageBase64: string | null,
  imageUrl: string | null,
  visualTokens: string,  // NEW: actual extracted CSS tokens
): Promise<string> {
  const excerpt = jinaExcerpt.slice(0, 16_000)

  const textBlock = `You are extracting a precise brand design specification to replicate in a new HTML page.

REFERENCE_URL (the generated page MUST feel like it belongs to this brand):
${landingUrl}

${ visualTokens ? `=== ACTUAL CSS/VISUAL TOKENS SCRAPED FROM THE SITE ===
These are REAL values from the site's CSS. Use them as ground truth — they override your priors:
${visualTokens}
===\n` : '' }
JINA_TEXT_EXCERPT (content structure — use for layout hints, font names, brand personality):
${excerpt || '(unavailable — use URL hostname as signal for well-known brands)'}

AD_ANALYSIS_JSON (ad colors/tone — do NOT use ad colors for page shell):
${JSON.stringify(adJson, null, 2)}

Your job: produce a faithful brand design spec that, when applied to a marketing landing page,
will make that page LOOK and FEEL like it belongs to ${landingUrl}.

Return valid JSON only (no markdown). Keys:
- brand_identity_guess: string
- confidence: "high" | "medium" | "low"
- font_family_heading: string   // full CSS font-family, e.g. "'Poppins', sans-serif" — USE scraped Google Fonts if available
- font_family_body: string      // full CSS font-family for body text
- colors_hex: {
    page_background: string,    // main page bg — USE scraped color if available
    surface_card: string,       // card/panel background
    text_primary: string,       // main text color
    text_secondary: string,     // secondary/muted text
    nav_background: string,     // nav bar bg — USE scraped nav color if available
    nav_link_color: string,     // nav link text color
    border_subtle: string,      // subtle dividers
    section_alt_background: string  // alternating section bg
  }
- border_radius_base: string    // USE scraped border-radius if available, e.g. "8px"
- shadow_style: string          // e.g. "0 4px 20px rgba(0,0,0,0.08)"
- layout: {
    nav_description: string,    // brief nav bar description
    hero_pattern: string,       // "split_image_right" | "centred" | "full_bleed" etc
    feature_grid_columns: number,
    section_order: string[]
  }
- spacing_density: "tight" | "balanced" | "airy"
- css_notes: string   // 2-4 sentences: how to faithfully implement this brand in CSS, including any unique visual signatures`

  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: 'text', text: textBlock },
  ]
  if (imageBase64?.startsWith('data:')) {
    parts.unshift({ type: 'image_url', image_url: { url: imageBase64 } })
  } else if (imageBase64?.trim()) {
    const t = imageBase64.trim()
    parts.unshift({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${t}` } })
  } else if (imageUrl?.trim()) {
    parts.unshift({ type: 'image_url', image_url: { url: imageUrl.trim() } })
  }

  const r = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content:
          'You are a principal brand and design-systems engineer. When actual CSS tokens are provided (colors, fonts, border-radius), you MUST use them directly — do not guess. Return strictly valid JSON only.',
      },
      { role: 'user', content: parts },
    ],
    max_tokens: 2000,
  })
  return stripCodeFences(r.choices[0]?.message?.content ?? '{}')
}

// FIX: Token — only use if image > 12kb, not 16k chars
const HERO_SRC_TOKEN = '__ADMATCH_HERO_IMAGE_SRC__'
const MAX_HERO_IN_PROMPT = 12_000

function applyHeroTokenReplace(
  html: string,
  heroReplace: { token: string; value: string } | null,
): string {
  if (!heroReplace || !html.includes(heroReplace.token)) return html
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return html.split(heroReplace.token).join(esc(heroReplace.value))
}

export async function generateLandingHtml(
  openai: OpenAI,
  adJson: unknown,
  pageText: string,
  pageUnderstandingJson: string | null,
  scrapeFailed: boolean,
  heroImageSrc: string | null,
  referenceGuidance: string,
  brandDesignJson: string,
): Promise<string> {
  const excerpt = (pageText || '').slice(0, 40_000)

  let imgBlock: string
  let heroReplace: { token: string; value: string } | null = null
  if (heroImageSrc?.trim()) {
    const src = heroImageSrc.trim()
    if (src.length <= MAX_HERO_IN_PROMPT) {
      imgBlock = `HERO_IMAGE_SRC (paste EXACTLY as <img src="..."> value):\n${src}\n`
    } else {
      heroReplace = { token: HERO_SRC_TOKEN, value: src }
      imgBlock = `HERO_IMAGE: Use this exact token as the hero img src (do not modify): ${HERO_SRC_TOKEN}\n`
    }
  } else {
    imgBlock = 'HERO_IMAGE_SRC: none — use a CSS gradient hero background.\n'
  }

  const refBlock = referenceGuidance.trim()
    ? `REFERENCE_GUIDANCE:\n${referenceGuidance}\n\n`
    : ''

  const designBlock = `BRAND_DESIGN_SPEC_JSON (implement literally for fonts/colors/layout):\n${brandDesignJson.trim() || '{}'}\n\n`

  const pageBlock = scrapeFailed || !pageUnderstandingJson
    ? `PAGE_LAYOUT: Scrape unavailable. Use BRAND_DESIGN_SPEC + AD_ANALYSIS for all decisions.\nRAW_EXCERPT (facts only):\n${excerpt || '(none)'}`
    : `PAGE_LAYOUT_JSON:\n${pageUnderstandingJson}\n\nRAW_EXCERPT (facts):\n${excerpt || '(empty)'}`

  const userPrompt = `AD_ANALYSIS_JSON:\n${JSON.stringify(adJson, null, 2)}\n\n${designBlock}${refBlock}${imgBlock}\n${pageBlock}\n\nGenerate the complete landing page HTML now.`

  // FIX: temperature: 0.2 for consistent, high-quality HTML output
  const r = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    messages: [
      { role: 'system', content: generatorSystem },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 8192,
  })
  let html = stripCodeFences(r.choices[0]?.message?.content ?? '')
  html = applyHeroTokenReplace(html, heroReplace)
  return html
}

// FIX: Repair prompt is now ESCALATED — it knows it's a second attempt and gets stricter instructions.
// Old code passed identical prompts twice which obviously didn't help.
const repairSystemBase = `You are fixing a FAILED landing page HTML. The previous AI attempt was rejected.

REJECTION REASON: {REASON}

You MUST output a complete, filled marketing landing page. Absolute requirements:
1. <!DOCTYPE html> ... </html> — complete document, all CSS inline in <style>
2. NO <iframe>, <object>, <embed>, meta refresh
3. Nav + Hero (h1, subcopy ≥2 sentences, CTA button) + Features grid (3 tiles) + CTA band + Footer
4. If HERO_IMAGE_SRC provided: include <img src="EXACT_VALUE"> in hero
5. Minimum 150 words of visible copy
6. Real Unsplash https:// image URLs for feature tiles (not placeholders)
7. Page must look like a real marketing site at 1280px wide

Apply BRAND_DESIGN_SPEC_JSON literally. Ad's primary color on CTA buttons only.

Return full HTML only. No markdown. No explanation.`

export async function repairLandingHtml(
  openai: OpenAI,
  brokenHtml: string,
  adJson: unknown,
  pageUnderstandingJson: string | null,
  heroImageSrc: string | null,
  referenceGuidance: string,
  brandDesignJson: string,
  // FIX: Added attemptNumber so we can escalate instructions
  attemptNumber: number = 1,
): Promise<string> {
  let imgLine = ''
  let heroReplace: { token: string; value: string } | null = null
  if (heroImageSrc?.trim()) {
    const src = heroImageSrc.trim()
    if (src.length <= MAX_HERO_IN_PROMPT) {
      imgLine = `HERO_IMAGE_SRC:\n${src}\n`
    } else {
      heroReplace = { token: HERO_SRC_TOKEN, value: src }
      imgLine = `HERO_IMAGE: use src="${HERO_SRC_TOKEN}" on hero img.\n`
    }
  }

  // FIX: Escalate rejection reason message for second attempt
  const reason =
    attemptNumber === 1
      ? 'The page was nearly empty, missing h1, missing hero image, or had a black void with no content.'
      : 'TWO previous attempts failed. This is your FINAL attempt. The output must be a fully populated page — do not hold back. Include all sections. Do not output an empty or minimal page under any circumstances.'

  const systemPrompt = repairSystemBase.replace('{REASON}', reason)

  const user = `Previous broken output (do NOT copy its emptiness — rebuild from scratch):\n${brokenHtml.slice(0, 6000)}\n\nAD_ANALYSIS_JSON:\n${JSON.stringify(adJson, null, 2)}\n\nBRAND_DESIGN_SPEC_JSON:\n${brandDesignJson || '{}'}\n\nPAGE_LAYOUT_JSON:\n${pageUnderstandingJson ?? '{}'}\n\nREFERENCE_GUIDANCE:\n${referenceGuidance || '(none)'}\n\n${imgLine}\nOutput the fixed, complete HTML document now.`

  const r = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: attemptNumber === 1 ? 0.2 : 0.4, // FIX: Slightly higher temp on retry for different output
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: user },
    ],
    max_tokens: 8192,
  })
  let html = stripCodeFences(r.choices[0]?.message?.content ?? '')
  html = applyHeroTokenReplace(html, heroReplace)
  return html
}

export async function buildIntroMessage(
  openai: OpenAI,
  adJson: unknown,
  pageUnderstandingJson: string | null,
  scrapeFailed: boolean,
  brandDesignJson: string,
): Promise<string> {
  const ctx = scrapeFailed
    ? 'URL scrape was unavailable; design inferred from the URL + ad image.'
    : 'Page content was successfully scraped and used for facts and structure.'

  const r = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.5,
    messages: [
      {
        role: 'system',
        content:
          'You are AdMatch. In 2–4 short friendly sentences, tell the user what you built and why — mentioning the headline you used, the CTA, and the brand style. Be specific, not generic. No markdown headings.',
      },
      {
        role: 'user',
        content: `Context: ${ctx}\nAd analysis: ${JSON.stringify(adJson, null, 2)}\nBrand spec summary: ${brandDesignJson.slice(0, 2000)}\nPage layout: ${pageUnderstandingJson ?? '{}'}`,
      },
    ],
    max_tokens: 350,
  })
  return (r.choices[0]?.message?.content ?? MOCK_INTRO_MESSAGE).trim()
}

// FIX: Chat editor now explicitly guards against the model collapsing the page into an empty shell
const chatEditorSystem = `You are an expert front-end developer editing an existing landing page HTML.
The user has already described exactly WHAT they want changed (as a detailed EDIT_INTENT).

STRICT RULES:
- Make ONLY the targeted change described in EDIT_INTENT. Leave everything else untouched.
- NEVER replace the page with a near-empty shell. Keep all existing sections and content.
- NEVER remove existing sections unless the user explicitly asked to remove them.
- NEVER add <iframe>, <object>, <embed>, or meta refresh.
- For new images: use real https://images.unsplash.com/photo-[ID]?w=800&q=80&auto=format&fit=crop URLs.
- Apply the change surgically: modify only the relevant HTML tags, classes, or inline styles.
- Return the COMPLETE updated HTML document. No markdown. No explanation. No partial output.`

/**
 * Strip base64-encoded data: URLs from HTML (replace with placeholder src).
 * This prevents blowing the token budget when the HTML embeds large images.
 */
function stripBase64FromHtml(html: string): string {
  return html.replace(/src="data:[^"]{50,}"/gi, 'src="[base64-image-removed-to-save-tokens]"')
}

/**
 * Step 1 of 2-step chat: use gpt-4o to ELEVATE a vague user request into
 * a comprehensive, senior-designer-level full-page edit specification.
 * The output tells the executor EXACTLY what to change on EVERY relevant element.
 */
async function expandUserIntent(openai: OpenAI, message: string, htmlSummary: string): Promise<string> {
  const r = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.4,
    max_tokens: 700,
    messages: [
      {
        role: 'system',
        content: `You are a senior UI/UX designer and front-end engineer.
The user has given a SHORT, VAGUE edit request for a marketing landing page.
Your job is to ELEVATE it into a COMPREHENSIVE, PROFESSIONAL design prescription
that covers EVERY relevant element of the page — not just the obvious one.

GUIDING PRINCIPLE: A great designer never changes just one thing. When a theme
changes, EVERYTHING changes: body background, nav, hero, section alternates,
cards, buttons, form inputs, footer, text colors, shadows, borders, and hover states.

OUTPUT FORMAT: 6–12 numbered bullet points. Each bullet must:
- Name the specific HTML element/section (e.g. "<body>", "nav bar", "hero section", ".feature-card", "CTA band", "footer")
- Give the exact CSS change with concrete values (real hex codes, gradient strings, px values, font weights)
- Be immediately actionable by a developer — no vague adjectives like "nice" or "modern"

EXAMPLES OF ELEVATION:
User says "make it dark" → You specify:
1. <body> background: linear-gradient(135deg, #0a0a0f 0%, #12121e 50%, #0d0d1a 100%)
2. nav: background rgba(10,10,20,0.95) with backdrop-filter blur(12px), border-bottom 1px solid rgba(255,255,255,0.06)
3. hero section: background linear-gradient(180deg, #12121e 0%, #0a0a0f 100%), h1 color #f0f0ff, subtext color #9090b0
4. .feature-card: background #1a1a2a, border 1px solid rgba(255,255,255,0.08), box-shadow 0 4px 24px rgba(0,0,0,0.4)
5. CTA buttons: keep existing accent color but add glow — box-shadow 0 0 20px rgba(ACCENT,0.4)
6. CTA band: background linear-gradient(135deg, #1a0a30, #0a0a1e), white headline
7. footer: background #06060f, text color rgba(255,255,255,0.5)
8. All body text: color #c8c8d8, links: color #a0a0ff
9. Card hover: box-shadow 0 8px 32px rgba(0,0,0,0.6), transform translateY(-4px)
10. Section alternates: background #0f0f1e instead of pure black

User says "make it more premium" → specify metallic gradients, refined typography, generous spacing, glass-morphism cards, etc.
User says "make headline bigger" → specify the h1 font-size clamp value, line-height, font-weight, letter-spacing, and also update h2 proportionally.

Always elevate. Always cover the full page. Always use real CSS values.`,
      },
      {
        role: 'user',
        content: `PAGE STRUCTURE (sections and text present):
${htmlSummary}

USER'S REQUEST: "${message}"

Write the elevated, comprehensive design prescription now:`,
      },
    ],
  })
  return r.choices[0]?.message?.content?.trim() ?? message
}

/**
 * Build a richer structural summary of the HTML for the intent expander.
 * Includes section IDs, class names, key text content — gives the AI real context.
 */
function buildHtmlStructureSummary(html: string): string {
  // Section/landmark tags with their IDs/classes
  const sections = (html.match(/<(nav|header|section|footer|main|div)[^>]*(?:id|class)="[^"]*"[^>]*>/gi) ?? [])
    .map(t => {
      const tag = t.match(/<(\w+)/)?.[1] ?? ''
      const id = t.match(/id="([^"]+)"/)?.[1] ?? ''
      const cls = t.match(/class="([^"]+)"/)?.[1]?.split(' ').slice(0, 2).join(' ') ?? ''
      return `<${tag}${id ? ` #${id}` : ''}${cls ? ` .${cls}` : ''}>`
    })
    .filter(Boolean)
    .slice(0, 15)

  // Key visible text (h1-h3, button labels, CTA text)
  const texts = (html.match(/<(?:h[1-3]|button|a\b)[^>]*>([^<]{2,80})<\/(?:h[1-3]|button|a)>/gi) ?? [])
    .map(t => t.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
    .slice(0, 10)

  // Detect color scheme hints from inline styles
  const bgColors = (html.match(/background(?:-color)?:\s*([^;}"']{4,30})/gi) ?? [])
    .map(m => m.replace(/background(?:-color)?:\s*/i, '').trim())
    .filter(Boolean)
    .slice(0, 5)

  return [
    sections.length ? `Page sections: ${sections.join(', ')}` : '',
    texts.length ? `Key text: ${texts.map(t => `"${t}"`).join(', ')}` : '',
    bgColors.length ? `Current backgrounds: ${bgColors.join(', ')}` : '',
  ].filter(Boolean).join('\n').slice(0, 2000)
}

export async function chatEditHtml(
  openai: OpenAI,
  html: string,
  instruction: string,
): Promise<string> {
  // Strip base64 images to keep well within token budget
  const safeHtml = stripBase64FromHtml(html)

  // Hard-cap HTML at ~90k chars (~22k tokens) — trim middle if too large
  const MAX_HTML_CHARS = 90_000
  const trimmedHtml = safeHtml.length > MAX_HTML_CHARS
    ? safeHtml.slice(0, 45_000) + '\n<!-- ...middle trimmed to save tokens... -->\n' + safeHtml.slice(-45_000)
    : safeHtml

  const r = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.25,
    messages: [
      { role: 'system', content: chatEditorSystem },
      {
        role: 'user',
        content: `EDIT_INTENT (apply this precisely):\n${instruction}\n\nCURRENT HTML:\n${trimmedHtml}\n\nReturn the full updated HTML document only.`,
      },
    ],
    max_tokens: 8192,
  })
  return stripCodeFences(r.choices[0]?.message?.content ?? html)
}

export function getOpenai(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  return new OpenAI({ apiKey: key })
}

// ─── MAIN PIPELINE ────────────────────────────────────────────────────────────

export async function runGeneratePipeline(input: {
  useMock: boolean
  imageBase64: string | null
  imageUrl: string | null
  landingUrl: string
}): Promise<{
  html: string
  introMessage: string
  scrapeFailed: boolean
  usedMock: boolean
}> {
  const heroForMock = resolveHeroImageSrc(input.imageBase64, input.imageUrl)

  if (input.useMock) {
    return {
      html: sanitizeGeneratedHtml(ensureHeroImgInHtml(MOCK_HTML, heroForMock)),
      introMessage: MOCK_INTRO_MESSAGE,
      scrapeFailed: false,
      usedMock: true,
    }
  }

  const openai = getOpenai()
  if (!openai) {
    return {
      html: sanitizeGeneratedHtml(ensureHeroImgInHtml(MOCK_HTML, heroForMock)),
      introMessage: MOCK_INTRO_MESSAGE + ' (OpenAI key missing — showing mock page.)',
      scrapeFailed: false,
      usedMock: true,
    }
  }

  const heroImageSrc = resolveHeroImageSrc(input.imageBase64, input.imageUrl)
  const hadHeroImage = Boolean(heroImageSrc?.trim())
  const landing = input.landingUrl.trim()

  // Step 1: Parallel — scrape page text + scrape raw HTML for CSS tokens + analyze ad
  const [jina, rawHtml, adJson] = await Promise.all([
    landing ? fetchJinaPage(landing) : Promise.resolve({ ok: false, text: '' }),
    landing ? fetchPageRawHtml(landing).catch(() => '') : Promise.resolve(''),
    analyzeAdWithVision(openai, input.imageBase64, input.imageUrl),
  ])

  const scrapeFailed = !jina.ok
  const pageText = jina.ok ? jina.text : ''
  const referenceGuidance = landing ? referenceSiteGuidance(landing, pageText) : ''

  // Extract actual CSS design tokens from the raw HTML
  const visualTokens = rawHtml ? extractVisualTokensFromHtml(rawHtml) : ''

  // Step 2: Parallel — analyze page content + infer brand design (now with real CSS tokens)
  const [pageUnderstandingJson, brandDesignJson] = await Promise.all([
    !scrapeFailed && pageText.trim()
      ? analyzeLandingPageContent(openai, pageText, landing || 'https://unknown').catch(() => null)
      : Promise.resolve(null),
    landing
      ? inferReferenceSiteDesign(openai, landing, pageText, adJson, input.imageBase64, input.imageUrl, visualTokens).catch(() => '{}')
      : Promise.resolve('{}'),
  ])

  // Step 3: Generate
  const sanitize = (h: string) => sanitizeGeneratedHtml(ensureHeroImgInHtml(h, heroImageSrc))

  let html = sanitize(
    await generateLandingHtml(
      openai, adJson, pageText, pageUnderstandingJson,
      scrapeFailed, heroImageSrc, referenceGuidance, brandDesignJson,
    )
  )

  const isValid = (h: string) => h.includes('<html') || h.includes('<!DOCTYPE')
  const isGood = (h: string) => !isGeneratedHtmlDegenerate(h, hadHeroImage)

  // FIX: Repair loop now passes attemptNumber so prompts escalate
  if (!isValid(html)) {
    html = MOCK_HTML
  } else if (!isGood(html)) {
    // First repair attempt
    html = sanitize(
      await repairLandingHtml(
        openai, html, adJson, pageUnderstandingJson,
        heroImageSrc, referenceGuidance, brandDesignJson, 1
      )
    )

    if (!isValid(html)) {
      html = MOCK_HTML
    } else if (!isGood(html)) {
      // Second repair attempt — escalated instructions + higher temperature
      html = sanitize(
        await repairLandingHtml(
          openai, html, adJson, pageUnderstandingJson,
          heroImageSrc,
          `${referenceGuidance}\n\nCRITICAL: Two previous attempts failed. Output a complete light-theme marketing page now. Do not output a dark void. All 5 sections required.`,
          brandDesignJson, 2
        )
      )

      // Final fallback
      if (!isValid(html) || !isGood(html)) {
        html = MOCK_HTML
      }
    }
  }

  html = sanitize(html)

  const introMessage = await buildIntroMessage(
    openai, adJson, pageUnderstandingJson, scrapeFailed, brandDesignJson,
  )

  return { html, introMessage, scrapeFailed, usedMock: false }
}

// ─── CHAT EDIT ────────────────────────────────────────────────────────────────

export async function runChatEdit(input: {
  useMock: boolean
  html: string
  message: string
}): Promise<{ html: string; usedMock: boolean }> {
  if (input.useMock || !getOpenai()) {
    return { html: mockChatResponse(input.html, input.message), usedMock: true }
  }

  const openai = getOpenai()!
  const hadImg = /(<img\b)/i.test(input.html)

  // ── Step 1: Expand user intent cheaply with gpt-4o-mini ──────────────────
  const htmlSummary = buildHtmlStructureSummary(input.html)
  const detailedIntent = await expandUserIntent(openai, input.message, htmlSummary)
  console.log('[chat] Expanded intent:', detailedIntent)

  // ── Step 2: Apply the edit with gpt-4o using full HTML ────────────────────
  const next = await chatEditHtml(openai, input.html, detailedIntent)
  const out = sanitizeGeneratedHtml(next || input.html)

  // Guard — if AI collapsed the page, return original
  if (
    isGeneratedHtmlDegenerate(out, hadImg) &&
    !isGeneratedHtmlDegenerate(input.html, hadImg)
  ) {
    return { html: input.html, usedMock: false }
  }

  return { html: out, usedMock: false }
}