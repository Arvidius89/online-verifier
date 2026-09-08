import { buildHaipQuery, validateHaipQuery } from '@openeudi/openid4vp';

import { getDoctypeConfig } from '../doctype-config.js';

export const MDL_DOCTYPE = 'org.iso.18013.5.1.mDL';
export const MDL_NAMESPACE = 'org.iso.18013.5.1';
export const MDL_CREDENTIAL_ID = 'mdl';

export function buildDocumentQuery(doctype, claims) {
    const definition = getDoctypeConfig(doctype);
    if (!definition) {
        throw new TypeError(`unsupported doctype: ${doctype}`);
    }
    if (!Array.isArray(claims) || claims.length === 0) {
        throw new TypeError('claims must be a non-empty array of claim names');
    }

    const query = buildHaipQuery({
        credentialId: definition.credentialId,
        format: 'mso_mdoc',
        doctypeValue: definition.id,
        claims,
    });
    validateHaipQuery(query);
    return query;
}

/**
 * Build the HAIP-compliant DCQL query for the selected mDOC doctype.
 * `validateHaipQuery` re-checks the result so a malformed query fails fast at
 * request time, not in the wallet.
 *
 * @param {string[]} claims bare mDL claim names (config.mdlClaims)
 * @returns {import('@openeudi/dcql').DcqlQuery}
 */
export function buildMdlQuery(claims) {
    return buildDocumentQuery(MDL_DOCTYPE, claims);
}
