import { describe, expect, it } from 'vitest';

import { verifyResponse } from '../src/services/verifyService.js';

const session = {
    clientId: 'verifier.test',
    nonce: 'nonce-1',
    query: { credentials: [{ id: 'mdl', format: 'mso_mdoc' }] },
    responseUri: 'http://localhost:3000/response',
};

const transcript = new Uint8Array([1, 2, 3]);
const trustStore = { getAnchors: async () => [] };

describe('verifyResponse', () => {
    it('binds the session values and trust set to verification', async () => {
        const envelope = { vp_token: { mdl: ['token'] } };
        const result = { valid: true, parsed: { claims: {} }, match: {} };
        const buildSessionTranscript = async (params) => {
            expect(params).toEqual({
                clientId: session.clientId,
                nonce: session.nonce,
                responseUri: session.responseUri,
            });
            return transcript;
        };
        const verifyAuthorizationResponse = async (actualEnvelope, query, options) => {
            expect(actualEnvelope).toBe(envelope);
            expect(query).toBe(session.query);
            expect(options).toMatchObject({
                clientId: session.clientId,
                mdocSessionTranscript: transcript,
                nonce: session.nonce,
                responseUri: session.responseUri,
                trustedCertificates: [],
                trustStore,
            });
            return result;
        };

        await expect(verifyResponse(session, envelope, trustStore, {
            buildSessionTranscript,
            verifyAuthorizationResponse,
        })).resolves.toEqual({ result });
    });

    it('maps an invalid verification result to a safe failure', async () => {
        await expect(verifyResponse(session, {}, trustStore, {
            buildSessionTranscript: async () => transcript,
            verifyAuthorizationResponse: async () => ({
                valid: false,
                parsed: { error: 'Issuer is not trusted.' },
                match: { unmatched: [{ reason: 'missing_claims' }] },
            }),
        })).resolves.toEqual({
            error: 'Issuer is not trusted.',
            unmatched: [{ reason: 'missing_claims' }],
        });
    });

    it('forwards session.allowDigestMismatch to the library and surfaces digestMismatchIgnored', async () => {
        const envelope = { vp_token: { mdl: ['token'] } };
        const verifyAuthorizationResponse = async (_envelope, _query, options) => {
            expect(options.allowDigestMismatch).toBe(true);
            return {
                valid: true,
                parsed: { claims: {}, digestMismatchIgnored: true, digestLog: [{ match: false }] },
                match: {},
            };
        };

        await expect(verifyResponse(
            { ...session, allowDigestMismatch: true },
            envelope,
            trustStore,
            { buildSessionTranscript: async () => transcript, verifyAuthorizationResponse },
        )).resolves.toEqual({
            result: {
                valid: true,
                parsed: { claims: {}, digestMismatchIgnored: true, digestLog: [{ match: false }] },
                match: {},
            },
        });
    });

    it('leaves malformed envelopes as TypeError for the route to reject', async () => {
        await expect(verifyResponse(session, {}, trustStore, {
            buildSessionTranscript: async () => transcript,
            verifyAuthorizationResponse: async () => {
                throw new TypeError('envelope is malformed');
            },
        })).rejects.toThrow('envelope is malformed');
    });
});