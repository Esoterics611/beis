> **Phase 3 complete.** Vocabulary updated to Beis terminology. Visual direction is the **sefer aesthetic** (parchment + serif + burgundy accent) — see [`PUBLIC_INTRODUCTION.md`](PUBLIC_INTRODUCTION.md). Score-tier insignia (enlisted / NCO / officer) replace the legacy rank insignia section.

---

# Spec 1: Sefer Aesthetic UI — Beis

## Implementation Guide for SvelteKit / Tailwind CSS v4

**Purpose:** Redesign the visual theme of the Beis platform from cyberpunk dark to academic institutional. Same stack (SvelteKit 2, Svelte 5, Tailwind CSS v4), same pages, same components, same RTL Hebrew layout — only the visual layer changes.

**Target audience:** Yeshiva administrations, traditional Jewish philanthropists, university research offices, academic grant committees, rabbinical scholars.

**Reference feeling:** Oxford/Cambridge academic portals, Bar-Ilan University Responsa Project, Jewish Theological Seminary portals, JSTOR article viewer, Hebrew University manuscript databases.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Rank Insignia Redesign](#4-rank-insignia-redesign)
5. [Component-by-Component Redesign Guide](#5-component-by-component-redesign-guide)
6. [Page-by-Page Layout Notes](#6-page-by-page-layout-notes)
7. [Motion & Interaction](#7-motion--interaction)
8. [Academic Credibility Signals](#8-academic-credibility-signals)
9. [Full `src/app.css` Replacement](#9-full-srcappcss-replacement)

---

## 1. Design Principles

### 1.1 Legibility Over Atmosphere
Every design choice prioritizes reading comfort and information clarity. Torah scholarship requires long-form reading; the UI must never compete with the content. High contrast ratios (WCAG AA minimum, AAA where possible). No decorative elements that reduce legibility.

### 1.2 Tradition Signals Trust
Traditional donors and rabbinical figures trust institutions that look established. Use visual cues from centuries-old academic tradition: serifed headings, formal spacing, structured layouts, muted earth tones. The interface should feel like it has existed for decades, not weeks.

### 1.3 Warmth of Parchment, Not Cold of Screen
The primary surface color evokes aged parchment/vellum — warm ivory, not clinical white or cold gray. This connects subconsciously to Torah scrolls, printed sefarim, and the physicality of traditional learning. Backgrounds should feel natural and warm.

### 1.4 Hierarchy Through Restraint
Academic credibility comes from what you *don't* show. Minimal color usage — most of the interface is neutral. Color is reserved for status, rank, and actionable elements. When everything is highlighted, nothing is. The current cyberpunk palette uses 5+ accent colors simultaneously; the new palette uses 1–2 accents per view.

### 1.5 Institutional Formality
Spacing is generous. Borders are subtle. Shadows are barely-there or absent. The overall impression is of a well-typeset printed document, not a web application. Cards have thin borders, not dramatic shadows. Headers use proper typographic hierarchy, not size-as-emphasis.

### 1.6 Hebrew Dignity
Hebrew text is treated with the respect of a printed sefer. Right-to-left layout is primary, not an afterthought. Hebrew typography uses appropriate fonts with proper nikud support. English secondary text is clearly subordinate. Line heights are generous for Hebrew readability.

### 1.7 Quiet Authority
The system should convey that important scholarly work is happening here without needing to shout about it. Status indicators are present but understated. Token balances are factual, not gamified. Ranks are dignified titles, not leaderboard positions.

---

## 2. Color System

### 2.1 Mode Decision: **Light Mode Only**

**Rationale:** Academic institutions, grant applications, and philanthropic contexts universally present in light mode. Dark mode signals tech/gaming culture — exactly the opposite of our audience. A single light mode eliminates theme-switching complexity and ensures every screenshot, printout, and presentation looks institutional. If dark mode is ever needed (late-night learning sessions), it can be added later as an optional preference — but it is NOT part of this spec.

### 2.2 Semantic Color Tokens

All colors below replace the current cyberpunk tokens. Names are semantic — components reference these tokens, never raw hex values.

#### Backgrounds

| Token | Hex | Usage |
|---|---|---|
| `--color-bg-primary` | `#FAF7F2` | Page background — warm parchment ivory |
| `--color-bg-secondary` | `#F3EDE4` | Card/panel backgrounds — slightly deeper parchment |
| `--color-bg-tertiary` | `#EBE3D7` | Nested surfaces, table stripes, inset areas |
| `--color-bg-sidebar` | `#2C2418` | Sidebar — deep warm brown (sefer binding color) |
| `--color-bg-topbar` | `#FFFFFF` | Top bar — clean white with bottom border |
| `--color-bg-hover` | `#F0E8DA` | Hover state on interactive surfaces |
| `--color-bg-active` | `#E8DECE` | Active/pressed state |
| `--color-bg-selected` | `#E6DDD0` | Selected row/item |
| `--color-bg-code` | `#F5F0E8` | Code blocks, mono text backgrounds |

#### Text

| Token | Hex | Usage |
|---|---|---|
| `--color-text-primary` | `#1A1611` | Primary body text — near-black warm brown |
| `--color-text-secondary` | `#5C5347` | Secondary/helper text — muted brown |
| `--color-text-tertiary` | `#8A7F72` | Captions, timestamps, disabled labels |
| `--color-text-inverse` | `#FAF7F2` | Text on dark backgrounds (sidebar) |
| `--color-text-inverse-secondary` | `#C4B8A8` | Secondary text on dark backgrounds |
| `--color-text-link` | `#1B4F72` | Hyperlinks — deep academic blue |
| `--color-text-link-hover` | `#154360` | Link hover state |

#### Borders

| Token | Hex | Usage |
|---|---|---|
| `--color-border-primary` | `#D4CAB8` | Card borders, dividers — warm taupe |
| `--color-border-secondary` | `#E2D9CC` | Subtle inner dividers |
| `--color-border-strong` | `#B8AD9E` | Emphasized borders (focused inputs, active cards) |
| `--color-border-sidebar` | `#3D3326` | Borders within the sidebar |

#### Accents

| Token | Hex | Usage | Replaces |
|---|---|---|---|
| `--color-accent-primary` | `#1B4F72` | Primary actions, links, active nav — deep institutional blue | Cyan `#06b6d4` |
| `--color-accent-primary-hover` | `#154360` | Hover on primary accent | — |
| `--color-accent-primary-light` | `#D4E6F1` | Light wash for selected states, badges | — |
| `--color-accent-secondary` | `#7D6C3F` | Secondary accent — antiqued gold (subtle, not neon) | Gold `#fbbf24` |
| `--color-accent-secondary-light` | `#F2EACD` | Light gold wash for highlights | — |

#### Status Colors

| Token | Hex | Usage | Replaces |
|---|---|---|---|
| `--color-status-success` | `#1E6F50` | Approved, completed, online — deep forest green | Emerald |
| `--color-status-success-light` | `#D5F0E3` | Success background tint | — |
| `--color-status-warning` | `#A67B2C` | Pending, in review — warm amber | Gold/amber |
| `--color-status-warning-light` | `#FDF3DD` | Warning background tint | — |
| `--color-status-error` | `#922B21` | Rejected, failed, critical — deep burgundy | Crimson |
| `--color-status-error-light` | `#FADBD8` | Error background tint | — |
| `--color-status-info` | `#1B4F72` | Informational — matches primary accent | Sapphire |
| `--color-status-info-light` | `#D4E6F1` | Info background tint | — |
| `--color-status-draft` | `#8A7F72` | Draft/inactive — muted text color | Purple |
| `--color-status-draft-light` | `#EDEAE5` | Draft background tint | — |

#### Tier Colors (Ranks)

These replace the current gold/silver/bronze neon-inflected tier colors.

| Tier | Token | Hex | Concept |
|---|---|---|---|
| Enlisted (טוראי, רב טוראי) | `--color-tier-enlisted` | `#5D6D3F` | Olive green — new student, growing |
| Enlisted light | `--color-tier-enlisted-light` | `#E8EDD9` | Light olive wash |
| NCO (סמל, סמ"ר, רס"מ) | `--color-tier-nco` | `#1B4F72` | Deep blue — established scholar |
| NCO light | `--color-tier-nco-light` | `#D4E6F1` | Light blue wash |
| Officer (סגן → אלוף) | `--color-tier-officer` | `#7D6C3F` | Antiqued gold — senior authority |
| Officer light | `--color-tier-officer-light` | `#F2EACD` | Light gold wash |

---

## 3. Typography

### 3.1 Font Stack

**Hebrew primary:** `"Frank Ruhl Libre", "David Libre", "Noto Serif Hebrew", serif`
- **Frank Ruhl Libre** — Google Fonts, free. A modern cut of the classic Frank Ruhl typeface used in Israeli newspapers and academic publications. Available weights: 300–900. This is the primary font for all Hebrew headings and body text.
- **David Libre** — Google Fonts fallback. Traditional Hebrew book font.
- **Noto Serif Hebrew** — Google Fonts fallback. Universal coverage.

**English/Latin:** `"Libre Baskerville", "Georgia", serif`
- **Libre Baskerville** — Google Fonts, free. Classic Baskerville revival, the quintessential academic serif. Available weights: 400, 700.
- Georgia — system fallback, universally available, excellent screen serif.

**Monospace (code, addresses, hashes):** `"IBM Plex Mono", "Courier New", monospace`
- **IBM Plex Mono** — Google Fonts, free. Clean and institutional. Available weights: 400, 500, 600.

**Google Fonts import URL:**
```
https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@300;400;500;700;900&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Serif+Hebrew:wght@400;500;700&display=swap
```

### 3.2 Type Scale

All sizes use `rem`. Base size: `16px` (`1rem`).

| Token | Size | Weight | Usage |
|---|---|---|---|
| `--text-h1` | `2rem` (32px) | 700 | Page titles (בית המדרש, מבצעים) |
| `--text-h2` | `1.5rem` (24px) | 700 | Section headings, card titles |
| `--text-h3` | `1.25rem` (20px) | 600 | Sub-section headings, modal titles |
| `--text-h4` | `1.1rem` (17.6px) | 600 | Minor headings, widget titles |
| `--text-body` | `1rem` (16px) | 400 | Default body text |
| `--text-body-emphasis` | `1rem` (16px) | 600 | Emphasized body (names, amounts) |
| `--text-caption` | `0.875rem` (14px) | 400 | Timestamps, helper text, metadata |
| `--text-label` | `0.75rem` (12px) | 600 | Badge text, tab labels, form labels, uppercase Latin labels |
| `--text-mono` | `0.875rem` (14px) | 400 | Wallet addresses, hashes, contract data |

### 3.3 Hebrew Typography Rules

- **Line height:** `1.8` for Hebrew body text (Hebrew requires more generous line height than Latin due to descenders/ascenders and nikud). Headings: `1.4`.
- **Letter spacing:** `0` for Hebrew (never add letter-spacing to Hebrew text — it breaks visual word grouping). Latin body: `0.01em`. Latin labels: `0.05em`.
- **Direction:** All text containers default to `dir="rtl"`. English-only blocks (wallet addresses, contract data) use `dir="ltr"` inline.
- **Font weight discipline:** Hebrew body at 400 (regular). Headings at 700. Never use 300 (light) for Hebrew body — it reduces legibility at screen sizes.

---

## 4. Rank Insignia Redesign

### 4.1 Concept: Sefer & Crown Motif

The current flame motif (cyberpunk-styled fire) is replaced by a **Torah scroll / sefer motif** system that reflects academic progression:

- **Enlisted (טוראי, רב טוראי):** A single open book (sefer) viewed from above. Simple, clean. For rav_turai (PV2), the book has a small ribbon bookmark.
- **NCO (סמל, סמ"ר, רס"מ):** Stacked sefarim / open Torah scroll. Samal (SGT): two stacked books. Samal Rishon (SSG): open scroll with one column visible. Rav Samal (MSG): open scroll with two columns visible, flanked by olive branches.
- **Officer (סגן → אלוף):** Crown and Torah motif. Segen (LT): single crown above a scroll. Seren (CPT): crown with one star. Rav Seren (MAJ): crown with two stars. Sgan Aluf (LTC): crown with three stars above open Torah with olive branches. Aluf (GEN): ornate crown with menorah above open Torah, full olive wreath surrounding.

### 4.2 Tier-Specific Visual Treatment

| Tier | Primary Color | Secondary Color | Style |
|---|---|---|---|
| Enlisted | `#5D6D3F` (olive) | `#3D4A2A` (dark olive) | Thin stroke, simple geometry, 1.5px stroke width |
| NCO | `#1B4F72` (deep blue) | `#0E3A5C` (navy) | Medium stroke, moderate detail, 2px stroke width |
| Officer | `#7D6C3F` (antiqued gold) | `#5C4E2A` (dark gold) | Thicker stroke, ornate detail, 2px stroke + fill areas |

### 4.3 SVG Structure Description

Each insignia is a 32×32 viewBox SVG. All use `currentColor` with tier color applied via CSS class.

**Turai (טוראי) — Private:**
- A simple open book shape: two rectangles angled slightly apart (like an open book viewed from above), meeting at a spine line in the center. Stroke only, no fill. The pages are suggested by 2-3 thin horizontal lines inside each rectangle.

**Rav Turai (רב טוראי) — Corporal:**
- Same open book, but with a small triangular ribbon/bookmark hanging from the bottom of the spine. Ribbon uses secondary color.

**Samal (סמל) — Sergeant:**
- Two books stacked, slightly offset. Bottom book closed (single rectangle with spine line), top book open. Thin horizontal text lines on the open book's pages.

**Samal Rishon (סמ"ר) — Staff Sergeant:**
- A Torah scroll partially unrolled: two circles (atzei chaim / scroll handles) on left and right, connected by a curved parchment rectangle. One column of tiny horizontal lines (text) visible on the parchment.

**Rav Samal (רס"מ) — Master Sergeant:**
- Torah scroll fully open (wider parchment, two columns of text lines visible). Small olive branches (2-3 leaves each) flanking the scroll handles on each side.

**Segen (סגן) — Lieutenant:**
- A small simple crown (3 points) centered above a closed scroll. The crown has fill (using tier officer gold), the scroll is stroke-only.

**Seren (סרן) — Captain:**
- Crown (3 points) with a single small 5-point star centered above the middle point. Below: open scroll with one column.

**Rav Seren (רב סרן) — Major:**
- Crown (3 points) with two small stars flanking the center point. Below: open scroll with olive branches.

**Sgan Aluf (סגן אלוף) — Lt. Colonel:**
- Ornate crown (5 points) with three stars in an arc above it. Below: wide open Torah scroll with olive branches. The crown has more decorative detailing (small circles on each point).

**Aluf (אלוף) — General:**
- Full ornate crown (5 points with circle finials) with a 7-branch menorah centered above it. Below: wide open Torah scroll. Full olive wreath (connected branches) surrounding the entire composition. This is the most detailed insignia — uses both stroke and fill.

### 4.4 Implementation Notes for `RankInsignia.svelte`

The component currently takes `rank` and `size` props. Keep the same interface. Replace the internal SVG `<path>` data.

- Use a `switch` on `rank` to select the SVG content.
- Apply tier color via a wrapper class: `.tier-enlisted`, `.tier-nco`, `.tier-officer` — each sets `color` to the tier token.
- Default size: `32px`. Sizes used: `24px` (inline), `32px` (badges/cards), `48px` (profile page), `64px` (sidebar identity).
- SVGs should use `stroke="currentColor"` and `fill="none"` for stroke-only elements, `fill="currentColor"` for filled elements.

---

## 5. Component-by-Component Redesign Guide

### 5.1 Sidebar (`Sidebar.svelte`)

**Current:** Near-black background, neon cyan nav links, flame logo, glowing active state.

**New:**
- Background: `--color-bg-sidebar` (`#2C2418`) — deep warm brown, like the leather binding of a sefer.
- Logo area: Replace flame/cyber logo with institutional crest (see Section 8). White or light gold rendering on dark background.
- Nav links: `--color-text-inverse` (`#FAF7F2`), weight 400. No uppercase transform.
- Active nav item: Left border (3px, `--color-accent-secondary` antiqued gold), background `rgba(255,255,255,0.08)`, text weight 600.
- Hover: Background `rgba(255,255,255,0.05)`.
- Section dividers: `--color-border-sidebar` (`#3D3326`), 1px, horizontal.
- User identity section (bottom): Rank insignia (small, 24px), Hebrew name, rank title in `--color-text-inverse-secondary`.
- Collapse behavior: unchanged. When collapsed, show only icons + insignia.
- Border radius: `0` (sidebar is full-height, hard edges against page).
- Remove: all glow effects, scan lines, neon colors.

### 5.2 TopBar (`TopBar.svelte`)

**Current:** Dark background, neon text, wallet connect button with glow.

**New:**
- Background: `--color-bg-topbar` (`#FFFFFF`), solid white.
- Bottom border: `1px solid` `--color-border-primary`.
- Page title: `--text-h2`, `--color-text-primary`, weight 700, Frank Ruhl Libre.
- Breadcrumb: `--text-caption`, `--color-text-secondary`, separated by `/` or `›`.
- Search input: `--color-bg-secondary` background, `--color-border-primary` border, `border-radius: 6px`. Placeholder text in `--color-text-tertiary`.
- Wallet connect button: `--color-accent-primary` background, `--color-text-inverse` text, `border-radius: 6px`, no glow, no animation. Hover: `--color-accent-primary-hover`. Displays truncated address when connected.
- Height: `64px`. Padding: `0 24px`.
- Shadow: none. The bottom border provides separation.

### 5.3 RankInsignia (`RankInsignia.svelte`)

See Section 4 above for full redesign. Summary of changes:
- Replace all SVG content (flames → sefer/crown motifs).
- Color: `currentColor` inheriting from `.tier-enlisted` / `.tier-nco` / `.tier-officer` CSS classes.
- Remove: all glow filters, animation keyframes, neon stroke effects.

### 5.4 RankBadge (`RankBadge.svelte`)

**Current:** Colored pill with neon tier color, bold text.

**New:**
- Container: `display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 4px;`.
- Background: Tier light color (`--color-tier-enlisted-light`, `--color-tier-nco-light`, or `--color-tier-officer-light`).
- Text: Tier main color, `--text-label` size (12px), weight 600.
- Contains: small RankInsignia (16px) + rank Hebrew name.
- Border: `1px solid` tier main color at 20% opacity.
- No glow, no animation.

### 5.5 ChaverAvatar (`ChaverAvatar.svelte`)

**Current:** Dark circle with Hebrew initial, neon border for online status.

**New:**
- Circle: `--color-bg-tertiary` background, `--color-text-primary` letter.
- Font: Frank Ruhl Libre, weight 700, sized to 60% of avatar diameter.
- Online dot: `--color-status-success` (`#1E6F50`), 8px circle, positioned bottom-right. Subtle 2px white ring around the dot for contrast.
- Border: `2px solid --color-border-primary`. No special border for online (the dot handles it).
- Sizes: 32px (list rows), 40px (cards), 64px (profile header).
- No glow, no pulse animation on the online dot.

### 5.6 StatusBadge (`StatusBadge.svelte`)

**Current:** Colored pill with neon status colors.

**New mapping:**

| Status | Background | Text | Border |
|---|---|---|---|
| `open` | `--color-status-info-light` | `--color-status-info` | 1px info at 30% |
| `in_progress` | `--color-status-warning-light` | `--color-status-warning` | 1px warning at 30% |
| `submitted` | `--color-status-info-light` | `--color-status-info` | 1px info at 30% |
| `in_review` | `--color-status-warning-light` | `--color-status-warning` | 1px warning at 30% |
| `revision_requested` | `--color-status-error-light` | `--color-status-error` | 1px error at 30% |
| `approved` / `completed` | `--color-status-success-light` | `--color-status-success` | 1px success at 30% |
| `published` | `--color-status-success-light` | `--color-status-success` | 1px success at 30% |
| `rejected` / `failed` | `--color-status-error-light` | `--color-status-error` | 1px error at 30% |
| `draft` / `archived` | `--color-status-draft-light` | `--color-status-draft` | 1px draft at 30% |
| `active` | `--color-accent-primary-light` | `--color-accent-primary` | 1px primary at 30% |
| `pending` | `--color-status-warning-light` | `--color-status-warning` | 1px warning at 30% |

- Shape: `border-radius: 4px; padding: 2px 8px;`.
- Font: `--text-label`, weight 600.
- No icons inside — text only, keep it clean.

### 5.7 ProgressBar (`ProgressBar.svelte`)

**Current:** Neon colored bars with glow (gold, sapphire, emerald variants).

**New:**
- Track: `--color-bg-tertiary`, height `8px`, `border-radius: 4px`.
- Fill: `--color-accent-primary` (default), `--color-status-success` (completed/on-track), `--color-status-warning` (behind), `--color-status-error` (critical/overdue).
- No glow, no gradient, no animation on fill. Solid flat color.
- Percentage text (if shown): `--text-caption`, `--color-text-secondary`, positioned to the right (left in RTL) of the bar.
- Token budget bars: Use `--color-accent-secondary` (gold) for "tokens used / tokens allocated" to distinguish from progress.

### 5.8 TokenDisplay (`TokenDisplay.svelte`)

**Current:** Sechar balance with neon icon, prominent glow.

**New:**
- Icon: Small menorah or coin icon (SVG, 16px), `--color-accent-secondary` (antiqued gold).
- Amount: `--text-body-emphasis` (16px, weight 600), `--color-text-primary`.
- Label "TMIM": `--text-label`, `--color-text-secondary`, after the number.
- Container: no background, no border. Just icon + number + label inline.
- For large displays (dashboard, profile): `--text-h3` size for the amount, with a subtle `--color-bg-secondary` card behind it.
- No animation, no glow, no pulse.

### 5.9 Toast (`Toast.svelte`)

**Current:** Dark background toasts with neon borders, scan-line effect.

**New:**
- Container: `--color-bg-topbar` (white) background, `border-radius: 8px`, `box-shadow: 0 2px 8px rgba(0,0,0,0.1)`.
- Left border: `4px solid` status color (success/error/warning/info).
- Text: `--color-text-primary`, `--text-body`.
- Optional link: `--color-text-link`, underlined.
- Dismiss button: `--color-text-tertiary`, subtle `×`.
- Position: top-right (top-left in RTL), `16px` from edges.
- No scan-line, no glow.

### 5.10 PeerReviewCard (`PeerReviewCard.svelte`)

**Current:** Dark card with neon-accented star rating.

**New:**
- Card: `--color-bg-secondary` background, `1px solid --color-border-primary`, `border-radius: 8px`, `padding: 16px`.
- Star rating: `--color-accent-secondary` (antiqued gold) for filled stars, `--color-border-primary` for empty stars. Stars are 18px. Use simple 5-point star SVG, no glow.
- Reviewer name: `--text-body-emphasis`, with `RankBadge` inline.
- Comments: `--text-body`, `--color-text-primary`.
- Suggestions: bulleted list, `--text-body`, `--color-text-secondary`.
- Divider between comments and suggestions: `1px solid --color-border-secondary`.
- Date: `--text-caption`, `--color-text-tertiary`, positioned top-right (top-left RTL).

### 5.11 DiscussionThread (`DiscussionThread.svelte`)

**Current:** Dark thread with neon message bubbles.

**New:**
- Thread container: no background (inherits page background).
- Each message: `--color-bg-secondary` background, `1px solid --color-border-secondary`, `border-radius: 8px`, `padding: 12px 16px`, `margin-bottom: 8px`.
- Author line: `ChaverAvatar` (24px) + name (`--text-body-emphasis`) + timestamp (`--text-caption`, `--color-text-tertiary`).
- Message body: `--text-body`, `--color-text-primary`. Generous line-height (1.8 for Hebrew).
- Nested replies: indent `24px` from parent (in RTL: margin-right: 24px), with a `2px solid --color-border-secondary` vertical line on the right side (connecting parent to children).
- Reply button: text-only, `--color-text-link`, `--text-caption`.

### 5.12 LocationBadge (`LocationBadge.svelte`)

**Current:** Neon-styled location pill.

**New:**
- Container: `display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px;`.
- Background: `--color-bg-tertiary`.
- Text: `--text-label`, `--color-text-secondary`.
- Icon: small map-pin SVG (14px), `--color-text-tertiary`.
- Border: `1px solid --color-border-secondary`.

### 5.13 ConfirmDialog (`ConfirmDialog.svelte`)

**Current:** Dark modal with neon border.

**New:**
- Overlay: `rgba(0, 0, 0, 0.3)` — lighter than typical to maintain the airy academic feel.
- Dialog: `--color-bg-topbar` (white) background, `border-radius: 12px`, `box-shadow: 0 4px 24px rgba(0,0,0,0.12)`, `max-width: 440px`, centered.
- Title: `--text-h3`, `--color-text-primary`.
- Body text: `--text-body`, `--color-text-secondary`.
- Buttons: Primary action uses `--color-accent-primary` bg + white text, `border-radius: 6px`, `padding: 8px 20px`. Cancel button: `--color-bg-secondary` bg, `--color-text-secondary` text, `1px solid --color-border-primary`.
- Destructive actions: Primary button uses `--color-status-error` instead.
- Divider above button row: `1px solid --color-border-secondary`.

### 5.14 LoadingOverlay (`LoadingOverlay.svelte`)

**Current:** Full-screen dark overlay with neon spinner.

**New:**
- Overlay: `--color-bg-primary` at 80% opacity.
- Spinner: A simple rotating ring. `3px solid --color-border-primary`, `border-top-color: --color-accent-primary`. 32px diameter. `animation: spin 0.8s linear infinite`.
- Optional text beneath spinner: `--text-body`, `--color-text-secondary`, e.g. "טוען..." (loading...).
- No scan-line, no glow, no pulse.

### 5.15 EmptyState (`EmptyState.svelte`)

**Current:** Dark card with neon icon and text.

**New:**
- Container: centered, `max-width: 400px`, `padding: 48px 24px`.
- Icon: `48px`, `--color-text-tertiary`, simple line SVG (e.g., open book for empty chaburot, magnifying glass for no results, scroll for empty chibburim).
- Title: `--text-h3`, `--color-text-secondary`.
- Description: `--text-body`, `--color-text-tertiary`.
- Action button (if present): `--color-accent-primary` bg, white text, `border-radius: 6px`.

---

## 6. Page-by-Page Layout Notes

### 6.1 Dashboard (`/` — בית המדרש)

**Current:** Welcome card with neon border, cyber-styled stats grid, activity feed with dark cards.

**New layout concept:** The dashboard should feel like the front page of an academic journal or the bulletin board in a beis medrash entrance.

- **Welcome section:** Clean card with `--color-bg-secondary`, thin border. User's Hebrew name in `--text-h2`. Current rank with `RankBadge`. Rank progress bar (subtle, `--color-accent-secondary` fill showing progress to next rank). No "XP bar" language — label it "מסלול קידום" (advancement path).
- **Seder schedule widget:** Format like a printed zmanim sheet. Table with clean borders, times in `--text-mono`. Header row: `--color-bg-tertiary`. Current seder highlighted with `--color-bg-hover` and a subtle left/right border accent.
- **My chibburim (active assignments):** List format, not cards. Each row: chibbur name, chaburah name, status badge, deadline. Sort by deadline proximity. Overdue items: row gets `--color-status-error-light` background tint.
- **Activity feed:** Simple chronological list. Each entry: timestamp (caption), actor name, action description. No avatars in the feed — keep it text-dense like an academic log. Dividers between days.
- **Active chaburot summary:** 2-3 cards showing ongoing campaigns. Each card: name, category badge, progress bar, enrolled count. Style like research program abstracts.
- **Online chaverim:** Subtle section at bottom. Small avatars (24px) in a wrapping row. Count badge: "12 מחוברים" (12 online).

### 6.2 Chaburahot List (`/chaburot` — מבצעים)

**Current:** Neon grid cards with progress bars and glow effects.

**New:** Research program directory.
- Grid layout: 1 column on mobile, 2 on tablet, 3 on desktop.
- Each card: `--color-bg-secondary`, `1px solid --color-border-primary`, `border-radius: 8px`.
  - Header: Chaburah name (`--text-h3`), type badge (course/research/publication/chaburah), category badge.
  - Body: Description truncated to 3 lines. Topics as small tags (`--color-bg-tertiary` bg, `--text-label`).
  - Footer: Progress bar, "X/Y enrolled", token allocation, deadline.
  - Status: Top-right corner `StatusBadge`.
- Filter bar: horizontal row of dropdown selects (status, category, type) + search input. Clean, flat dropdowns with `--color-bg-secondary` bg.
- "Create new" button (visible to officers): `--color-accent-primary`, positioned in top bar area or above filter row.

### 6.3 Create Chaburah (`/chaburot/new` — מבצע חדש)

- Form card: `--color-bg-secondary`, centered, `max-width: 640px`.
- Form fields: label above input. Labels in `--text-label`, weight 600. Inputs: `--color-bg-primary` bg, `1px solid --color-border-primary`, `border-radius: 6px`, `padding: 10px 14px`. Focus: `--color-border-strong` border, no glow.
- Section dividers between form groups (basic info / details / tokens / schedule).
- Submit button: `--color-accent-primary`, full width at bottom of form.

### 6.4 Chaburah Detail (`/chaburot/[id]`)

Layout like a research program overview page:
- **Header:** Chaburah name (`--text-h1`), status badge, category badge, type badge, creator name with rank.
- **Description section:** Full description, generous typography. If `researchQuestion` exists, display it in a callout box: `--color-bg-tertiary`, `border-right: 3px solid --color-accent-primary` (RTL right = visual left in LTR contexts; this appears on the reading-start side).
- **Progress section:** Token allocation bar, enrolled count, chibburim completion stats.
- **Masimot tab:** Table of all chibburim in this chaburah. Columns: name, type, assignee, status, tokens, deadline. Sortable. Clickable rows.
- **Enrolled chaverim tab:** Grid of avatar + name + rank badges.
- **Timeline/activity tab:** Chronological list of events (enrollment, submission, approval).

### 6.5 Masimot List (`/chibburim` — משימות)

- Table layout (not cards — assignments are work items, tables are more appropriate).
- Columns: Name, Type, Chaburah, Assignee, Status, Tokens, Deadline.
- Filterable by status, type. Searchable.
- Unassigned chibburim: "Claim" button in the assignee column (text button, `--color-text-link`).
- My assignments highlighted with `--color-bg-hover` row background.

### 6.6 Chibbur Detail (`/chibburim/[id]`)

Layout like an academic paper submission page:
- **Header:** Title, type badge, status badge. Parent chaburah linked.
- **Assignment panel:** Assignee (avatar + name + rank), reviewer (avatar + name + rank), token reward, deadline.
- **Content section:** If submitted, show content URL link styled as a formal "View submission" button. Submission notes in a quoted block.
- **Seifim sub-list:** Table of sub-tasks with status, assignee, priority, token reward.
- **Peer reviews section:** `PeerReviewCard` components stacked vertically.
- **Discussion thread:** `DiscussionThread` component.
- **Action bar:** Fixed at bottom of content area. Buttons depend on status and user role:
  - "Submit" (assignee, in_progress) — primary button
  - "Approve / Request Revision / Reject" (reviewer, in_review) — primary + secondary + destructive buttons
  - "Claim" (unassigned) — primary button

### 6.7 Seifim List (`/seifim` — תפקידים)

- Similar to chibburim list, table format.
- Columns: Name, Type, Parent Chibbur, Assignee, Status, Priority, Tokens.
- Priority indicator: colored dot before the task name (`critical` = `--color-status-error`, `high` = `--color-status-warning`, `medium` = `--color-accent-primary`, `low` = `--color-text-tertiary`).
- Filter by status, priority.

### 6.8 Anash Roster (`/anash` — אנש)

**Current:** Card grid with neon rank colors.

**New:** Academic roster / faculty directory style.
- Default view: Table sorted by rank (highest first). Columns: Avatar + Name, Rank (with insignia), Track, Location, Sechar balance, Masimot completed, Online status.
- Hierarchy view toggle: Tree view grouped by shiur groups. Group header with leader's name and rank. Members indented beneath.
- Each row: `ChaverAvatar` (32px) + name (`--text-body-emphasis`) + `RankBadge`.
- Clickable rows → navigate to profile.
- Search: by name, location, track.

### 6.9 Chaver Profile (`/anash/[id]`)

Layout like a faculty profile page:
- **Header card:** Large avatar (64px), full Hebrew name (`--text-h1`), rank with full insignia (48px), track, location badge, wallet address (mono, truncated). Chavrusa link if paired.
- **Stats grid:** 4 columns — Sechar balance, chibburim completed, papers published, peer reviews given. Each stat: large number (`--text-h2`, `--color-text-primary`) + label below (`--text-caption`, `--color-text-secondary`).
- **Rank progress bar:** Progress toward next rank. "X Sechar / Y Sechar needed for [next rank name]".
- **Tabs:**
  - Active chibburim: table of current assignments
  - Completed work: table of finished chibburim with ratings
  - Token history: chronological log of Sechar earned/spent
  - Voting history (new, from Spec 2): governance participation

### 6.10 Review (`/review` — חדר המשפיע)

**Current:** Dark review queue with neon-highlighted pending items.

**New:** Academic review panel, styled like a journal editorial dashboard.
- **Section: Pending chibburim review:** Cards (not table — reviewers need more context at a glance). Each card shows:
  - Chibbur title + type badge
  - Author name + rank
  - Chaburah name
  - Submission date + days pending
  - Token allocation
  - Preview snippet of submission (first 100 chars)
  - Action buttons: "Review" (navigates to detail)
- **Section: Pending seifim review:** Simpler list — task name, assignee, type, "Approve / Reject" inline buttons.
- Cards sorted by oldest-first (longest-waiting submissions rise to top).
- Counter badges in section headers: "משימות לבדיקה (5)" — showing pending count.

### 6.11 Farbrengen (`/farbrengen` — פארבריינגען)

Three tabs, styled academically:
- **Live/upcoming farbrengens tab:** Event cards with date, topic, speaker, location. Active events get a subtle `--color-status-success-light` background. "Join" button on live events.
- **Maamarim list tab:** Styled like a journal article index. Each entry: title (bold), author, date, category tag. Click to expand/view. Citation-style metadata display (see Section 8).
- **Activity stream tab:** Same treatment as dashboard activity feed — text-dense chronological log.

### 6.12 Treasury (`/treasury` — אוצר)

**Current:** Dark stats with neon numbers.

**New:** Institutional financial dashboard — serious, clear, auditable-looking.
- **Stats row (top):** 4 large stat cards across the top:
  - Total donated (formatted currency)
  - Sechar circulating (with total minted below in caption)
  - Current treasury balance
  - Reserve ratio (percentage, with gauge visualization)
- **Donation history:** Table with: date, donor name/wallet, amount, earmark (makom/chaburah if specified), Sechar minted. Subtle row striping (`--color-bg-tertiary` alternating).
- **Donation form** (new in Spec 2, placeholder here): Card for making donations.
- **Redemption form** (new in Spec 2, placeholder here): Card for redeeming Sechar.
- Numbers use tabular figures (monospace for alignment). Large amounts: `--text-h3` weight 600.

### 6.13 Settings (`/settings` — הגדרות)

- Form card layout, same treatment as Create Chaburah form.
- Wallet section: Connected wallet display (mono text), connect/disconnect button.
- Profile section: Name field, track selector, location selector.
- Dev mode user switcher: Dropdown select listing all mock chaverim. Labeled clearly as "מצב פיתוח" (dev mode) with `--color-status-warning-light` background on the section.

### 6.14 Signup (`/signup` — הרשמה)

- Centered card, `max-width: 480px`.
- Institutional crest/logo at top (64px, centered).
- Title: "הרשמה לחיילי בית דוד" in `--text-h2`.
- Wallet connection flow: Step 1 — "Connect Wallet" button. Step 2 — Signature prompt (explain in Hebrew what they're signing). Step 3 — Success + redirect.
- Clean, minimal. No background decorations.

---

## 7. Motion & Interaction

### 7.1 Animation Philosophy: **Minimal and Purposeful**

Academic interfaces should feel stable and reliable. Animations exist only to provide spatial context (where did this come from?) and state feedback (did my action work?). No decorative motion.

### 7.2 Transitions

| Transition | Duration | Easing | Usage |
|---|---|---|---|
| Color/background change | `150ms` | `ease-in-out` | Hover, focus, status changes |
| Opacity | `200ms` | `ease-in-out` | Appearing/disappearing elements |
| Transform (slide) | `250ms` | `ease-out` | Sidebar collapse, toast entry |
| Page transition | `0ms` (none) | — | SvelteKit page navigations are instant, no page transition |

### 7.3 Replacements for Current Effects

| Current Effect | Replacement |
|---|---|
| `.scan-line` | Remove entirely. No replacement. |
| `.glow-*` (glow-cyan, glow-gold, etc.) | Remove entirely. Use `box-shadow: 0 0 0 2px --color-accent-primary` for focus rings instead. |
| Neon text shadow | Remove entirely. No text shadows. |
| Pulse animation (online dot) | Remove. Static green dot. |
| Shimmer/loading skeleton | Simple opacity pulse: `opacity: 0.5 → 1.0`, `1.5s`, `ease-in-out`, infinite. |

### 7.4 Toast Animation

- Entry: Slide in from top-right (top-left in RTL), `250ms ease-out`.
- Exit: Fade out `200ms ease-in`, then remove from DOM.
- Auto-dismiss: 5 seconds for info/success, 8 seconds for warnings, manual dismiss only for errors.
- Stack: New toasts push older ones down, `150ms ease-out` repositioning.

### 7.5 Focus States

All interactive elements get a consistent focus ring:
- `outline: 2px solid --color-accent-primary; outline-offset: 2px;`
- Remove default browser outlines via `outline: none` on the base element, then apply the above on `:focus-visible`.

---

## 8. Academic Credibility Signals

### 8.1 Institutional Crest / Logo

Replace the current flame/cyber logo with a formal institutional crest:
- **Shape:** Shield or oval frame (traditional academic seal shape).
- **Central motif:** Open Torah scroll with two atzei chaim (scroll handles).
- **Surrounding:** Olive branches wreath (academic laurel equivalent in Jewish context).
- **Text band:** "חיילי בית דוד" (Beis) in the upper arc, founding year or motto in the lower arc.
- **Style:** Single color (works in `--color-text-inverse` on dark sidebar, `--color-text-primary` on light backgrounds). Line art, not filled shapes — think university seal engraving style.
- **Sizes:** 48px (sidebar), 64px (signup page), 120px (print/export header).

Implementation note: This is an SVG. Create as `InstitutionalCrest.svelte` component using `currentColor`.

### 8.2 Citation-Style Attribution

When displaying maamarim (Chassidic discourses) in the Farbrengen page and elsewhere, use academic citation formatting:
- Title in **bold** or *italic* (per academic convention for work titles)
- Author/rebbe attribution line
- Date and source reference
- Format example: **ד"ה באתי לגני** — כ"ק אדמו"ר, י' שבט תשי"א
- This mirrors how academic papers cite primary sources — it signals scholarly rigor.

### 8.3 Publication-Style Metadata

Masimot (assignments/papers) should display metadata like an academic journal submission:
- **Submitted:** [date]
- **Reviewed by:** [name], [rank]
- **Status:** [badge]
- **DOI-like identifier:** Display the chibbur ID in a formatted way (e.g., "CBD-2026-0042") as a reference number.
- **Abstract/summary** section when viewing a completed chibbur.

### 8.4 Formal Header Treatment

Page headers should feel like chapter headings in an academic text:
- Rule (horizontal line) beneath the title: `1px solid --color-border-primary`, full width, `margin-top: 8px`.
- Subtitle/description in `--text-body`, `--color-text-secondary`, beneath the rule.

### 8.5 Print-Friendly Consideration

The academic theme should look good if a user prints a page (grant committee member printing a report):
- All colors have sufficient contrast on white paper.
- No dark backgrounds (except sidebar, which would be excluded from print via `@media print`).
- Token displays and stats use high-contrast text, not color-dependent meaning.

---

## 9. Full `src/app.css` Replacement

This is the primary deliverable. The implementer will replace the entire contents of `src/app.css` with the following.

```css
/* ============================================================
   Beis — Academic Theme
   SvelteKit 2 + Tailwind CSS v4
   ============================================================ */

/* Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@300;400;500;700;900&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Serif+Hebrew:wght@400;500;700&display=swap');

@import "tailwindcss";

/* ============================================================
   Theme Tokens
   ============================================================ */

@theme {
  /* --- Backgrounds --- */
  --color-bg-primary: #FAF7F2;
  --color-bg-secondary: #F3EDE4;
  --color-bg-tertiary: #EBE3D7;
  --color-bg-sidebar: #2C2418;
  --color-bg-topbar: #FFFFFF;
  --color-bg-hover: #F0E8DA;
  --color-bg-active: #E8DECE;
  --color-bg-selected: #E6DDD0;
  --color-bg-code: #F5F0E8;

  /* --- Text --- */
  --color-text-primary: #1A1611;
  --color-text-secondary: #5C5347;
  --color-text-tertiary: #8A7F72;
  --color-text-inverse: #FAF7F2;
  --color-text-inverse-secondary: #C4B8A8;
  --color-text-link: #1B4F72;
  --color-text-link-hover: #154360;

  /* --- Borders --- */
  --color-border-primary: #D4CAB8;
  --color-border-secondary: #E2D9CC;
  --color-border-strong: #B8AD9E;
  --color-border-sidebar: #3D3326;

  /* --- Accent: Primary (Institutional Blue) --- */
  --color-accent-primary: #1B4F72;
  --color-accent-primary-hover: #154360;
  --color-accent-primary-light: #D4E6F1;

  /* --- Accent: Secondary (Antiqued Gold) --- */
  --color-accent-secondary: #7D6C3F;
  --color-accent-secondary-light: #F2EACD;

  /* --- Status --- */
  --color-status-success: #1E6F50;
  --color-status-success-light: #D5F0E3;
  --color-status-warning: #A67B2C;
  --color-status-warning-light: #FDF3DD;
  --color-status-error: #922B21;
  --color-status-error-light: #FADBD8;
  --color-status-info: #1B4F72;
  --color-status-info-light: #D4E6F1;
  --color-status-draft: #8A7F72;
  --color-status-draft-light: #EDEAE5;

  /* --- Tiers --- */
  --color-tier-enlisted: #5D6D3F;
  --color-tier-enlisted-light: #E8EDD9;
  --color-tier-nco: #1B4F72;
  --color-tier-nco-light: #D4E6F1;
  --color-tier-officer: #7D6C3F;
  --color-tier-officer-light: #F2EACD;

  /* --- Typography --- */
  --font-hebrew: "Frank Ruhl Libre", "David Libre", "Noto Serif Hebrew", serif;
  --font-latin: "Libre Baskerville", "Georgia", serif;
  --font-mono: "IBM Plex Mono", "Courier New", monospace;

  /* --- Spacing (keep Tailwind defaults, override where needed) --- */
  --spacing-page-x: 2rem;
  --spacing-page-y: 1.5rem;
  --spacing-card: 1.25rem;
  --spacing-section: 2.5rem;

  /* --- Radii --- */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* --- Shadows --- */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 4px 24px rgba(0, 0, 0, 0.12);

  /* --- Transitions --- */
  --transition-fast: 150ms ease-in-out;
  --transition-normal: 200ms ease-in-out;
  --transition-slow: 250ms ease-out;
}

/* ============================================================
   Base Styles
   ============================================================ */

html {
  direction: rtl;
  font-family: var(--font-hebrew);
  font-size: 16px;
  line-height: 1.8;
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

/* ============================================================
   Typography
   ============================================================ */

h1, h2, h3, h4 {
  font-family: var(--font-hebrew);
  color: var(--color-text-primary);
  line-height: 1.4;
  margin: 0;
}

h1 { font-size: 2rem; font-weight: 700; }
h2 { font-size: 1.5rem; font-weight: 700; }
h3 { font-size: 1.25rem; font-weight: 600; }
h4 { font-size: 1.1rem; font-weight: 600; }

p {
  margin: 0 0 1rem 0;
  line-height: 1.8;
}

/* Latin text (English labels, wallet addresses) */
[lang="en"], .text-latin {
  font-family: var(--font-latin);
  direction: ltr;
}

/* Monospace text */
code, .mono, .wallet-address, .contract-address {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  direction: ltr;
  unicode-bidi: embed;
  background-color: var(--color-bg-code);
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
}

/* Captions and labels */
.caption {
  font-size: 0.875rem;
  color: var(--color-text-tertiary);
}

.label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.01em;
}

/* ============================================================
   Links
   ============================================================ */

a {
  color: var(--color-text-link);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  transition: color var(--transition-fast);
}

a:hover {
  color: var(--color-text-link-hover);
}

/* ============================================================
   Focus States (global)
   ============================================================ */

*:focus {
  outline: none;
}

*:focus-visible {
  outline: 2px solid var(--color-accent-primary);
  outline-offset: 2px;
}

/* ============================================================
   Buttons
   ============================================================ */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-md);
  font-family: var(--font-hebrew);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  border: none;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.btn-primary {
  background-color: var(--color-accent-primary);
  color: var(--color-text-inverse);
}

.btn-primary:hover {
  background-color: var(--color-accent-primary-hover);
}

.btn-secondary {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-primary);
}

.btn-secondary:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.btn-destructive {
  background-color: var(--color-status-error);
  color: var(--color-text-inverse);
}

.btn-destructive:hover {
  background-color: #7B241C;
}

.btn-ghost {
  background-color: transparent;
  color: var(--color-text-link);
  padding: 0.5rem 0.75rem;
}

.btn-ghost:hover {
  background-color: var(--color-bg-hover);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ============================================================
   Cards
   ============================================================ */

.card {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-card);
}

.card-hover:hover {
  background-color: var(--color-bg-hover);
  transition: background-color var(--transition-fast);
}

.card-header {
  border-bottom: 1px solid var(--color-border-secondary);
  padding-bottom: 0.75rem;
  margin-bottom: 0.75rem;
}

/* ============================================================
   Forms
   ============================================================ */

input[type="text"],
input[type="email"],
input[type="number"],
input[type="search"],
input[type="url"],
textarea,
select {
  width: 100%;
  padding: 0.625rem 0.875rem;
  font-family: var(--font-hebrew);
  font-size: 1rem;
  line-height: 1.8;
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-fast);
}

input:focus,
textarea:focus,
select:focus {
  border-color: var(--color-border-strong);
}

input::placeholder,
textarea::placeholder {
  color: var(--color-text-tertiary);
}

label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 0.375rem;
}

/* ============================================================
   Tables
   ============================================================ */

table {
  width: 100%;
  border-collapse: collapse;
}

thead th {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-align: right; /* RTL */
  padding: 0.75rem 1rem;
  border-bottom: 2px solid var(--color-border-primary);
  background-color: var(--color-bg-tertiary);
}

tbody td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border-secondary);
  vertical-align: middle;
}

tbody tr:hover {
  background-color: var(--color-bg-hover);
}

/* Alternating row striping */
tbody tr:nth-child(even) {
  background-color: var(--color-bg-tertiary);
}

tbody tr:nth-child(even):hover {
  background-color: var(--color-bg-hover);
}

/* ============================================================
   Badges & Pills
   ============================================================ */

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
}

/* ============================================================
   Tier Classes
   ============================================================ */

.tier-enlisted {
  color: var(--color-tier-enlisted);
}

.tier-nco {
  color: var(--color-tier-nco);
}

.tier-officer {
  color: var(--color-tier-officer);
}

.tier-enlisted-bg {
  background-color: var(--color-tier-enlisted-light);
  color: var(--color-tier-enlisted);
  border: 1px solid rgba(93, 109, 63, 0.2);
}

.tier-nco-bg {
  background-color: var(--color-tier-nco-light);
  color: var(--color-tier-nco);
  border: 1px solid rgba(27, 79, 114, 0.2);
}

.tier-officer-bg {
  background-color: var(--color-tier-officer-light);
  color: var(--color-tier-officer);
  border: 1px solid rgba(125, 108, 63, 0.2);
}

/* ============================================================
   Status Badge Variants
   ============================================================ */

.status-success {
  background-color: var(--color-status-success-light);
  color: var(--color-status-success);
  border: 1px solid rgba(30, 111, 80, 0.3);
}

.status-warning {
  background-color: var(--color-status-warning-light);
  color: var(--color-status-warning);
  border: 1px solid rgba(166, 123, 44, 0.3);
}

.status-error {
  background-color: var(--color-status-error-light);
  color: var(--color-status-error);
  border: 1px solid rgba(146, 43, 33, 0.3);
}

.status-info {
  background-color: var(--color-status-info-light);
  color: var(--color-status-info);
  border: 1px solid rgba(27, 79, 114, 0.3);
}

.status-draft {
  background-color: var(--color-status-draft-light);
  color: var(--color-status-draft);
  border: 1px solid rgba(138, 127, 114, 0.3);
}

/* ============================================================
   Layout Utilities
   ============================================================ */

.page-container {
  padding: var(--spacing-page-y) var(--spacing-page-x);
}

.page-header {
  margin-bottom: var(--spacing-section);
}

.page-header h1 {
  margin-bottom: 0.5rem;
}

.page-header-rule {
  border: none;
  border-top: 1px solid var(--color-border-primary);
  margin-top: 0.5rem;
}

.section {
  margin-bottom: var(--spacing-section);
}

/* ============================================================
   Callout Box (for research questions, notices)
   ============================================================ */

.callout {
  background-color: var(--color-bg-tertiary);
  border-right: 3px solid var(--color-accent-primary); /* RTL: right side = leading edge */
  padding: 1rem 1.25rem;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

.callout-warning {
  border-right-color: var(--color-status-warning);
  background-color: var(--color-status-warning-light);
}

.callout-error {
  border-right-color: var(--color-status-error);
  background-color: var(--color-status-error-light);
}

/* ============================================================
   Loading Spinner
   ============================================================ */

@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border-primary);
  border-top-color: var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ============================================================
   Shimmer / Skeleton Loading
   ============================================================ */

@keyframes shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.skeleton {
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  animation: shimmer 1.5s ease-in-out infinite;
}

/* ============================================================
   Toast
   ============================================================ */

.toast {
  background-color: var(--color-bg-topbar);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 0.75rem 1rem;
  border-right: 4px solid var(--color-status-info); /* RTL leading edge */
}

.toast-success { border-right-color: var(--color-status-success); }
.toast-error { border-right-color: var(--color-status-error); }
.toast-warning { border-right-color: var(--color-status-warning); }

/* ============================================================
   Scrollbar (subtle, academic)
   ============================================================ */

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg-primary);
}

::-webkit-scrollbar-thumb {
  background: var(--color-border-primary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-strong);
}

/* ============================================================
   Print Styles
   ============================================================ */

@media print {
  .sidebar,
  .topbar,
  .toast,
  .btn,
  .wallet-address {
    display: none !important;
  }

  body {
    background: white;
    color: black;
    font-size: 12pt;
  }

  .card {
    border: 1px solid #ccc;
    box-shadow: none;
    break-inside: avoid;
  }
}

/* ============================================================
   REMOVE: All cyberpunk effects
   The following classes should be deleted from any component
   that references them. Listed here as reminders:
   - .scan-line (remove)
   - .glow-cyan, .glow-gold, .glow-purple, .glow-emerald (remove)
   - .neon-border (remove)
   - .cyber-bg (remove)
   - .pulse-glow (remove)
   - Any text-shadow with neon colors (remove)
   - Any box-shadow with neon spread (remove)
   ============================================================ */
```

---

## Implementation Checklist (for the implementer)

1. Replace `src/app.css` with the content from Section 9 above.
2. Add the Google Fonts `<link>` to `src/app.html` `<head>` (or keep the `@import` in CSS — the CSS version is included above).
3. Update `Sidebar.svelte` — change background, nav styles, logo to institutional crest.
4. Update `TopBar.svelte` — white background, bottom border, clean styling.
5. Update `RankInsignia.svelte` — replace all SVG paths with new sefer/crown motifs.
6. Update each of the 15 components per Section 5 specifications.
7. Remove all cyberpunk CSS classes (`.scan-line`, `.glow-*`, `.neon-*`, `.cyber-*`, `.pulse-*`).
8. Search for any inline `style` attributes with hardcoded neon hex values and replace with theme tokens.
9. Test all 14 pages visually — every page should feel like an academic institution portal.
10. Verify RTL layout is intact — no broken alignment from the theme swap.

---

*End of Spec 1: Academic UI Redesign*
