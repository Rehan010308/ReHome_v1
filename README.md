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

Copy `.env.example` to `.env` and fill in values when Supabase is configured
(Phase 3). Never commit the real `.env`.

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