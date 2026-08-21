// views/login.js
import { api } from '../js/api.js?v=18';
import { Auth } from '../js/auth.js?v=18';
import { router } from '../js/router.js?v=18';
import { showToast, ThemeToggle, Loading } from '../js/components.js?v=18';

export function LoginView(role) {
    const meta = {
        student: { icon: 'school', title: 'Student', accent: 'var(--color-emerald)' },
        teacher: { icon: 'badge', title: 'Teacher', accent: 'var(--color-ink)' },
        admin: { icon: 'admin_panel_settings', title: 'Administrator', accent: 'var(--color-gold)' },
    }[role] || { icon: 'school', title: 'Student', accent: 'var(--color-emerald)' };

    const registerHref = role === 'student' ? '#/register/student' : (role === 'teacher' ? '#/register/teacher' : null);

    return {
        render: async () => {
            if (Auth.isLoggedIn()) {
                const user = Auth.getCurrentUser();
                setTimeout(() => router.navigate(`/${user.role}`), 0);
                return Loading('Redirecting…');
            }

            return `
                ${Navbar(role)}
                <main id="app-main" class="flex justify-center" style="padding:4rem 0 3rem">
                    <div class="card card-padded animate-scale-in" style="width:100%;max-width:400px">
                        <a href="#/" class="small muted" style="display:inline-flex;align-items:center;gap:.3rem">
                            <span class="material-symbols-outlined" style="font-size:1rem">arrow_back</span>Back
                        </a>
                        <div class="flex flex-col items-center" style="margin-top:.8rem">
                            <span class="avatar lg" style="background:${meta.accent}">
                                <span class="material-symbols-outlined" style="color:#fff">${meta.icon}</span>
                            </span>
                            <h1 class="display" style="font-size:1.6rem;margin-top:.8rem">${meta.title} sign in</h1>
                            <p class="small muted">Access your ${meta.title.toLowerCase()} dashboard</p>
                        </div>

                        <form id="login-form" class="flex flex-col gap-4" style="margin-top:1.6rem" novalidate>
                            <div class="field">
                                <label class="label" for="username">User ID</label>
                                <input class="input" id="username" name="username" autocomplete="username" required autofocus>
                                <span class="field-error-text" id="username-error" role="alert"></span>
                            </div>
                            <div class="field">
                                <label class="label" for="password">Password</label>
                                <div style="position:relative">
                                    <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
                                    <button type="button" class="icon-btn" data-reveal-password data-for="password"
                                            style="position:absolute;right:.35rem;top:50%;transform:translateY(-50%);border:none;background:none"
                                            aria-label="Show password">
                                        <span class="material-symbols-outlined">visibility</span>
                                    </button>
                                </div>
                                <span class="field-error-text" id="password-error" role="alert"></span>
                            </div>
                            <span class="field-error-text" id="form-error" role="alert"></span>
                            <button type="submit" class="btn btn-primary btn-lg btn-block" id="submit-btn">Sign in</button>
                            ${registerHref ? `<p class="small muted" style="text-align:center">New here? <a href="${registerHref}">Create an account</a></p>` : ''}
                        </form>
                    </div>
                </main>
            `;
        },

        init: () => {
            const form = document.getElementById('login-form');
            if (!form) return;

            form.querySelector('[data-reveal-password]')?.addEventListener('click', (e) => {
                const input = document.getElementById(e.currentTarget.dataset.for);
                const isText = input.type === 'text';
                input.type = isText ? 'password' : 'text';
                e.currentTarget.querySelector('.material-symbols-outlined').textContent = isText ? 'visibility' : 'visibility_off';
                e.currentTarget.setAttribute('aria-label', isText ? 'Show password' : 'Hide password');
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('submit-btn');
                const errEl = document.getElementById('form-error');
                errEl.textContent = '';

                const username = document.getElementById('username').value.trim();
                const password = document.getElementById('password').value;
                if (!username || !password) {
                    errEl.textContent = 'Enter your user ID and password.';
                    return;
                }

                btn.disabled = true;
                btn.textContent = 'Signing in…';
                try {
                    const res = await api.login(username, password, role);
                    Auth.setSession(res.access_token, res.user);
                    showToast(`Welcome back, ${res.user.name}.`);
                    router.navigate(`/${res.user.role}`);
                } catch (err) {
                    errEl.textContent = err.message || 'Sign in failed.';
                    btn.disabled = false;
                    btn.textContent = 'Sign in';
                }
            });
        },
    };
}

function Navbar(role) {
    const labels = { student: 'Students', teacher: 'Teachers', admin: 'Administrators' };
    return `
        <header class="navbar">
            <div class="nav-inner">
                <a class="nav-brand" href="#/">
                    <span class="material-symbols-outlined" style="color:var(--color-emerald)">shield_person</span>
                    <span>Democrate · ${labels[role] || ''}</span>
                </a>
                <nav class="nav-links">${ThemeToggle()}<a href="#/" class="nav-link">Home</a></nav>
            </div>
        </header>
    `;
}
