export const MOCK_AD_ANALYSIS = {
  headline: 'Ship faster with AI',
  cta: 'Start Free Trial',
  colors: ['#8b5cf6', '#3b82f6', '#0f172a'],
  tone: 'urgent',
  product: 'AdMatch',
  audience: 'Growth marketers',
  valueProp: 'Turn any ad into a matched landing page in minutes',
}

export const MOCK_INTRO_MESSAGE = `I matched your ad's urgent tone and used your primary CTA "${MOCK_AD_ANALYSIS.cta}". I pulled key product details from the scraped page and built a hero, benefits, social proof placeholder, and a strong closing CTA. Use the chat to tweak copy, colors, or layout — I always work from your latest preview.`

export const MOCK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${MOCK_AD_ANALYSIS.product} — Landing</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#0f172a;background:#f8fafc}
  .wrap{max-width:1100px;margin:0 auto;padding:0 1.25rem}
  header{padding:1.25rem 0;display:flex;justify-content:space-between;align-items:center}
  .logo{font-weight:800;background:linear-gradient(135deg,#8b5cf6,#3b82f6);-webkit-background-clip:text;background-clip:text;color:transparent}
  .hero{padding:4rem 0 3rem;text-align:center}
  .hero h1{font-size:clamp(2rem,5vw,3rem);font-weight:800;margin-bottom:1rem;color:#0f172a}
  .hero p{font-size:1.125rem;color:#475569;max-width:560px;margin:0 auto 1.75rem}
  .btn{display:inline-block;padding:0.9rem 1.75rem;border-radius:9999px;font-weight:700;color:#fff;background:linear-gradient(135deg,#8b5cf6,#3b82f6);text-decoration:none;box-shadow:0 10px 40px rgba(139,92,246,.35)}
  .btn:hover{opacity:.95}
  section{padding:3rem 0}
  .grid{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
  .card{background:#fff;border-radius:1rem;padding:1.5rem;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(15,23,42,.06)}
  .card h3{font-size:1.1rem;margin-bottom:.5rem;color:#0f172a}
  .card p{color:#64748b;font-size:.95rem}
  .proof{background:#fff;border-radius:1rem;padding:2rem;text-align:center;border:1px dashed #cbd5e1;color:#64748b}
  .cta-band{text-align:center;padding:3.5rem 1.5rem;border-radius:1.25rem;background:linear-gradient(135deg,rgba(139,92,246,.12),rgba(59,130,246,.12))}
  .cta-band h2{font-size:1.5rem;margin-bottom:.75rem}
  footer{padding:2rem 0;text-align:center;color:#94a3b8;font-size:.875rem}
  @media(max-width:640px){.hero{padding-top:2.5rem}}
</style>
</head>
<body>
  <header class="wrap"><span class="logo">${MOCK_AD_ANALYSIS.product}</span><span style="color:#64748b;font-size:.875rem">Trusted by teams</span></header>
  <section class="hero wrap">
    <h1>${MOCK_AD_ANALYSIS.headline}</h1>
    <p>${MOCK_AD_ANALYSIS.valueProp}. Built for ${MOCK_AD_ANALYSIS.audience} who need speed without sacrificing polish.</p>
    <a class="btn" href="#">${MOCK_AD_ANALYSIS.cta}</a>
  </section>
  <section class="wrap">
    <div class="grid">
      <div class="card"><h3>Matched messaging</h3><p>Headlines and CTAs echo your ad so visitors feel continuity from click to conversion.</p></div>
      <div class="card"><h3>On-brand colors</h3><p>Primary palette pulled from your creative keeps the experience cohesive.</p></div>
      <div class="card"><h3>Mobile-ready</h3><p>Responsive layout with clear hierarchy for small screens and fast scans.</p></div>
    </div>
  </section>
  <section class="wrap"><div class="proof">Social proof: add logos, quotes, or ratings here — placeholder for MVP.</div></section>
  <section class="wrap"><div class="cta-band"><h2>Ready when you are</h2><p style="color:#64748b;margin-bottom:1.25rem">Same CTA as your ad — one clear next step.</p><a class="btn" href="#">${MOCK_AD_ANALYSIS.cta}</a></div></section>
  <footer class="wrap">&#169; ${new Date().getFullYear()} ${MOCK_AD_ANALYSIS.product} &middot; Demo page</footer>
</body>
</html>`

export function mockChatResponse(html: string, instruction: string): string {
  const lower = instruction.toLowerCase()
  if (lower.includes('red') && lower.includes('cta')) {
    return html.replace(
      /linear-gradient\(135deg,#8b5cf6,#3b82f6\)/g,
      'linear-gradient(135deg,#dc2626,#b91c1c)',
    )
  }
  if (lower.includes('bigger') && lower.includes('headline')) {
    return html.replace(
      'font-size:clamp(2rem,5vw,3rem)',
      'font-size:clamp(2.5rem,6vw,3.75rem)',
    )
  }
  if (lower.includes('testimonial')) {
    return html.replace(
      '<div class="proof">',
      '<div class="proof"><p style="color:#0f172a;font-weight:600;margin-bottom:.5rem">“We doubled trial signups the first week.”</p><p style="font-size:.875rem">— Alex, Growth Lead</p><hr style="margin:1rem 0;border:none;border-top:1px solid #e2e8f0"/>',
    )
  }
  return html.replace(
    '</body>',
    `<!-- AI tweak: ${instruction.slice(0, 80)} --></body>`,
  )
}
