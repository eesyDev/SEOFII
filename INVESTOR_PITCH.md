# SEOBrief — Investment Pitch

> **One-liner:** AI-powered SEO analyst that turns any URL into a concrete action plan — with ready-to-paste content — in 2 minutes.

---

## 1. Executive Summary

SEOBrief is a **B2B SaaS** that automates competitor SEO analysis using AI. Instead of spending hours in Ahrefs/Semrush and hiring expensive SEO consultants, a user pastes a URL and receives:

- **Concrete task list** ("replace title with this exact text", "add FAQ with these 6 questions")
- **Ready-to-paste content** (title, H1, meta description, intro paragraph, FAQ, schema.org JSON-LD)
- **Weekly monitoring** with change detection and ranking outcome tracking
- **Niche intelligence** accumulated across thousands of analyzed pages

**Stage:** MVP live, core engine working  
**Monetization:** Freemium ($0 → $25 → $50/mo) via LemonSqueezy  
**Ask:** [Insert your ask here — e.g. $150K seed]  
**Use of funds:** Growth marketing, AI infrastructure scaling, team

---

## 2. The Problem

### SEO is a black box for 99% of business owners

- **SurferSEO / Clearscope** give scores, not actionable tasks. A marketer still needs to interpret data.
- **Ahrefs / Semrush** are powerful but require expertise. Average SMB owner is lost in dashboards.
- **SEO agencies** charge $1,000–5,000/mo with unclear ROI and slow delivery (1–2 weeks per audit).
- **AI chatbots** (ChatGPT, Claude) don't have live competitor data — they hallucinate recommendations.

**Result:** Small and medium businesses either overpay for SEO or do nothing and lose organic traffic to competitors.

---

## 3. The Solution

### "Paste URL → Get Action Plan" in 2 minutes

SEOBrief bridges the gap between raw SEO data and executable tasks:

| Traditional SEO Tool | SEOBrief |
|---------------------|----------|
| Dashboards with charts | Concrete task list with copy-paste content |
| "Improve your SEO" | "Replace title with: Buy Sofas in Moscow — 500 Models from $200" |
| Manual competitor research | Auto-scraped top-10 with structure analysis |
| Generic advice | Niche-specific patterns from 1000+ pages |
| One-time audit | Weekly monitoring with change detection |

### Core Engine

1. **Data Layer:** DataForSEO API pulls real-time SERP (Google + Yandex), keyword volumes, domain authority
2. **Scraping Layer:** Cheerio-based scraper extracts page structure (headings, blocks, schema, word count, internal links)
3. **AI Layer:** Claude Sonnet 4.6 generates briefs & comparisons; Gemini handles schema generation; Claude Haiku generates quick fixes
4. **Intelligence Layer:** Niche pattern accumulator builds knowledge base of what actually works per industry
5. **Monitoring Layer:** Weekly snapshots + diff detection + GSC ranking correlation

---

## 4. Product Demo Flow

### For Investors — 3-Minute Demo Script

1. **Landing:** Dark-mode landing with "Analyze my site" CTA
2. **Input:** User pastes URL (e.g., `https://example.com/sofas`)
3. **Processing:** Background job (Trigger.dev) runs 60–90 seconds:
   - Fetches top-10 competitors from DataForSEO
   - Scrapes all competitor pages
   - Analyzes with Claude + Gemini
4. **Report Dashboard:**
   - **Summary Cards:** Word count gap, speed score, keyword opportunities
   - **Competitor Comparison:** "Competitor #1 has 2400 words vs your 820 — expand article"
   - **Block Matrix:** Visual table showing which blocks (FAQ, reviews, video) you miss
   - **Quick Fixes:** 3–5 tasks sorted by effort (5min → 2hours), zero SEO jargon
   - **Ready Content:** Title, H1, Meta, Intro paragraph, 6 FAQ items, schema.org markup
   - **E-E-A-T Analysis:** Scores + specific gaps
   - **Content Gaps:** 5 missing page ideas with traffic potential
   - **Link Building Strategy:** Target DR + specific tactics
5. **Monitoring:** Weekly emails when competitors change something or your rankings move

---

## 5. Market Opportunity

### TAM / SAM / SOM

| Segment | Size | Notes |
|---------|------|-------|
| **TAM** — Global SEO software | ~$80B by 2030 (CAGR 12%) | Includes agencies, enterprises, tools |
| **SAM** — SMB SEO tools + services | ~$15B | Businesses with <50 employees who can't afford agencies |
| **SOM** — Our initial beachhead | ~$500M | SMBs in US, UK, DE, KZ, UA + Russian-speaking markets |

### Why Now?

1. **AI cost collapse:** Claude API costs ~$0.03 per full report (was $0.50+ 2 years ago)
2. **Google algorithm shifts:** E-E-A-T, Helpful Content Update → content quality matters more than backlinks
3. **Post-pandemic:** SMBs desperate for organic traffic, ad costs (CPC) rising 15–30% YoY
4. **AI hype maturation:** Users tried ChatGPT for SEO, got garbage → ready for specialized tools

---

## 6. Business Model

### Freemium SaaS

| Plan | Price | Reports/mo | Key Features |
|------|-------|-----------|--------------|
| **Free** | $0 | 1 full report | Competitor analysis, task list, basic recommendations |
| **Starter** | $25 | 4 reports | Weekly monitoring, ready content, FAQ, schema.org |
| **Pro** | $50 | 10 reports | Ranking tracking, outcome data, priority support |

**Unit Economics (per Pro report):**

| Cost Item | Amount |
|-----------|--------|
| DataForSEO SERP + Keywords + Domain | ~$0.03 |
| Claude Sonnet (brief generation) | ~$0.02 |
| Claude Haiku (comparisons ×3 + fixes + blocks) | ~$0.015 |
| Gemini (schema + structure) | ~$0.005 |
| PageSpeed API | $0 |
| **Total COGS** | **~$0.07** |
| **Revenue per Pro report** | **$5.00** ($50 ÷ 10) |
| **Gross Margin** | **98.6%** |

*Note: At scale, API costs decrease with caching (SERP cached 7 days, keywords cached).*

### Expansion Revenue Levers

1. **Pay-per-report:** $9 for users who hit their monthly limit
2. **White-label:** $200/mo for agencies to use their own branding
3. **API access:** $0.50/report for integrations
4. **Niche intelligence add-on:** $30/mo for industry-wide pattern reports

---

## 7. Traction & Metrics

### Current Status (June 2026)

- ✅ **MVP complete** — Full report generation pipeline working end-to-end
- ✅ **Multi-language** — English + Russian (i18n ready for DE, FR)
- ✅ **Multi-region** — Google (US, UK, DE, FR, KZ, UA) + Yandex (Russia)
- ✅ **Payment integration** — LemonSqueezy with subscription management
- ✅ **Auth system** — NextAuth with Google OAuth + email/password
- ✅ **Background jobs** — Trigger.dev with retry logic
- ✅ **Monitoring engine** — Page snapshots, change detection, ranking outcomes
- ✅ **Niche intelligence** — Pattern accumulator with confidence scoring

### Metrics to Track Post-Launch

| Metric | Target (Month 6) |
|--------|-----------------|
| Monthly Reports Generated | 5,000 |
| Free → Paid Conversion | 8–12% |
| Monthly Churn | <5% |
| NPS | >40 |
| CAC (paid ads) | <$15 |
| LTV (Starter) | $150+ |
| LTV (Pro) | $300+ |

---

## 8. Competitive Landscape

### Direct Competitors

| Competitor | Weakness | Our Advantage |
|------------|----------|---------------|
| **SurferSEO** | Gives scores, not ready content | We generate copy-paste titles, H1s, FAQ |
| **Clearscope** | Expensive ($170+/mo), content-only | We include technical SEO, monitoring, links |
| **MarketMuse** | Enterprise focus, complex | SMB-friendly, 2-minute results |
| **SE Ranking** | Generic audits, no AI content | Claude-powered specific recommendations |
| **ChatGPT + manual research** | No live data, hallucinations | Real competitor data + verified patterns |

### Moat

1. **Niche Knowledge Base:** Accumulated patterns per industry (e.g., "e-commerce product pages in RU need warranty block in 87% of top-10")
2. **Outcome Data:** Only tool that correlates page changes with actual ranking movements via GSC
3. **Speed:** 2 minutes from URL to action plan vs. hours in traditional tools
4. **Localization:** Deep Yandex + Russian market support (underserved by US-centric tools)

---

## 9. Tech Stack & Architecture

```
Frontend:     Next.js 16 + React 18 + TypeScript + Tailwind CSS + shadcn/ui
Backend:      Next.js API Routes + Server Actions
Database:     PostgreSQL (Prisma ORM)
Auth:         NextAuth v5 (OAuth + Credentials)
State:        Redux Toolkit
Queue:        Trigger.dev (background jobs with retries)
Payments:     LemonSqueezy
SEO Data:     DataForSEO API (SERP, Keywords, Backlinks, WHOIS)
AI:           Anthropic Claude (Sonnet 4.6 + Haiku) + Google Gemini
Scraping:     Cheerio + native fetch
Monitoring:   Custom snapshot + diff engine
i18n:         next-intl (EN/RU, extensible)
```

### Architecture Highlights

- **Caching layer:** SERP results cached 7 days → reduces DataForSEO costs by ~60%
- **Graceful degradation:** PageSpeed has 20s timeout → report completes even if slow
- **Mock mode:** Full dev environment without API keys (zero-cost development)
- **Pattern accumulator:** Fire-and-forget background job builds niche knowledge base
- **Outcome engine:** Correlates DetectedChange → RankingOutcome for causal insights

---

## 10. Roadmap

### Q3 2026 — Launch & Polish
- [ ] Public beta launch
- [ ] Google Search Console OAuth integration (one-click connect)
- [ ] Email reports + weekly digest
- [ ] Chrome extension (analyze any page in 1 click)

### Q4 2026 — Growth Features
- [ ] White-label for agencies
- [ ] Bulk analysis (10 URLs at once)
- [ ] Content editor with live SEO scoring
- [ ] Team workspaces (3–10 seats)

### Q1 2027 — Platform
- [ ] API for third-party integrations
- [ ] Marketplace: SEO expert marketplace (take 20%)
- [ ] AI content generation (full article, not just brief)
- [ ] Mobile app (monitoring alerts)

---

## 11. Team

*[Fill in your team details here]*

| Role | Background |
|------|-----------|
| **CEO / Product** | [Your background — e.g., ex-SEO agency founder, 5 years in digital marketing] |
| **CTO / Engineering** | [Your background — full-stack dev, AI/ML experience] |
| **Advisor** | [If any — e.g., former VP Product at Semrush] |

**What we need to hire:**
- Growth marketer (performance + content)
- Customer success (onboarding, support)
- ML engineer (fine-tuning models for SEO domain)

---

## 12. The Ask

**Raising:** $150,000–300,000 Seed  
**Valuation:** [Your target, e.g. $1.5M pre-money]  
**Instrument:** SAFE or equity

### Use of Funds

| Category | % | Amount | Purpose |
|----------|---|--------|---------|
| Growth Marketing | 40% | $60K–120K | Paid acquisition (Google Ads, LinkedIn), content SEO |
| Product & Engineering | 35% | $52K–105K | Hire contractor devs, AI infrastructure, feature dev |
| Operations | 15% | $22K–45K | API costs, hosting, legal, accounting |
| Buffer | 10% | $15K–30K | Unexpected costs, runway extension |

**Runway:** 12–18 months to profitability or Series A metrics

---

## 13. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| AI API costs spike | Hybrid approach: Claude for quality, open-source models for volume; caching layers |
| DataForSEO dependency | Abstracted client — can switch to SerpApi, Bright Data, or build own scraper |
| Google algorithm changes | Actually an opportunity — more businesses need help adapting |
| Copycats | Niche knowledge base + outcome data creates data network effect over time |
| Low free→paid conversion | Freemium is generous (1 full report) — but report quality sells itself |

---

## 14. Key Metrics for Next Check-in

1. **MRR** and **paid user count** (monthly)
2. **Report completion rate** (target: >95%)
3. **Time-to-first-value** (target: <3 min from signup to first report)
4. **Niche pattern database size** (target: 10,000+ patterns by month 6)
5. **Outcome data quality** (correlation between changes and rankings)

---

## Appendix: Sample Report Output

When a user analyzes `https://example.com/sofas`, they receive:

### Quick Fixes (do this weekend)
1. **5 min:** Replace title → "Buy Sofas in Moscow — 500 Models from $200 | Free Delivery"
2. **30 min:** Add JSON-LD Product schema (provided, copy-paste ready)
3. **2 hours:** Add "How to Choose a Sofa: 5 Questions" section (300 words)

### Ready Content
- **Title:** [generated]
- **H1:** [generated]
- **Meta:** [generated]
- **Intro Paragraph:** [generated, 150 words]
- **FAQ (6 items):** [with schema.org markup]

### Competitor Gaps
- Competitor #1 (position 1): 2400 words vs your 820 → expand to 2000+
- Competitor #2: Has FAQ + AggregateRating schema → you have neither
- Competitor #3: 45 internal links vs your 12 → add cross-links

### Monitoring
- Weekly scan: Did competitors add new blocks? Did your rankings change?

---

*Prepared: June 2026*  
*Contact: [your email]*  
*Demo: [your app URL]*
