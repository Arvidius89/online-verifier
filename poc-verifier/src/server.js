import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { StaticTrustStore } from '@openeudi/openid4vp';

import { loadConfig } from './config.js';
import { SessionStore } from './services/sessionStore.js';
import { loadTrustedIssuers } from './trust/trustedIssuers.js';
import { requestRoutes } from './routes/requestRoutes.js';
import { responseRoutes } from './routes/responseRoutes.js';
import { statusRoutes } from './routes/statusRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Lazily resolved so importing this module (e.g. from tests) does not
// require a full environment — only actually starting a server does.
let defaultConfig;
function getDefaultConfig() {
    defaultConfig ??= loadConfig();
    return defaultConfig;
}

export function createApp(cfg = getDefaultConfig(), dependencies = {}) {
    const app = express();
    const sessionStore = new SessionStore({ ttlMs: cfg.sessionTtlMs });
    const trustStore = dependencies.trustStore ?? new StaticTrustStore([]);

    app.disable('x-powered-by');
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));
    app.use(express.static(path.join(__dirname, '..', 'public')));

    app.use(requestRoutes({ config: cfg, sessionStore }));
    app.use(responseRoutes({
        config: cfg,
        sessionStore,
        trustStore,
        verifyResponse: dependencies.verifyResponse,
    }));
    app.use(statusRoutes({ sessionStore }));

    // JSON error handler — keeps route failures out of the HTML error page.
    // eslint-disable-next-line no-unused-vars
    app.use((err, _req, res, _next) => {
        console.error(`[poc-verifier] request failed: ${err.name}: ${err.message}`);
        res.status(500).json({ error: 'internal_error' });
    });

    app.use((_req, res) => {
        res.status(404).json({ error: 'not_found' });
    });

    return app;
}

// Only listen when run directly (not when imported by tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const config = loadConfig(); // fails fast on missing/invalid env (PROJECT_PLAN.md §3.1)
    const trustedIssuers = loadTrustedIssuers(config.trustedIssuersDir);
    const trustStore = new StaticTrustStore(trustedIssuers);
    const app = createApp(config, { trustStore });
    const server = app.listen(config.port, () => {
        const { port } = server.address();
        console.log(`[poc-verifier] listening on port ${port}`);
        console.log(`[poc-verifier] base URL: ${config.baseUrl}`);
        console.log(`[poc-verifier] client_id: ${config.clientId}`);
        console.log(`[poc-verifier] response_uri: ${config.responseUri}`);
        console.log(`[poc-verifier] trusted issuers: ${trustedIssuers.length}`);
    });
}
