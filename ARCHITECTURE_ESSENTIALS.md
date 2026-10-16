# ARCHITECTURE_ESSENTIALS.md — docforum-web

Frontend-only quick reference. Full product/system architecture lives in
`docforum-core`'s `ARCHITECTURE.md` and `ARCHITECTURE_ESSENTIALS.md` — read
those first if you're new to the org, not just this file.

## Stack
- React + TypeScript + Vite
- React Query for server state, Zustand for client-only UI state
- No localStorage/sessionStorage for anything server-derived — treat
  `docforum-core`'s API as the source of truth, always refetch/cache via
  React Query rather than hand-rolling persistence.

## Hard rules
1. **This repo never calls `docforum-escrow` or Stellar directly.** Wallet
   linking, payment status, escrow state — all of it comes from
   `docforum-core`'s API. If a screen needs Stellar-related data, that's a
   `docforum-core` API gap to file, not a reason to add a Stellar SDK
   dependency here.
2. Mirror `docforum-core`'s data model shapes in `src/types/models.ts` —
   don't invent parallel frontend-only shapes for the same entities.
3. Structure: `pages/ components/ features/ hooks/ services/ store/ types/`
   — keep this shape.

## Where things live
- `src/services/` — API client calls to `docforum-core`. `api-client.ts` is
  the only place fetch/base-URL/error-envelope details live.
- `src/features/` — flow-specific logic (booking, referral-accept, order
  fulfillment selection, etc.) — one feature folder per PRD core flow.
- `src/pages/` — route-level components.
- `src/store/` — Zustand stores. `auth-store.ts` is intentionally
  in-memory only (not persisted) — see hard rule about
  localStorage/sessionStorage above; it applies to auth tokens too, not
  just business data.

## Deployment
- GitHub Pages, deployed on every push to `main` via
  `.github/workflows/deploy-pages.yml`: https://docforum.github.io/docforum-web/
- **Connected to a live backend as of 2026-09-14** —
  `VITE_API_BASE_URL` is set at build time to `docforum-core`'s Render
  preview deployment (`https://docforum-core-api.onrender.com`, see that
  repo's `docs/adr/0003-render-preview-deployment.md`). Signup/login
  actually work end-to-end against a real Postgres now. Still a
  **preview**, not production: the free-tier backend spins down after 15
  minutes idle (~1 minute cold-start delay on the next request), and its
  Postgres expires 2026-10-14 unless renewed — data is disposable.
- Router is `HashRouter`, not `BrowserRouter` — GitHub Pages has no
  server-side rewrite for client-side routes, so a deep link like `/login`
  would 404 on refresh under history-API routing. Switch back to
  `BrowserRouter` if this ever deploys somewhere with a real rewrite rule
  (e.g. behind `docforum-core` itself, or Vercel/Netlify).
- `vite.config.ts`'s `base` is conditional on `GITHUB_PAGES=true` (set by
  `npm run build:pages`) — plain `npm run build` still serves from `/`.

## Known gaps against the real API (docforum-core Phase 1 landed 2026-09-14)
`docforum-core` now has a real, tested API — see its `docs/api/README.md`.
The original W1 assumptions here turned out correct (`POST /auth/signup`/
`login`/`logout`, `{ user, accessToken }`, `{ message: string }` error
envelope, `fullName` is a real column, `role` restricted to `patient`/
`doctor` at signup — server-enforced too, not just this UI).
`credentials: 'include'` is now set on the `fetch` call in
`api-client.ts` (fixed 2026-09-14, alongside the Render connection — the
real backend's refresh cookie is `SameSite=None; Secure`, cross-site
between this repo's `github.io` domain and Render's, so it's required for
the cookie to be sent/received at all). One gap remains:
- **`POST /auth/refresh` exists on the backend but nothing here calls
  it.** `auth-store.ts` still has no silent-reauth-on-reload flow — a
  page refresh loses the session even though the refresh cookie would
  still be valid. Tracked, not built (Phase W1 was scoped to
  signup/login only).
- Local-dev-only caveat inherited from the backend: its refresh cookie is
  `sameSite: 'lax'`/`secure: false`, which may not survive true
  cross-origin (different ports) `fetch` + `credentials: 'include'` in
  every browser — not verified end-to-end. See `docforum-core`'s
  `docs/api/README.md`.

## Known assumptions — Phase W2 (dependents, health profile, acting-for)

These API shapes are assumed and not yet implemented in `docforum-core`.
Reconcile against the real contract once the corresponding backend issues
land.

### Dependents (docforum-core#42)
- `GET /patients/me/dependents` → `Dependent[]`
- `POST /patients/me/dependents` (body: `{fullName, dateOfBirth, relationship}`) → `Dependent`
- `PATCH /patients/me/dependents/:id` (body: `{fullName, dateOfBirth, relationship}`) → `Dependent`
- `POST /patients/me/dependents/:id/handover-invite` (body: `{email}`) → `Dependent`
- `POST /patients/me/dependents/:id/handover-invite/resend` → `Dependent`
- `POST /auth/claim-account` (body: `{token, email, password}`) → `void`
- `Dependent` shape: `{id, guardianProfileId, fullName, dateOfBirth, relationship: 'parent'|'guardian'|'carer', handoverStatus: 'not_eligible'|'eligible'|'invited'|'claimed', claimEmail?, claimInviteExpiresAt?, createdAt, updatedAt}`

### Health profile (docforum-core#59)
- `GET /patients/:profileId/health/:section` → `HealthEntry[]`
- `POST /patients/:profileId/health` (body: `{section, name, details?}`) → `HealthEntry`
- `PATCH /patients/:profileId/health/:entryId` (body: `{name, details?}`) → `HealthEntry`
- `DELETE /patients/:profileId/health/:entryId` → `void`
- `HealthEntry` shape: `{id, patientProfileId, section: 'allergies'|'conditions'|'medications', name, details?, version, previousValue?, updatedAt, createdAt}`

### Acting-for profile switcher (#20)
No new backend endpoint. The switcher is client-only UI state (Zustand
store). Every patient API call and React Query key includes the selected
`patientProfileId` so caches never mix profiles.

## Known assumptions — issues #38–#41 (Phase W2/W3)

Same rule as the two sections above: these shapes are assumed, not implemented
in `docforum-core` yet. Each mirrors the real model fields it will eventually
hang off, so reconciliation should be a rename rather than a rewrite.

### Patient's own profile and prescriptions (#38, docforum-core#9)
- `GET /patients/me` → `PatientProfile`. Core has `GET /doctors/me` but no
  patient equivalent, and `POST /auth/login` returns only
  `{ user, accessToken }` — without this the client cannot scope any
  `/patients/:profileId/...` read.
- `GET /patients/:profileId/prescriptions?status=active` → `Prescription[]`
- `Prescription`: `{id, status: 'issued'|'fulfilled'|'expired'|'superseded', createdAt, patientProfileId, prescribingDoctorId, prescribingDoctorName?, items: PrescriptionItem[]}`
- `PrescriptionItem`: `{id, drugName, dosage, frequency, duration}`.
  `frequency`/`duration` are the prescriber's free text (`'every 8 hours'`,
  `'as needed'`, `'ongoing'`). `features/medications/schedule.ts` derives dose
  times from them client-side and never rewrites them — an ambiguous or
  free-text frequency is displayed verbatim instead of being scheduled.
- Core has no prescription routes at all yet, so `OrderStatus` is assumed
  wholesale.

### Availability manager (#39, docforum-core#53)
- REAL: `POST /availability/doctors/:doctorProfileId/slots/generate`
  (`{date: 'YYYY-MM-DD', startHour, endHour, slotLengthMinutes}` →
  `{created, skipped, slots}`). Core has no recurrence engine, so a date range
  is one request per day issued from this client.
- ASSUMED: `GET /doctors/me/slots?from=&to=` → `AvailabilitySlot[]` (every
  status, past included — the public
  `GET /availability/doctors/:id/slots` returns only open future slots and
  cannot drive a manager view), `POST /doctors/me/slots/block`
  (`{startTime, endTime, reason?}` → `{blockedSlotIds, conflicts}`),
  `DELETE /availability/slots/:slotId`, `POST /availability/slots/:slotId/unblock`.
- `AvailabilitySlot`: `{id, doctorProfileId, status: 'open'|'held'|'booked', startTime, endTime, createdAt, updatedAt, appointment?: {id, status, patientFullName?} | null}`.
  The embedded `appointment` is assumed: the manager has to say which booked
  slot belongs to whom, and there is no slot→appointment route yet.
- Block/remove are optimistic and roll back on conflict; the server's conflict
  list is what gets rendered.

### Doctor verification application (#40, docforum-core#51/#52)
- ASSUMED, all of it: `GET /doctors/me/credentials`,
  `POST /doctors/me/credentials` (multipart fields `file`, `type`),
  `POST /doctors/me/credentials/:id/resubmit` (multipart field `file`),
  `DELETE /doctors/me/credentials/:id`, `GET /specialties`,
  `GET /doctors/me/specialty-claims`, `POST /doctors/me/specialty-claims`
  (`{specialtyId}`), `DELETE /doctors/me/specialty-claims/:id`,
  `POST /doctors/me/specialty-claims/:id/resubmit`.
- `GET /doctors/me` is real and is read through `doctor-service.ts` only, so
  the verification flow and the availability manager cannot drift on it.
- `DoctorCredential`: `{id, doctorProfileId, type: CredentialType, fileName, mimeType, sizeBytes, status: 'pending'|'verified'|'rejected', rejectionReason?, submittedAt, updatedAt}`;
  `SpecialtyClaim`: `{id, doctorProfileId, specialtyId, specialty, status, rejectionReason?, submittedAt, updatedAt}`.
  Per-item status is assumed because #51 reviews each document and each
  specialty claim individually, while `DoctorProfile.verificationStatus` stays
  profile-level.
- `fileName` is display-only: the backend is expected to store a key behind a
  get-on-demand/signed URL, so nothing here renders an upload as a link.
  Upload progress goes through `apiUpload` (XHR) in `api-client.ts` — the
  repo's only non-`fetch` HTTP, kept in that file for the same reason.

### Referral inbox (#41, docforum-core#5/#7)
- ASSUMED: `GET /doctors/me/referrals?status=&cursor=&limit=20` →
  `CursorPage<ReferralSummary>` (`{items, nextCursor}`) and
  `GET /referrals/:id` → `ReferralDetail` (403/404 once a referral has been
  reassigned to another specialist).
- `status=upcoming` is an assumed server-side filter (referrals whose
  resulting appointment is still scheduled); the `ReferralStatus` union itself
  mirrors core's referral lifecycle.
- `ReferralSummary`: `{id, status, snapshotNotes, referringDoctor: {id, fullName}, targetSpecialty?, snapshotTakenAt, createdAt, updatedAt, resultingAppointmentId?, appointment?}`;
  `ReferralDetail` adds `intakeSnapshot: {id, symptoms: string[], freeTextNotes?, submittedAt}`.
- Those snapshot fields are copies, not live references (core
  `ARCHITECTURE.md` §4.4), which is why this feature never calls an
  intake/consultation endpoint — there is deliberately no live-notes fetch.

## Roadmap / status
See `ROADMAP.md` in this repo, and Phase 7 in `docforum-core`'s
`ROADMAP.md` for the original (pre-split) frontend phase this was carved
out of.
