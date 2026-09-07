// Frontend flow: request an authorization request, render the QR, then poll
// until the wallet returns a verified result or an actionable failure.

const panels = {
    start: document.getElementById('panel-start'),
    qr: document.getElementById('panel-qr'),
    result: document.getElementById('panel-result'),
};

const statusLine = document.getElementById('status-line');
const qrImage = document.getElementById('qr-image');
const requestUri = document.getElementById('request-uri');
const openWalletButton = document.getElementById('btn-open-wallet');
const qrCountdown = document.getElementById('qr-countdown');
const resultHeading = document.getElementById('result-heading');
const resultBody = document.getElementById('result-body');
const ignoreDigestErrorsToggle = document.getElementById('toggle-ignore-digest-errors');

const POLL_INTERVAL_MS = 2000;
let pollTimer = null;
let countdownTimer = null;
let authorizationRequest = '';

function showPanel(name) {
    for (const [key, el] of Object.entries(panels)) {
        el.hidden = key !== name;
    }
}

function setStatus(message) {
    statusLine.textContent = message ?? '';
}

function stopPolling() {
    if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (countdownTimer !== null) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
}

async function pollStatus(state) {
    try {
        const res = await fetch(`/api/status/${encodeURIComponent(state)}`);
        if (res.status === 404) {
            stopPolling();
            qrCountdown.textContent = '';
            showResult(false, 'Session expired. Please start a new request.');
            return;
        }
        if (!res.ok) throw new Error(`server responded ${res.status}`);
        const data = await res.json();

        if (data.status === 'pending') {
            setStatus('Waiting for wallet…');
        } else if (data.status === 'done') {
            stopPolling();
            showResult(true, null, data); // rendered fully in Milestone 3
        } else if (data.status === 'failed') {
            stopPolling();
            showResult(false, data.error ?? 'Verification failed.', data);
        }
    } catch (err) {
        setStatus(`Status check failed: ${err.message}`);
    }
}

function startPolling(state, expiresInSeconds) {
    stopPolling();
    let remaining = expiresInSeconds;
    qrCountdown.textContent = `Request expires in ${remaining}s`;
    countdownTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
            clearInterval(countdownTimer);
            countdownTimer = null;
            qrCountdown.textContent = 'Request expired.';
            return;
        }
        qrCountdown.textContent = `Request expires in ${remaining}s`;
    }, 1000);
    pollTimer = setInterval(() => void pollStatus(state), POLL_INTERVAL_MS);
    void pollStatus(state);
}

function renderDigestLog(digestLog) {
    const details = document.createElement('details');
    details.className = 'digest-log';
    details.open = digestLog.some((entry) => !entry.match);
    const summary = document.createElement('summary');
    const mismatchCount = digestLog.filter((entry) => !entry.match).length;
    summary.textContent = mismatchCount > 0
        ? `Digest verification: ${mismatchCount} of ${digestLog.length} attribute(s) mismatched`
        : `Digest verification: all ${digestLog.length} attribute(s) matched`;
    details.append(summary);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Namespace</th><th>Attribute</th><th>Digest ID</th>'
        + '<th>Expected digest (MSO)</th><th>Computed digest</th><th>Match</th></tr>';
    const tbody = document.createElement('tbody');
    for (const entry of digestLog) {
        const row = document.createElement('tr');
        if (!entry.match) row.className = 'digest-mismatch';
        row.append(
            makeCell(entry.namespace),
            makeCell(entry.elementIdentifier),
            makeCell(String(entry.digestID)),
            makeCell(entry.expectedDigestHex, true),
            makeCell(entry.computedDigestHex, true),
            makeCell(entry.match ? '✓' : '✗'),
        );
        tbody.append(row);
    }
    table.append(thead, tbody);
    details.append(table);
    return details;
}

function makeCell(text, mono = false) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (mono) cell.className = 'digest-hex';
    return cell;
}

function showResult(ok, error, data) {
    showPanel('result');
    resultBody.replaceChildren();
    if (data?.digestMismatchIgnored) {
        const banner = document.createElement('p');
        banner.className = 'insecure-banner';
        banner.textContent = '⚠ Digest verification was bypassed — this result is NOT trustworthy.';
        resultBody.append(banner);
    }
    if (ok) {
        resultHeading.textContent = 'Credential verified';
        const claims = data.claims ?? {};
        if (data.portrait) {
            const portrait = document.createElement('img');
            portrait.className = 'portrait';
            portrait.alt = 'Credential portrait';
            portrait.src = `data:image/jpeg;base64,${data.portrait}`;
            resultBody.append(portrait);
        }

        const table = document.createElement('table');
        const tableBody = document.createElement('tbody');
        for (const [name, value] of Object.entries(claims)) {
            const row = document.createElement('tr');
            const claimName = document.createElement('th');
            claimName.scope = 'row';
            claimName.textContent = name.replaceAll('_', ' ');
            const claimValue = document.createElement('td');
            claimValue.textContent = typeof value === 'string' ? value : JSON.stringify(value);
            row.append(claimName, claimValue);
            tableBody.append(row);
        }
        table.append(tableBody);
        resultBody.append(table);

        const metadata = document.createElement('p');
        metadata.className = 'result-metadata';
        const issuer = data.issuer?.subject ?? data.issuer?.country ?? 'Unknown issuer';
        metadata.textContent = `${data.docType ?? 'Unknown document type'} · ${issuer}`;
        resultBody.append(metadata);
        if (data.digestLog?.length) {
            resultBody.append(renderDigestLog(data.digestLog));
        }
        setStatus('');
    } else {
        resultHeading.textContent = 'Verification failed';
        const message = document.createElement('p');
        message.textContent = error;
        resultBody.append(message);
        if (data?.unmatched?.length) {
            const unmatched = document.createElement('ul');
            unmatched.className = 'unmatched';
            for (const item of data.unmatched) {
                const entry = document.createElement('li');
                entry.textContent = typeof item === 'string' ? item : JSON.stringify(item);
                unmatched.append(entry);
            }
            resultBody.append(unmatched);
        }
        if (data?.digestLog?.length) {
            resultBody.append(renderDigestLog(data.digestLog));
        }
        setStatus('');
    }
}

async function requestPresentation() {
    setStatus('Creating authorization request…');
    try {
        const ignoreDigestErrors = ignoreDigestErrorsToggle?.checked === true;
        const url = `/api/request?ignoreDigestErrors=${ignoreDigestErrors}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`server responded ${res.status}`);
        const { state, qr, uri, expiresInSeconds } = await res.json();

        qrImage.src = qr;
        authorizationRequest = uri;
        requestUri.href = authorizationRequest;
        requestUri.textContent = authorizationRequest;
        showPanel('qr');
        setStatus('Waiting for wallet…');
        startPolling(state, expiresInSeconds);
    } catch (err) {
        setStatus(`Could not create request: ${err.message}`);
    }
}

openWalletButton.addEventListener('click', () => {
    if (authorizationRequest) {
        window.location.href = authorizationRequest;
    }
});

document.getElementById('btn-request').addEventListener('click', () => {
    void requestPresentation();
});

document.getElementById('btn-new-request').addEventListener('click', () => {
    showPanel('start');
    void requestPresentation();
});

showPanel('start');
