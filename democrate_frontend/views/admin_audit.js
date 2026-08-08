// views/admin_audit.js — the immutable accountability trail (admin only).
import { api } from '../js/api.js';
import { Auth } from '../js/auth.js';
import { Navbar, Empty } from '../js/components.js?v=9';

function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ACTION_LABELS = {
    login_success: 'Login', login_failure: 'Failed login', register_success: 'Registered',
    complaint_created: 'Complaint created', complaint_verified: 'Complaint verified', complaint_rejected: 'Complaint rejected',
    complaint_flagged: 'Complaint flagged', complaint_resolved: 'Complaint resolved', complaint_archived: 'Complaint archived',
    complaint_false: 'Marked false', vote_cast: 'Vote cast', rating_submitted: 'Rating submitted',
    account_disabled: 'Account disabled', account_enabled: 'Account enabled', user_banned: 'User banned',
};

export const AdminAuditView = {
    render: async () => {
        const user = Auth.getCurrentUser();
        if (!user || user.role !== 'admin') {
            return '<main id="app-main"><div class="empty" style="margin-top:8rem">Unauthorized.</div></main>';
        }

        const entries = await api.adminAudit({ limit: 100 });
        const rows = entries.length
            ? entries.map((e, i) => {
                const label = ACTION_LABELS[e.action] || e.action;
                const hidden = i >= 20 ? ' data-hidden-row' : '';
                return `
                    <tr${hidden}>
                        <td class="small muted nowrap" style="white-space:nowrap">${new Date(e.timestamp).toLocaleString()}</td>
                        <td>${esc(e.user_id || '—')}</td>
                        <td><span class="badge">${esc(label)}</span></td>
                        <td>${esc(e.target || '—')}</td>
                        <td class="small muted">${esc(e.details || '—')}</td>
                        <td class="small muted nowrap" style="white-space:nowrap">${esc(e.ip_address || '—')}</td>
                    </tr>
                `;
            }).join('')
            : '';

        return `
            ${Navbar(user)}
            <main id="app-main" style="padding:2rem 0 3rem">
                <header class="animate-fade-in">
                    <span class="eyebrow">Administration</span>
                    <h1 class="display" style="font-size:1.7rem;margin-top:.2rem">Audit log</h1>
                    <p class="muted small">Who did what, when. Complaint text, passwords, and tokens are never recorded here.</p>
                </header>

                ${entries.length ? `
                    <div class="card card-padded" style="margin-top:1.2rem;padding:0;overflow-x:auto">
                        <table class="tbl">
                            <thead>
                                <tr>
                                    <th>Timestamp</th><th>User</th><th>Action</th>
                                    <th>Target</th><th>Details</th><th>IP</th>
                                </tr>
                            </thead>
                            <tbody id="audit-table-body">${rows}</tbody>
                        </table>
                        <div class="flex justify-center" style="padding:1rem">
                            <button class="btn btn-soft btn-sm" data-action="load-more" data-target="audit-table-body">Load more</button>
                        </div>
                    </div>
                ` : Empty('No audit entries yet.', 'receipt_long')}
            </main>
        `;
    },
};
