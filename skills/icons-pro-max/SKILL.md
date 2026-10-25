---
name: icons-pro-max
description: >
  A portable icon catalog and rendering guide for the current project:
  payment methods, QR codes, social/app brand marks, download badges, the
  lucide-react UI icon set, 145 tech-stack logos, 86 full-color AI provider
  marks, and 516 Claude connector icons. Gives the exact asset path,
  React component, canonical size, brand color, render recipe, and accessibility
  rule for each icon — plus an anti-slop checklist so an agent never redraws a
  logo, recolors a brand mark, distorts an aspect ratio, or re-inlines a
  duplicated icon. Use whenever adding, rendering, swapping, or auditing an icon
  anywhere in a website, app, or document.
---

# Icons Pro Max — The Complete Icon System

> Every icon the site ships, in one catalog. Before you place, swap, or invent an
> icon: find it here first. If it exists, **reuse the canonical component / asset
> path and size** — do not paste a fresh `<svg>` or a new PNG. If it does not
> exist, add it to the right group *and* update this catalog in the same change.
>
> The load-bearing rule: **an icon carries a brand's identity. Reproduce it
> exactly — never redraw, recolor, or restretch a logo.** Generic UI glyphs
> (lucide) are the only icons you may freely restyle.

Asset roots:
- **In the web app:** `public/…` (served at `/…`) and inline React components in `src/`.
- **In this skill:** `assets/{payment,social,tech,badge,ai,connector}/` — a self-contained mirror so the catalog is usable outside the repo.
- **Provenance:** [`assets/SOURCES.md`](assets/SOURCES.md) records where every bundled file comes from. Check it before replacing a mark.

Application paths, component names, and tuned sizes below are examples from the
catalog's original web app. Inspect the current project's framework and asset
conventions first. Resolve bundled paths relative to this `SKILL.md`, then copy
only the selected assets into the project's public or asset directory and use
that project's own paths and components. Do not assume its `src/`, `public/`,
payment configuration, or React components already exist. For documents, use the
bundled file with the document tool's image import mechanism. Keep provenance and
applicable notices with copied assets. Never read or import payment codes or
account details from the original application; ask the user for their own data
only when their requested task needs it.

---

## 0. PICK THE RIGHT GROUP FIRST

| You need… | Group | Section | Render style |
|-----------|-------|---------|--------------|
| A checkout / donate payment mark | **Payment** | §1 | White badge wrapper, fixed per-logo height |
| A scannable pay code | **QR** | §2 | Raster image or VietQR dynamic URL |
| A link to a social / contact account | **Social & App** | §3 | `currentColor` inline SVG (or brand SVG for Zalo/Gmail) |
| A generic action / status glyph (close, download, check…) | **UI (lucide)** | §4 | `lucide-react`, `currentColor`, sized by class |
| A technology / tool logo (portfolio) | **Tech stack** | §5 | Brand-colored SVG file |
| An app store or OS download badge | **Download badges** | §6 | Brand-colored SVG badge, black background |
| An AI model provider, lab, or AI tool | **AI providers** | §7 | Full-color SVG, render as-is |
| A service Claude connects to (Drive, Slack, Notion…) | **Claude connectors** | §8 | Brand SVG, or the directory's own raster icon |

**Decision rule:** a *brand* (company, product, payment network) → its exact logo asset (§1/§3/§5–§8). A *concept* (save, delete, warning) → a lucide glyph (§4). Never substitute one for the other (a lucide `credit-card` is not the Visa logo).

---

## 1. PAYMENT METHODS

Brand payment marks. Rendered through the shared **badge wrapper** in `src/PaymentLogos.tsx` — a white, bordered, rounded chip that gives every logo equal optical weight regardless of its native aspect ratio.

### 1.A Catalog

| Logo | Component | Web asset | Skill asset | Canonical height | Notes |
|------|-----------|-----------|-------------|:---:|-------|
| VietQR | `VietQRLogo` | `/payment/vietqr.svg` | `assets/payment/vietqr.svg` | **13px** | national QR scheme |
| VNPAY | `VnpayLogo` | `/payment/vnpay.svg` | `assets/payment/vnpay.svg` | **16px** | |
| ZaloPay | `ZaloPayLogo` | `/payment/zalopay.svg` | `assets/payment/zalopay.svg` | **11px** | wordmark is wide → shortest height |
| MoMo | `MoMoLogo` | `/payment/momo.svg` | `assets/payment/momo.svg` | **18px** | square mark → tallest |
| Visa | `VisaLogo` | `/payment/visa.svg` | `assets/payment/visa.svg` | **12px** | card network |
| Mastercard | `MastercardLogo` | `/payment/mastercard.svg` | `assets/payment/mastercard.svg` | **17px** | card network |

Extra marks in `assets/payment/` (not wired into the badge set, no tuned height yet): `paypal` · `stripe` · `applepay` · `googlepay` · `americanexpress` · `jcb` · `shopee` · `grab` · `zalo`, plus `zalo-icon.png`. Each carries its own white padded chip. Before shipping one on the web, add a `…Logo` component with a tuned height (§1.B) and move it into the table above.

### 1.B The badge wrapper (single source — do not re-implement)

```tsx
// src/PaymentLogos.tsx
const BADGE =
  "inline-flex h-6 items-center justify-center rounded-md border border-neutral-200 bg-white px-1.5 shadow-sm";

const Logo = ({ src, alt, h }: { src: string; alt: string; h: number }) => (
  <span className={BADGE}>
    <img src={src} alt={alt} style={{ height: h, width: "auto" }}
         className="block max-w-none" draggable={false} loading="eager" decoding="sync" />
  </span>
);
```

**Rules**
- The badge is a fixed **24px (`h-6`)** chip; the logo height is the per-logo value above — never equalize heights, the values are tuned so every mark reads at the same optical size.
- Always `width: auto` — **never set both width and height** (distorts the mark). Aspect ratio is sacred.
- `loading="eager"` + `decoding="sync"`: payment trust marks must not pop in late.
- The white `bg-white` is required — these logos assume a light backing; do not drop them onto a dark or tinted surface bare. (The bundled `assets/payment/*.svg` copies carry a white rounded tile so they preview correctly on dark backdrops like the README; the web renders them via the badge wrapper instead.)
- Import the component; do not hand-roll `<img src="/payment/…">` at call sites.

---

## 2. QR CODES

| QR | Web asset | How |
|----|-----------|-----|
| MoMo static | `/qr_momo.png` | raster `<img>`, render on a white card (personal pay code — lives in the web `public/`, not bundled in this skill) |
| ZaloPay static | `/qr_zalopay.png` | raster `<img>`, render on a white card (personal pay code — lives in the web `public/`, not bundled in this skill) |
| VietQR **dynamic** | — | generated per-amount via `qrUrl()` (see below) |

### 2.A VietQR dynamic — never hardcode a bank QR image

```ts
// src/lib/payment.ts — bank details live here (single source)
export const PAY = { bank: "…", bankCode: "…", account: "…", holder: "…", … };

export const qrUrl = (amount: number, ref: string, email: string) =>
  `https://img.vietqr.io/image/${PAY.bankCode}-${PAY.account}-compact.png?amount=${amount}` +
  `&addInfo=${encodeURIComponent(`${ref} ${email}`.trim())}` +
  `&accountName=${encodeURIComponent(PAY.holder)}`;
```

**Rules**
- A bank transfer QR is **amount-specific** — always build it with `qrUrl(amount, ref, email)`; never save a screenshot of one.
- QR must render at ≥ 160px on a quiet white margin (scanners need the quiet zone) and never be recolored or overlaid.
- Bank account / holder come from `PAY` only — do not duplicate the account number in markup.

---

## 3. SOCIAL & APP BRAND ICONS

Contact / social-link marks. Four are monochrome inline SVGs that inherit text color (`currentColor`); Zalo and Gmail are brand-colored.

### 3.A Catalog

| Icon | Component | Style | Web source | Skill asset |
|------|-----------|-------|------------|-------------|
| GitHub | `GitHubIcon` | inline SVG, `currentColor` | `src/SocialIcons.tsx` | `assets/social/github.svg` |
| LinkedIn | `LinkedInIcon` | inline SVG, `currentColor` | `src/SocialIcons.tsx` | `assets/social/linkedin.svg` |
| Facebook | `FacebookIcon` | inline SVG, `currentColor` | `src/SocialIcons.tsx` | `assets/social/facebook.svg` |
| Telegram | `TelegramIcon` | inline SVG, `currentColor` | `src/SocialIcons.tsx` | `assets/social/telegram.svg` |
| Zalo | `ZaloIcon` | `<img>` brand SVG | `public/assets/zalo-logo.svg` | `assets/social/zalo.svg` |
| Gmail | `GmailIcon` | inline brand SVG (multicolor) | `src/SocialIcons.tsx` | `assets/social/gmail.svg` |

### 3.B Canonical component shapes

```tsx
// currentColor marks — size and color via className, default h-5 w-5
export const GitHubIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>…</svg>
);

// Zalo — one <img>, one source path, forwards extra props (alt / data-testid)
export const ZaloIcon = ({ className, alt = "Zalo logo", ...rest }) => (
  <img src="/assets/zalo-logo.svg" alt={alt} role="img" aria-label={alt} className={className} {...rest} />
);

// Gmail — brand-colored, decorative when paired with a visible text label
export const GmailIcon = ({ className }: { className?: string }) => (
  <svg viewBox="52 42 88 66" className={className} aria-hidden="true">…5 brand paths…</svg>
);
```

**Rules**
- **All six live in `src/SocialIcons.tsx` — import from there.** Do **not** paste a fresh definition into a page. (Historically `ZaloIcon` and `GmailIcon` were copy-pasted into `ContactSection`, `BlogApp`, and `PortfolioApp`; that was consolidated — keep it consolidated. See §9 Anti-Slop #5.)
- `currentColor` marks: set color on the parent (`text-neutral-600 hover:text-neutral-900`); size only via `className` (`h-5 w-5`). Never bake a fill color into these four **web components** — the web keeps them `currentColor`. (The bundled `assets/social/*.svg` files carry a brand-color default and a white rounded tile so they preview correctly as standalone images — dark marks like GitHub stay visible on dark backdrops, e.g. in the README.)
- Zalo `/assets/zalo-logo.svg` is the contact/social source; keep it distinct from the payment `zalo.svg`.
- Gmail is multicolor and immutable — never recolor it to match a theme; mark `aria-hidden` when a visible "Email" label sits beside it.
- Each link needs an accessible name: a visible label, or `aria-label` on the anchor.

### 3.C Bundled-only social marks (no web component yet)

`x` · `instagram` · `tiktok` · `youtube` · `discord` · `whatsapp` · `messenger` · `reddit` · `threads` · `pinterest` · `medium` · `devto` · `stackoverflow` · `snapchat` · `twitch` · `bluesky` · `mastodon` · `line` · `viber` · `signal` · `wechat` · `kakaotalk`

Each file is the Simple Icons path in its brand color on a padded white tile. To use one on the web, add a `currentColor` component to `src/SocialIcons.tsx` from the same path — never re-trace it.

---

## 4. UI ICONS — lucide-react

Generic action/status glyphs. **These are the only freely-restylable icons** — one library, `currentColor`, sized by class. Reach here for *concepts*, never for brands.

### 4.A Usage

```tsx
import { Download, Check, X } from "lucide-react";
<Download className="h-4 w-4" />           // size via class, inherits text color
```

- Size with `h-* w-*`; color with `text-*` on the icon or parent. Default stroke is fine — don't override `strokeWidth` per-icon without reason.
- Prefer an existing name from the set below before pulling a new one, to keep the visual language consistent.
- Decorative icon beside a text label → the label carries meaning (icon `aria-hidden` implicitly via lucide). Icon-only button → add `aria-label`.

### 4.B Icons already in use (reuse before adding new)

`ArrowUpRight` · `ArrowLeft` · `X` · `Check` · `CheckCircle2` · `CircleAlert` · `AlertCircle` · `Copy` · `Download` · `Search` · `Send` · `Mail` · `Phone` · `MapPin` · `Calendar` · `Clock` · `Bell` · `ShoppingCart` · `ShoppingBag` · `Store` · `CreditCard` · `Wallet` · `Truck` · `Gift` · `Heart` · `Coffee` · `Star` · `Sparkles` · `Eye` · `Lock` · `ShieldCheck` · `Shield` · `RotateCcw` · `Home` · `User` · `Users` · `Puzzle` · `Languages` · `FileText` · `BookOpen` · `Bookmark` · `PenLine` · `Printer` · `MessageCircle` · `MessageSquare` · `Code2` · `Terminal` · `Cpu` · `Laptop` · `Smartphone` · `Layers` · `Layout` · `LayoutGrid` · `Paintbrush` · `Zap` · `BarChart2` · `Trash2` · `ChevronRight` · `Loader2` · `Building2` · `Lightbulb` · `Bot` · `Telescope` · `Leaf` · `Wrench` · `FlaskConical` · `GitBranch` · `Scale`

---

## 5. TECH-STACK LOGOS

145 brand-colored SVGs for languages, frameworks, runtimes, databases, cloud, dev tools, editors, data/ML libraries, operating systems, and browsers. Colors are baked into each file — render as-is.

**Location:** web `public/portfolio/assets/tech/<name>.svg` · skill `assets/tech/<name>.svg`

`anaconda` · `android` · `androidstudio` · `angular` · `ansible` · `apache` · `apple` · `archlinux` · `astro` · `aws` · `azure` · `babel` · `bash` · `batchfile` · `bitbucket` · `bootstrap` · `bun` · `c` · `canvas` · `chrome` · `claude` · `cloudflare` · `cmake` · `cplusplus` · `csharp` · `css3` · `cypress` · `dart` · `debian` · `deno` · `digitalocean` · `django` · `docker` · `dotnet` · `elasticsearch` · `electron` · `eslint` · `express` · `fastapi` · `fedora` · `firebase` · `firefox` · `flask` · `flutter` · `gemini` · `git` · `github` · `github-actions` · `gitlab` · `go` · `googlecloud` · `gradle` · `graphql` · `heroku` · `html5` · `intellij` · `java` · `javascript` · `jenkins` · `jest` · `jquery` · `json` · `jupyter` · `keras` · `kotlin` · `kubernetes` · `langflow` · `laravel` · `latex` · `linux` · `lua` · `mariadb` · `markdown` · `matplotlib` · `mongodb` · `mysql` · `neo4j` · `neovim` · `nestjs` · `netlify` · `nextjs` · `nginx` · `nodejs` · `npm` · `numpy` · `nuxt` · `objectivec` · `opencv` · `orjson` · `pandas` · `php` · `playwright` · `pnpm` · `postgresql` · `postman` · `powershell` · `prettier` · `prisma` · `pwa` · `pycharm` · `pydantic` · `python` · `pytorch` · `r` · `rails` · `raspberrypi` · `react` · `redis` · `redux` · `ruby` · `rust` · `safari` · `sass` · `scala` · `scikitlearn` · `selenium` · `spring` · `sqlalchemy` · `sqlite` · `sqlserver` · `storybook` · `supabase` · `svelte` · `swift` · `tailwindcss` · `tauri` · `telethon` · `tensorflow` · `terraform` · `threejs` · `typescript` · `ubuntu` · `uvicorn` · `vercel` · `vim` · `vite` · `vitest` · `vscode` · `vue` · `webpack` · `webstorm` · `windows` · `xcode` · `yaml` · `yarn`

**Rules**
- Reference by path (`/portfolio/assets/tech/python.svg`); do not paste the SVG source inline.
- These carry their own brand colors — do **not** apply `currentColor` or a `fill` override.
- Keep the aspect ratio; size the container, let `object-fit: contain` do the rest.
- Marks that are black, near-black, or very dark carry a white rounded tile (`data-tile="1"`) in their **bundled** copy so they stay visible on dark backdrops (e.g. the README). Strip that one `<rect>` if you need the bare mark on a light surface; never recolor the mark instead.
- Every file is an official mark: devicon `original` (multi-color) first, then Simple Icons or the project's own logo file. `batchfile` and `orjson` are the only house glyphs — neither project publishes a logo. `canvas` is **Canvas LMS** (Instructure), not the HTML `<canvas>` API; `telethon` is the Telethon library's own logo, not Telegram's.
- `github` appears here (tech context) *and* as a `currentColor` social mark in §3 — pick by context: a stack chip → tech SVG; a "follow me" link → `GitHubIcon`. The same split applies to `claude`/`gemini` (tech chip) vs §7 (AI provider row).
- The web copies under `public/portfolio/assets/tech/` must be refreshed from these files when a mark is corrected here.

---

## 6. DOWNLOAD BADGES

App Store, Google Play, macOS, and Windows download badges. Rendered on a black background, with rounded corners and high contrast, these badges are used to direct users to application download links.

### 6.A Catalog

| Badge | Web asset | Skill asset | Aspect Ratio | Text / Notes |
|-------|-----------|-------------|:------------:|--------------|
| App Store | `/badge/appstore.svg` | `assets/badge/appstore.svg` | **3.0:1** | Download on the App Store |
| Google Play | `/badge/googleplay.svg` | `assets/badge/googleplay.svg` | **3.38:1** | GET IT ON Google Play |
| macOS | `/badge/macos.svg` | `assets/badge/macos.svg` | **3.0:1** | Tải cho macOS (Finder icon) |
| App Store · tiếng Việt | `/badge/appstore-vi.svg` | `assets/badge/appstore-vi.svg` | **3.0:1** | Tải về trên App Store — bản Apple phát hành cho vi-VN |
| Google Play · tiếng Việt | `/badge/googleplay-vi.png` | `assets/badge/googleplay-vi.png` | **3.365:1** | TẢI TRÊN Google Play — bản Google phát hành cho vi, đã cắt viền trong suốt |
| Windows | `/badge/windows.svg` | `assets/badge/windows.svg` | **3.0:1** | Tải cho Windows (Windows 11 icon) |
| macOS · English | `/badge/macos-en.svg` | `assets/badge/macos-en.svg` | **3.0:1** | Download for macOS (Finder icon) |
| Windows · English | `/badge/windows-en.svg` | `assets/badge/windows-en.svg` | **3.0:1** | Download for Windows (Windows 11 icon) |

**Rules**
- Maintain the original aspect ratio (always set only height or use `object-fit: contain`).
- Render at a standard height (typically **40px**).
- Do not invert or modify the brand icons or colors in the badges.
- Never translate a vendor badge by editing its text. Apple and Google publish their own localized artwork — use `appstore-vi.svg` / `googleplay-vi.png` for Vietnamese pages. The Windows and macOS badges are house-built, so their wording is ours to set: `macos.svg` / `windows.svg` read **Tải cho** (Vietnamese pages), `macos-en.svg` / `windows-en.svg` read **Download for** (English pages). Pair each badge language with the page language.

---

## 7. AI PROVIDERS

86 full-color marks for model providers, labs, clouds, and AI tools — from [LobeHub Icons](https://github.com/lobehub/lobe-icons), using the `-color` variant whenever the brand has one.

**Location:** skill `assets/ai/<name>.svg`

`ai21` · `aistudio` · `anthropic` · `aws` · `azureai` · `baichuan` · `bedrock` · `bfl` · `cerebras` · `chatglm` · `claude` · `claudecode` · `cline` · `codex` · `cohere` · `copilot` · `crewai` · `cursor` · `dalle` · `deepinfra` · `deepmind` · `deepseek` · `devin` · `dify` · `doubao` · `elevenlabs` · `fireworks` · `flux` · `gemini` · `geminicli` · `gemma` · `githubcopilot` · `google` · `grok` · `groq` · `hailuo` · `huggingface` · `hunyuan` · `ideogram` · `inflection` · `kimi` · `kling` · `langchain` · `llamaindex` · `lmstudio` · `lovable` · `luma` · `manus` · `mcp` · `meta` · `metaai` · `microsoft` · `midjourney` · `minimax` · `mistral` · `moonshot` · `n8n` · `notebooklm` · `nvidia` · `ollama` · `openai` · `openrouter` · `perplexity` · `pika` · `poe` · `qwen` · `reka` · `replicate` · `replit` · `runway` · `sambanova` · `sora` · `stability` · `stepfun` · `suno` · `together` · `trae` · `udio` · `upstage` · `v0` · `vertexai` · `wenxin` · `windsurf` · `xai` · `yi` · `zhipu`

**Rules**
- Render as-is. Brands whose official mark is monochrome (OpenAI, Anthropic, xAI, Grok, Ollama, Cursor, Midjourney…) ship in black on a white tile — never tint them to a theme color.
- `kimi` ships on its black app tile: the mark is white and disappears on light surfaces without it.
- Provider ≠ product: `claude` is the model/app, `anthropic` is the company, `claudecode` is the CLI; `gemini`, `google`, `deepmind`, `vertexai`, `aistudio`, `notebooklm` are different Google marks. Use the one the sentence names.
- Group order for a model picker: provider mark first, then model name as text — do not stack two marks.

---

## 8. CLAUDE CONNECTORS

516 icons for the services in the Claude connector directory (Google Drive, Gmail, Google Calendar, Canva, Microsoft 365, Notion, Figma, Slack, and the rest).

**Location:** skill `assets/connector/<name>.svg|png` — see `assets/SOURCES.md` for the file, brand, and origin of each.

**How each icon was chosen (keep this order when adding one)**
1. A multi-color vector (devicon `original` or LobeHub `-color`) of the **same brand**, confirmed by matching the Simple Icons entry's official domain to the connector's domain.
2. The Simple Icons vector in its brand color, same domain check.
3. The icon the connector directory itself serves for that connector, or the brand's own `apple-touch-icon`/favicon — stored as a PNG (≤128px). Google Workspace products use Google's published product icons.

**Rules**
- A raster connector icon is small: render it at ≤48px. Do not upscale; replace it with a vector when the brand publishes one.
- Match by domain, never by name alone — many connectors share a word with an unrelated brand (Runway, Orion, Light, Close, Craft, Loops).
- The directory changes; a connector missing here gets its icon by the same three steps, and a row in `assets/SOURCES.md`.

---

## 9. ANTI-SLOP CHECKLIST — Fix On Sight

The meta-rule: **an icon references something real. Preserve its identity; reuse its one source.**

| # | The tell | Why it's wrong | The fix |
|---|----------|----------------|---------|
| 1 | A **re-drawn / re-traced** logo (pasted path that "looks close") | breaks brand identity; legal risk | use the exact asset from this catalog |
| 2 | A **recolored brand mark** (Gmail forced monochrome, tech logo tinted) | falsifies the brand | brand icons keep their colors; only lucide + the four `currentColor` social marks restyle |
| 3 | **Width + height both set** on a payment/tech logo | distorts aspect ratio | set one dimension, `width:auto` / `object-fit:contain` |
| 4 | A **lucide glyph standing in for a brand** (lucide `credit-card` as "Visa") | wrong meaning | brands → §1/§3/§5–§8 assets; concepts → §4 |
| 5 | **Re-inlined duplicate** of a shared icon in a page | drift across copies; the ZaloIcon/GmailIcon trap | import from `src/SocialIcons.tsx` (social) / `src/PaymentLogos.tsx` (payment) |
| 6 | **Payment mark on a bare dark/tinted surface** | logos assume light backing | keep the white badge wrapper |
| 7 | **Hardcoded VietQR / bank QR image** | amount-specific, goes stale | generate via `qrUrl()`; bank data from `PAY` |
| 8 | **Icon-only control with no accessible name** | fails a11y | `aria-label` on the button; brand `<img>` gets real `alt` |
| 9 | **New icon added, catalog not updated** | this file goes stale, next agent re-inlines | add the asset *and* the row here in one change |
| 10 | **Look-alike stand-in** (brand color + a generic shape or the name typed in a box, e.g. a purple star for Gemini, a "Zalo" text tile) | it is not the logo; it passes a glance and fails every brand check | fetch the official mark (devicon / Simple Icons / LobeHub / the brand's own file) and record it in `assets/SOURCES.md` |

---

## 10. ADD-AN-ICON PROCEDURE

1. **Classify** — brand or concept? Which group (§0)?
2. **Concept (lucide)** — reuse a name from §4.B if one fits; otherwise import the new lucide name and add it to §4.B.
3. **Brand** — drop the official asset into the right folder (`public/payment|portfolio|badge/assets/tech` + this skill's `assets/…`), keep native colors, respect aspect ratio. Record its origin in `assets/SOURCES.md`; if no official mark exists, say so there instead of drawing one.
4. **Wire the render** — payment → add a `…Logo` to `PaymentLogos.tsx` with a tuned height; social/app → add to `SocialIcons.tsx`; never inline at the call site.
5. **Update this catalog** — add the row (path, component, size, color) in the matching section.
6. **A11y** — give it an accessible name; mark decorative marks `aria-hidden` when a text label is present.
7. **Verify** — it renders at the right size, correct colors, no distortion, light + dark backing where relevant.
