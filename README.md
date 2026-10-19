# Archify3D

**2D Plans. 3D Possibilities.** A Next.js and Supabase MVP for architecture students. Archify3D is a working product name; domain and trademark clearance have not been performed.

## What works

- Supabase email/password sign-up, verification callback, sign-in, sign-out, and password recovery email.
- A protected dashboard with account-owned project creation, search, rename, duplicate, and delete.
- Private DXF upload to Supabase Storage, source preview by filename, and conversion of DXF `LINE`, `LWPOLYLINE`, and `POLYLINE` segments into real editable wall meshes.
- Browser 3D orbit/zoom, wall height/thickness edits, add/remove walls, scale control, debounced JSON autosave, and binary GLB export.
- SVG symbol, light/dark wordmarks and app icon, plus locally persisted light/dark/system theme.
- Postgres schema, RLS policies, private bucket, ownership-scoped file access, and baseline security headers.

## Limitations

DXF is the only supported conversion input. The MVP treats all supported line/polyline segments as wall centerlines; it does not classify layers, distinguish annotations, process raster/PDF plans, detect openings, or infer roof/facade/elevation details. Students must review geometry. A floor slab is generated from the detected plan bounds. `$INSUNITS` is used for millimeter, centimeter, meter, inch, and foot drawings. If unit metadata is missing, large plan extents are treated as a millimeter estimate; confirm the editable scale against a known dimension. A self-authored sample room DXF is included at `samples/simple-room.dxf`. Tests cover deterministic DXF parsing only; authenticated cross-account isolation, browser workflows, and exported GLB validity have not been integration-tested. There is no rate limiter, account deletion flow, or server-side upload verification. Do not use as a construction model.

## Architecture

- `src/app` contains the public site, auth callback, dashboard, and workspace.
- `src/lib/dxf.ts` parses supported DXF entities and initializes wall centerlines.
- `src/components/ModelViewer.tsx` renders editable wall and slab meshes with React Three Fiber.
- `supabase/migrations/0001_init.sql` creates profiles, projects, conversion job groundwork, RLS, and private storage policies.
- `src/app/icon.svg` and `public/brand/` contain the application and reusable brand SVGs.

## Requirements

- Node.js 20+
- A Supabase project

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted).
3. In Supabase SQL Editor, run `supabase/migrations/0001_init.sql`.
4. In Supabase Authentication → URL Configuration, set the Site URL to `https://archify3d.netlify.app` and add `https://archify3d.netlify.app/auth/callback` plus `https://archify3d.netlify.app/auth/callback?next=/auth/reset` to Redirect URLs. Add `http://localhost:3000/**` as an additional redirect only if you also test auth locally. Enable email/password and email confirmation. In Netlify, set `NEXT_PUBLIC_SITE_URL` to `https://archify3d.netlify.app`; local development can leave it unset.
5. `npm run dev`

The development server uses `.next-dev`; production builds use `.next`, so building while developing cannot replace the active server manifests. Keep one development server per checkout. The dev command is pinned to port 3000 and will fail clearly if it is already occupied instead of silently starting a second server against the same development cache. Stop the existing server with Ctrl+C in its terminal before starting another.

For local auth testing, configure a mail provider or use Supabase's development email capture. The service role key is not needed by the app and must never be exposed in browser code.

## Commands

- `npm run dev` — development server
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint on application source
- `npm run build` — production build

## Data and security

`profiles`, `projects`, and `conversion_jobs` are owner-scoped by RLS. Project rows never accept a client-supplied owner ID; inserts rely on policy checks against `auth.uid()`. Storage paths must start with the authenticated user's UUID and are private under the `archify-private` bucket. The source upload parses DXF in the browser and checks extension and size there; the private bucket has a 50 MB limit. Add authenticated server-side content-signature validation and rate limiting before public production use. Supabase is the authorization boundary, so apply the migration and test policies with separate accounts before production.

Project JSON model data is saved to `projects.model_data` by a debounced client update; the source DXF remains in private Storage. Autosave failures remain visible, and editing can be retried by changing a property. `conversion_jobs` is schema groundwork; the current deterministic conversion runs synchronously in the browser and does not create a durable job record.

## Deploy

Deploy as a standard Next.js App Router application on Vercel or another Node-compatible host. Configure the public Supabase variables and `NEXT_PUBLIC_SITE_URL=https://archify3d.netlify.app`, apply the SQL migration, and set the production Site URL and callback allow-list in Supabase Auth. Confirm the bucket is private and RLS policies are enabled. Do not deploy without independently testing cross-account project queries and Storage reads/writes. No deployment has been performed.

## Brand assets

- `public/brand/archify3d-symbol.svg` — standalone monogram
- `public/brand/archify3d-logo-light.svg` / `archify3d-logo-dark.svg` — horizontal logo variants
- `public/brand/archify3d-app-icon.svg` — square app icon

Replace these with approved vector assets while preserving transparent backgrounds and viewBox sizing. The source SVGs are original geometric paths, not externally hosted images.
