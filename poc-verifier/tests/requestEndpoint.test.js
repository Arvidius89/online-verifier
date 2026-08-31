import { describe, it, expect } from 'vitest';

import { createApp } from '../src/server.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig({
    BASE_URL: 'http://localhost:3000',
    SESSION_TTL_MS: '60000',
    MDL_CLAIMS: 'family_name,given_name,age_over_18',
});

async function getJson(app, path) {
    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    try {
        const { port } = server.address();
        const res = await fetch(`http://127.0.0.1:${port}${path}`);
        return { status: res.status, body: await res.json() };
    } finally {
        server.close();
    }
}

describe('GET /api/request', () => {
    it('returns a wallet URI, QR data URL and session state', async () => {
        const { status, body } = await getJson(createApp(config), '/api/request');

        expect(status).toBe(200);
        expect(body.state).toMatch(/^[0-9a-f-]{36}$/);
        expect(body.qr).toMatch(/^data:image\/png;base64,/);
        expect(body.expiresInSeconds).toBeGreaterThan(0);
    });

    it('embeds an openid4vp URI with the HAIP mDL dcql_query', async () => {
        const { body } = await getJson(createApp(config), '/api/request');
        const url = new URL(body.uri.replace('openid4vp://', 'https://placeholder/'));

        expect(body.uri).toMatch(/^openid4vp:\/\/authorize\?/);
        expect(url.searchParams.get('response_type')).toBe('vp_token');
        expect(url.searchParams.get('response_mode')).toBe('direct_post');
        expect(url.searchParams.get('response_uri')).toBe(config.responseUri);
        expect(url.searchParams.get('client_id')).toBe(config.clientId);
        expect(url.searchParams.get('nonce')).toBeTruthy();
        expect(url.searchParams.get('state')).toBe(body.state);

        const dcql = JSON.parse(url.searchParams.get('dcql_query'));
        expect(dcql.credentials).toHaveLength(1);
        expect(dcql.credentials[0].format).toBe('mso_mdoc');
        expect(dcql.credentials[0].meta.doctype_value).toBe('org.iso.18013.5.1.mDL');
        expect(dcql.credentials[0].claims).toContainEqual({
            path: ['org.iso.18013.5.1', 'family_name'],
        });
    });
});

describe('GET /api/status/:state', () => {
    it('reports pending for a fresh session', async () => {
        const app = createApp(config);
        const { body } = await getJson(app, '/api/request');
        const { status, body: statusBody } = await getJson(app, `/api/status/${body.state}`);

        expect(status).toBe(200);
        expect(statusBody.status).toBe('pending');
    });

    it('returns 404 expired for unknown state', async () => {
        const { status, body } = await getJson(createApp(config), '/api/status/unknown');
        expect(status).toBe(404);
        expect(body.status).toBe('expired');
    });
});
