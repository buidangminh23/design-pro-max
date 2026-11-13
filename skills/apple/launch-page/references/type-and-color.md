# Type and colour

The two token sets, how they were made, and what was measured elsewhere only as context. Values live in `../assets/tokens.json`; `tokens.css` and `theme.tailwind.css` are generated from it.

## Contents

- How the ladder is made
- The restrained set
- The expressive set
- Fonts
- Colour and contrast
- Scripts and languages
- Measured context, never values

## How the ladder is made

- Sizes come from a modular type scale: base `16px`, ratio `1.25`, each step rounded to a whole pixel. The ratio is the one the spacing skill pairs with a restrained marketing page; the spacing ladder is its `8px` scale, so type and gaps share one rhythm.
- Leading rounds each line box up to the `4px` grid: about `1.5` times the size for reading text, `1.6` for ledes, `1.1` for display sizes. Whole-pixel line boxes keep stacked text on the grid [LP-TYPE-01] (AD-1, as a principle only).
- Tracking is a curve over size: slightly open at the caption size, zero for body text, tightening step by step for display sizes. Weight is regular for text and semibold from the title size up.
- Display leading never drops under `1.1`, so stacked Vietnamese marks do not collide when a heading wraps.

## The restrained set

The page's default, on `:root`. Sizes change only at the breakpoints `640px`, `1024px` and `1280px`.

| Role | Base | From `640px` | From `1024px` | From `1280px` |
|---|---|---|---|---|
| caption | `13/20`, `+0.008em` | | | |
| body | `16/24`, `0` | | | |
| lede | `20/32`, `-0.004em` | | | |
| title | `25/28`, `-0.008em` | | | |
| heading | `31/36`, `-0.012em` | | `39/44`, `-0.016em` | |
| display | `39/44`, `-0.016em` | `49/56`, `-0.02em` | | |
| hero | `39/44`, `-0.016em` | `49/56`, `-0.02em` | `61/68`, `-0.022em` | `76/84`, `-0.024em` |

Each role is four custom properties: `--type-<role>-size`, `-leading`, `-tracking` and `-weight`. Components read only these, so a mode, a language or a brand override changes no component.

## The expressive set

Turned on with `<html data-launch-mode="expressive">`. The hero, heading and lede become fluid between two sizes from a `390px` to a `1280px` viewport, with leading rounded up to the `4px` grid by CSS `round()`, so every computed line height is still a whole pixel [LP-TYPE-01].

| Role | Range | Tracking |
|---|---|---|
| lede | `20px` to `24px` | `-0.006em` |
| heading | `32px` to `64px` | `-0.024em` |
| hero | `44px` to `96px` | `-0.028em` |

Reveals run longer and rise further, sections get more room, and `data-section-accent="amber|violet|rose"` on a section sets `--section-accent` from the set. Browsers without CSS `round()` drop the fluid leading; the restrained set has no such dependency.

## Fonts

- The stack starts with `system-ui`, then platform faces, then openly licensed faces: `system-ui, "Segoe UI", Roboto, "Noto Sans", "Inter", sans-serif`. No font is downloaded unless the project adds one.
- Never SF Pro, SF Pro Icons, SF Compact or SF Symbols on a website: the San Francisco licence forbids embedding, serving or using them for web content [LP-FONT-01] (AD-7). The same goes for the private-use glyphs those fonts carry. Icons come from a licensed set (POL-2).
- A brand font replaces `--font-sans`; keep `system-ui` behind it, and pick a face whose licence allows web use, with a Vietnamese subset when the page has Vietnamese copy (AD-8). The licensing reasoning is not legal advice.

## Colour and contrast

- Neutral greys and one accent, in light and dark schemes. Every text pair in the set, accent and section accents included, is at least 4.5:1 [LP-CONTRAST-01]; the generator refuses a token file that breaks this.
- The accent is split by role: `--color-accent` for text and links, `--color-accent-fill` for filled buttons with `--color-on-accent` text. A role split lets each pair pass on its own (AD-10).
- Secondary text uses `--color-muted`, never a lighter grey for small text: a pale grey that fails 4.5:1 on small text is the most common contrast failure on product pages (AD-11).
- Text over an image or a gradient must pass against its worst pixel, not its average; the checker renders the page once with text hidden and measures it. Text over video cannot be proven; give it a solid or scrimmed backing.
- Brand colours replace the accent tokens; run the checker and use the passing colour it suggests for any failure.

## Scripts and languages

- `:lang(ja)`, `:lang(ko)`, `:lang(th)` and `:lang(zh)` set tracking to zero and loosen leading (`1.75` for text, `1.4` for display, rounded up to the grid), with a script-specific Noto face after `system-ui`. These are this set's own values; tracking back to zero for these scripts follows the measured practice (AD-28).
- Vietnamese keeps the Latin tokens; it needs a face with the Vietnamese subset and the display leading floor above.
- Set `lang` on the root and on any section in another language, so the right override applies.

## Measured context, never values

Measured on a large product site and a reference landing page, kept in the ledger as context. None of these numbers appears in the tokens, and `scripts/lint-tokens.mjs` in the repository fails a token set that matches 3 or more of the measured values within 1 px or 0.001 em (ON-16).

- A fixed ladder of about 15 sizes from 12 to 96 px with no fluid type (AD-0).
- Integer-pixel line boxes: headlines size + 4 px, reading text size + 6-8 px (AD-1).
- Tracking from about -0.022 em to +0.012 em by size (AD-2), and weight 600 at display sizes (AD-3).
- Fill and text accents split by role, every pair at least 4.5:1 (AD-10).
