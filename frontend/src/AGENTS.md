<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-27 -->

# src

## Purpose
Source directory for Next.js app: App Router pages, API routes, React components, configuration, and utility libraries.

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js pages, layouts, and API routes (see `app/AGENTS.md`) |
| `components/` | React components: wallet app, UI overlays, tabs (see `components/AGENTS.md`) |
| `config/` | Contract addresses, asset universe, runtime config (see `config/AGENTS.md`) |
| `lib/` | Utilities: DB, storage, oracle logic (see `lib/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- All exports use path aliases (@/components, @/config, etc.)
- TypeScript files only; no .js
- Avoid creating new top-level directories; follow existing structure

<!-- MANUAL: -->
