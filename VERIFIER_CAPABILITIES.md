# Verifier Capabilities — Repository API Validation

Validation of the `@openeudi/openid4vp` library (v0.10.0) against everything a
minimal OpenID4VP mDL verifier needs. Each capability lists the exact API,
its source location, and a working snippet. Gaps are recorded at the end.

**Verdict up front:** the repository contains all functionality required for
the planned PoC verifier. The only gaps are application-level concerns
(HTTP, sessions, QR) that a library intentionally does not provide, plus two
documented protocol limitations (single-credential responses only; revocation
policies `prefer`/`require` not yet shipped).

## 1. Capability matrix

| Verifier need | Library API | Source | Status |
| --- | --- | --- | --- |
| Build mDL DCQL query | `buildHaipQuery` | [src/haip.ts](src/haip.ts#L11) | ✅ |
| Validate DCQL query (HAIP) | `validateHaipQuery`, `isHaipQuery`, `HAIP_DOCTYPE_NAMESPACES` | [src/haip.ts](src/haip.ts#L61) | ✅ |
| Unsigned authorization request | `createAuthorizationRequest` | [src/authorization.ts](src/authorization.ts#L6) | ✅ |
| Signed authorization request (JAR / RFC 9101) | `createSignedAuthorizationRequest` | [src/signed-authorization.ts](src/signed-authorization.ts#L28) | ✅ |
| Validate VP response envelope (§8.1) | `verifyAuthorizationResponse` | [src/verify.ts](src/verify.ts#L177) | ✅ |
| Validate raw VP token + DCQL match | `verifyPresentation` | [src/verify.ts](src/verify.ts#L48) | ✅ |
| Decrypt JWE responses (`direct_post.jwt`) | `decryptAuthorizationResponse` | [src/decrypt-response.ts](src/decrypt-response.ts#L21) | ✅ |
| Parse/verify mDOC DeviceResponse | `MdocParser` (via `parsePresentation`) | [src/parsers/mdoc.parser.ts](src/parsers/mdoc.parser.ts#L202), [src/presentation.ts](src/presentation.ts#L8) | ✅ |
| mDOC crypto primitives | `decodeCoseSign1`, `verifyCoseSign1`, `verifyDeviceAuth`, `verifyAllDigests`, `decodeMso`, `validateMsoValidity`, `validateMsoDocType` | [src/crypto/](src/crypto/) | ✅ |
| Session transcript (device binding) | `buildOid4vpSessionTranscript`, `buildOpenID4VPHandoverSessionTranscript` (auto-built inside `verifyAuthorizationResponse`) | [src/crypto/session-transcript.ts](src/crypto/session-transcript.ts) | ✅ |
| Issuer trust | `StaticTrustStore`, `CompositeTrustStore`, `LotlTrustStore`, or legacy `trustedCertificates` byte-equality | [src/trust/index.ts](src/trust/index.ts) | ✅ |
| Revocation (CRL/OCSP plumbing) | `CrlFetcher`, `OcspClient`, `RevocationChecker` | [src/trust/](src/trust/) | ⚠️ partial — only `revocationPolicy: 'skip'` works; `'prefer'`/`'require'` throw today |
| HTTP server / sessions / QR | — | — | ❌ not in scope for a library (app layer) |

All public exports are surfaced through [src/index.ts](src/index.ts).

## 2. Authorization request creation

### 2.1 Unsigned request — `createAuthorizationRequest`

[src/authorization.ts](src/authorization.ts#L6)

Input ([src/types/authorization.ts](src/types/authorization.ts#L3)):
`{ clientId, responseUri, nonce, state?, responseMode?: 'direct_post' | 'direct_post.jwt' }`.
`state` auto-generates as UUIDv4 when omitted; `responseMode` defaults to
`direct_post`. Returns `{ uri, dcqlQuery, nonce, state }`.

```ts
import { buildHaipQuery, createAuthorizationRequest } from '@openeudi/openid4vp';
import { randomUUID } from 'node:crypto';

const query = buildHaipQuery({
  credentialId: 'mdl',
  format: 'mso_mdoc',
  doctypeValue: 'org.iso.18013.5.1.mDL',   // claim paths auto-namespaced to org.iso.18013.5.1
  claims: ['family_name', 'given_name', 'birth_date', 'age_over_18'],
});

const request = createAuthorizationRequest(
  {
    clientId: 'x509_san_dns:verifier.example.com',
    responseUri: 'https://verifier.example.com/response',
    nonce: randomUUID(),
  },
  query,
);
// request.uri → "openid4vp://authorize?response_type=vp_token&response_mode=direct_post&..."
```

### 2.2 Signed request (JAR) — `createSignedAuthorizationRequest`

[src/signed-authorization.ts](src/signed-authorization.ts#L28)

OpenID4VP 1.0 §5.10 / RFC 9101. Validates signer key ↔ leaf cert binding and
SAN hostname, supports `x509_san_dns` and `x509_hash` client ID prefixes
(§5.9.3), ES256/ES384/RS256, and advertises a response-encryption JWK for
`direct_post.jwt` (defaults to it). Returns `{ uri, requestObject, ... }` —
the caller hosts `requestObject` at `requestUri` with
`Content-Type: application/oauth-authz-req+jwt`.

```ts
const signed = await createSignedAuthorizationRequest(
  {
    hostname: 'verifier.example.com',
    requestUri: 'https://verifier.example.com/request.jwt',
    responseUri: 'https://verifier.example.com/response',
    nonce: randomUUID(),
    signer: keyPair,                       // CryptoKeyPair, publicKey must match leaf cert SPKI
    certificateChain: [leafDer, caDer],    // DER bytes, leaf first
    encryptionKey: { publicJwk },          // required for direct_post.jwt
    vpFormatsSupported: { mso_mdoc: { issuerauth_alg_values: [-7], deviceauth_alg_values: [-7] } },
  },
  query,
);
```

## 3. Authorization response validation

### 3.1 Envelope validation — `verifyAuthorizationResponse`

[src/verify.ts](src/verify.ts#L177)

Accepts the §8.1 envelope or a JWE wrapper `{ response: '<JWE>' }`:

- **Unencrypted**: `vp_token` must be a JSON object keyed by query id, and
  each entry must be an **array of presentations** (OpenID4VP 1.0 §8.1).
- **mDOC transport**: when the query's format is `mso_mdoc` and the
  presentation is a string, the library base64url-decodes it to bytes
  internally ([src/verify.ts](src/verify.ts#L283-L289)) — the verifier app
  does not need to pre-decode.
- **Single credential only**: >1 query id or >1 presentation throws
  `MultipleCredentialsNotSupportedError`.
- **Encrypted**: requires `options.decryptionKey` (CryptoKey, ECDH-ES +
  A128GCM/A256GCM). The mDOC `SessionTranscript` is auto-built from
  `clientId`/`responseUri`/`nonce` plus either the JWE `apu` nonce
  (`iso-18013-7`, default) or the verifier encryption JWK thumbprint
  (`openid4vp-1.0`). A caller-supplied `mdocSessionTranscript` always wins.
- **State**: the caller MUST compare `envelope.state` against its own
  session — the library is stateless.

```ts
import { verifyAuthorizationResponse } from '@openeudi/openid4vp';

// app layer: parse form body, JSON.parse vp_token, wrap as { vp_token }
const result = await verifyAuthorizationResponse(envelope, session.query, {
  nonce: session.nonce,                    // replay protection / device binding
  trustStore: new StaticTrustStore([...]), // or trustedCertificates: [derBytes]
  // encrypted flow additionally:
  // decryptionKey, clientId, responseUri,
  // sessionTranscriptProfile: 'openid4vp-1.0', verifierEncryptionJwk,
});

if (result.valid) {
  const claims = result.parsed.namespacedClaims['org.iso.18013.5.1'];
  // { family_name, given_name, birth_date, age_over_18, ... }
} else {
  // result.parsed.error  — crypto/structural failure
  // result.match.unmatched — per-claim DCQL reasons:
  //   format_mismatch | vct_mismatch | doctype_mismatch | missing_claims |
  //   value_mismatch | trusted_authority_mismatch | no_credential_found
}
```

### 3.2 JWE decryption — `decryptAuthorizationResponse`

[src/decrypt-response.ts](src/decrypt-response.ts#L21)

Standalone decryptor (also used internally). Restricted to `alg: ECDH-ES`,
`enc: A128GCM | A256GCM`; anything else throws `UnsupportedJweError`,
crypto failures throw `DecryptionFailedError`.

```ts
const envelope = await decryptAuthorizationResponse(jwe, privateKey);
```

## 4. mDOC credential parsing

### 4.1 Dispatch — `parsePresentation`

[src/presentation.ts](src/presentation.ts#L8)

Format auto-detection: strings with `~` → SD-JWT VC; `Uint8Array`/`Buffer` →
mDOC. `MdocParser.canParse` is `vpToken instanceof Uint8Array`
([src/parsers/mdoc.parser.ts](src/parsers/mdoc.parser.ts#L210)).

### 4.2 `MdocParser.parse` validation pipeline

[src/parsers/mdoc.parser.ts](src/parsers/mdoc.parser.ts#L220)

1. CBOR-decode `DeviceResponse`, extract `documents[0].issuerSigned`.
2. Decode `issuerAuth` COSE_Sign1; algorithm allow-list
   (default `ES256/ES384/ES512`).
3. **Trust** — two paths:
   - `trustStore` provided → RFC 5280 chain validation via `TrustEvaluator`
     (with optional revocation policy, fetcher, cache, clock-skew tolerance);
   - legacy `trustedCertificates` → byte-equality of the x5chain leaf
     (deprecated since 0.5.0, removal in 1.0.0).
   Empty trust input throws `MalformedCredentialError` unless
   `skipTrustCheck: true`.
4. Verify issuer COSE_Sign1 signature over the MSO (`InvalidSignatureError`
   on failure).
5. MSO checks: `validateMsoDocType`, `validateMsoValidity`
   (`ExpiredCredentialError`), `verifyAllDigests` for each disclosed
   `IssuerSignedItemBytes`.
6. Device authentication: `verifyDeviceAuth` against
   `options.mdocSessionTranscript` — **required for mDOC**; the parser fails
   closed without it (for the encrypted flow `verifyAuthorizationResponse`
   builds it automatically; for unencrypted `direct_post` the caller must
   supply it or use the transcript builders).

```ts
import {
  parsePresentation,
  buildOid4vpSessionTranscript,
} from '@openeudi/openid4vp';

const mdocSessionTranscript = await buildOid4vpSessionTranscript({
  clientId, responseUri, nonce, mdocGeneratedNonce,
});

const parsed = await parsePresentation(deviceResponseBytes, {
  nonce,
  trustedCertificates: [issuerCertDer],
  mdocSessionTranscript,
});
```

### 4.3 Parse options that matter to a verifier

[src/parsers/parser.interface.ts](src/parsers/parser.interface.ts#L6)

`nonce` (required), `trustedCertificates` / `trustStore`,
`mdocSessionTranscript`, `expectedDocType` (fail fast on wrong docType),
`allowedAlgorithms`, `audience` + `requireKeyBinding` (SD-JWT),
`trustedIssuerJwks` (CI-only alternate trust path, explicitly not for
production), `clockSkewTolerance`.

## 5. Trust infrastructure

[src/trust/index.ts](src/trust/index.ts)

- `StaticTrustStore(anchors)` — in-memory anchors; the PoC default.
- `CompositeTrustStore([...])` — combine stores.
- `LotlTrustStore(options)` — EU List of Trusted Lists resolution
  (uses `LotlFetcher`/`LotlParser`, signed-XML validation).
- `InMemoryCache`, pluggable `Fetcher` (defaults to `globalThis.fetch`).
- Errors: `TrustAnchorNotFoundError`, `CertificateChainError`,
  `RevokedCertificateError`, `RevocationCheckFailedError`, `LotlFetchError`,
  `LotlSignatureError`.

## 6. Missing functionality / gaps

| Gap | Severity for PoC | Notes |
| --- | --- | --- |
| HTTP server, session store, QR generation, frontend | Expected | Application concerns; built in the PoC app, not the library |
| Multi-credential responses | Low | `verifyAuthorizationResponse` throws `MultipleCredentialsNotSupportedError` when >1 credential/query id — PoC requests exactly one mDL |
| Revocation policies `prefer` / `require` | Low | `ParseOptions.revocationPolicy` documents them as "ship in 0.5.0 workstream A.2 — passing them today throws"; only `'skip'` (default) works |
| `trustedCertificates` byte-equality path deprecated | Low | Works in 0.10.0; migrate to `StaticTrustStore` before 1.0.0 |
| Unencrypted `direct_post` + mDOC session transcript | Medium | Auto-transcript construction only happens on the **encrypted** path. For unsigned/unencrypted PoC requests the app must build and pass `mdocSessionTranscript` itself, and it cannot know the wallet's `mdoc-generated-nonce` — in practice this pushes the PoC toward the encrypted flow (`direct_post.jwt`) for real-wallet interop, or toward wallets implementing the OpenID4VP 1.0 handover. Confirm against `tests/verify-authorization-response.test.ts` and the OIDF CI harness during implementation. |
| OIDF conformance certification | Optional | Harness exists (`scripts/oidf-ci/`, `docker/oidf-conformance-suite/`) — no code gap |

## 7. Conclusion

The repository provides complete verifier-side protocol support for the PoC:
request building (unsigned and signed/JAR), response envelope validation,
mDOC parsing with full ISO 18013-5/18013-7 cryptographic verification,
device binding via session transcripts, JWE decryption, and pluggable issuer
trust. Remaining work is purely the application layer (Express server,
sessions, QR, UI) as designed in `ARCHITECTURE.md` / `VERIFIER_DESIGN.md`,
plus one integration decision on the session-transcript strategy for
unencrypted flows.
