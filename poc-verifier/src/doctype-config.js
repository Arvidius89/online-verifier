export const DEFAULT_DOCTYPE = 'org.iso.18013.5.1.mDL';

export const SUPPORTED_DOCTYPES = Object.freeze({
    [DEFAULT_DOCTYPE]: Object.freeze({
        id: DEFAULT_DOCTYPE,
        credentialId: 'mdl',
        namespace: 'org.iso.18013.5.1',
        label: 'mDL',
        claimsEnv: 'MDL_CLAIMS',
    }),
    'org.iso.23220.1.nl.kiwa.sampcert': Object.freeze({
        id: 'org.iso.23220.1.nl.kiwa.sampcert',
        credentialId: 'kiwa-sample-certificate',
        namespace: 'org.iso.23220.1.nl.kiwa.sampcert',
        label: 'Kiwa Sample Certificate',
        claimsEnv: 'KIWA_SAMPCERT_CLAIMS',
    }),
});

export function getDoctypeConfig(doctype = DEFAULT_DOCTYPE) {
    return SUPPORTED_DOCTYPES[doctype];
}

export function isSupportedDoctype(doctype) {
    return typeof doctype === 'string' && getDoctypeConfig(doctype) !== undefined;
}

export function supportedDoctypeValues() {
    return Object.keys(SUPPORTED_DOCTYPES);
}
