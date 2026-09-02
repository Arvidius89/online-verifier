import { describe, it, expect } from 'vitest';

import { SessionStore } from '../src/services/sessionStore.js';

const baseSession = {
    state: 'state-1',
    nonce: 'nonce-1',
    clientId: 'verifier.test',
    responseUri: 'http://localhost:3000/response',
    query: { credentials: [{ id: 'mdl' }] },
};

function makeStore(ttlMs = 60_000, now = () => 1_000_000) {
    return new SessionStore({ ttlMs, now, sweep: false });
}

describe('SessionStore', () => {
    it('creates and retrieves a pending session', () => {
        const store = makeStore();
        store.create(baseSession);
        const session = store.get('state-1');
        expect(session.status).toBe('pending');
        expect(session.nonce).toBe('nonce-1');
        expect(session.allowDigestMismatch).toBe(false);
    });

    it('stores an explicit allowDigestMismatch flag', () => {
        const store = makeStore();
        store.create({ ...baseSession, allowDigestMismatch: true });
        expect(store.get('state-1').allowDigestMismatch).toBe(true);
    });

    it('rejects creation without required fields', () => {
        const store = makeStore();
        expect(() => store.create({ state: 'x' })).toThrow(TypeError);
    });

    it('rejects duplicate state', () => {
        const store = makeStore();
        store.create(baseSession);
        expect(() => store.create(baseSession)).toThrow(/collision/);
    });

    it('returns undefined for unknown state', () => {
        const store = makeStore();
        expect(store.get('nope')).toBeUndefined();
        expect(store.complete('nope', {})).toBe(false);
    });

    it('expires sessions after the TTL', () => {
        let clock = 0;
        const store = makeStore(60_000, () => clock);
        store.create(baseSession);
        clock = 61_000;
        const session = store.get('state-1');
        expect(session.status).toBe('expired');
        expect(store.get('state-1')).toBeUndefined(); // removed after expiry
    });

    it('completes a pending session with a result', () => {
        const store = makeStore();
        store.create(baseSession);
        expect(store.complete('state-1', { result: { valid: true } })).toBe(true);
        expect(store.get('state-1').status).toBe('done');
        expect(store.get('state-1').result).toEqual({ valid: true });
    });

    it('completes a pending session with an error', () => {
        const store = makeStore();
        store.create(baseSession);
        expect(store.complete('state-1', { error: 'access_denied' })).toBe(true);
        expect(store.get('state-1').status).toBe('failed');
    });

    it('is one-shot: a completed session cannot be completed again (replay rejected)', () => {
        const store = makeStore();
        store.create(baseSession);
        expect(store.complete('state-1', { result: { valid: true } })).toBe(true);
        expect(store.complete('state-1', { error: 'replay attempt' })).toBe(false);
        expect(store.get('state-1').status).toBe('done');
    });

    it('cannot complete an expired session', () => {
        let clock = 0;
        const store = makeStore(60_000, () => clock);
        store.create(baseSession);
        clock = 61_000;
        expect(store.complete('state-1', { result: {} })).toBe(false);
        expect(store.get('state-1')).toBeUndefined();
    });

    it('reports remaining TTL in seconds', () => {
        let clock = 0;
        const store = makeStore(60_000, () => clock);
        store.create(baseSession);
        clock = 45_000;
        expect(store.ttlSeconds('state-1')).toBe(15);
    });
});
