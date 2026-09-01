// views/register.js — public student registration + key-gated teacher registration.
// There is NO public administrator registration (admins are provisioned out-of-band).
import { api } from '../js/api.js?v=18';
import { router } from '../js/router.js?v=18';
import { showToast, ThemeToggle } from '../js/components.js?v=18';

const ALLOWED_SUBJECTS = [
    "English", "Hindi", "Mathematics", "EVS/Science", "Social Studies", 
    "Computer / AI / IT", "Sanskrit", "General Knowledge", "Art/Craft", 
    "Music", "Sports / Phy. Edu.", "Kaushal Bodh", "Physics", "Biology", 
    "Chemistry", "Painting", "History", "Polity", "Geography", "Accountancy", 
    "BST", "Economics"
];

const ALLOWED_CLASSES = [
    "nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"
];

const ALLOWED_SECTIONS = [
    "rose", "lily", "jasmin", "daisy", "A", "B", "C", "D", "E"
];

function strengthScore(pw) {
    let s = 0;
    if (!pw) return 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 10) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    return Math.max(1, s);
}
const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

export function RegisterView(role) {
    const isStudent = role === 'student';

    return {
        render: async () => {
            const body = isStudent ? studentForm() : teacherForm();
            return `
                <header class="navbar">
                    <div class="nav-inner">
                        <a class="nav-brand" href="#/">
                            <span class="material-symbols-outlined" style="color:var(--color-emerald)">person_add</span>
                            <span>Create a ${isStudent ? 'student' : 'teacher'} account</span>
                        </a>
                        <nav class="nav-links">${ThemeToggle()}<a href="#/login/${role}" class="nav-link">Sign in</a></nav>
                    </div>
                </header>
                <main id="app-main" class="flex justify-center" style="padding:3rem 0 3rem">
                    <div class="card card-padded animate-scale-in" style="width:100%;max-width:430px">
                        <a href="#/" class="small muted" style="display:inline-flex;align-items:center;gap:.3rem">
                            <span class="material-symbols-outlined" style="font-size:1rem">arrow_back</span>Back
                        </a>
                        <h1 class="display" style="font-size:1.6rem;margin-top:.8rem">${isStudent ? 'Student registration' : 'Teacher registration'}</h1>
                        <p class="small muted">${isStudent
                            ? 'A student ID keeps your reports anonymous to everyone else — only an administrator can ever trace them, in a moderation case.'
                            : 'Teacher accounts are controlled. You need a registration key issued by the school administration.'}</p>
                        ${body}
                    </div>
                </main>
            `;
        },

        init: () => {
            const form = document.getElementById('register-form');
            if (!form) return;

            const idInput = document.getElementById('regId');
            const idStatus = document.getElementById('regIdStatus');
            let idUnavailable = false;   // server confirmed this ID is taken
            let idCheckFailed = false;   // availability check could not run (offline/server error)

            let idTimer;
            idInput?.addEventListener('input', async () => {
                clearTimeout(idTimer);
                idTimer = setTimeout(async () => {
                    const v = idInput.value.trim();
                    if (v.length < 3) {
                        idStatus.textContent = '';
                        idUnavailable = false;
                        idCheckFailed = false;
                        return;
                    }
                    try {
                        const res = await api.checkId(v);
                        idUnavailable = !res.available;
                        idCheckFailed = false;
                        idStatus.textContent = res.available ? '✓ Available' : '✗ Already taken';
                        idStatus.style.color = res.available ? 'var(--color-emerald)' : 'var(--color-danger)';
                    } catch {
                        // Don't invent "unavailable" when the check itself failed —
                        // let the server validate on submit instead.
                        idCheckFailed = true;
                        idStatus.textContent = 'Could not verify availability — you can still submit.';
                        idStatus.style.color = '';
                    }
                }, 350);
            });

            const pw = document.getElementById('regPassword');
            const pwConfirm = document.getElementById('regPassword2');
            const meter = document.getElementById('strength');
            const strengthLabel = document.getElementById('strength-label');
            if (pw && meter) {
                pw.addEventListener('input', () => {
                    const s = strengthScore(pw.value);
                    meter.setAttribute('data-score', String(s));
                    strengthLabel.textContent = strengthLabels[s] || '';
                });
            }

            form.querySelectorAll('[data-reveal-password]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const input = document.getElementById(btn.dataset.for);
                    const isText = input.type === 'text';
                    input.type = isText ? 'password' : 'text';
                    btn.querySelector('.material-symbols-outlined').textContent = isText ? 'visibility' : 'visibility_off';
                });
            });

            const isClassTeacherCheckbox = document.getElementById('regIsClassTeacher');
            const classSectionFields = document.getElementById('classSectionFields');
            if (isClassTeacherCheckbox && classSectionFields) {
                isClassTeacherCheckbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        classSectionFields.style.display = 'block';
                        document.getElementById('regClass').required = true;
                        document.getElementById('regSection').required = true;
                    } else {
                        classSectionFields.style.display = 'none';
                        document.getElementById('regClass').required = false;
                        document.getElementById('regSection').required = false;
                    }
                });
            }

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const errEl = document.getElementById('form-error');
                errEl.textContent = '';

                const data = {};
                if (isStudent) {
                    data.id = idInput.value.trim();
                    data.name = document.getElementById('regName').value.trim();
                    data.password = pw.value;
                    data.class_name = document.getElementById('regClass').value;
                    data.section_name = document.getElementById('regSection').value;
                } else {
                    data.id = idInput.value.trim();
                    data.name = document.getElementById('regName').value.trim();
                    data.password = pw.value;
                    data.subject = document.getElementById('regSubject').value;
                    data.registration_key = document.getElementById('regKey').value.trim();
                    data.is_class_teacher = document.getElementById('regIsClassTeacher').checked;
                    if (data.is_class_teacher) {
                        data.class_name = document.getElementById('regClass').value;
                        data.section_name = document.getElementById('regSection').value;
                    } else {
                        data.class_name = "NA";
                        data.section_name = "NA";
                    }
                }

                if (data.id.length < 3) return (errEl.textContent = 'User ID must be at least 3 characters.');
                if (!/^[A-Za-z0-9_-]+$/.test(data.id)) return (errEl.textContent = 'User ID: letters, numbers, _ and - only.');
                if (data.name.length < 1) return (errEl.textContent = 'Please enter your name.');
                if (pw.value.length < 8 || !/[A-Za-z]/.test(pw.value) || !/\d/.test(pw.value)) {
                    return (errEl.textContent = 'Password: at least 8 characters, with a letter and a number.');
                }
                if (pw.value !== pwConfirm.value) return (errEl.textContent = 'Passwords do not match.');
                if (idUnavailable) {
                    return (errEl.textContent = 'That user ID is unavailable — pick a different one.');
                }

                const btn = document.getElementById('submit-btn');
                btn.disabled = true;
                btn.textContent = 'Creating account…';
                try {
                    const res = isStudent ? await api.register(data) : await api.registerTeacher(data);
                    showToast(`${res.name}, your account is ready — sign in.`);
                    router.navigate(`/login/${role}`);
                } catch (err) {
                    errEl.textContent = err.message || 'Registration failed.';
                    btn.disabled = false;
                    btn.textContent = 'Create account';
                }
            });
        },
    };
}

function passwordFields() {
    return `
        <div class="field">
            <label class="label" for="regPassword">Password <span class="req">*</span></label>
            <div style="position:relative">
                <input class="input" id="regPassword" name="password" type="password" autocomplete="new-password" required>
                <button type="button" class="icon-btn" data-reveal-password data-for="regPassword"
                        style="position:absolute;right:.35rem;top:50%;transform:translateY(-50%);border:none;background:none" aria-label="Show password">
                    <span class="material-symbols-outlined">visibility</span>
                </button>
            </div>
            <div class="strength-meter" id="strength" data-score="0" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
            <span class="strength-label" id="strength-label"></span>
            <span class="hint">Min 8 characters, must include a letter and a number.</span>
        </div>
        <div class="field">
            <label class="label" for="regPassword2">Confirm password <span class="req">*</span></label>
            <div style="position:relative">
                <input class="input" id="regPassword2" type="password" autocomplete="new-password" required>
                <button type="button" class="icon-btn" data-reveal-password data-for="regPassword2"
                        style="position:absolute;right:.35rem;top:50%;transform:translateY(-50%);border:none;background:none" aria-label="Show password">
                    <span class="material-symbols-outlined">visibility</span>
                </button>
            </div>
        </div>
    `;
}

function classSectionInputs() {
    return `
        <div class="grid grid-cols-2 gap-4">
            <div class="field">
                <label class="label" for="regClass">Class <span class="req">*</span></label>
                <select class="input" id="regClass" required>
                    <option value="" disabled selected>Select class</option>
                    ${ALLOWED_CLASSES.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
            </div>
            <div class="field">
                <label class="label" for="regSection">Section <span class="req">*</span></label>
                <select class="input" id="regSection" required>
                    <option value="" disabled selected>Select section</option>
                    ${ALLOWED_SECTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
            </div>
        </div>
    `;
}

function studentForm() {
    return `
        <form id="register-form" class="flex flex-col gap-4" style="margin-top:1.4rem" novalidate>
            <div class="field">
                <label class="label" for="regId">User ID <span class="req">*</span></label>
                <input class="input" id="regId" autocomplete="username" required>
                <span class="hint" id="regIdStatus"></span>
            </div>
            <div class="field">
                <label class="label" for="regName">Full name <span class="req">*</span></label>
                <input class="input" id="regName" autocomplete="name" required>
            </div>
            ${classSectionInputs()}
            ${passwordFields()}
            <span class="field-error-text" id="form-error" role="alert"></span>
            <button type="submit" class="btn btn-primary btn-lg btn-block" id="submit-btn">Create account</button>
            <p class="small muted" style="text-align:center">Already registered? <a href="#/login/student">Sign in</a></p>
            <p class="small muted" style="text-align:center; margin-top:.2rem"><a href="#" data-action="privacy-policy">Privacy Policy</a></p>
        </form>
    `;
}

function teacherForm() {
    return `
        <form id="register-form" class="flex flex-col gap-4" style="margin-top:1.4rem" novalidate>
            <div class="field">
                <label class="label" for="regId">Staff ID <span class="req">*</span></label>
                <input class="input" id="regId" autocomplete="username" required>
                <span class="hint" id="regIdStatus"></span>
            </div>
            <div class="field">
                <label class="label" for="regName">Full name <span class="req">*</span></label>
                <input class="input" id="regName" autocomplete="name" required>
            </div>
            <div class="field">
                <label class="label" for="regSubject">Subject <span class="req">*</span></label>
                <select class="input" id="regSubject" required>
                    <option value="" disabled selected>Select subject</option>
                    ${ALLOWED_SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
            </div>
            <div class="field" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                <input type="checkbox" id="regIsClassTeacher" style="width: 1.2rem; height: 1.2rem;">
                <label for="regIsClassTeacher" style="margin: 0; font-weight: 500; cursor: pointer;">I am a Class Teacher</label>
            </div>
            <div id="classSectionFields" style="display: none;">
                ${classSectionInputs()}
            </div>
            <div class="field">
                <label class="label" for="regKey">Registration key <span class="req">*</span></label>
                <input class="input" id="regKey" type="password" autocomplete="off" required>
                <span class="hint">Issued by the school administration.</span>
            </div>
            ${passwordFields()}
            <span class="field-error-text" id="form-error" role="alert"></span>
            <button type="submit" class="btn btn-primary btn-lg btn-block" id="submit-btn">Create teacher account</button>
            <p class="small muted" style="text-align:center">Already registered? <a href="#/login/teacher">Sign in</a></p>
            <p class="small muted" style="text-align:center; margin-top:.2rem"><a href="#" data-action="privacy-policy">Privacy Policy</a></p>
        </form>
    `;
}
