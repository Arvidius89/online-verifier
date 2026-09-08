import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

import {
    DEFAULT_DOCTYPE,
    SUPPORTED_DOCTYPES,
} from './doctype-config.js';

// 12-factor: all environment-dependent values come from process.env.
// dotenv is loaded only when a .env file exists, so the same code runs
// unchanged in Azure where App Settings inject real environment variables.
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
const envPath = path.resolve(process.cwd(), envFile);
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
}

class ConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigError';
    }
}

/**
 * Load and validate configuration. Fails fast with a descriptive error when
 * required values are missing or malformed — no silent defaults for URLs,
 * client IDs, or trust material (PROJECT_PLAN.md §3.1).
 */
export function loadConfig(env = process.env) {
    // Re-read from the passed-in env so tests can inject values.
    const get = (name) => env[name];

    const baseUrl = (() => {
        const value = get('BASE_URL');
        if (!value) {
            throw new ConfigError(
                'BASE_URL is required but not set. Copy .env.example to .env and configure it.',
            );
        }
        let url;
        try {
            url = new URL(value);
        } catch {
            throw new ConfigError(`BASE_URL must be a valid URL, got: "${value}"`);
        }
        if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
            throw new ConfigError(
                `BASE_URL must use HTTPS for non-local hosts (wallets require a reachable HTTPS response_uri), got: "${value}"`,
            );
        }
        return value.replace(/\/+$/, '');
    })();

    const responseUri = `${baseUrl}/response`;

    const mdlClaims = parseClaims(get('MDL_CLAIMS'), [
        'family_name',
        'given_name',
        'birth_date',
        'age_over_18',
        'portrait',
    ], 'MDL_CLAIMS');
    const claimsByDoctype = Object.fromEntries(
        Object.entries(SUPPORTED_DOCTYPES).map(([doctype, definition]) => [
            doctype,
            parseClaims(get(definition.claimsEnv), mdlClaims, definition.claimsEnv),
        ]),
    );

    return Object.freeze({
        port: (() => {
            const value = get('PORT');
            if (value === undefined || value === '') return 3000;
            const parsed = Number.parseInt(value, 10);
            if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
                throw new ConfigError(`PORT must be an integer 0-65535, got: "${value}"`);
            }
            return parsed;
        })(),
        baseUrl,
        clientId: `redirect_uri:${responseUri}`,
        sessionTtlMs: (() => {
            const value = get('SESSION_TTL_MS');
            if (value === undefined || value === '') return 300_000;
            const parsed = Number.parseInt(value, 10);
            if (!Number.isInteger(parsed) || parsed <= 0) {
                throw new ConfigError(`SESSION_TTL_MS must be a positive integer, got: "${value}"`);
            }
            return parsed;
        })(),
        mdlClaims,
        claimsByDoctype,
        defaultDoctype: DEFAULT_DOCTYPE,
        supportedDoctypes: Object.keys(SUPPORTED_DOCTYPES),
        trustedIssuersDir: get('TRUSTED_ISSUERS_DIR') || './trusted-issuers',
        responseUri,
    });
}

function parseClaims(value, fallback, envName) {
    const claims = value === undefined || value === ''
        ? fallback
        : value.split(',').map((claim) => claim.trim()).filter(Boolean);
    if (claims.length === 0) {
        throw new ConfigError(`${envName} must list at least one claim`);
    }
    return claims;
}

export { ConfigError };
