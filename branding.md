# Almanac FI — Branding Guideline

This document defines the brand foundation for Almanac FI: what the name means, how it should sound, and how it should look. It exists to be extended, not replaced — a later UX guideline should derive layout, component, and interaction rules from the principles here rather than re-deciding them.

It builds on `product.md` (product vision and principles) and the existing UI foundation shipped in 023a (`apps/web/src/styles.css`), which was intentionally left neutral pending this work.

---

## 1. Name and positioning

**Full name:** Almanac FI
**Short form:** Almanac (acceptable in UI chrome, CLI banners, and tight spaces where "FI" is established by context)
**Tagline:** Almanac — Financial Intelligence

An almanac is a record of the past and a forecast of the future in one document — exactly what the product does with a user's financial data. "FI" is deliberately double-duty:

- **Financial Intelligence** — the AI experimentation layer, model reasoning, and generated recommendations.
- **Financial Independence** — the FIRE-community goal the target audience is already working toward.

Use the tagline once, prominently (README, about page, marketing surfaces). Do not restate the FI wordplay repeatedly in UI copy or headings — it should land once and then get out of the way. The name should never be spelled out as an acronym expansion inside the product ("Financial Intelligence" as a label on a screen) — that belongs to brand copy, not product chrome.

**Do not reference or compare against** Almanac.io (the docs/wiki product) in any brand material. Different category, no relationship — no acknowledgment needed anywhere in copy.

---

## 2. Who this is for

Per `product.md`: developers, AI enthusiasts, open-source contributors, technically proficient personal-finance users comfortable running a local Node.js app. This is not a mass-market consumer fintech audience, and the brand should not perform like one. No growth-hacking urgency, no "financial guru" persona, no stock-photo warmth. The credibility signal this audience responds to is competence and transparency, not friendliness.

---

## 3. Brand personality

Five traits, ranked. Where two pull in different directions, the higher-ranked one wins.

1. **Precise** — says exactly what happened; never rounds off uncertainty into false confidence.
2. **Transparent** — shows its work; never asserts a number without showing whether it was calculated or generated.
3. **Unpretentious** — plainspoken, dry humor allowed, no evangelism, no hype.
4. **Inviting to tinker** — reads like a well-documented open-source project, not a locked-down SaaS product.
5. **Quietly literary** — the almanac/record-keeping heritage gives it permission to be a little more considered in tone than typical dev tooling, without tipping into whimsy.

**Anti-traits** — actively avoid: hypey, urgent, cute, corporate-reassuring, emoji-heavy, "smart" as a filler adjective, anthropomorphized AI ("I think...", "Your AI assistant recommends...").

---

## 4. Voice and tone

Write like good technical documentation with a pulse — not like a fintech landing page.

**Do:**

- State what the system did, in active voice. "Calculated from 14 transactions." "Projected by Claude 3.7 Sonnet."
- Name the actor. If a number came from a model, say which model. If it came from the deterministic core, say "calculated," not "we found."
- Let precision imply trust. Don't add reassurance language ("don't worry," "it's easy") — the audience trusts clarity, not comfort.
- Use dry understatement for errors and edge cases rather than alarm or cheerfulness.

**Don't:**

- Don't say "AI-powered" as a selling point — the product's whole premise is that AI is one visible, swappable component, not a magic layer.
- Don't use second-person coaching voice ("You should cut back on dining out!"). Present findings; let the user draw conclusions.
- Don't use exclamation points in system copy. Reserve emphasis for genuinely rare states (destructive actions, irreversible imports).

This directly follows from the product's "Transparent AI" and "Deterministic financial core" principles — the voice exists to keep the user able to tell, at a glance, what the system _knows_ versus what it _thinks_.

---

## 5. Color system

The existing neutral foundation (slate grays, `#155eef` blue, white surfaces) stays as the **system layer** — it already reads as calm and trustworthy and should not be replaced wholesale. Brand work adds two _meaning-carrying_ accents on top of it, tied directly to the product's core trust principle: a user must always be able to tell a calculated number from an AI-generated one without reading a label.

| Role                                | Color                                                        | Hex                  | Use                                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ledger (calculated / deterministic) | Deep ink blue                                                | `#155eef` (existing) | Anything the deterministic core produced: balances, budget totals, projections from the calculation engine. This is the "fact" color.                                                         |
| Intelligence (AI-generated)         | Warm amber                                                   | `#B7791F` (proposed) | Anything a model produced: suggestions, narrative explanations, AI-drafted categorizations before confirmation. This is the "hypothesis" color — warmer, less final-looking than Ledger blue. |
| Neutral surfaces                    | Existing slates (`#182230`, `#475467`, `#d8dee8`, `#f5f7fa`) | —                    | Layout, text, borders — unchanged.                                                                                                                                                            |
| Success / error                     | Existing green/red (`#12b76a`, `#f04438`)                    | —                    | Unchanged — these are already semantic, keep them reserved for state, not decoration.                                                                                                         |

Rule for a future UX guideline to inherit: **any value on screen that originated from an LLM call must be visually distinguishable (color, icon, or border treatment) from a deterministically calculated value, using this Ledger/Intelligence pairing.** This is a functional requirement derived from "Transparent AI," not a decorative choice — don't let a future redesign collapse the two into one accent color for the sake of visual simplicity.

---

## 6. Typography

Keep **Inter** as the product/UI typeface — it's already integrated, it's legible at data-table density, and changing it would fight the "precise, unpretentious" personality for no benefit.

For brand-only surfaces (README hero, marketing site if one appears, `about` page), a serif display face may be used for the wordmark and large headings only — never in the working application — to gesture at the "almanac" (printed record) heritage without slowing down product UI. Candidates: Fraunces, Newsreader, or Source Serif 4 (all open-source, pairs cleanly with Inter). This is optional polish, not a requirement for the initial brand rollout.

Numerals: continue using tabular figures (`font-variant-numeric: tabular-nums`, already in use for transaction amounts) everywhere money appears, including any new AI-generated financial figures — alignment discipline is part of "precise."

---

## 7. Mark / logo direction

No logo file is specified here — this is direction for whoever designs one, or for an AI-generated concept later.

Lean into instruments of personal record-keeping and forecasting rather than generic finance icons (no coins, no dollar signs, no line-chart-arrow-up clichés — those are the invisible-zone conventions this name was chosen to avoid). Reasonable directions:

- An open book / ledger page, rendered as a simple geometric mark rather than illustrative
- A bound-spine or tab motif (suggesting "a record you keep," echoing almanac-as-book)
- A minimal instrument mark (a single tick/gauge line, not a full sextant/astrolabe illustration — too literal, too busy at small sizes)

Avoid: owls/wisdom clichés, AI sparkle/stars-icon (now a generic "AI feature" signifier used everywhere — exactly the saturated convention called out when the name was chosen), anything photographic or skeuomorphic.

---

## 8. Terminology rules (carry into UX guideline)

- **"Calculated"** — deterministic core output. Never say "AI calculated."
- **"Projected" / "Suggested" / "Drafted by [model name]"** — AI output, always naming the model, never anonymized to "the AI" in data provenance contexts.
- **"Almanac" / "Almanac FI"** — product name. Don't invent nicknames or shorten further ("the Alm," etc.).
- Avoid **"smart"**, **"powered by AI"**, **"intelligent"** as unearned adjectives in UI copy — the product's credibility comes from showing its work, not from claiming intelligence.
- Model/provider names are first-class UI vocabulary, not hidden settings-page trivia — provider independence is a brand-level trait, not just a technical one.

---

## 9. What this doc intentionally leaves open

Component-level specs (button variants, spacing scale beyond what 023a already set, iconography set, motion/animation rules, dark mode palette) belong in the UX guideline this feeds, not here. This document should only need to change when the brand's meaning changes — not every time a new component ships.
