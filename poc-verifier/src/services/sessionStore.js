/**
 * In-memory session store (VERIFIER_DESIGN.md §1.2).
 *
 * The openid4vp library is stateless — it never tracks `state` or `nonce`.
 * This store binds them per session and enforces:
 *  - TTL: sessions expire after `ttlMs` (default 5 min).
 *  - One-shot: once completed (`done`/`failed`) a session cannot be
 *    completed again — replay protection at the store level, in addition to
 *    the library's nonce binding in the mDOC session transcript.
 *
 * PoC scope: single-process in-memory Map. Redis is a documented upgrade
 * path behind this same interface.
 */
export class SessionStore {
    #sessions = new Map();
    #ttlMs;
    #sweeper;
    #now;

    /**
     * @param {object} opts
     * @param {number} opts.ttlMs session time-to-live in milliseconds
     * @param {() => number} [opts.now] clock override for tests
     * @param {boolean} [opts.sweep=true] start the periodic sweeper
     */
    constructor({ ttlMs, now = Date.now, sweep = true }) {
        if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
            throw new TypeError('ttlMs must be a positive integer');
        }
        this.#ttlMs = ttlMs;
        this.#now = now;
        if (sweep) {
            this.#sweeper = setInterval(() => this.#sweep(), 60_000);
            this.#sweeper.unref(); // never keep the process alive
        }
    }

    /**
     * Create a session. Overwrites nothing — `state` is a fresh UUID from the
     * library, so a collision would indicate a bug or an attack.
     * @returns the stored session
     */
    create({ state, nonce, clientId, responseUri, query, allowDigestMismatch = false }) {
        if (!state || !nonce || !query) {
            throw new TypeError('state, nonce and query are required');
        }
        if (this.#sessions.has(state)) {
            throw new Error(`session state collision: ${state}`);
        }
        const session = {
            state,
            nonce,
            clientId,
            responseUri,
            query,
            allowDigestMismatch,
            createdAt: this.#now(),
            expiresAt: this.#now() + this.#ttlMs,
            status: 'pending',
            result: undefined,
            error: undefined,
            unmatched: undefined,
        };
        this.#sessions.set(state, session);
        return session;
    }

    /**
     * Look up a session by state. Expired sessions are removed and reported
     * as `{ status: 'expired' }` markers rather than `undefined` so the
     * status route can distinguish "never existed" from "too late".
     */
    get(state) {
        const session = this.#sessions.get(state);
        if (!session) return undefined;
        if (this.#isExpired(session)) {
            session.status = 'expired';
            this.#sessions.delete(state);
            return session;
        }
        return session;
    }

    /**
     * Transition a pending session to its terminal state. Returns false when
     * the session is missing, expired, or already completed (one-shot
     * enforcement — replays are silently dropped by the caller).
     */
    complete(state, { result, error, unmatched, digestLog, digestMismatchIgnored }) {
        const session = this.#sessions.get(state);
        if (!session) return false;
        if (session.status !== 'pending') return false;
        if (this.#isExpired(session)) {
            session.status = 'expired';
            this.#sessions.delete(state);
            return false;
        }
        if (error !== undefined) {
            session.status = 'failed';
            session.error = error;
            session.unmatched = unmatched;
            session.digestLog = digestLog;
            session.digestMismatchIgnored = digestMismatchIgnored;
        } else {
            session.status = 'done';
            session.result = result;
        }
        return true;
    }

    /** Seconds until expiry (for the frontend countdown); 0 when expired. */
    ttlSeconds(state) {
        const session = this.#sessions.get(state);
        if (!session) return 0;
        return Math.max(0, Math.ceil((session.expiresAt - this.#now()) / 1000));
    }

    get size() {
        return this.#sessions.size;
    }

    #isExpired(session) {
        return this.#now() >= session.expiresAt;
    }

    #sweep() {
        for (const [state, session] of this.#sessions) {
            if (this.#isExpired(session)) {
                this.#sessions.delete(state);
            }
        }
    }

    stop() {
        if (this.#sweeper) clearInterval(this.#sweeper);
    }
}
