import { Router } from 'express';

import { verifyResponse as defaultVerifyResponse } from '../services/verifyService.js';

function responseEnvelope(vpToken, query) {
    if (vpToken && typeof vpToken === 'object') return { vp_token: vpToken };
    if (typeof vpToken !== 'string' || !vpToken) {
        throw new TypeError('vp_token is required');
    }

    try {
        const parsed = JSON.parse(vpToken);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return { vp_token: parsed };
        }
    } catch {
        // A single mDOC is posted directly as a base64url string.
    }

    const credentialId = query.credentials?.[0]?.id;
    if (!credentialId) throw new TypeError('authorization request has no credential id');
    return { vp_token: { [credentialId]: [vpToken] } };
}

/** POST /response — accept and verify an unencrypted OpenID4VP direct_post response. */
export function responseRoutes({ config, sessionStore, trustStore, verifyResponse = defaultVerifyResponse }) {
    const router = Router();

    router.post('/response', async (req, res, next) => {
        const { state, vp_token: vpToken, response } = req.body;
        if (typeof state !== 'string' || !state) {
            res.status(400).json({ error: 'invalid_state' });
            return;
        }

        const session = sessionStore.get(state);
        if (!session || session.status === 'expired') {
            res.status(400).json({ error: 'invalid_state' });
            return;
        }
        if (session.status !== 'pending') {
            res.status(400).json({ error: 'response_already_processed' });
            return;
        }
        if (typeof response === 'string' && response) {
            sessionStore.complete(state, { error: 'Encrypted responses are not supported by this verifier.' });
            res.json({ redirect_uri: `${config.baseUrl}/?state=${encodeURIComponent(state)}#failed` });
            return;
        }

        try {
            const outcome = await verifyResponse(
                session,
                responseEnvelope(vpToken, session.query),
                trustStore,
            );
            if (outcome.result) {
                sessionStore.complete(state, { result: outcome.result });
                res.json({ redirect_uri: `${config.baseUrl}/?state=${encodeURIComponent(state)}#done` });
                return;
            }

            sessionStore.complete(state, {
                error: outcome.error,
                unmatched: outcome.unmatched,
                digestLog: outcome.digestLog,
                digestMismatchIgnored: outcome.digestMismatchIgnored,
            });
            res.json({ redirect_uri: `${config.baseUrl}/?state=${encodeURIComponent(state)}#failed` });
        } catch (error) {
            if (error instanceof TypeError) {
                res.status(400).json({ error: 'invalid_response' });
                return;
            }
            next(error);
        }
    });

    return router;
}