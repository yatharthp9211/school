// js/state.js — single source of truth for the frontend
// Session + theme live under ONE localStorage key each (no dual-key drift).

const SESSION_KEY = 'democrate_session';
const THEME_KEY = 'democrate_theme';

export const state = {
    user: null,          // { id, name, role }
    token: null,
    theme: 'light',
    complaints: [],      // current list shown by the active view
    leaderboard: null,   // cached leaderboard (refreshed on mount)
    currentView: null,
};

const listeners = [];
export function subscribe(listener) {
    listeners.push(listener);
    return () => {
        const i = listeners.indexOf(listener);
        if (i > -1) listeners.splice(i, 1);
    };
}
function notify() {
    listeners.forEach((fn) => {
        try { fn(state); } catch (e) { console.error(e); }
    });
}

// --- Session ---
export function setSession(token, user) {
    state.token = token;
    state.user = user;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user })); } catch (e) { /* private mode */ }
    notify();
}

export function loadSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
            const d = JSON.parse(raw);
            if (d && d.token && d.user) {
                state.token = d.token;
                state.user = d.user;
                return true;
            }
            // Partial/corrupt session (token but no user, or unreadable):
            // purge it so the app never treats the user as half-logged-in.
            if (d && d.token) {
                localStorage.removeItem(SESSION_KEY);
                state.token = null;
                state.user = null;
            }
        }
    } catch (e) { /* corrupted session — ignore */ }
    return false;
}

export function logout() {
    state.token = null;
    state.user = null;
    state.complaints = [];
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    notify();
}

// --- Data cache (short-lived; refreshed on mount) ---
export function setLeaderboard(leaderboard) {
    state.leaderboard = leaderboard;
    notify();
}

export function setView(viewName) {
    state.currentView = viewName;
}

// --- Theme ---
function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
    notify();
}

export function loadTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    const dark = saved === 'dark'
        || (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
    applyTheme(dark ? 'dark' : 'light');
}

export function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}
