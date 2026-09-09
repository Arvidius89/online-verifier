# Implementation Notes

## Location

The dashboard lives in `poc-verifier/vcm/` — a self-contained
Vite + React 18 + TypeScript + Tailwind v4 + Fragment UI sub-app.

It is served at `/vcm` by the existing Express server:
the build output goes to `poc-verifier/public/vcm/`, which the
server's existing static middleware picks up automatically.
No changes to `server.js`, `src/routes/*`, or `public/index.html`.

The dashboard is available at `/vcm/`. Crew certificate details are
available at `/vcm/#/crew` through the Crew Certificates card action.
Hash routing keeps the page directly loadable through the existing
static-server configuration without requiring a server fallback route.

The existing mDOC verifier at `/` is untouched.

## Commands

```bash
cd poc-verifier/vcm
npm install        # first time
npm run dev        # vite dev server on :5173 (proxy /api -> :3000)
npm run build      # builds into ../public/vcm (served at /vcm)
npm run type-check # tsc --noEmit
```

Then start the PoC server as usual (`npm start` in `poc-verifier/`)
and open `http://localhost:3000/vcm`.

## Structure

```
vcm/
  index.html              # <html lang="en" data-theme="light"> — light mode only
  vite.config.ts          # base: /vcm/, outDir: ../public/vcm
  src/
    main.tsx, App.tsx
    index.css             # tailwind v4 + @fragment_ui/tokens + @source for fragment classes
    types/compliance.ts   # Vessel, Certificate, ComplianceCategory,
                          # ComplianceOverview, status unions
    data/mockData.ts      # mock data only — no backend integration
    components/
      ui/                 # thin wrappers where Fragment UI has no primitive
        StatusBadge.tsx   # Badge + semantic status colors
      AppHeader.tsx       # top navigation (logo, title, avatar)
      PageHeader.tsx      # reusable section/page title block
      VesselBanner.tsx    # vessel name + last updated
      ComplianceScoreCard.tsx    # hero: 92% score, progress, metric cards
      ComplianceCategoryCard.tsx # per-domain card (vessel/company/crew)
    pages/
      DashboardPage.tsx   # composition of the above
      CrewCertificatesPage.tsx # crew search, status and certificate cards
      AddCrewCertificateEvidencePage.tsx # certificate evidence onboarding
```

## Design decisions

- Fragment UI is used via the `@fragment_ui/ui` package
  (with `@fragment_ui/tokens` imported once in `index.css`).
- Light mode only, enforced via `data-theme="light"`. No theme switching.
- Status colors come from `--color-status-*` tokens; `-fg` variants
  give WCAG AA text contrast.
- The Compliance Score is the hero element; score, vessel status and
  per-domain compliance are all visible above the fold at 1440px.
- Hero and category cards share the same `max-w-7xl` container and a
  consistent `gap-6` rhythm, so section edges align exactly.
- Components are props-driven and reusable for future pages
  (Vessel/Company/Crew Certificates, Certificate Detail, Add Certificate),
  without introducing a router, state library, or data layer.
- The Crew Certificates "View Details" action opens the crew page through
  hash routing; certificate data remains local mock data in the PoC.
- The Crew Certificates detail panel opens the certificate evidence page at
  `/vcm/#/crew/{memberId}/add-certificate`. Upload File remains a placeholder;
  Use Wallet expands the selected certificate card inline with a static QR
  placeholder and a shared-successfully indicator.

## Future pages

The same building blocks apply:

- Certificate list pages: `PageHeader` + `Table` + `StatusBadge`
- Certificate Detail: `Card` + `Badge` + `Certificate` type
- Add Certificate: `Card` + `Input` / `Select` / `DatePicker` + `Button`
