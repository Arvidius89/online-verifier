# Verifier Design — OpenID4VP mDL PoC

Detailed component and data design for the minimal verifier application.
Complements [ARCHITECTURE.md](ARCHITECTURE.md) (the "what/why") with the
"how".

## 1. Module breakdown

```
poc-verifier/
├── package.json
├── .env.example
├── src/
│   ├── server.js                 # entry point: express app, listen
│   ├── config.js                 # env-driven configuration
│   ├── routes/
│   │   ├── pageRoutes.js         # static frontend
│   │   ├── requestRoutes.js      # GET /api/request
│   │   ├── responseRoutes.js     # POST /response
│   │   └── statusRoutes.js       # GET /api/status/:state
│   ├── services/
│   │   ├── sessionStore.js       # in-memory sessions (TTL, one-shot)
│   │   ├── queryBuilder.js       # mDL DCQL query via buildHaipQuery
│   │   ├── requestService.js     # createAuthorizationRequest wrapper
│   │   └── verifyService.js      # verifyAuthorizationResponse wrapper
│   └── trust/
│       └── trustedIssuers.js     # loads issuer certs (DER) from disk
└── public/
    ├── index.html                # landing / QR page
    ├── app.js                    # fetch request, render QR, poll status
    └── style.css
```

### 1.1 `config.js`

| Setting | Env var | Default | Notes |
| --- | --- | --- | --- |
| Port | `PORT` | `3000` | |
| Public base URL | `BASE_URL` | `http://localhost:3000` | Must be HTTPS + reachable for real wallets |
| Client ID | `CLIENT_ID` | derived from BASE_URL host | PoC uses a plain client_id; HAIP deployments would use `x509_san_dns:<host>` |
| Session TTL | `SESSION_TTL_MS` | `300000` (5 min) | |
| Trusted issuer dir | `TRUSTED_ISSUERS_DIR` | `./trusted-issuers` | `*.der` / `*.pem` files |
| mDL claims | `MDL_CLAIMS` | `family_name,given_name,birth_date,age_over_18,portrait` | comma-separated |

### 1.2 `services/sessionStore.js`

- Backing store: `Map<string, Session>`.
- `create(session)` — insert, schedule lazy expiry.
- `get(state)` — return session or `undefined`; mark `expired` if past TTL.
- `complete(state, result | error)` — transition to `done`/`failed`, set
  `consumed = true`.
- Enforcement: `complete` is a no-op (returns `false`) if the session is
  missing, expired, or already consumed → replay protection at the store
  level, in addition to the nonce/state checks.
- Cleanup: `setInterval` sweep every 60 s (`.unref()`ed so it never keeps
  the process alive).

### 1.3 `services/queryBuilder.js`

```js
import { buildHaipQuery, validateHaipQuery } from '@openeudi/openid4vp';

export function buildMdlQuery(claims) {
  const query = buildHaipQuery({
    credentialId: 'mdl',
    format: 'mso_mdoc',
    doctypeValue: 'org.iso.18013.5.1.mDL',
    claims,                       // e.g. ['family_name', 'age_over_18']
  });
  validateHaipQuery(query);       // fail fast at startup/request time
  return query;
}
```

`buildHaipQuery` auto-namespaces claim paths to `org.iso.18013.5.1` for the
mDL doctype (`HAIP_DOCTYPE_NAMESPACES`), so claim paths on the wire are
`['org.iso.18013.5.1', 'family_name']` etc.

### 1.4 `services/requestService.js`

```js
import { createAuthorizationRequest } from '@openeudi/openid4vp';
import { randomUUID } from 'node:crypto';

export function buildRequest(cfg, query) {
  return createAuthorizationRequest(
    {
      clientId: cfg.clientId,
      responseUri: `${cfg.baseUrl}/response`,
      nonce: randomUUID(),
      // state omitted → library auto-generates a UUID
    },
    query,
  );
}
```

Returns `{ uri, state, nonce, dcqlQuery }`; the route layer persists a
session keyed by `state` and renders `uri` as a QR PNG via `qrcode`.

### 1.5 `services/verifyService.js`

```js
import { verifyAuthorizationResponse } from '@openeudi/openid4vp';

export async function verify(session, envelope, trustedCertificates) {
  const result = await verifyAuthorizationResponse(envelope, session.query, {
    nonce: session.nonce,
    trustedCertificates,
  });
  return result; // { valid, parsed, match, submission }
}
```

Claim extraction for display:

```js
// mDOC claims are namespace-grouped:
const ns = result.parsed.namespacedClaims?.['org.iso.18013.5.1'] ?? {};
// → { family_name: 'MUSTERMANN', given_name: 'ERIKA', age_over_18: true, ... }
```

### 1.6 `trust/trustedIssuers.js`

- At startup, read every `*.der`/`*.pem` under `TRUSTED_ISSUERS_DIR`,
  convert to `Uint8Array` DER bytes.
- PoC passes them as `trustedCertificates` to the verify call.
- The library's `MdocParser` validates the MSO issuer signature against
  these; an unknown issuer → `result.valid === false` /
  `TrustAnchorNotFoundError`-class failure.
- Upgrade path (documented, not built): swap to `StaticTrustStore` or
  `LotlTrustStore` from `src/trust/` for EU List of Trusted Lists resolution
  with CRL/OCSP revocation checks.

## 2. Route designs

### 2.1 `GET /api/request`

1. Build the mDL DCQL query.
2. Build the authorization request (`nonce`, auto `state`).
3. Store session `{ state, nonce, query, status: 'pending', expiresAt }`.
4. Render `request.uri` to a PNG data URL with `qrcode`.
5. Respond `200 { state, qr, uri }`.

Errors: `500` on unexpected failure; there is no user input to validate.

### 2.2 `POST /response`

Content-Type: `application/x-www-form-urlencoded` (per OpenID4VP
`direct_post`).

1. Extract `state` and `vp_token`.
2. `session = sessionStore.get(state)` → `400` if missing/expired.
3. Parse `vp_token` JSON → envelope `{ vp_token: { <queryId>: '<token>' } }`.
   The library expects the §8.1 object form; if the wallet already posted an
   object, pass it through. (Encrypted `{ response: '<JWE>' }` bodies are
   recognized by the library but rejected in this PoC with a clear error,
   since no decryption key is provisioned.)
4. `result = await verifyService.verify(session, envelope, trusted)`.
5. On `result.valid`: `sessionStore.complete(state, result)` → respond
   `200 { "redirect_uri": "<baseUrl>/?state=...#done" }` (optional;
   `direct_post` permits an empty 200 as well — PoC returns JSON).
6. On invalid: `sessionStore.complete(state, error)` → still respond `200`
   to the wallet (the failure is delivered to the browser via status
   polling, not to the wallet).

Error mapping (library errors → HTTP):
`TypeError` (malformed envelope) → `400`; `OpenID4VPError` subclasses
(`InvalidSignatureError`, `ExpiredCredentialError`, `NonceValidationError`,
`DecryptionFailedError`, …) → `200` with session marked `failed` (the
wallet did its part; validation simply failed); unexpected → `500`.

### 2.3 `GET /api/status/:state`

- `pending` → `{ status: 'pending' }`
- `done` → `{ status: 'done', claims, issuer, docType }`
- `failed` → `{ status: 'failed', error, unmatched? }` (per-claim reasons
  from `result.match.unmatched`, e.g. `missing_claims`, `doctype_mismatch`)
- unknown/expired → `404 { status: 'expired' }`

## 3. Frontend design

Single page, three panels toggled by state:

1. **Start panel** — explanation text + "Request mDL" button.
2. **QR panel** — QR image + copyable `openid4vp://` URI + countdown to
   session expiry. Polls `/api/status/:state` every 2 s.
3. **Result panel** —
   - success: table of disclosed claims (namespace stripped for display),
     portrait rendered as `<img>` if present, issuer/docType footer.
   - failure: error message + unmatched reasons.

Vanilla JS `fetch`; no framework, no bundler. Accessibility: semantic HTML,
`aria-live="polite"` on the status region.

## 4. Data design

### 4.1 DCQL query sent to the wallet (example)

```json
{
  "credentials": [
    {
      "id": "mdl",
      "format": "mso_mdoc",
      "meta": { "doctype_value": "org.iso.18013.5.1.mDL" },
      "claims": [
        { "path": ["org.iso.18013.5.1", "family_name"] },
        { "path": ["org.iso.18013.5.1", "given_name"] },
        { "path": ["org.iso.18013.5.1", "birth_date"] },
        { "path": ["org.iso.18013.5.1", "age_over_18"] }
      ]
    }
  ]
}
```

### 4.2 Authorization request URI (shape)

```
openid4vp://authorize?response_type=vp_token
  &response_mode=direct_post
  &response_uri=https%3A%2F%2Fverifier.example%2Fresponse
  &client_id=verifier.example
  &nonce=<uuid>
  &state=<uuid>
  &dcql_query=<url-encoded JSON above>
```

### 4.3 Response envelope (shape, `direct_post`)

```json
{
  "vp_token": { "mdl": "<base64url CBOR DeviceResponse>" },
  "state": "<uuid>"
}
```

Note: the mDOC token may arrive base64url-encoded as a string in the form
post. The library's `MdocParser.canParse` handles `Uint8Array`; the route
layer must therefore decode a string token via base64url before calling
`verifyAuthorizationResponse` (or pass the envelope through unchanged if the
library accepts the encoded form — to be confirmed against
`tests/verify-authorization-response.test.ts` during implementation).

### 4.4 Verification result → displayed claims

`VerifyResult.parsed.namespacedClaims['org.iso.18013.5.1']` is rendered
key-by-key. `portrait` (bytes) → base64 data URL `<img>`. `birth_date` and
`driving_privileges` rendered as-is.

## 5. Security design

| Threat | Mitigation |
| --- | --- |
| Replay of a VP response | Per-session `nonce` embedded in the mDOC session transcript (device binding) + one-shot sessions + 5 min TTL |
| Session fixation / CSRF on callback | `state` is an unguessable UUIDv4 bound to the session; unknown state → reject |
| Untrusted issuer | `trustedCertificates` allow-list; library enforces MSO issuer chain |
| Expired credential | Library MSO validity check (`ExpiredCredentialError`) |
| Token substitution | Library verifies issuer COSE_Sign1 signature and MSO value digests |
| Response interception in transit | HTTPS only in any real test; document `direct_post.jwt` (JWE) as the upgrade path (`decryptAuthorizationResponse`, ECDH-ES/A128GCM) |
| Wallet error responses (`error=access_denied`) | Route handles `error`/`error_description` fields → session `failed` with reason |
| QR leakage | QR rendered per request, short-lived session, no PII in logs |

Logging: request id, state, status transitions, error class names. Never log
`vp_token` contents or claims.

## 6. Testing design

| Level | Approach |
| --- | --- |
| Unit | Vitest for `sessionStore` (TTL, one-shot), `queryBuilder` (shape matches HAIP), route handlers with a mocked `verifyService` |
| Integration | Supertest against the Express app; feed the library's mDOC fixtures (`tests/fixtures/mdoc-helpers.ts`, `tests/verify-authorization-response.test.ts`) through `POST /response` |
| Interop (manual) | EUDI reference wallet against an ngrok-tunneled instance; follow `docs/manual-testing/oidf-interop.md` |
| Conformance (optional) | `scripts/oidf-ci-run.mjs` harness already in the repo |

## 7. Upgrade paths (explicitly out of PoC scope)

1. **Signed requests (JAR)** — `createSignedAuthorizationRequest` with an
   `x509_san_dns` client ID; requires hosting the JWS at a `request_uri`.
2. **Encrypted responses** — `response_mode: 'direct_post.jwt'` + ephemeral
   ECDH-ES key pair per session; `verifyAuthorizationResponse` then derives
   the session transcript automatically (`iso-18013-7` via JWE `apu`, or
   `openid4vp-1.0` via the verifier encryption JWK thumbprint).
3. **LOTL trust** — `LotlTrustStore` for EU trusted-list resolution with
   revocation.
4. **Persistence** — swap `sessionStore` for Redis behind the same interface.
