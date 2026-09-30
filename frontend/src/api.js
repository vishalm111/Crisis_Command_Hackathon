const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export async function getState() {
    try {
        const response = await fetch(`${VITE_API_URL}/state`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        throw new Error(e.message);
    }
}

export async function postJson(endpoint, payload) {
    try {
        const response = await fetch(`${VITE_API_URL}${endpoint}`, {
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
