import { describe, expect, it } from 'vitest';
import { buildOpenID4VPHandoverSessionTranscript, StaticTrustStore } from '@openeudi/openid4vp';

import { loadConfig } from '../src/config.js';
import { createApp } from '../src/server.js';
import { generateTestKeyMaterial } from '../../tests/fixtures/crypto-helpers.js';
import { buildSignedMdoc } from '../../tests/fixtures/mdoc-helpers.js';

const config = loadConfig({
    BASE_URL: 'http://localhost:3000',
    MDL_CLAIMS: 'family_name,given_name',
    SESSION_TTL_MS: '60000',
});

async function withServer(app, test) {
    const server = await new Promise((resolve) => {
        const listener = app.listen(0, () => resolve(listener));
    });
    try {
        await test(`http://127.0.0.1:${server.address().port}`);
    } finally {
        server.close();
    }
}

async function requestSession(baseUrl) {
    const response = await fetch(`${baseUrl}/api/request`);
    return response.json();
}

async function requestKiwaSession(baseUrl) {
    const response = await fetch(
        `${baseUrl}/api/request?doctype=org.iso.23220.1.nl.kiwa.sampcert`,
    );
    return response.json();
}

describe('POST /response', () => {
    it('verifies a signed repository mDOC fixture through the direct_post flow', async () => {
        const issuerKey = await generateTestKeyMaterial();
        const trustStore = new StaticTrustStore([issuerKey.certDerBytes]);
        const app = createApp(config, { trustStore });

        await withServer(app, async (baseUrl) => {
            const request = await requestSession(baseUrl);
            const requestUrl = new URL(request.uri.replace('openid4vp://', 'https://placeholder/'));
            const transcript = await buildOpenID4VPHandoverSessionTranscript({
                clientId: config.clientId,
                nonce: requestUrl.searchParams.get('nonce'),
                responseUri: config.responseUri,
            });
            const mdoc = await buildSignedMdoc({
                issuerKey,
                docType: 'org.iso.18013.5.1.mDL',
                namespaces: {
                    'org.iso.18013.5.1': { family_name: 'Doe', given_name: 'Jane' },
                },
                sessionTranscript: transcript,
            });
            const response = await fetch(`${baseUrl}/response`, {
                method: 'POST',
                body: new URLSearchParams({
                    state: request.state,
                    vp_token: Buffer.from(mdoc.mdocBytes).toString('base64url'),
                }),
            });
            expect(response.status).toBe(200);

            const status = await fetch(`${baseUrl}/api/status/${request.state}`);
            const result = await status.json();
            expect(result.status).toBe('done');
            expect(result.claims).toMatchObject({ family_name: 'Doe', given_name: 'Jane' });
            expect(result.docType).toBe('org.iso.18013.5.1.mDL');
        });
    });

    it('completes a session and exposes verified claims through status', async () => {
        const verifyResponse = async () => ({
            result: {
                valid: true,
                parsed: {
                    claims: { ignored: true },
                    namespacedClaims: {
                        'org.iso.18013.5.1': { family_name: 'Doe', portrait: new Uint8Array([1, 2]) },
                    },
                    docType: 'org.iso.18013.5.1.mDL',
                    issuer: { country: 'NL' },
                },
                match: {},
            },
        });
        const app = createApp(config, { verifyResponse });

        await withServer(app, async (baseUrl) => {
            const request = await requestSession(baseUrl);
            const response = await fetch(`${baseUrl}/response`, {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ state: request.state, vp_token: 'base64url-mdoc-token' }),
            });
            expect(response.status).toBe(200);
            expect((await response.json()).redirect_uri).toContain('#done');

            const status = await fetch(`${baseUrl}/api/status/${request.state}`);
            expect(await status.json()).toEqual({
                status: 'done',
                claims: { family_name: 'Doe' },
                docType: 'org.iso.18013.5.1.mDL',
                issuer: { country: 'NL' },
                portrait: 'AQI=',
            });
        });
    });

    it('uses the selected Kiwa namespace when exposing verified claims', async () => {
        const verifyResponse = async () => ({
            result: {
                valid: true,
                parsed: {
                    claims: { ignored: true },
                    namespacedClaims: {
                        'org.iso.23220.1.nl.kiwa.sampcert': { sample_id: 'S-42' },
                        'org.iso.18013.5.1': { wrong_namespace: true },
                    },
                    docType: 'org.iso.23220.1.nl.kiwa.sampcert',
                },
                match: {},
            },
        });
        const app = createApp(config, { verifyResponse });

        await withServer(app, async (baseUrl) => {
            const request = await requestKiwaSession(baseUrl);
            await fetch(`${baseUrl}/response`, {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ state: request.state, vp_token: 'base64url-mdoc-token' }),
            });

            const status = await fetch(`${baseUrl}/api/status/${request.state}`);
            expect(await status.json()).toMatchObject({
                status: 'done',
                claims: { sample_id: 'S-42' },
                docType: 'org.iso.23220.1.nl.kiwa.sampcert',
            });
        });
    });

    it('marks a rejected response as failed and refuses a replay', async () => {
        const app = createApp(config, {
            verifyResponse: async () => ({ error: 'Credential verification failed.', unmatched: ['missing_claim'] }),
        });

        await withServer(app, async (baseUrl) => {
            const request = await requestSession(baseUrl);
            const body = new URLSearchParams({ state: request.state, vp_token: '{}' });
            expect((await fetch(`${baseUrl}/response`, { method: 'POST', body })).status).toBe(200);

            const status = await fetch(`${baseUrl}/api/status/${request.state}`);
            expect(await status.json()).toEqual({
                status: 'failed',
                error: 'Credential verification failed.',
                unmatched: ['missing_claim'],
            });
            expect((await fetch(`${baseUrl}/response`, { method: 'POST', body })).status).toBe(400);
        });
    });

    it('rejects unknown states and malformed responses', async () => {
        const app = createApp(config);
        await withServer(app, async (baseUrl) => {
            const unknown = await fetch(`${baseUrl}/response`, {
                method: 'POST',
                body: new URLSearchParams({ state: 'missing', vp_token: 'token' }),
            });
            expect(unknown.status).toBe(400);
            expect(await unknown.json()).toEqual({ error: 'invalid_state' });

            const request = await requestSession(baseUrl);
            const malformed = await fetch(`${baseUrl}/response`, {
                method: 'POST',
                body: new URLSearchParams({ state: request.state }),
            });
            expect(malformed.status).toBe(400);
            expect(await malformed.json()).toEqual({ error: 'invalid_response' });
        });
    });
});