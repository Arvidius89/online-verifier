import { randomUUID } from 'node:crypto';
import { createAuthorizationRequest } from '@openeudi/openid4vp';

import { DEFAULT_DOCTYPE } from '../doctype-config.js';
import { buildDocumentQuery } from './queryBuilder.js';

/**
 * Build an unsigned OpenID4VP authorization request for an mDL presentation
 * and register the corresponding session (VERIFIER_DESIGN.md §1.4).
 *
 * The library auto-generates `state` (UUIDv4); the returned session is keyed
 * by it so the wallet's `direct_post` callback can be matched later.
 *
 * @param {object} config validated app config (clientId, responseUri, mdlClaims)
 * @param {import('./sessionStore.js').SessionStore} sessionStore
 * @param {object} [opts]
 * @param {boolean} [opts.allowDigestMismatch=false] DEBUG ONLY — see ParseOptions.allowDigestMismatch
 * @returns {{ uri: string, state: string, nonce: string, session: object }}
 */
export function createPresentationRequest(
    config,
    sessionStore,
    { doctype = DEFAULT_DOCTYPE, allowDigestMismatch = false } = {},
) {
    const claims = config.claimsByDoctype?.[doctype] ?? config.mdlClaims;
    const query = buildDocumentQuery(doctype, claims);

    const request = createAuthorizationRequest(
        {
            clientId: config.clientId,
            responseUri: config.responseUri,
            nonce: randomUUID(),
            // state omitted → library generates a UUID
        },
        query,
    );

    const session = sessionStore.create({
        state: request.state,
        nonce: request.nonce,
        clientId: config.clientId,
        responseUri: config.responseUri,
        query: request.dcqlQuery,
        doctype,
        allowDigestMismatch,
    });

    return {
        uri: request.uri,
        state: request.state,
        nonce: request.nonce,
        session,
    };
}
