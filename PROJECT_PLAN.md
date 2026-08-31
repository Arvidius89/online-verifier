# Project Plan — Minimal OpenID4VP mDL Verifier PoC

Plan for building the verifier application described in
[ARCHITECTURE.md](ARCHITECTURE.md) and [VERIFIER_DESIGN.md](VERIFIER_DESIGN.md).

## 1. Goals and success criteria

**Goal:** a running Node.js/Express web app where a user can request their
mDL with a wallet scan of a QR code, and see the validated claims in the
browser.

**Success criteria:**

1. `GET /api/request` returns a QR encoding a valid OpenID4VP authorization
   request URI with a HAIP-compliant mDL DCQL query.
2. `POST /response` accepts a `direct_post` VP response, validates the mDOC
   (issuer signature, MSO validity + digests, device binding/nonce, trusted
   issuer), and stores the outcome.
3. `GET /api/status/:state` reflects pending/done/failed within one poll
   interval.
4. Browser UI shows QR → waiting → claims table (or a clear error).
5. Unit + integration tests pass; a real-wallet manual test succeeds against
   a tunneled HTTPS URL.

## 2. Prerequisites

- [x] Repository analysis (`IMPLEMENTATION_PLAN.md`, `ARCHITECTURE.md`,
      `VERIFIER_DESIGN.md`)
- [ ] Library built: `npm install && npm run build` in the repo root
      (produces `dist/`; note the `reflect-metadata` polyfill ordering —
      always import the library's root entry, which loads it first)
- [ ] Node.js 20+, npm
- [ ] A test issuer certificate (DER/PEM) for `trustedCertificates` — from
      the repo's test fixtures or a known mDL test issuer
- [ ] For real-device testing: ngrok/cloudflared tunnel and an
      EUDI-compatible test wallet

## 3. Configuration & secrets strategy (.env → Azure)

Configuration is designed for Azure from day one, so the later deployment is a
lift-and-shift of settings rather than a refactor. The app follows 12-factor:
all environment-dependent values come from process env, parsed and validated in
one place (`config.js`).

### 3.1 Local development (now)

- **`dotenv`** loads `.env` in `config.js` only when the file exists
  (`if (fs.existsSync('.env'))`), so the same code runs unchanged in Azure
  where real environment variables are injected.
- **`.env`** — real local values; **gitignored**, never committed.
- **`.env.example`** — committed; every key with a placeholder and a comment.
  Acts as the configuration contract and onboarding documentation.
- **`.env.test`** — committed, safe dummy values used by the vitest/supertest
  suites (fixture nonces, localhost URLs).
- Startup **fail-fast validation** in `config.js`: missing/invalid required
  keys → descriptive error and non-zero exit (no silent defaults for URLs,
  client IDs, or trust material).

### 3.2 Variable naming (maps 1:1 to Azure App Settings)

| Env var | Local (.env) | Azure target | Secret? |
| --- | --- | --- | --- |
| `PORT` | `3000` | Container Apps target port / App Service `PORT` | no |
| `BASE_URL` | tunnel URL | App setting (public HTTPS URL of the app) | no |
| `CLIENT_ID` | plain id | App setting (`x509_san_dns:<host>` in prod) | no |
| `SESSION_TTL_MS` | `300000` | App setting | no |
| `MDL_CLAIMS` | claim list | App setting | no |
| `TRUSTED_ISSUERS_DIR` | `./trusted-issuers` | replaced by Key Vault certificates | yes (trust material) |
| `VERIFIER_SIGNING_KEY` | dev key (PEM path) | Key Vault reference (later, JAR flow) | yes |
| `VERIFIER_ENCRYPTION_KEY` | dev key | Key Vault reference (later, `direct_post.jwt`) | yes |

Rule introduced now and enforced by review: **no secrets in source control —
local or Azure**. Anything sensitive is either gitignored locally or a Key
Vault reference in Azure.

### 3.3 Azure migration path (later, no code changes)

1. **App settings**: App Service / Container Apps inject env vars directly —
   `config.js` already reads `process.env`, so nothing changes in code.
2. **Key Vault**: secrets and certificates move to Azure Key Vault; app
   settings hold `@Microsoft.KeyVault(SecretUri=...)` references; the app
   authenticates with a **system-assigned managed identity** (no client
   secrets, no connection strings). `trustedIssuers.js` gains a loader that
   reads certs via `@azure/identity` + `@azure/keyvault-certificates` when
   `KEYVAULT_URI` is set — the only planned code delta.
3. **IaC**: `azd`-based deployment with Bicep under `infra/` (per Azure
   best practices): App Service or Container Apps, Key Vault (purge
   protection on), managed identity with least-privilege `Key Vault
   Secrets User`/`Certificate User` role assignments.
4. **Environments**: `azd env` names (dev/staging/prod) map to separate
   `.env.<env>` files locally and separate app settings / Key Vaults in Azure.

### 3.4 What goes where (decision rules)

- Code default → only for non-sensitive, dev-safe values (`PORT`,
  `SESSION_TTL_MS`).
- `.env` (gitignored) → local secrets and environment-specific URLs.
- Azure app settings → non-secret per-environment values.
- Azure Key Vault → private keys, certificates, anything a rotation policy
  would ever apply to.

## 4. Work breakdown

### Milestone 1 — Skeleton (est. 0.5 day)

| # | Task | Output | Done when |
| --- | --- | --- | --- |
| 1.1 | Scaffold `poc-verifier/` (package.json, ESM, Express, scripts) | runnable empty server | `npm start` serves 404s |
| 1.2 | `config.js` with env parsing + defaults | config module | bad env → clear startup error |
| 1.3 | Static frontend shell (`index.html`, `app.js`, `style.css`) | page renders, button wired | manual check |
| 1.4 | `.env` strategy per §3: `dotenv` wiring, `.env.example`, `.gitignore`, fail-fast validation | config foundation | app refuses to start without required keys; `.env.example` documents every key |

### Milestone 2 — Request side (est. 0.5 day)

| # | Task | Output | Done when |
| --- | --- | --- | --- |
| 2.1 | `sessionStore.js` (Map, TTL, one-shot, sweeper) | store module | unit tests green |
| 2.2 | `queryBuilder.js` — `buildHaipQuery` for mDL + `validateHaipQuery` | query module | unit test asserts DCQL JSON shape |
| 2.3 | `requestService.js` + `GET /api/request` (+ `qrcode` PNG data URL) | working request endpoint | QR decodes to an `openid4vp://authorize?...` URI containing `dcql_query` with `mso_mdoc`/`org.iso.18013.5.1.mDL` |
| 2.4 | Frontend QR panel + status polling loop | interactive page | manual check with a QR scanner app |

### Milestone 3 — Response side (est. 1 day)

| # | Task | Output | Done when |
| --- | --- | --- | --- |
| 3.1 | `trustedIssuers.js` — load DER/PEM certs from disk | trust module | startup logs N trusted issuers |
| 3.2 | `verifyService.js` — envelope handling, `verifyAuthorizationResponse` call, error mapping | verify module | unit tests with mocked library |
| 3.3 | `POST /response` route — form parsing, base64url mDOC token decode, state lookup, one-shot completion | callback endpoint | supertest integration test with repo mDOC fixtures passes |
| 3.4 | `GET /api/status/:state` route | status endpoint | integration tests for all four states |
| 3.5 | Result panel — claims table, portrait image, error/unmatched display | complete UI flow | manual check with fixture-driven fake wallet post |

### Milestone 4 — Hardening & interop (est. 0.5–1 day)

| # | Task | Output | Done when |
| --- | --- | --- | --- |
| 4.1 | Wallet error responses (`error=access_denied`), malformed bodies, expired sessions | robust handlers | negative integration tests |
| 4.2 | Logging hygiene (no tokens/claims in logs) | reviewed log statements | code review |
| 4.3 | README for the PoC (setup, tunnel, wallet test steps) | docs | someone else can run it |
| 4.4 | Manual interop test with a real wallet over HTTPS tunnel | verified demo | claims shown in browser |

**Total estimate: 2–3 days** for one developer.

## 5. Test plan

| Suite | Scope | Key cases |
| --- | --- | --- |
| Unit: session store | TTL expiry, one-shot completion, unknown state | replay after completion rejected |
| Unit: query builder | DCQL shape, HAIP validation | mso_mdoc meta, namespaced claim paths, empty claims → error |
| Unit: verify service | error mapping | each `OpenID4VPError` subclass → `failed` session with message |
| Integration: request | `/api/request` | nonce/state present, query embedded, QR payload == returned URI |
| Integration: response | `/api/response` | valid fixture VP → `done` + claims; wrong nonce → `failed`; unknown state → 400; encrypted `{response}` body → clear unsupported error |
| Integration: status | `/api/status/:state` | pending → done transition visible |
| Manual interop | real wallet | scan → consent → claims displayed; denial → failure shown |

Fixtures: reuse `tests/fixtures/mdoc-helpers.ts` and
`tests/verify-authorization-response.test.ts` from the library to mint
realistic DeviceResponses.

## 6. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Wallets require a publicly reachable HTTPS `response_uri` | PoC can't be tested on localhost with a real wallet | Document tunnel setup (ngrok/cloudflared); reference `docker/oidf-conformance-suite` nginx TLS config |
| mDOC token transport encoding in `direct_post` form bodies differs between wallets | `MdocParser.canParse` fails → false rejections | Normalize to `Uint8Array` in the route layer; verify against library tests before the interop milestone |
| Unsigned requests rejected by some HAIP wallets | Interop failure | Milestone 4 fallback: switch to `createSignedAuthorizationRequest` (JAR, `x509_san_dns`) — library already supports it |
| No test issuer certificate available | Validation always fails trust | Extract one from the repo's mDOC test fixtures |
| Secret leaks via git | Credential compromise | `.env` gitignored from commit #1; `.env.example` placeholders only; pre-commit review checklist |
| Local `.env` diverges from Azure settings | "works on my machine" at deploy time | Single `config.js` schema + naming map (§3.2); `azd provision --preview` before first deploy |
| Session store grows unboundedly under abuse | Memory exhaustion | TTL sweeper + optional max-size eviction (LRU) |
| reflect-metadata load-order bug when importing the library | Crypto runtime errors | Always import the package root (polyfill-first entry is tested by `tests/bundle-polyfill-order.test.ts`) |

## 7. Deliverables

1. `poc-verifier/` application (Express server + static frontend)
2. Unit + integration test suite (`vitest` + `supertest`)
3. PoC README with setup/tunnel/wallet instructions
4. Manual interop test report (wallet used, claims received, issues)

## 8. Out of scope (recorded for later iterations)

- Signed authorization requests (JAR) and encrypted responses
  (`direct_post.jwt`) — design documented in VERIFIER_DESIGN.md §7.
- EU LOTL-based issuer trust with revocation (`LotlTrustStore`).
- Azure deployment itself (azd/Bicep `infra/`, Key Vault wiring) — the
  configuration strategy in §3 is planned from the start so this remains a
  deployment-only task later.
- Multi-credential requests/presentations.
- SD-JWT VC credentials.
- Production concerns: Redis sessions, horizontal scaling, WAF, key custody.
