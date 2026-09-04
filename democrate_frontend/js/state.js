// js/state.js — single source of truth for the frontend
// Session + theme live under ONE localStorage key each (no dual-key drift).

const SESSION_KEY = 'democrate_session';
const THEME_KEY = 'democrate_theme';

export const state = {
    user: null,          // { id, name, role }
    token: null,
    theme: 'light',
    currentView: null,
};

// --- Session ---
export function setSession(token, user) {
    // We no longer store the real token; authentication is handled via HttpOnly cookies.
    // 'token' arg is ignored, we just store the user metadata.
    state.token = "cookie-auth"; // Dummy token to satisfy legacy checks
    state.user = user;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ user })); } catch (e) { /* private mode */ }

}

export function loadSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
            const d = JSON.parse(raw);
            if (d && d.user) {
                state.token = "cookie-auth"; // Dummy
                state.user = d.user;
                return true;
            }
        }
    } catch (e) { /* corrupted session — ignore */ }
    return false;
}

export function logout() {
    state.token = null;
    state.user = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }

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
