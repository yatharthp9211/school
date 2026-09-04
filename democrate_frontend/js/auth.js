// js/auth.js — thin adapter over the single session store in state.js
import { state, setSession, loadSession, logout as stateLogout } from './state.js?v=18';

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

    // A stored session is valid only with BOTH a token (dummy) and a user.
    // Expiry is now managed entirely by the backend via HttpOnly cookies.
    // If a request returns 401, the api layer will handle logout.
    isLoggedIn() {
        if (!this.getToken() || !this.getCurrentUser()) return false;
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
