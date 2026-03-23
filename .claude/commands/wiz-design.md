# ThreatDex — Wiz Brand Design Skill

Apply the Wiz brand design system consistently to ThreatDex frontend code.

## Brand Philosophy
Wiz's visual identity is **optimistic, magical, and unexpected** — a deliberate rejection of fear-based security aesthetics. ThreatDex inherits this DNA: dark navy base, vivid electric blue primary, neon pink accent, clean glassmorphism surfaces.

## Canonical Color Tokens

These values are the single source of truth. Always reference CSS variables; never hard-code hex values in components (use `BRAND_COLORS` from `~/schema` for JS contexts).

| Token | Hex | Usage |
|---|---|---|
| `--color-wiz-blue` | `#0254EC` | Primary CTAs, nav, interactive elements |
| `--color-purplish-pink` | `#FFBFFF` | Background accents, gradients |
| `--color-cloudy-white` | `#FFFFFF` | Card surfaces, bright backgrounds |
| `--color-serious-blue` | `#00123F` | Page background, dark surfaces |
| `--color-blue-shadow` | `#173AAA` | Secondary nav, card frames |
| `--color-sky-blue` | `#6197FF` | Links, tags, RARE tier |
| `--color-light-sky-blue` | `#978BFF` | EPIC tier, subtle accents |
| `--color-pink-shadow` | `#C64BA4` | Hover states only |
| `--color-vibrant-pink` | `#FF0BBE` | **LEGENDARY tier, "Dex" logotype** |
| `--color-frosting-pink` | `#FFBFD6` | Soft backgrounds, frosted panels |
| `--color-surprising-yellow` | `#FFFF00` | **MYTHIC tier glow, warnings only** |

## Rarity Tier Color Map

| Tier | Primary Color | Usage |
|---|---|---|
| MYTHIC | `#FFFF00` surprising-yellow | Border, badge, glow — reserved for top-tier actors |
| LEGENDARY | `#FF0BBE` vibrant-pink | Border, badge, glow |
| EPIC | `#978BFF` light-sky-blue | Border, badge, glow |
| RARE | `#6197FF` sky-blue | Border, badge, glow |

## Typography Rules

```
Display headings  → Orbitron (font-display), black weight, uppercase, tight tracking
Body copy         → Space Grotesk (font-sans), regular/semibold
Data & stats      → JetBrains Mono (font-mono), all caps, wide letter-spacing
```

- Actor names: always `font-display uppercase`
- MITRE IDs, TLP labels, cadence tags: always `font-mono uppercase tracking-widest`
- Descriptions: `font-sans` regular, comfortable line-height

## Spacing & Shape Language

- Primary panels: `border-radius: 2rem` with glassmorphism (`backdrop-filter: blur(24px)`)
- Sub-panels: `border-radius: 1.5rem`
- Chips & badges: `border-radius: 999px` (pill)
- Cards: `border-radius: 1.35rem`
- Buttons: `border-radius: 999px`, primary gradient `#0254EC → #4D85EB`

## Surface + Glassmorphism Pattern

```css
/* Primary panel */
background: var(--surface-panel);          /* rgba white with opacity */
border: 1px solid var(--border-primary);   /* rgba wiz-blue */
backdrop-filter: blur(24px);
box-shadow: 0 24px 80px -40px var(--hero-shadow), inset 0 1px 0 rgba(255,255,255,0.24);

/* Background always has dual radial gradient corners */
background:
  radial-gradient(circle at top left, rgba(2,84,236,0.18), transparent 28%),
  radial-gradient(circle at top right, rgba(255,191,255,0.24), transparent 24%),
  linear-gradient(180deg, var(--surface-bg) 0%, var(--surface-bg-secondary) 100%);
```

## Background Grid Pattern

The animated grid is a signature ThreatDex motif — use it sparingly in hero sections and card placeholder backgrounds:

```css
.dex-grid {
  background-image:
    linear-gradient(to right, var(--card-grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--card-grid-line) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(180deg, rgba(0,0,0,0.45), transparent 85%);
}
```

## Component Checklist

When reviewing or writing frontend code, verify:

- [ ] `"Dex"` logotype always uses `vibrant-pink` (`#FF0BBE`), never `pink-shadow`
- [ ] Rarity badge colors match the tier map above exactly
- [ ] Rarity border/glow CSS classes use matching tier colors
- [ ] Buttons use `dex-button` class or the exact gradient `#0254EC → #4D85EB`
- [ ] Section headings use `font-display uppercase tracking-[0.08em]`
- [ ] Data fields use `font-mono uppercase tracking-widest text-app-muted`
- [ ] No hard-coded hex values in components — use CSS vars or `BRAND_COLORS`
- [ ] Dark/light theme: all colors reference CSS custom properties, not raw values
- [ ] Interactive elements have `transition` for `transform`/`color`/`border-color` at `180ms ease`
- [ ] Hover states: `translateY(-1px)` lift on cards/buttons, `border-color` shift on nav links

## Motivation Chip Colors

```
espionage  → bg rgba(2,84,236,0.16)    text #0254EC    (wiz-blue family)
financial  → bg rgba(255,255,0,0.18)   text #665700    (yellow, muted text for contrast)
sabotage   → bg rgba(255,11,190,0.18)  text #A10B6E    (vibrant-pink family)
hacktivism → bg rgba(151,139,255,0.24) text #173AAA    (light-sky-blue family)
military   → bg rgba(197,75,164,0.18)  text #8C2B6A    (pink-shadow family)
```

## How to Apply This Skill

When asked to `/wiz-design` a component or file:

1. Read the file
2. Cross-check every color value against this spec
3. Fix any drift from canonical tokens (CSS var vs hard-coded hex, wrong rarity color, wrong logotype color)
4. Verify typography hierarchy matches the rules above
5. Check spacing/shape language consistency
6. Report what was changed and why
