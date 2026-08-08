// js/auth.js?v=5 — thin adapter over the single session store in state.js?v=5
import { state, setSession, loadSession, logout as stateLogout } from './state.js?v=5';

export const Auth = {
    setSession(token, user) {
        setSession(token, user);
    },

    getToken() {
        if (!state.token) loadSession();
        return state.token;
    },

    getCurrentUser() {
        if (!state.user) loadSession();
        return state.user;
    },

    isLoggedIn() {
        return !!this.getToken() && !!this.getCurrentUser();
    },

    hasRole(role) {
        const user = this.getCurrentUser();
        return !!user && user.role === role;
    },

    logout() {
        stateLogout();
    },
};
