# OpenID4VP mDL Verification — Sequence

Complete cross-device flow for the PoC verifier: browser-driven request, QR
handoff to the wallet, `direct_post` response, and validation delegated to the
`@openeudi/openid4vp` library.

Participants:

- **Browser** — the user's desktop browser showing the verifier UI
- **Verifier** — the Express application (HTTP, sessions, QR)
- **Wallet** — the EUDI-compatible wallet on the user's phone holding the mDL
- **Library** — `@openeudi/openid4vp` (this repository)

## Full flow

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant V as Verifier (Express)
    participant W as Wallet (Phone)
    participant L as OpenID4VP Library

    Note over B,L: Phase 1 — Request creation
    B->>V: GET /api/request
    V->>L: buildHaipQuery(format: mso_mdoc, doctype: org.iso.18013.5.1.mDL, claims)
    L-->>V: DcqlQuery (claim paths namespaced to org.iso.18013.5.1)
    V->>L: validateHaipQuery(query)
    L-->>V: ok (throws HaipValidationError otherwise)
    V->>L: createAuthorizationRequest({clientId, responseUri, nonce}, query)
    L-->>V: { uri, state, nonce, dcqlQuery }
    V->>V: sessionStore.create({state, nonce, query, status: pending, TTL 5min})
    V-->>B: { state, qr (PNG data URL of uri), uri }
    B->>B: render QR panel, start polling /api/status/:state

    Note over B,W: Phase 2 — Wallet interaction (user scans QR)
    B-->>W: user scans QR (openid4vp://authorize?...)
    W->>W: parse dcql_query, match held mDL credential, user consent

    Note over W,L: Phase 3 — Response (direct_post)
    W->>V: POST /response (application/x-www-form-urlencoded)<br/>vp_token={ "mdl": ["<base64url CBOR DeviceResponse>"] }, state
    V->>V: sessionStore.get(state) — reject 400 if unknown/expired/consumed
    V->>L: verifyAuthorizationResponse(envelope, query, { nonce, trustedCertificates })
    L->>L: envelope checks (§8.1: object vp_token, array entries, single credential)
    L->>L: base64url-decode mDOC presentation to Uint8Array
    L->>L: MdocParser.parse — CBOR decode DeviceResponse
    L->>L: verify issuer COSE_Sign1 over MSO (x5chain ↔ trusted certs)
    L->>L: MSO checks — docType, validity period, value digests
    L->>L: verifyDeviceAuth against session transcript (nonce binding)
    L->>L: matchQuery(dcqlQuery, decoded claims) + buildSubmission
    L-->>V: VerifyResult { valid, parsed, match, submission }

    alt valid
        V->>V: sessionStore.complete(state, result) — one-shot
        V-->>W: 200 OK
    else invalid / library error
        V->>V: sessionStore.complete(state, error + match.unmatched)
        V-->>W: 200 OK (failure surfaced to browser, not wallet)
    end

    Note over B,V: Phase 4 — Result delivery to browser
    loop every 2s until done/failed/expired
        B->>V: GET /api/status/:state
        V-->>B: { status: pending | done | failed, claims?, error? }
    end
    B->>B: render claims table (family_name, given_name, birth_date,<br/>age_over_18, portrait) or error + unmatched reasons
```

## Failure and edge paths

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant V as Verifier (Express)
    participant W as Wallet (Phone)
    participant L as OpenID4VP Library

    Note over W,V: Wallet denies the request
    W->>V: POST /response (error=access_denied, state)
    V->>V: sessionStore.complete(state, "access_denied")
    V-->>B: (via polling) { status: failed, error: "access_denied" }

    Note over W,V: Replay / stale response
    W->>V: POST /response with already-consumed state
    V-->>W: 400 (one-shot session enforcement)

    Note over W,V: Session expiry
    B->>V: GET /api/status/:state after TTL
    V-->>B: 404 { status: expired }

    Note over V,L: Crypto failures (library throws or returns valid:false)
    V->>L: verifyAuthorizationResponse(...)
    L-->>V: InvalidSignatureError / ExpiredCredentialError /<br/>NonceValidationError / MalformedCredentialError /<br/>"Issuer certificate is not trusted"
    V->>V: sessionStore.complete(state, error)
    V-->>B: (via polling) { status: failed, error }
```

## Notes

1. **Stateless library, stateful verifier.** The library never tracks `state`
   or `nonce`; the verifier's session store binds them, enforces the one-shot
   rule, and the caller compares `state` before invoking the library.
2. **Nonce binding.** The `nonce` from the authorization request flows into
   the mDOC session transcript, so the wallet's device signature is bound to
   this exact session — replayed responses fail device-auth.
3. **Encrypted variant (`direct_post.jwt`).** Not in the PoC baseline: the
   wallet posts `{ response: "<JWE>" }` instead; the library decrypts it
   (`decryptAuthorizationResponse`, ECDH-ES + A128/256GCM) and auto-builds the
   mDOC session transcript from the JWE `apu` header (ISO 18013-7) or the
   verifier encryption JWK thumbprint (OpenID4VP 1.0). See
   VERIFIER_CAPABILITIES.md §3.
4. **Polling vs push.** The browser learns the outcome by polling
   `/api/status/:state` because the wallet talks directly to the verifier
   backend; WebSockets/SSE were rejected for PoC simplicity.
