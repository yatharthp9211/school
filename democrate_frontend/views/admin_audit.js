// views/admin_audit.js — the immutable accountability trail (admin only).
import { api } from '../js/api.js?v=17';
import { Auth } from '../js/auth.js?v=17';
import { Navbar, Empty, esc, Unauthorized, paginateRows } from '../js/components.js?v=17';

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
            return Unauthorized();
        }

        return `
            ${Navbar(user)}
            <main id="app-main" style="padding:2rem 0 3rem">
                <header class="animate-fade-in">
                    <span class="eyebrow">Administration</span>
                    <h1 class="display" style="font-size:1.7rem;margin-top:.2rem">Audit log</h1>
                    <p class="muted small">Who did what, when. Complaint text, passwords, and tokens are never recorded here.</p>
                </header>
                <div class="card card-padded" style="margin-top:1.2rem;padding:0;overflow-x:auto">
                    <table class="tbl">
                        <thead>
                            <tr>
                                <th>Timestamp</th><th>User</th><th>Action</th>
                                <th>Target</th><th>Details</th><th>IP</th>
                            </tr>
                        </thead>
                        <tbody id="audit-table-body"></tbody>
                    </table>
                </div>
            </main>
        `;
    },

    init: () => {
        const tableBody = document.getElementById('audit-table-body');
        if (!tableBody) return;

        paginateRows({
            listEl: tableBody,
            getRows: async () => await api.adminAudit({ limit: 200 }),
            renderRow: (e, i) => {
                const label = ACTION_LABELS[e.action] || e.action;
                return `
                    <tr>
                        <td class="small muted nowrap" style="white-space:nowrap">${new Date(e.timestamp).toLocaleString()}</td>
                        <td>${esc(e.user_id || '—')}</td>
                        <td><span class="badge">${esc(label)}</span></td>
                        <td>${esc(e.target || '—')}</td>
                        <td class="small muted">${esc(e.details || '—')}</td>
                        <td class="small muted nowrap" style="white-space:nowrap">${esc(e.ip_address || '—')}</td>
                    </tr>
                `;
            },
            pageSize: 20,
            emptyMessage: 'No audit entries yet.',
            emptyIcon: 'receipt_long',
        });
    },
};