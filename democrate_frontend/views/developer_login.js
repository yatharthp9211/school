// views/developer_login.js — developer authentication with file unlock

import { api } from '../js/api.js?v=18';
import { Auth } from '../js/auth.js?v=18';
import { router } from '../js/router.js?v=18';
import { showToast, ThemeToggle, Loading } from '../js/components.js?v=18';



export const DeveloperLoginView = {
        render: async () => {

            if (Auth.isLoggedIn() && Auth.getCurrentUser()?.role === 'developer') {

                setTimeout(() => router.navigate('/developer'), 0);

                return Loading('Redirecting…');

            }



            return `

                ${Navbar()}

                <main id="app-main" class="flex justify-center" style="padding:4rem 0 3rem">

                    <div class="card card-padded animate-scale-in" style="width:100%;max-width:420px">

                        <a href="#/" class="small muted" style="display:inline-flex;align-items:center;gap:.3rem">

                            <span class="material-symbols-outlined" style="font-size:1rem">arrow_back</span>Back

                        </a>

                        <div class="flex flex-col items-center" style="margin-top:.8rem">

                            <span class="avatar lg" style="background:var(--color-gold)">

                                <span class="material-symbols-outlined" style="color:#fff">terminal</span>

                            </span>

                            <h1 class="display" style="font-size:1.6rem;margin-top:.8rem">Developer Access</h1>

                            <p class="small muted">Step 1: Enter credentials</p>

                        </div>



                        <form id="login-form" class="flex flex-col gap-4" style="margin-top:1.6rem" novalidate>

                            <div class="field">

                                <label class="label" for="username">Developer ID</label>

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

                            <button type="submit" class="btn btn-primary btn-lg btn-block" id="submit-btn">Continue</button>

                        </form>



                        <div id="unlock-section" style="display:none;margin-top:1.6rem">

                            <div class="flex flex-col items-center">

                                <span class="avatar lg" style="background:var(--color-emerald)">

                                    <span class="material-symbols-outlined" style="color:#fff">upload_file</span>

                                </span>

                                <h2 class="display" style="font-size:1.3rem;margin-top:.8rem">Step 2: Upload Unlock File</h2>

                                <p class="small muted">Upload the designated unlock file to complete authentication.</p>

                            </div>

                            <div class="field" style="margin-top:1rem">

                                <label class="label" for="unlock-file">Unlock File</label>

                                <input class="input" type="file" id="unlock-file" name="unlock-file" accept="*/*" required>

                                <span class="field-error-text" id="file-error" role="alert"></span>

                            </div>

                            <button class="btn btn-ink btn-lg btn-block" id="unlock-btn" style="margin-top:1rem">Unlock &amp; Enter</button>

                        </div>

                    </div>

                </main>

            `;

        },



        init: () => {

            const form = document.getElementById('login-form');

            if (!form) return;



            let tempToken = null;



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

                    errEl.textContent = 'Enter your developer ID and password.';

                    return;

                }



                btn.disabled = true;

                btn.textContent = 'Verifying…';

                try {

                    const res = await api.developerLogin(username, password);

                    tempToken = res.temp_token;

                    // Store temp token for step 2

                    sessionStorage.setItem('dev_temp_token', tempToken);

                    document.getElementById('login-form').style.display = 'none';

                    document.getElementById('unlock-section').style.display = 'block';

                    showToast('Password verified. Upload unlock file.');

                } catch (err) {

                    errEl.textContent = err.message || 'Authentication failed.';

                    btn.disabled = false;

                    btn.textContent = 'Continue';

                }

            });



            // Step 2: unlock file

            const unlockBtn = document.getElementById('unlock-btn');

            if (unlockBtn) {

                unlockBtn.addEventListener('click', async () => {

                    const fileInput = document.getElementById('unlock-file');

                    const fileError = document.getElementById('file-error');

                    fileError.textContent = '';



                    if (!fileInput.files || fileInput.files.length === 0) {

                        fileError.textContent = 'Please select the unlock file.';

                        return;

                    }



                    unlockBtn.disabled = true;

                    unlockBtn.textContent = 'Unlocking…';

                    let originalToken = Auth.getToken();
                    try {

                        // Retrieve temp token and complete unlock

                        const tempToken = sessionStorage.getItem('dev_temp_token');

                        if (!tempToken) {

                            throw new Error('Session expired. Please start over.');

                        }

                        // Set temp token for the unlock API call

                        Auth.setToken(tempToken); // temporarily set temp token

                            const res = await api.developerUnlock(fileInput.files[0]);

                            Auth.setSession(res.access_token, res.user);

                            sessionStorage.removeItem('dev_temp_token');

                            showToast(`Welcome, ${res.user.name}.`);

                            router.navigate('/developer');

                        } catch (err) {

                            if (originalToken) Auth.setToken(originalToken);
                            else Auth.logout();

                            fileError.textContent = err.message || 'Unlock failed.';

                            unlockBtn.disabled = false;

                            unlockBtn.textContent = 'Unlock & Enter';

                        }

                });

            }

        },

    };



function Navbar() {

    return `

        <header class="navbar">

            <div class="nav-inner">

                <a class="nav-brand" href="#/">

                    <span class="material-symbols-outlined" style="color:var(--color-gold)">terminal</span>

                    <span>Democrate · Developer</span>

                </a>

                <nav class="nav-links">${ThemeToggle()}<a href="#/" class="nav-link">Home</a></nav>

            </div>

        </header>

    `;

}

