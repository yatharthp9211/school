import { api } from '../js/api.js';
import { Auth } from '../js/auth.js';
import { ThemeToggle, esc, showToast } from '../js/components.js';
import { router } from '../js/router.js';

export const DeveloperDashboardView = {
    render: async () => {
        const user = Auth.getCurrentUser();
        if (!user || user.role !== 'developer') {
            return '<div class="empty" style="margin-top:8rem">Unauthorized.</div>';
        }

        // Fetch basic stats (fallback if endpoints missing)
        const stats = await api.developerStats().catch(() => ({ users: 0, complaints: 0, false_reports: 0 }));

        return `
            <header class="navbar">
                <div class="nav-inner">
                    <a class="nav-brand" href="#/">
                        <span class="material-symbols-outlined" style="color:var(--color-gold)">terminal</span>
                        <span>Democrate · Developer</span>
                    </a>
                    <nav class="nav-links">
                        ${ThemeToggle()}
                        <button class="btn btn-soft btn-sm" data-action="logout">Logout</button>
                    </nav>
                </div>
            </header>
            <main id="app-main" style="padding:2rem 0 3rem;max-width:900px;margin:0 auto">
                <header class="animate-fade-in">
                    <span class="eyebrow">Administration</span>
                    <h1 class="display" style="font-size:1.9rem;margin-top:.2rem">Developer Console</h1>
                    <p class="muted small">Direct database access and audit logs.</p>
                </header>
                
                <section class="grid grid-cols-1 sm:grid-cols-3 gap-4" style="margin-top:1.5rem">
                    <div class="stat animate-fade-in">
                        <div class="stat-value" style="color:var(--color-ink)">${stats.users?.total || 0}</div>
                        <div class="stat-label">Total Users</div>
                    </div>
                    <div class="stat animate-fade-in">
                        <div class="stat-value" style="color:var(--color-ink)">${stats.complaints?.total || 0}</div>
                        <div class="stat-label">Complaints</div>
                    </div>
                    <div class="stat animate-fade-in">
                        <div class="stat-value" style="color:var(--color-ink)">${stats.false_reports || 0}</div>
                        <div class="stat-label">False Reports</div>
                    </div>
                </section>

                <div class="card card-padded" style="margin-top:2rem">
                    <h2 class="display" style="font-size:1.2rem;margin-bottom:1rem">SQL Console</h2>
                    <div class="field">
                        <textarea class="input" id="sql-input" rows="4" placeholder="SELECT * FROM users LIMIT 10;" style="font-family:monospace"></textarea>
                    </div>
                    <div class="flex gap-2 flex-wrap" style="margin-top:1rem">
                        <button class="btn btn-primary btn-sm" id="btn-run-query">Run Query (Read)</button>
                        <button class="btn btn-danger btn-sm" id="btn-run-execute">Execute (Write)</button>
                        <button class="btn btn-soft btn-sm" id="btn-view-tables">List Tables</button>
                        <button class="btn btn-soft btn-sm" id="btn-view-users">List Users</button>
                    </div>
                    <div id="query-result" style="margin-top:1rem"></div>
                </div>

                <div class="card card-padded" style="margin-top:2rem">
                    <div class="flex justify-between items-center" style="margin-bottom:1rem">
                        <h2 class="display" style="font-size:1.2rem">Audit Log</h2>
                        <button class="btn btn-soft btn-sm" id="btn-load-audit">Refresh Audit</button>
                    </div>
                    <div id="audit-table-container"></div>
                </div>
            </main>
        `;
    },

    init: () => {
        const sqlInput = document.getElementById('sql-input');
        const resultDiv = document.getElementById('query-result');

        document.getElementById('btn-run-query')?.addEventListener('click', async () => {
            if (!sqlInput.value.trim()) return showToast('Enter SQL first.', 'error');
            try {
                const res = await api.developerQuery(sqlInput.value.trim());
                if (res.columns && res.rows && res.rows.length > 0) {
                    const header = res.columns.map((c) => `<th>${esc(c)}</th>`).join('');
                    const body = res.rows.map((row) => `<tr>${res.columns.map((c) => `<td class="small">${esc(row[c])}</td>`).join('')}</tr>`).join('');
                    resultDiv.innerHTML = `
                        <div class="small muted" style="margin-bottom:.5rem">${res.row_count} row(s) returned</div>
                        <div style="overflow-x:auto">
                            <table class="tbl"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
                        </div>
                    `;
                } else {
                    resultDiv.innerHTML = '<span class="small muted">No results.</span>';
                }
            } catch (err) {
                resultDiv.innerHTML = `<span class="small" style="color:var(--color-danger)">${esc(err.message)}</span>`;
            }
        });

        document.getElementById('btn-run-execute')?.addEventListener('click', async () => {
            if (!sqlInput.value.trim()) return showToast('Enter SQL first.', 'error');
            try {
                const res = await api.developerExecute(sqlInput.value.trim());
                resultDiv.innerHTML = `<span class="badge badge-success">${esc(res.message)}</span>`;
            } catch (err) {
                resultDiv.innerHTML = `<span class="small" style="color:var(--color-danger)">${esc(err.message)}</span>`;
            }
        });

        document.getElementById('btn-view-tables')?.addEventListener('click', () => {
            sqlInput.value = 'SELECT name FROM sqlite_master WHERE type="table";';
            document.getElementById('btn-run-query').click();
        });

        document.getElementById('btn-view-users')?.addEventListener('click', () => {
            sqlInput.value = 'SELECT id, name, role, is_active FROM users LIMIT 50;';
            document.getElementById('btn-run-query').click();
        });

        const loadAudit = async () => {
            const container = document.getElementById('audit-table-container');
            if (!container) return;
            try {
                const entries = await api.developerAudit({ limit: 50 });
                if (!entries.length) {
                    container.innerHTML = '<span class="small muted">No audit logs found.</span>';
                    return;
                }
                const rows = entries.map(e => `
                    <tr>
                        <td class="small muted">${new Date(e.timestamp).toLocaleString()}</td>
                        <td class="small"><strong>${esc(e.user_id || 'System')}</strong></td>
                        <td class="small"><span class="badge badge-neutral">${esc(e.action)}</span></td>
                        <td class="small">${esc(e.target_id || '-')}</td>
                        <td class="small muted truncate" style="max-width:200px" title="${esc(e.details)}">${esc(e.details || '-')}</td>
                        <td class="small muted">${esc(e.ip_address)}</td>
                    </tr>
                `).join('');
                container.innerHTML = `
                    <div style="overflow-x:auto">
                        <table class="tbl" style="width:100%;text-align:left">
                            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Details</th><th>IP</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `;
            } catch (err) {
                container.innerHTML = `<span class="small" style="color:var(--color-danger)">Failed to load audit logs.</span>`;
            }
        };

        document.getElementById('btn-load-audit')?.addEventListener('click', loadAudit);
        loadAudit(); // load initially
    }
};
