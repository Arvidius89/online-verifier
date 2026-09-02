import { Router } from 'express';
import QRCode from 'qrcode';

import { createPresentationRequest } from '../services/requestService.js';

/**
 * GET /api/request — create an authorization request session and return the
 * wallet URI plus a QR PNG data URL (VERIFIER_DESIGN.md §2.1).
 */
export function requestRoutes({ config, sessionStore }) {
    const router = Router();

    router.get('/api/request', async (req, res, next) => {
        try {
            const allowDigestMismatch = req.query.ignoreDigestErrors === 'true';
            const { uri, state } = createPresentationRequest(config, sessionStore, { allowDigestMismatch });

            // Server-side QR as PNG data URL — zero frontend dependencies.
            const qr = await QRCode.toDataURL(uri, {
                errorCorrectionLevel: 'M',
                margin: 2,
                width: 512,
            });

            res.json({
                state,
                qr,
                uri,
                expiresInSeconds: sessionStore.ttlSeconds(state),
            });
        } catch (err) {
            next(err);
        }
    });

    return router;
}
