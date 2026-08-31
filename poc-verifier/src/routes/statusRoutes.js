import { Router } from 'express';

/**
 * GET /api/status/:state — polled by the browser while the wallet interacts
 * with the verifier directly (VERIFIER_DESIGN.md §2.3). Milestone 2 exposes
 * pending/expired; done/failed arrive with Milestone 3.
 */
export function statusRoutes({ sessionStore }) {
    const router = Router();

    router.get('/api/status/:state', (req, res) => {
        const session = sessionStore.get(req.params.state);
        if (!session || session.status === 'expired') {
            res.status(404).json({ status: 'expired' });
            return;
        }
        if (session.status === 'done') {
            const parsed = session.result.parsed;
            const claims = parsed.namespacedClaims?.['org.iso.18013.5.1'] ?? parsed.claims;
            const { portrait, ...displayClaims } = claims;
            res.json({
                status: 'done',
                claims: displayClaims,
                docType: parsed.docType,
                issuer: parsed.issuer,
                portrait: portrait instanceof Uint8Array
                    ? Buffer.from(portrait).toString('base64')
                    : undefined,
            });
            return;
        }
        if (session.status === 'failed') {
            res.json({ status: 'failed', error: session.error, unmatched: session.unmatched });
            return;
        }
        res.json({ status: 'pending' });
    });

    return router;
}
