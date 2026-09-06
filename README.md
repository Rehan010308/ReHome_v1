# ReHome_v1

A clean rebuild of ReHome — an AI-powered donation platform that helps
households give their items a second life.

**Give Your Items A Second Life** — snap a photo, let AI sort it, connect with
local donation partners. Every item you rehome earns you reward points.

## Tech stack

- React 18 + TypeScript + Vite 5
- Tailwind CSS (design system ported from the original ReHome)
- react-router-dom (HashRouter — GitHub Pages compatible)
- Supabase (planned: auth, database, storage — Phase 3+)

## Getting started

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # TypeScript check
npm run build      # typecheck + production build
```

## Environment variables

Copy `.env.example` to `.env` and fill it in. `.env` is deliberately never
committed, so every fresh clone needs its own.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required; without them the
app loads but the login and signup pages say authentication is not configured.
`VITE_GOOGLE_MAPS_API_KEY` is optional — without it the maps draw on
OpenStreetMap tiles instead of Google imagery, and nothing else changes.

## Deploying

Vite inlines every `VITE_` variable into the bundle **at build time**. There is
no runtime configuration: a host that builds the app without those values
publishes a site that cannot sign anyone in, no matter what is set afterwards.
So wherever the build runs, the variables have to be there.

- **GitHub Pages** — `.github/workflows/deploy.yml` does this already. Set the
  values under *Settings → Secrets and variables → Actions → Variables*, and
  turn on *Settings → Pages → Source: GitHub Actions*. The workflow fails
  loudly rather than publishing an unconfigured build.
- **Vercel / Netlify / anything else** — add the same two variables in the
  project's environment settings and redeploy. Nothing in the repository needs
  to change.

`VITE_BASE_PATH` sets the asset prefix, which project Pages need (`/ReHome_v1/`)
and root-served hosts do not. Routing is hash-based, so no host needs an SPA
rewrite rule.

The anon key is a publishable browser value: it ships inside every bundle by
design, and the data behind it is protected by row-level security. The
service-role key is a different thing and must never be committed, put in a
`VITE_` variable, or given to a build.

## Phase roadmap

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 1 | Project scaffold, branding, homepage | ✅ Done |
| 2 | GitHub repo setup + initial push | ⏳ Next |
| 3 | Supabase project + connection | ⏳ |
| 4 | Database schema + RLS | ⏳ |
| 5 | Authentication (individual + organization) | ⏳ |
| 6 | Individual dashboard + upload flow | ⏳ |
| 7 | Organization dashboard + requirements | ⏳ |
| 8 | Real AI integration | ⏳ |
| 9 | Matching engine | ⏳ |
| 10 | Collection + rewards + impact | ⏳ |
| 11 | Final polish + end-to-end test | ⏳ |

## AI service layer

The real model plugs into `src/services/ai/index.ts` (`analyzeItem`) without
touching UI. Browser baseline is COCO-SSD. Optional OpenRouter/Claude runs in
`supabase/functions/analyze-item`. Keys stay server-side.