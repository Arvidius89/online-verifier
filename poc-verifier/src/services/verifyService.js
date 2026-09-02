import {
    buildOpenID4VPHandoverSessionTranscript,
    CertificateChainError,
    DecryptionFailedError,
    ExpiredCredentialError,
    InvalidSignatureError,
    MalformedCredentialError,
    NonceValidationError,
    OpenID4VPError,
    TrustAnchorNotFoundError,
    verifyAuthorizationResponse,
} from '@openeudi/openid4vp';

const VERIFICATION_ERRORS = [
    CertificateChainError,
    DecryptionFailedError,
    ExpiredCredentialError,
    InvalidSignatureError,
    MalformedCredentialError,
    NonceValidationError,
    OpenID4VPError,
    TrustAnchorNotFoundError,
];

function isVerificationError(error) {
    return VERIFICATION_ERRORS.some((ErrorClass) => error instanceof ErrorClass);
}

/**
 * Verify a direct_post envelope against the authorization request session.
 * The unencrypted OpenID4VP 1.0 mDOC flow binds device authentication to a
 * handover transcript containing the verifier's client ID, nonce and callback.
 */
export async function verifyResponse(session, envelope, trustStore, dependencies = {}) {
    const verify = dependencies.verifyAuthorizationResponse ?? verifyAuthorizationResponse;
    const buildTranscript = dependencies.buildSessionTranscript
        ?? buildOpenID4VPHandoverSessionTranscript;

    try {
        const mdocSessionTranscript = await buildTranscript({
            clientId: session.clientId,
            nonce: session.nonce,
            responseUri: session.responseUri,
        });
        const result = await verify(envelope, session.query, {
            clientId: session.clientId,
            mdocSessionTranscript,
            nonce: session.nonce,
            responseUri: session.responseUri,
            // trustStore drives RFC 5280 chain validation; trustedCertificates is the
            // deprecated byte-equality path and must stay empty so it's ignored.
            trustedCertificates: [],
            trustStore,
            // DEBUG ONLY — opted into per-session via the frontend toggle.
            allowDigestMismatch: session.allowDigestMismatch === true,
        });

        if (result.parsed.digestMismatchIgnored) {
            console.warn(`[SECURITY] digest mismatch ignored for state=${session.state}`);
        }

        if (!result.valid) {
            return {
                error: result.parsed.error ?? 'Credential verification did not satisfy the request.',
                unmatched: result.match?.unmatched,
                digestLog: result.parsed.digestLog,
                digestMismatchIgnored: result.parsed.digestMismatchIgnored,
            };
        }
        return { result };
    } catch (error) {
        if (error instanceof TypeError) throw error;
        if (isVerificationError(error)) {
            return { error: 'Credential verification failed.' };
        }
        throw error;
    }
}