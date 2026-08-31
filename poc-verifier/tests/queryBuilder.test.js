import { describe, it, expect } from 'vitest';

import {
    buildMdlQuery,
    MDL_DOCTYPE,
    MDL_NAMESPACE,
    MDL_CREDENTIAL_ID,
} from '../src/services/queryBuilder.js';

const CLAIMS = ['family_name', 'given_name', 'birth_date', 'age_over_18'];

describe('buildMdlQuery', () => {
    it('produces the HAIP mso_mdoc DCQL shape', () => {
        const query = buildMdlQuery(CLAIMS);

        expect(query.credentials).toHaveLength(1);
        const [credential] = query.credentials;
        expect(credential.id).toBe(MDL_CREDENTIAL_ID);
        expect(credential.format).toBe('mso_mdoc');
        expect(credential.meta).toEqual({ doctype_value: MDL_DOCTYPE });
    });

    it('namespaces every claim path to org.iso.18013.5.1', () => {
        const query = buildMdlQuery(CLAIMS);
        const paths = query.credentials[0].claims.map((c) => c.path);

        expect(paths).toEqual(CLAIMS.map((name) => [MDL_NAMESPACE, name]));
    });

    it('rejects an empty claim list (fail fast, HAIP NO_CLAIMS)', () => {
        expect(() => buildMdlQuery([])).toThrow();
    });

    it('rejects non-array input', () => {
        expect(() => buildMdlQuery('family_name')).toThrow(TypeError);
    });

    it('passes HAIP validation (no credential_sets / claim_sets)', () => {
        const query = buildMdlQuery(CLAIMS);
        expect(query.credential_sets).toBeUndefined();
        expect(query.credentials[0].claim_sets).toBeUndefined();
    });
});
