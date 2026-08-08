// js/router.js — hash router with lazy-loaded views, focus management, page transitions
import { setView } from './state.js';
import { Auth } from './auth.js';

function skeleton() {
    return `
        <div class="card card-padded animate-pulse" aria-busy="true">
            <div class="skeleton line w-40 mb-4"></div>
            <div class="skeleton line w-80 mb-3"></div>
            <div class="skeleton line w-60"></div>
        </div>
    `;
}

export const router = {
    routes: {},
    appContainer: null,

    init(containerId) {
        this.appContainer = document.getElementById(containerId);
        window.addEventListener('hashchange', () => this.handleRoute());
        if (!window.location.hash) {
            window.location.hash = '/';
        } else {
            this.handleRoute();
        }
    },

    addRoute(path, loader, options = {}) {
        this.routes[path] = { loader, options };
    },

    navigate(path) {
        if (window.location.hash.slice(1) !== path) window.location.hash = path;
        else this.handleRoute();
    },

    // Re-run the current view (after data-changing actions) without a skeleton flash.
    async refresh() {
        await this.handleRoute(true);
    },

    async handleRoute(skipSkeleton = false) {
        const path = window.location.hash.slice(1) || '/';
        setView(path);

        const config = this.routes[path];

        if (!config) {
            this.renderMessage('Page not found', 'The page you are looking for does not exist.', true);
            return;
        }

        const { loader, options } = config;

        if (options.requiresAuth && !Auth.isLoggedIn()) {
            this.navigate(options.loginPath || '/login/student');
            return;
        }

        if (options.role && !Auth.hasRole(options.role)) {
            this.renderMessage('Access denied', 'You do not have permission to view this page.', true);
            return;
        }

        if (!skipSkeleton) {
            this.appContainer.innerHTML = skeleton();
        }

        try {
            const view = await loader();
            const html = await view.render();
            this.appContainer.innerHTML = html;
            this.appContainer.classList.remove('page-enter');
            // Force reflow then animate.
            void this.appContainer.offsetWidth;
            this.appContainer.classList.add('page-enter');

            // Move focus to main content for keyboard / screen-reader users.
            const main = document.getElementById('app-main');
            if (main) {
                main.setAttribute('tabindex', '-1');
                main.focus({ preventScroll: true });
            }

            if (typeof view.init === 'function') view.init();
        } catch (e) {
            console.error('Route error:', e);
            this.renderMessage(
                'Something went wrong',
                (e && e.message) || 'The page could not be loaded. Please try again.',
                true
            );
        }
    },

    renderMessage(title, message, isError = false) {
        this.appContainer.innerHTML = `
            <div class="card card-padded text-center" style="margin-top: 8rem">
                <span class="material-symbols-outlined" style="font-size:3rem;opacity:.4">${isError ? 'error_outline' : 'info'}</span>
                <h1 class="display" style="margin:.5rem 0">${title}</h1>
                <p class="muted">${message}</p>
                ${isError ? '<a class="btn btn-primary" style="margin-top:1rem" href="#/">Go Home</a>' : ''}
            </div>
        `;
    },
};
