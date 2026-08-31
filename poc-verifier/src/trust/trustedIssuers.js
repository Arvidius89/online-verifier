import fs from 'node:fs';
import path from 'node:path';
import { X509Certificate } from 'node:crypto';

const CERTIFICATE_EXTENSIONS = new Set(['.der', '.pem']);

/**
 * Load issuer certificates from a directory as DER-encoded bytes.
 *
 * PEM certificates are parsed through X509Certificate so malformed trust
 * material prevents the verifier from starting with an incomplete trust set.
 */
export function loadTrustedIssuers(directory) {
    const directoryPath = path.resolve(directory);
    let entries;
    try {
        entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    } catch (error) {
        throw new Error(`Unable to read trusted issuers directory "${directoryPath}": ${error.message}`, {
            cause: error,
        });
    }

    const certificates = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            certificates.push(...loadTrustedIssuers(entryPath));
            continue;
        }
        if (!entry.isFile() || !CERTIFICATE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
            continue;
        }

        try {
            const source = fs.readFileSync(entryPath);
            if (path.extname(entry.name).toLowerCase() === '.pem') {
                certificates.push(new Uint8Array(new X509Certificate(source).raw));
            } else {
                certificates.push(new Uint8Array(source));
            }
        } catch (error) {
            throw new Error(`Unable to load trusted issuer certificate "${entryPath}": ${error.message}`, {
                cause: error,
            });
        }
    }

    return certificates;
}