// js/auth.js — thin adapter over the single session store in state.js
import { state, setSession, loadSession, logout as stateLogout } from './state.js';

// Decode the JWT payload (base64url) to read its exp without a library.
// Returns epoch-ms or null when the token isn't a parseable 3-part JWT.
function tokenExpiryMs(token) {
    try {
        const part = token.split('.')[1];
        if (!part) return null;
        const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(json);
        return payload && typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch (e) {
        return null;
    }
}

export const Auth = {
    setSession(token, user) {
        setSession(token, user);
    },

    // Temporarily override the in-memory token without persisting to
    // localStorage.  Used by the developer two-step unlock flow.
    setToken(token) {
        state.token = token;
    },

    getToken() {
        if (!state.token) loadSession();
        return state.token;
    },

    getCurrentUser() {
        if (!state.user) loadSession();
        return state.user;
    },

    // A stored session is valid only with BOTH a token and a user, and only if
    // the token hasn't expired. Expired sessions are purged here so the app
    // never strands someone on a protected page with dead credentials.
    isLoggedIn() {
        if (!this.getToken() || !this.getCurrentUser()) return false;
        const exp = tokenExpiryMs(state.token);
        if (exp !== null && exp <= Date.now()) {
            this.logout();
            return false;
        }
        return true;
    },

    hasRole(role) {
        const user = this.getCurrentUser();
        return !!user && user.role === role;
    },

    logout() {
        stateLogout();
    },
};
