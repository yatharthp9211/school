// views/profile.js?v=5 — account overview (own data only, via /auth/me).
import { api } from '../js/api.js?v=5';
import { Auth } from '../js/auth.js?v=5';
import { Navbar, Avatar } from '../js/components.js?v=5';

function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ROLE_LABELS = { student: 'Student', teacher: 'Teacher', admin: 'Administrator' };

export const ProfileView = {
    render: async () => {
        const user = Auth.getCurrentUser();
        if (!user) {
            return '<main id="app-main"><div class="empty" style="margin-top:8rem">Unauthorized.</div></main>';
        }

        const me = await api.me().catch(() => null);
        const info = me || user;

        // Teachers store subject/classes/photo as JSON in details; students store plain text.
        let detailRows = [];
        let photo = null;
        if (info.role === 'teacher' && info.details) {
            try {
                const parsed = JSON.parse(info.details);
                if (parsed && typeof parsed === 'object') {
                    detailRows = [
                        ['Subject', parsed.subject || '—'],
                        ['Classes', parsed.classes || '—'],
                    ];
                    photo = parsed.photo || null;
                }
            } catch (e) {
                detailRows = [['Subject', info.details]];
            }
        } else if (info.details) {
            detailRows = [['Class & section', info.details]];
        }

        const statusBadges = [];
        if (info.is_banned) statusBadges.push('<span class="badge badge-harassment">Banned from submitting</span>');
        if (info.is_active === false) statusBadges.push('<span class="pill pill-archived">Account disabled</span>');

        return `
            ${Navbar(user)}
            <main id="app-main" style="padding:2rem 0 3rem;max-width:640px">
                <header class="animate-fade-in">
                    <span class="eyebrow">Account</span>
                    <h1 class="display" style="font-size:1.9rem;margin-top:.2rem">Your profile</h1>
                    <p class="muted small">This is only visible to you. Identity stays anonymous to students and teachers.</p>
                </header>

                <div class="card card-padded flex items-center gap-4" style="margin-top:1.4rem">
                    ${Avatar(info.name, { photo, sizeClass: 'lg' })}
                    <div style="min-width:0">
                        <h2 class="display" style="font-size:1.35rem">${esc(info.name)}</h2>
                        <p class="small muted">${esc(info.id)} · ${ROLE_LABELS[info.role] || info.role}</p>
                    </div>
                    <div style="margin-left:auto" class="flex flex-wrap gap-2 justify-end">
                        ${statusBadges.join('') || `<span class="badge"><span class="material-symbols-outlined" style="font-size:.95rem">verified</span>Active account</span>`}
                    </div>
                </div>

                <div class="card card-padded" style="margin-top:1rem">
                    <h3 class="display" style="font-size:1.05rem;margin-bottom:.8rem">Account details</h3>
                    <div class="flex flex-col gap-3">
                        ${detailRows.map(([k, v]) => `
                            <div class="flex justify-between items-center gap-4" style="border-bottom:1px solid var(--color-hairline);padding-bottom:.5rem">
                                <span class="small muted">${k}</span>
                                <span style="font-weight:600;text-align:right">${esc(v)}</span>
                            </div>`).join('')}
                        <div class="flex justify-between items-center gap-4" style="border-bottom:1px solid var(--color-hairline);padding-bottom:.5rem">
                            <span class="small muted">False report record</span>
                            <span style="font-weight:600">${info.false_count || 0} (of 5 before review)</span>
                        </div>
                        <div class="flex justify-between items-center gap-4">
                            <span class="small muted">Member role</span>
                            <span style="font-weight:600">${ROLE_LABELS[info.role] || info.role}</span>
                        </div>
                    </div>
                </div>

                <div class="card card-padded" style="margin-top:1rem;border-style:dashed">
                    <p class="small muted" style="display:flex;gap:.4rem;align-items:flex-start">
                        <span class="material-symbols-outlined" style="font-size:1.1rem">lock</span>
                        Anonymity is per-complaint: each report gets a fresh random ID, so your reports cannot be linked together — except by an administrator resolving a moderation case.
                    </p>
                </div>

                <div class="flex gap-3" style="margin-top:1.2rem">
                    <button class="btn btn-ghost" data-action="logout">Sign out</button>
                </div>
            </main>
        `;
    },
};
