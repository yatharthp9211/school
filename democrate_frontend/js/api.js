// js/api.js — fetch wrapper + typed API methods

import { API } from './config.js?v=18';

import { Auth } from './auth.js?v=18';

import { router } from './router.js?v=18';



const DEFAULT_TIMEOUT = 15000; // ms — never let a hung request hang the UI forever



async function fetchApi(url, options = {}) {

    const headers = { ...options.headers };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {

        headers['Content-Type'] = 'application/json';

    }

    // Remove manual Authorization header and use credentials to send HttpOnly cookies
    options.credentials = 'include';



    // Abort the request if the server stops answering, so the UI gets an error

    // instead of a spinner that never resolves.

    const controller = new AbortController();

    const timer = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);



    let res;

    try {

        res = await fetch(url, { ...options, headers, signal: controller.signal });

    } catch (e) {

        // fetch() itself threw (DNS / connection refused / CORS / timeout) — no HTTP response.

        const err = new Error(e && e.name === 'AbortError'

            ? 'The server took too long to respond. Please try again.'

            : 'Network error. Check your connection and try again.');

        err.status = 0;

        err.cause = e; // keep the browser's real error for diagnosis

        throw err;

    } finally {

        clearTimeout(timer);

    }



    if (!res.ok) {

        let detail = `Server error (${res.status})`;

        try {

            const data = await res.json();

            if (data && data.detail) detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);

        } catch (e) { /* non-JSON error body */ }



        // A 401 only means "your session is gone" when we actually sent a token.

        // A 401 on login/register (no token) is simply bad credentials — do NOT

        // nuke the session or bounce the user for that.

        if (res.status === 401 && Auth.getToken() && Auth.getCurrentUser()) {

            const role = Auth.getCurrentUser().role || 'student';

            Auth.logout();

            // Navigate here so *every* 401-with-token path (route render, vote

            // click, form submit) lands on the right login page — not just the

            // ones a view's try/catch happens to rethrow.

            const loginPath = role === 'developer' ? '/developer/login' : `/login/${role}`;
            router.navigate(loginPath);

            const err = new Error('Your session has expired. Please sign in again.');

            err.status = 401;

            err.role = role;

            throw err;

        }

        const err = new Error(detail);

        err.status = res.status;

        throw err;

    }



    if (res.status === 204) return null;

    try {

        return await res.json();

    } catch (e) {

        // A 2xx that isn't JSON is still a contract violation — surface a

        // structured error instead of a raw SyntaxError.

        const err = new Error('The server returned an unexpected response.');

        err.status = res.status;

        err.cause = e;

        throw err;

    }

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

    // ---- Leaderboard & Ratings ----

    async getLeaderboard() {

        return fetchApi(API.LEADERBOARD);

    },
    
    // ---- Teacher Roster ----
    async getMyStudents() {
        return fetchApi(API.TEACHER_STUDENTS);
    },
    async removeStudent(studentId) {
        return fetchApi(`${API.TEACHER_REMOVE_STUDENT}/${encodeURIComponent(studentId)}`, { method: 'DELETE' });
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



    // ---- Profile ----

    async updateProfile(data) {

        return fetchApi(API.ME.replace('/me', '/profile'), { method: 'PUT', body: JSON.stringify(data) });

    },

    async getUserImage(userId) {

        return fetchApi(`${API.BASE}/auth/users/${encodeURIComponent(userId)}/image`);

    },



    // ---- Developer ----

    async developerLogin(username, password) {

        return fetchApi(API.DEVELOPER_LOGIN, { method: 'POST', body: JSON.stringify({ username, password, role: 'developer' }) });

    },

    async developerUnlock(file) {
        const formData = new FormData();
        formData.append("file", file);
        return fetchApi(API.DEVELOPER_UNLOCK, { 
            method: 'POST', 
            body: formData,
            headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
        });
    },

    async developerTables() {

        return fetchApi(API.DEVELOPER_TABLES);

    },

    async developerTableSchema(tableName) {

        return fetchApi(`${API.DEVELOPER_TABLE_SCHEMA}/${tableName}/schema`);

    },

    async developerQuery(sql) {

        return fetchApi(API.DEVELOPER_QUERY, { method: 'POST', body: JSON.stringify({ sql }) });

    },

    async developerExecute(sql) {

        return fetchApi(API.DEVELOPER_EXECUTE, { method: 'POST', body: JSON.stringify({ sql }) });

    },

    async developerAudit(params) {

        return fetchApi(API.DEVELOPER_AUDIT + qs(params));

    },

    async developerUsers(params) {

        return fetchApi(API.DEVELOPER_USERS + qs(params));

    },

    async developerStats() {

        return fetchApi(API.DEVELOPER_STATS);

    },

    async developerLogs(last = 200) {
        return fetchApi(`${API.DEVELOPER_LOGS}?last=${last}`);
    },

    async developerClearLogs() {
        return fetchApi(API.DEVELOPER_LOGS, { method: 'DELETE' });
    },



    // ---- Notifications ----

    async getVapidKey() {
        return fetchApi(API.NOTIFICATIONS_VAPID_KEY);
    },

    async subscribePush(endpoint, p256dh, auth) {
        return fetchApi(API.NOTIFICATIONS_SUBSCRIBE, { method: 'POST', body: JSON.stringify({ endpoint, p256dh, auth }) });
    },

};

