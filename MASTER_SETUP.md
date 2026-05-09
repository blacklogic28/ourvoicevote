# MASTER_CLAUDE.md — Setup Guide

Three placement slots. Use **all three** for maximum coverage.

---

## Slot 1 — Claude Code Global Default (highest leverage)

Every Claude Code session on your machine inherits this.

```bash
# macOS / Linux
mkdir -p ~/.claude
cp MASTER_CLAUDE.md ~/.claude/CLAUDE.md

# Windows (PowerShell)
New-Item -ItemType Directory -Force "$HOME\.claude"
Copy-Item MASTER_CLAUDE.md "$HOME\.claude\CLAUDE.md"
```

Verify it loaded:
```bash
claude
> /memory
```
You should see `~/.claude/CLAUDE.md` listed.

---

## Slot 2 — Per-Project Override (recommended for client work)

In the project root:

```bash
cp /path/to/MASTER_CLAUDE.md ./CLAUDE.md
```

Then edit the bottom of that copy and add a `## 12. Project-Specific Overrides` section with the client's brand, palette, type, deploy URLs. The project file overrides the global file for that repo.

Add to `.gitignore` only if the overrides contain anything sensitive — usually you commit `CLAUDE.md` so the team shares conventions.

---

## Slot 3 — Claude.ai Web/App (for browser planning sessions)

### a) User-wide profile preferences

Settings → **Profile** → "What personal preferences should Claude consider in responses?"

Paste the **condensed version** below (the field has a character limit, so this is trimmed to role + stack + non-negotiables):

```
You are a Senior Full-Stack Product Designer + Frontend Engineer. Build production
websites at the level of Vercel/Linear/Stripe — not generic AI-looking templates.

Locked stack: Next.js 15 App Router + TypeScript strict, Tailwind CSS v4 with OKLCH
palettes, shadcn/ui, lucide-react icons (never emoji), Motion for animation,
next/font + next/image, react-hook-form + zod, Vercel hosting via GitHub, pnpm.

Always: plan first (sitemap + design direction + components), build page by page,
verify with screenshots, run typecheck + lint + build + Playwright + axe before
commit, mobile-first, dark mode from day one, prefers-reduced-motion respected,
WCAG 2.2 AA, Lighthouse 95+.

Never: generic Tailwind colors as final design, emoji-as-icons, lorem ipsum, raw
<img>, any to silence TS, push to main directly, --no-verify, features not in the
brief.

When user shares a Figma URL, treat output as reference and map tokens to Tailwind.
Use the frontend-design skill for UI work, security-review before deploy, and the
GitHub MCP for all repo ops.
```

### b) Per-Project Instructions (best for individual client work)

claude.ai → **Projects** → New Project → click project name → **Project instructions** → paste the **full `MASTER_CLAUDE.md`** contents. Anything created inside that Project inherits it.

---

## One-Time Setup in Claude Code (do this once globally)

In any Claude Code session, run:

```
/plugin install frontend-design
/plugin install superpowers
```

These two compound the master prompt — `frontend-design` for visual generation, `superpowers` for multi-step planning.

If you build sites with AI features, also:
```
/plugin install claude-api
```

---

## MCP Servers — Install the Useful Ones

Claude Code supports MCP via the `claude mcp add` command (or `~/.claude.json`). Recommended for studio/web work:

| MCP | Why | Install hint |
|---|---|---|
| **GitHub** | All repo ops, PRs, CI | `claude mcp add github` (uses your `gh auth login` token) |
| **Figma** | Design extraction | Figma desktop app → Preferences → Enable Dev Mode MCP server, then add to Claude Code |
| **Linear** | Task tracking | OAuth via `claude mcp add linear` |
| **Sentry** | Error monitoring on shipped sites | `claude mcp add sentry` with org slug |
| **Vercel** | Deploys, env vars, analytics from chat | `claude mcp add vercel` |

Skip the rest unless you need them — every MCP adds startup latency.

---

## CLI Tools to Install Once

```bash
# Required
brew install pnpm gh
pnpm add -g vercel @playwright/test

# Recommended
brew install biome
pnpm dlx playwright install chromium
```

Authenticate:
```bash
gh auth login         # GitHub
vercel login          # Vercel
```

---

## How to Trigger the Master Prompt

Once installed, **you don't invoke it explicitly** — every session inherits it. But these openers get the best output:

1. **Greenfield site, you decide direction**
   > "Build a 7-page site for [client] — they're a [industry] brand. Pick a direction and go."

2. **Want to compare looks before committing**
   > "Show me 3 design directions for a landing page selling [product]. Mood-board each in one paragraph, then I'll pick."

3. **Slow controlled scaffold**
   > "Scaffold the project, set up GitHub + Vercel, then build the home page hero and stop for my approval."

4. **Pixel-faithful from a Figma file**
   > "Take [figma URL] and build it. Map design tokens to Tailwind theme."

5. **Audit + redesign**
   > "Audit [current site URL] and propose a sitemap + design direction for a redesign."

---

## Maintenance

- Re-pull this file once a quarter — frameworks move (Next.js minor versions, Tailwind updates, shadcn additions).
- When a client engagement ends, archive their per-project `CLAUDE.md` into your studio's `case-studies/` folder for reference.
- If a tool in §3 of `MASTER_CLAUDE.md` is unavailable in a session, Claude will mention it once and continue — don't panic.

---

## Verifying It Works

In a fresh Claude Code session, ask:

> "What's your role and what stack do you build websites in?"

You should hear back: Senior Full-Stack Product Designer + Frontend Engineer, Next.js 15 + Tailwind v4 + shadcn/ui + Motion + Vercel via GitHub with pnpm. If you hear anything generic, the file isn't being picked up — re-check Slot 1 placement.
