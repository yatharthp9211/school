// js/app.js — bootstrap, routes (lazy views), global action dispatcher, drawer
import { router } from './router.js?v=18';
import { loadSession, loadTheme, toggleTheme, logout as stateLogout } from './state.js?v=18';
import { Auth } from './auth.js?v=18';
import { api } from './api.js?v=18';
import { showToast, showPrivacyPolicy } from './components.js?v=18';

// ---------------------------------------------------------------------------
// Routes — views are lazy-loaded via dynamic import (code-split per route)
// The loader is a function returning a Promise<view object {render, init?}>.
// ---------------------------------------------------------------------------
// ?v=N busts the browser's module cache so view updates always take effect.
// Bump the suffix whenever view files change.
const V = 20;

router.addRoute('/', () => import(`../views/landing.js?v=${V}`).then((m) => m.LandingView));
router.addRoute('/login/student', () => import(`../views/login.js?v=${V}`).then((m) => m.LoginView('student')));
router.addRoute('/login/teacher', () => import(`../views/login.js?v=${V}`).then((m) => m.LoginView('teacher')));
router.addRoute('/login/admin', () => import(`../views/login.js?v=${V}`).then((m) => m.LoginView('admin')));
router.addRoute('/register/student', () => import(`../views/register.js?v=${V}`).then((m) => m.RegisterView('student')));
router.addRoute('/register/teacher', () => import(`../views/register.js?v=${V}`).then((m) => m.RegisterView('teacher')));

router.addRoute('/student', () => import(`../views/student_dashboard.js?v=${V}`).then((m) => m.StudentDashboardView), { requiresAuth: true, role: 'student' });
router.addRoute('/complaint', () => import(`../views/complaint_form.js?v=${V}`).then((m) => m.ComplaintFormView), { requiresAuth: true, role: 'student' });
router.addRoute('/teacher', () => import(`../views/teacher_dashboard.js?v=${V}`).then((m) => m.TeacherDashboardView), { requiresAuth: true, role: 'teacher' });
router.addRoute('/admin', () => import(`../views/admin_dashboard.js?v=${V}`).then((m) => m.AdminDashboardView), { requiresAuth: true, role: 'admin' });
router.addRoute('/admin/complaints', () => import(`../views/admin_complaints.js?v=${V}`).then((m) => m.AdminComplaintsView), { requiresAuth: true, role: 'admin' });
router.addRoute('/admin/audit', () => import(`../views/admin_audit.js?v=${V}`).then((m) => m.AdminAuditView), { requiresAuth: true, role: 'admin' });
router.addRoute('/complaints', () => import(`../views/complaints_list.js?v=${V}`).then((m) => m.ComplaintsListView), { requiresAuth: true });
router.addRoute('/leaderboard', () => import(`../views/leaderboard.js?v=${V}`).then((m) => m.LeaderboardView), { requiresAuth: true });
router.addRoute('/ratings', () => import(`../views/ratings.js?v=${V}`).then((m) => m.RatingsView), { requiresAuth: true, role: 'student' });
router.addRoute('/profile', () => import(`../views/profile.js?v=${V}`).then((m) => m.ProfileView), { requiresAuth: true });
router.addRoute('/developer/login', () => import(`../views/developer_login.js?v=${V}`).then((m) => m.DeveloperLoginView));
router.addRoute('/developer', () => import(`../views/developer_dashboard.js?v=${V}`).then((m) => m.DeveloperDashboardView), { requiresAuth: true, role: 'developer' });

// ---------------------------------------------------------------------------
// Drawer (mobile nav)
// ---------------------------------------------------------------------------
function openDrawer() {
    document.querySelector('.drawer')?.classList.add('open');
    document.querySelector('.drawer')?.setAttribute('aria-hidden', 'false');
    document.querySelector('.drawer-backdrop')?.classList.add('open');
    document.querySelector('[data-action="open-drawer"]')?.setAttribute('aria-expanded', 'true');
}
function closeDrawer() {
    document.querySelector('.drawer')?.classList.remove('open');
    document.querySelector('.drawer')?.setAttribute('aria-hidden', 'true');
    document.querySelector('.drawer-backdrop')?.classList.remove('open');
    document.querySelector('[data-action="open-drawer"]')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
});

// Tapping a drawer link navigates AND closes the drawer (a hashchange to the
// same path wouldn't re-render, leaving the drawer open).
document.addEventListener('click', (e) => {
    if (e.target.closest('.drawer-link')) closeDrawer();
});

function syncThemeIcons() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('[data-theme-icon]').forEach((el) => {
        el.textContent = dark ? 'light_mode' : 'dark_mode';
    });
    document.querySelectorAll('[data-action="theme-toggle"]').forEach((btn) => {
        btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    });
}

// ---------------------------------------------------------------------------
// Global action dispatcher (no inline onclick, no window globals)
// ---------------------------------------------------------------------------
document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;
    const btn = el;

    switch (action) {
        case 'theme-toggle':
            toggleTheme();
            syncThemeIcons();
            break;

        case 'open-drawer':
            e.preventDefault();
            openDrawer();
            break;

        case 'close-drawer':
            e.preventDefault();
            closeDrawer();
            break;

        case 'privacy-policy':
            e.preventDefault();
            showPrivacyPolicy();
            break;

        case 'logout':
            closeDrawer();
            Auth.logout();
            showToast('Signed out.');
            router.navigate('/');
            break;

        case 'vote': {
            btn.disabled = true;
            try {
                await api.voteComplaint(el.dataset.id, el.dataset.type);
                showToast('Vote recorded.');
                await router.refresh();
            } catch (err) {
                showToast(err.message || 'Could not vote.', 'error');
                btn.disabled = false;
            }
            break;
        }

        case 'verify':
        case 'reject':
            btn.disabled = true;
            try {
                const apiAction = action === 'verify' ? 'approve' : 'reject';
                const res = await api.verifyComplaint(el.dataset.id, apiAction);
                showToast(res.message || (action === 'verify' ? 'Complaint published.' : 'Complaint rejected.'));
                await router.refresh();
            } catch (err) {
                showToast(err.message || 'Could not update.', 'error');
                btn.disabled = false;
            }
            break;

        case 'resolve':
            btn.disabled = true;
            try {
                await api.markSolved(el.dataset.id);
                showToast('Complaint marked as resolved.');
                await router.refresh();
            } catch (err) {
                showToast(err.message || 'Could not resolve.', 'error');
                btn.disabled = false;
            }
            break;

        case 'archive':
            btn.disabled = true;
            try {
                await api.archiveComplaint(el.dataset.id);
                showToast('Complaint archived.');
                await router.refresh();
            } catch (err) {
                showToast(err.message || 'Could not archive.', 'error');
                btn.disabled = false;
            }
            break;

        case 'moderate': {
            btn.disabled = true;
            const decision = el.dataset.decision;
            try {
                const res = await api.moderate(el.dataset.id, decision);
                showToast(res.message || 'Complaint moderated.');
                await router.refresh();
            } catch (err) {
                showToast(err.message || 'Could not moderate.', 'error');
                btn.disabled = false;
            }
            break;
        }

        case 'export-csv': {
            const encoded = el.dataset.csv;
            if (!encoded) return;
            const csv = decodeURIComponent(encoded);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'democrate-report.csv';
            a.click();
            URL.revokeObjectURL(url);
            showToast('Report downloaded.');
            break;
        }

        case 'load-more': {
            const container = document.getElementById(el.dataset.target);
            const hidden = container ? Array.from(container.querySelectorAll('[data-hidden-row]')) : [];
            hidden.slice(0, 10).forEach((row) => row.removeAttribute('data-hidden-row'));
            if (hidden.length <= 10) btn.remove();
            break;
        }

        default:
            break;
    }
});

// ---------------------------------------------------------------------------
// Web Push setup — enhancement only; all failures are silent
// ---------------------------------------------------------------------------
function urlBase64ToUint8Array(base64) {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

function arrayBufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = '';
    bytes.forEach((b) => (str += String.fromCharCode(b)));
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function setupPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.register('/sw.js');

    // Only subscribe when signed in and the user consents to notifications.
    if (!Auth.isLoggedIn() || Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted' || !Auth.isLoggedIn()) return;
    }

    // Guard against https-only PushManager (localhost is treated as secure).
    if (!window.isSecureContext) return;

    const { public_key } = await api.getVapidKey();
    const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
    });
    await api.subscribePush(
        sub.endpoint,
        arrayBufferToBase64Url(sub.getKey('p256dh')),
        arrayBufferToBase64Url(sub.getKey('auth')),
    );
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadSession();
    setupPush().catch(() => {}); // notifications are optional, never block startup
    router.init('app');
});
