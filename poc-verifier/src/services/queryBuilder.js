import { buildHaipQuery, validateHaipQuery } from '@openeudi/openid4vp';

export const MDL_DOCTYPE = 'org.iso.18013.5.1.mDL';
export const MDL_NAMESPACE = 'org.iso.18013.5.1';
export const MDL_CREDENTIAL_ID = 'mdl';

/**
 * Build the HAIP-compliant DCQL query for an mDL presentation
 * (VERIFIER_DESIGN.md §1.3).
 *
 * `buildHaipQuery` auto-namespaces the claim paths to `org.iso.18013.5.1`
 * for the mDL doctype via HAIP_DOCTYPE_NAMESPACES, so callers pass bare
 * claim names ('family_name', ...). `validateHaipQuery` then re-checks the
 * result so a malformed query fails fast at request time, not in the wallet.
 *
 * @param {string[]} claims bare mDL claim names (config.mdlClaims)
 * @returns {import('@openeudi/dcql').DcqlQuery}
 */
export function buildMdlQuery(claims) {
    if (!Array.isArray(claims) || claims.length === 0) {
        throw new TypeError('claims must be a non-empty array of claim names');
    }
    const query = buildHaipQuery({
        credentialId: MDL_CREDENTIAL_ID,
        format: 'mso_mdoc',
        doctypeValue: MDL_DOCTYPE,
        claims,
    });
    validateHaipQuery(query);
    return query;
}
