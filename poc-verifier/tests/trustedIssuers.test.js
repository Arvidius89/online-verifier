import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadTrustedIssuers } from '../src/trust/trustedIssuers.js';

const temporaryDirectories = [];

function makeTemporaryDirectory() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'poc-verifier-trusted-issuers-'));
    temporaryDirectories.push(directory);
    return directory;
}

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

describe('loadTrustedIssuers', () => {
    it('loads DER certificates from nested directories and ignores other files', () => {
        const directory = makeTemporaryDirectory();
        const nestedDirectory = path.join(directory, 'national');
        fs.mkdirSync(nestedDirectory);
        fs.writeFileSync(path.join(directory, 'issuer.der'), Buffer.from([1, 2, 3]));
        fs.writeFileSync(path.join(nestedDirectory, 'issuer.DER'), Buffer.from([4, 5]));
        fs.writeFileSync(path.join(directory, 'notes.txt'), 'not a certificate');

        expect(loadTrustedIssuers(directory)).toEqual([
            new Uint8Array([1, 2, 3]),
            new Uint8Array([4, 5]),
        ]);
    });

    it('returns an empty list when the directory contains no certificates', () => {
        expect(loadTrustedIssuers(makeTemporaryDirectory())).toEqual([]);
    });

    it('reports an unreadable directory', () => {
        expect(() => loadTrustedIssuers(path.join(os.tmpdir(), 'missing-trusted-issuers')))
            .toThrow(/Unable to read trusted issuers directory/);
    });

    it('rejects malformed PEM certificate data', () => {
        const directory = makeTemporaryDirectory();
        fs.writeFileSync(path.join(directory, 'issuer.pem'), 'not a certificate');

        expect(() => loadTrustedIssuers(directory))
            .toThrow(/Unable to load trusted issuer certificate/);
    });
});