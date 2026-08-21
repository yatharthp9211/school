// views/complaint_form.js
import { CONFIG } from '../js/config.js?v=17';
import { api } from '../js/api.js?v=17';
import { Auth } from '../js/auth.js?v=17';
import { Navbar, showToast, esc, Unauthorized } from '../js/components.js?v=17';

const DRAFT_KEY = 'democrate_complaint_draft';
const MIN_LEN = 20;
const MAX_LEN = 5000;

export const ComplaintFormView = {
    render: async () => {
        const user = Auth.getCurrentUser();
        if (!user || user.role !== 'student') {
            return Unauthorized();
        }

        let teachers = [];
        try { teachers = await api.getLeaderboard(); } catch (e) { /* offline */ }

        const draft = loadDraft();
        const options = (sel) => `<option value="">${sel ? 'Select…' : '— Not specified —'}</option>`
            + teachers.map((t) => `<option value="${esc(t.id)}">${esc(t.name)} · ${esc(t.subject)}</option>`).join('');

        const categoryOptions = CONFIG.categories.map((c) => `<option value="${c}">${c}</option>`).join('');

        return `
            ${Navbar(user)}
            <main id="app-main" style="padding:2rem 0 3rem;max-width:680px">
                <a href="#/student" class="small muted" style="display:inline-flex;align-items:center;gap:.3rem">
                    <span class="material-symbols-outlined" style="font-size:1rem">arrow_back</span>Back to dashboard
                </a>

                <div class="card card-padded animate-scale-in" style="margin-top:1rem">
                    <span class="eyebrow">Submit a report</span>
                    <h1 class="display" style="font-size:1.7rem;margin:.4rem 0 .3rem">File a complaint</h1>
                    <p class="small muted">
                        Your identity is never attached to this report. Choose a category, and the review
                        begins with the verifier teacher you select — who can never be the teacher you are reporting.
                    </p>

                    <form id="complaintForm" class="flex flex-col gap-4" style="margin-top:1.4rem" novalidate>
                        <div class="field">
                            <label class="label" for="category">Category <span class="req">*</span></label>
                            <select class="select" id="category" required>
                                ${categoryOptions}
                            </select>
                        </div>

                        <div class="field">
                            <label class="label" for="targetTeacher">Teacher this is about <span class="hint">(optional)</span></label>
                            <select class="select" id="targetTeacher">${options(false)}</select>
                            <span class="hint">The person you are reporting — never the verifier.</span>
                        </div>

                        <div class="field">
                            <label class="label" for="verifierTeacher">Verifier teacher <span class="req">*</span></label>
                            <select class="select" id="verifierTeacher">${options(true)}</select>
                            <span class="hint" id="verifier-hint">Assign a trusted teacher to verify this report.</span>
                        </div>

                        <div class="field">
                            <label class="label" for="complaintText">Detailed report <span class="req">*</span></label>
                            <textarea class="textarea" id="complaintText" rows="7" maxlength="${MAX_LEN}"
                                      placeholder="Describe what happened, when, and any impact…">${esc(draft.text)}</textarea>
                            <div class="char-counter" id="charCounter">${draft.text.length}/${MAX_LEN}</div>
                            <span class="field-error-text" id="text-error" role="alert"></span>
                        </div>

                        <label class="toggle" for="isPrivate">
                            <input type="checkbox" id="isPrivate" ${draft.private ? 'checked' : ''}>
                            <span class="toggle-track" aria-hidden="true"></span>
                            <span>
                                <strong>Send directly to administration</strong>
                                <span class="hint" style="display:block">Skips teacher review. Only administrators can see it.</span>
                            </span>
                        </label>

                        <span class="field-error-text" id="form-error" role="alert"></span>
                        <div class="flex items-center gap-3">
                            <button type="submit" class="btn btn-primary btn-lg" id="submit-btn">Submit report</button>
                            <button type="button" class="btn btn-soft" id="clear-draft">Clear draft</button>
                        </div>
                    </form>
                </div>
            </main>
        `;
    },

    init: () => {
        const form = document.getElementById('complaintForm');
        if (!form) return;

        const text = document.getElementById('complaintText');
        const counter = document.getElementById('charCounter');
        const targetSel = document.getElementById('targetTeacher');
        const verifierSel = document.getElementById('verifierTeacher');
        const hint = document.getElementById('verifier-hint');
        const privateBox = document.getElementById('isPrivate');
        const verifierField = verifierSel.closest('.field');

        const saveDraftNow = () => {
            try {
                localStorage.setItem(DRAFT_KEY, JSON.stringify({ text: text.value, private: privateBox.checked }));
            } catch (e) { /* ignore */ }
        };
        const clearDraft = () => {
            try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
        };

        // Character counter
        text.addEventListener('input', () => {
            counter.textContent = `${text.value.length}/${MAX_LEN}`;
            counter.classList.toggle('over', text.value.length > MAX_LEN);
            if (text.value.trim().length < MIN_LEN) {
                document.getElementById('text-error').textContent = `Please write at least ${MIN_LEN} characters.`;
            } else {
                document.getElementById('text-error').textContent = '';
            }
            saveDraftNow();
        });

        // Conflict-of-interest guard
        function syncVerifierState() {
            if (privateBox.checked) {
                verifierField.style.opacity = '0.55';
                verifierSel.disabled = true;
                hint.textContent = 'Private reports go straight to administration — no verifier needed.';
            } else {
                verifierField.style.opacity = '1';
                verifierSel.disabled = false;
                hint.textContent = 'Assign a trusted teacher to verify this report.';
            }
            if (targetSel.value && verifierSel.value === targetSel.value) {
                hint.textContent = '⚠ The verifier cannot be the teacher you are reporting. Pick a different verifier.';
                hint.style.color = 'var(--color-danger)';
            } else {
                hint.style.color = '';
            }
        }
        targetSel.addEventListener('change', syncVerifierState);
        verifierSel.addEventListener('change', syncVerifierState);
        privateBox.addEventListener('change', () => { syncVerifierState(); saveDraftNow(); });

        document.getElementById('clear-draft').addEventListener('click', () => {
            clearDraft();
            text.value = '';
            privateBox.checked = false;
            counter.textContent = `0/${MAX_LEN}`;
            syncVerifierState();
            showToast('Draft cleared.');
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errEl = document.getElementById('form-error');
            errEl.textContent = '';

            const category = document.getElementById('category').value;
            const targetTeacher = targetSel.value || null;
            const verifierTeacher = privateBox.checked ? null : verifierSel.value || null;
            const textVal = text.value.trim();

            if (!category) return (errEl.textContent = 'Choose a category.');
            if (textVal.length < MIN_LEN) return (errEl.textContent = `Please write at least ${MIN_LEN} characters.`);
            if (!privateBox.checked && !verifierTeacher) return (errEl.textContent = 'Select a verifier teacher (or send directly to administration).');
            if (targetTeacher && verifierTeacher && targetTeacher === verifierTeacher) {
                return (errEl.textContent = 'The verifier cannot be the teacher you are reporting.');
            }

            const btn = document.getElementById('submit-btn');
            btn.disabled = true;
            btn.textContent = 'Submitting…';
            try {
                await api.submitComplaint({ text: textVal, category, target_teacher: targetTeacher, verifier_teacher: verifierTeacher, is_private: privateBox.checked });
                clearDraft();
                showToast(privateBox.checked ? 'Submitted to administration (private).' : 'Complaint submitted for verification.');
                window.location.hash = '/student';
            } catch (err) {
                errEl.textContent = err.message || 'Could not submit.';
                btn.disabled = false;
                btn.textContent = 'Submit report';
            }
        });

        syncVerifierState();
    },
};

function loadDraft() {
    try {
        const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        return d && typeof d.text === 'string' ? { text: d.text, private: !!d.private } : { text: '', private: false };
    } catch (e) {
        return { text: '', private: false };
    }
}
