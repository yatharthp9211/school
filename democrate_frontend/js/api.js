// js/api.js — fetch wrapper + typed API methods
import { API } from './config.js?v=8';
import { Auth } from './auth.js';

async function fetchApi(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = Auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res;
    try {
        res = await fetch(url, { ...options, headers });
    } catch (e) {
        const err = new Error('Network error. Is the server running?');
        err.status = 0;
        throw err;
    }

    if (!res.ok) {
        let detail = `Server error (${res.status})`;
        try {
            const data = await res.json();
            if (data && data.detail) detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        } catch (e) { /* non-JSON error body */ }

        if (res.status === 401) Auth.logout();
        const err = new Error(detail);
        err.status = res.status;
        throw err;
    }

    if (res.status === 204) return null;
    return res.json();
}

function qs(params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== null && v !== '') sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const api = {
    // ---- Auth ----
    async login(username, password, role) {
        return fetchApi(API.LOGIN, { method: 'POST', body: JSON.stringify({ username, password, role }) });
    },
    async register(data) {
        return fetchApi(API.REGISTER, { method: 'POST', body: JSON.stringify(data) });
    },
    async registerTeacher(data) {
        return fetchApi(API.REGISTER_TEACHER, { method: 'POST', body: JSON.stringify(data) });
    },
    async checkId(userId) {
        // Backend route is POST /auth/check-id?user_id=… (GET returns 405).
        return fetchApi(`${API.CHECK_ID}?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
    },
    async me() {
        return fetchApi(API.ME);
    },

    // ---- Complaints ----
    async getComplaints(params) {
        return fetchApi(API.COMPLAINTS + qs(params));
    },
    async getMyComplaints() {
        return fetchApi(API.MY_COMPLAINTS);
    },
    async submitComplaint(data) {
        return fetchApi(API.COMPLAINTS, { method: 'POST', body: JSON.stringify(data) });
    },
    async verifyComplaint(id, action) {
        return fetchApi(`${API.VERIFY}/${id}`, { method: 'POST', body: JSON.stringify({ action }) });
    },
    async voteComplaint(id, type) {
        return fetchApi(`${API.COMPLAINTS}/${id}/vote`, { method: 'POST', body: JSON.stringify({ type }) });
    },

    // ---- Leaderboard & Ratings ----
    async getLeaderboard() {
        return fetchApi(API.LEADERBOARD);
    },
    async submitRating(teacherId, rating, tags) {
        return fetchApi(API.RATINGS, { method: 'POST', body: JSON.stringify({ teacher_id: teacherId, rating, tags }) });
    },

    // ---- Admin ----
    async adminGetComplaints(params) {
        return fetchApi(API.ADMIN_COMPLAINTS + qs(params));
    },
    async adminFlagged() {
        return fetchApi(API.ADMIN_FLAGGED);
    },
    async adminFalse() {
        return fetchApi(API.ADMIN_FALSE);
    },
    async moderate(id, action) {
        return fetchApi(`${API.ADMIN_MODERATE}/${id}`, { method: 'POST', body: JSON.stringify({ action }) });
    },
    async markSolved(id) {
        return fetchApi(`${API.ADMIN_RESOLVE}/${id}`, { method: 'PUT' });
    },
    async archiveComplaint(id) {
        return fetchApi(`${API.ADMIN_ARCHIVE}/${id}`, { method: 'PUT' });
    },
    async adminAudit(params) {
        return fetchApi(API.ADMIN_AUDIT + qs(params));
    },
    async setUserActive(id, active) {
        return fetchApi(`${API.ADMIN_USERS}/${id}/${active ? 'enable' : 'disable'}`, { method: 'PUT' });
    },
};
