// js/auth.js — thin adapter over the single session store in state.js
import { state, setSession, loadSession, logout as stateLogout } from './state.js';

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
