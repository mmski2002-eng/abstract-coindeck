<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# app

## Purpose
Next.js 16 App Router pages and API routes. Renders the main game interface (layout + WalletApp), and provides backend endpoints for leaderboard, marketplace, oracle, NFT metadata, admin actions, and bot tick.

## Key Files
| File | Description |
|------|-------------|
| `layout.tsx` | Root layout: fonts, theme script, MetaMask suppression, language provider |
| `page.tsx` | Home page: renders MarketingHome (marketing landing page) |
| `globals.css` | Tailwind 4 styles, CSS custom properties, dark/light theme |
| `api/` | Server-side route handlers (see `api/AGENTS.md`) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `api/` | All API route handlers (see `api/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **layout.tsx** is root; configure fonts, providers, global scripts here
- **page.tsx** is home route (/); currently renders MarketingHome
- **App Router**: pages can be `.tsx` (client) or `.js` (server); use `"use client"` for client components
- **CSS**: globals.css applies to all routes; theme switching via `data-theme` on html element
- **Metadata**: configure in layout.tsx via Next.js Metadata API

### Common Patterns
- **Server-side rendering**: API routes in `api/` are server-only (access DATABASE_URL, contract addresses, etc.)
- **Client-side state**: WalletApp (in components/) uses hooks and client-side storage
- **Theme**: initialized server-side in initThemeScript, stored in localStorage as "cd_theme"

## Dependencies

### Internal
- `@/components/MarketingHome` – main landing page
- `@/components/WalletApp` – primary game app (imported but not used on home page; used elsewhere)
- `@/components/LanguageProvider` – language/locale context
- `api/*` – backend endpoints

### External
- `next@16.2.4` – App Router, Script, Metadata
- `@/lib/db` – postgres pool (accessed from API routes only)

<!-- MANUAL: -->
