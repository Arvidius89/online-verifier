import { describe, expect, it } from 'vitest';

import { verifyResponse } from '../src/services/verifyService.js';

const session = {
    clientId: 'verifier.test',
    nonce: 'nonce-1',
    query: { credentials: [{ id: 'mdl', format: 'mso_mdoc' }] },
    responseUri: 'http://localhost:3000/response',
};

const transcript = new Uint8Array([1, 2, 3]);
const trustedCertificates = [new Uint8Array([4, 5, 6])];

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
                trustedCertificates,
            });
            return result;
        };

        await expect(verifyResponse(session, envelope, trustedCertificates, {
            buildSessionTranscript,
            verifyAuthorizationResponse,
        })).resolves.toEqual({ result });
    });

    it('maps an invalid verification result to a safe failure', async () => {
        await expect(verifyResponse(session, {}, trustedCertificates, {
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

    it('leaves malformed envelopes as TypeError for the route to reject', async () => {
        await expect(verifyResponse(session, {}, trustedCertificates, {
            buildSessionTranscript: async () => transcript,
            verifyAuthorizationResponse: async () => {
                throw new TypeError('envelope is malformed');
            },
        })).rejects.toThrow('envelope is malformed');
    });
});