# Implementation Plan — Minimal OpenID4VP Verifier for mDL (mDOC) Credentials

This plan describes how to build a minimal proof-of-concept OpenID4VP verifier
for ISO 18013-5 mDL credentials using the `@openeudi/openid4vp` library in this
repository. The library is runtime-agnostic (no Node-only APIs in the core), so
the PoC can be a small Node.js HTTP server (Express/Fastify or plain `node:http`).

No code in the library itself needs to change; the verifier is a thin
orchestration layer on top of the public API exported from `src/index.ts`.

## 1. Scope of the PoC

- Same-device / cross-device **remote** presentation flow (OpenID4VP 1.0),
  not the ISO 18013-5 proximity (BLE/NFC/QR engagement) flow.
- Single credential per response (`vp_token` with one entry) — the library
  throws `MultipleCredentialsNotSupportedError` otherwise.
- mDOC format only (`mso_mdoc` / docType `org.iso.18013.5.1.mDL`).
- Start with unsigned request + `direct_post` (simplest), then optionally
  upgrade to a signed request (JAR) + encrypted response (`direct_post.jwt`).

## 2. Library capabilities to reuse

| Verifier concern | Library API | Module |
| --- | --- | --- |
| Build the DCQL query for an mDL | `buildHaipQuery({ credentialId, format: 'mso_mdoc', doctypeValue: 'org.iso.18013.5.1.mDL', claims: [...] })` | `src/haip.ts` |
| Validate a hand-built query | `validateHaipQuery(query)` | `src/haip.ts` |
| Unsigned authorization request URI | `createAuthorizationRequest(input, query)` | `src/authorization.ts` |
| Signed authorization request (JAR, `x509_san_dns` / `x509_hash`) | `createSignedAuthorizationRequest(input, query)` | `src/signed-authorization.ts` |
| Decrypt JWE responses (`ECDH-ES` + `A128GCM`/`A256GCM`) | `decryptAuthorizationResponse(jwe, privateKey)` (also handled internally by `verifyAuthorizationResponse`) | `src/decrypt-response.ts` |
| Session transcript for mDOC device binding | built automatically inside `verifyAuthorizationResponse` (ISO 18013-7 Annex B via JWE `apu`, or OpenID4VP 1.0 `OpenID4VPHandover` via `sessionTranscriptProfile: 'openid4vp-1.0'`); manual builders: `buildOid4vpSessionTranscript`, `buildOpenID4VPHandoverSessionTranscript` | `src/verify.ts`, `src/crypto/session-transcript.ts` |
| Full response validation | `verifyAuthorizationResponse(envelope, query, options)` → `VerifyResult { parsed, match, submission, valid }` | `src/verify.ts` |
| mDOC cryptographic checks | `MdocParser` (COSE_Sign1 issuer signature, MSO validity/docType, value digests, device-auth signature) | `src/parsers/mdoc.parser.ts`, `src/crypto/*` |
| Issuer trust | `StaticTrustStore` / `CompositeTrustStore` / `LotlTrustStore` (EU List of Trusted Lists) with CRL/OCSP revocation | `src/trust/*` |

## 3. Architecture of the PoC verifier

```
┌────────┐   1. openid4vp://authorize?...   ┌─────────────┐
│ Wallet │ ◄────────────────────────────────│  Verifier   │
│  (mDL) │   2. POST /response (vp_token    │  HTTP server│
└────────┘      or JWE {response})          └──────┬──────┘
                                                   │ 3. verifyAuthorizationResponse
                                                   ▼
                                          ┌────────────────┐
                                          │ @openeudi/     │
                                          │ openid4vp lib  │
                                          └────────────────┘
```

The verifier needs exactly three endpoints (or two, for the unsigned flow):

1. **`GET /request`** (or a QR-display page): creates a session, generates
   `nonce` + `state`, builds the authorization request URI, renders it as a
   QR code / deep link for the wallet.
2. **`GET /request.jwt`** (only for the signed/JAR flow): serves the JWS that
   `createSignedAuthorizationRequest` returns, with
   `Content-Type: application/oauth-authz-req+jwt`, at the `request_uri`
   embedded in the short URI.
3. **`POST /response`** (`response_uri`): receives the wallet's authorization
   response (`application/x-www-form-urlencoded` body containing either
   `vp_token` JSON or `response` JWE), validates it, and shows the result.

## 4. Step-by-step implementation

### Step 0 — Project setup

- New small app (e.g. `poc/verifier-server.ts`) that imports the library from
  this repo (`npm run build` → `dist/`, or via a workspace dependency).
- Dependencies to add for the PoC only: an HTTP framework (or none), a QR-code
  renderer (e.g. `qrcode`), and `jose` (already available) for key generation.

### Step 1 — Session store

The library is stateless by design: the verifier must keep, per session:
`state`, `nonce`, the DCQL query, (for encrypted mode) the ephemeral response
encryption key pair, and (for the OpenID4VP 1.0 profile) the verifier
encryption JWK. A `Map<state, Session>` in memory is enough for a PoC.

### Step 2 — Build the DCQL query for the mDL

```ts
const query = buildHaipQuery({
  credentialId: 'mdl',
  format: 'mso_mdoc',
  doctypeValue: 'org.iso.18013.5.1.mDL',
  claims: ['family_name', 'given_name', 'birth_date', 'age_over_18'],
});
```

Claim paths are auto-namespaced to `org.iso.18013.5.1` by `buildHaipQuery`
via `HAIP_DOCTYPE_NAMESPACES`. Optionally pass `trustedAuthorities` (e.g.
`{ type: 'aki', values: [...] }`) to let DCQL filter on trusted issuers.

### Step 3 — Issue the authorization request

Variant A (minimal, unsigned):

```ts
const request = createAuthorizationRequest(
  {
    clientId: `x509_san_dns:${HOSTNAME}`, // or a plain client id for the PoC
    responseUri: `${BASE_URL}/response`,
    nonce: crypto.randomUUID(),
  },
  query,
);
// Render request.uri as a QR code; store { state, nonce, query } in the session.
```

Variant B (signed JAR + encrypted response): use
`createSignedAuthorizationRequest` with a verifier certificate chain
(`x509_san_dns` client ID prefix), a `signer` key pair bound to the leaf cert,
and an `encryptionKey.publicJwk`; host the returned JWS at `requestUri`.
This variant is required by HAIP-facing wallets in practice and enables
`response_mode: 'direct_post.jwt'`.

### Step 4 — Receive and validate the response

On `POST /response`:

1. Parse the form body. If it contains `response`, treat it as a JWE envelope
   `{ response }`; otherwise parse `vp_token` into the §8.1 envelope shape.
2. Look up the session by the returned `state`; reject unknown/mismatched
   state (the library explicitly leaves this check to the caller).
3. Call:

```ts
const result = await verifyAuthorizationResponse(envelope, session.query, {
  nonce: session.nonce,
  trustedCertificates: [ /* issuer cert DER bytes */ ], // or a TrustStore
  // encrypted flow only:
  decryptionKey: session.encryptionPrivateKey,
  clientId: session.clientId,
  responseUri: session.responseUri,
  sessionTranscriptProfile: 'openid4vp-1.0', // or default 'iso-18013-7'
  verifierEncryptionJwk: session.encryptionPublicJwk, // required for openid4vp-1.0
});
```

4. If `result.valid`, read disclosed claims from
   `result.match.matches[0].extractedClaims` (mDOC claims are
   namespace-grouped, e.g. `claims['org.iso.18013.5.1'].family_name`) and the
   presentation submission from `result.submission`. If invalid, inspect
   `result.match.unmatched` entries (`format_mismatch`, `doctype_mismatch`,
   `missing_claims`, …) and `result.parsed.error`.

### Step 5 — Trust configuration

- PoC: load one or more issuer certificates (DER bytes) into
  `trustedCertificates`, or construct a `StaticTrustStore`.
- Realistic EU scenario: `LotlTrustStore` to resolve issuer trust anchors
  from the EU List of Trusted Lists, with CRL/OCSP revocation checking via
  the built-in `CrlFetcher`/`OcspClient`.

### Step 6 — Testing

- Unit-test the handler against the library's mDOC fixtures/helpers in
  `tests/fixtures/mdoc-helpers.ts` and the DCQL fixtures under
  `tests/fixtures/dcql-queries/`.
- Interop-test against a real EUDI wallet; the repo's
  `docs/manual-testing/oidf-interop.md` and `scripts/oidf-ci/` conformance
  harness describe the expected flows.

## 5. Security checklist for the PoC

- Always verify `state` against the session before trusting anything else.
- Always pass the session's original `nonce` to the verify call — it binds
  the mDOC device signature (via the session transcript) to this request.
- Use HTTPS for `response_uri` in any non-local test; wallets require it.
- Prefer the encrypted response mode (`direct_post.jwt`) so the VP token is
  not exposed in transit and the session transcript can be derived correctly.
- Fail closed: any `OpenID4VPError` subclass (e.g. `NonceValidationError`,
  `InvalidSignatureError`, `ExpiredCredentialError`,
  `DecryptionFailedError`) → reject the presentation.
- Sessions must expire (e.g. 5 minutes) and be one-shot.

## 6. Out of scope for the PoC

- Multi-credential presentations (library currently rejects them).
- Proximity flows (ISO 18013-5 device engagement / BLE / NFC).
- SD-JWT VC credentials (supported by the library, but not needed for mDL).
- OIDF conformance certification (harness exists in `scripts/oidf-ci/` if
  needed later).
