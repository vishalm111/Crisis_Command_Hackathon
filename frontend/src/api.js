let rawBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8000';
if (rawBase.endsWith('/')) {
    rawBase = rawBase.slice(0, -1);
}
export const API_BASE = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;
export const VITE_API_URL = API_BASE;

export async function getState() {
    try {
        const response = await fetch(`${API_BASE}/state`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        throw new Error(e.message);
    }
}

export async function postJson(endpoint, payload) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    try {
        const response = await fetch(`${API_BASE}${cleanEndpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        throw new Error(e.message);
    }
}
