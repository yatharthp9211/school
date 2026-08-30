// views/admin_dashboard.js
import { api } from '../js/api.js?v=18';
import { Auth } from '../js/auth.js?v=18';
import { Navbar, ComplaintCard, FlaggedCard, Empty, Stat, showToast, esc, Unauthorized } from '../js/components.js?v=18';

// OWASP CSV-injection guard: a cell starting with =, +, -, @, tab, or CR can
// execute as a formula in Excel/Sheets. Neutralize it with a leading quote.
function csvCell(v) {
    const s = String(v ?? '');
    const safe = s.replace(/^[=+\-@\t\r]/, "'").replace(/"/g, '""');
    return `"${safe}"`;
}

function toCsv(complaints) {
    const header = 'id,category,status,score,created_at,text';
    const rows = complaints.map((c) =>
        [c.id, c.category || '', c.status || '', c.score ?? 0, c.created_at || '', c.text || '']
            .map(csvCell).join(',')
    );
    return [header, ...rows].join('\n');
}

export const AdminDashboardView = {
    render: async () => {
        const user = Auth.getCurrentUser();
        if (!user || user.role !== 'admin') {
            return Unauthorized();
        }

        const [all, flagged, falseEntries] = await Promise.all([
            api.adminGetComplaints({ limit: 100 }),
            api.adminFlagged(),
            api.adminFalse(),
        ]);

        const pending = all.filter((c) => (c.status || '').toLowerCase() === 'pending').length;
        const resolved = all.filter((c) => (c.status || '').toLowerCase() === 'resolved').length;
        const archived = all.filter((c) => (c.status || '').toLowerCase() === 'archived').length;

        const flaggedCards = flagged.length
            ? flagged.map((entry) => FlaggedCard(entry)).join('')
            : Empty('No complaints currently flagged for review.', 'verified');

        const recentCards = all.filter(c => (c.status || '').toLowerCase() !== 'pending').slice(0, 6).map((c) => ComplaintCard(c, 'admin', user.id)).join('');

        const falseList = falseEntries.length
            ? falseEntries.map((entry) => {
                const c = entry.complaint;
                const a = entry.author;
                return `
                    <div class="card card-padded" style="border-left:3px solid var(--color-danger)">
                        <div class="flex justify-between items-start gap-3 flex-wrap">
                            <span class="small muted">${c.id} · ${new Date(c.created_at.endsWith('Z') ? c.created_at : c.created_at + 'Z').toLocaleDateString()}</span>
                            ${StatusPillInline('Archived')}
                        </div>
                        <p class="small" style="margin-top:.5rem">${esc(c.text)}</p>
                        <span class="small muted" style="margin-top:.5rem;display:block">
                            Complainant: <strong>${a ? `${esc(a.name)} (${esc(a.id)})` : 'Unknown'}</strong>
                            · Score ${c.score ?? 0}
                        </span>
                    </div>
                `;
            }).join('')
            : Empty('No false-complaint determinations recorded.', 'verified_user');

        const csv = encodeURIComponent(toCsv(all));

        return `
            ${Navbar(user)}
            <main id="app-main" style="padding:2rem 0 3rem">
                <header class="flex flex-wrap justify-between items-end gap-3 animate-fade-in">
                    <div>
                        <span class="eyebrow">Administration</span>
                        <h1 class="display" style="font-size:1.9rem;margin-top:.2rem">Oversight dashboard</h1>
                        <p class="muted small">Moderation, resolution, and the accountability trail. Votes only flag — you decide.</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <a href="#/admin/complaints" class="btn btn-ghost">All complaints</a>
                        <button class="btn btn-ink" data-action="export-csv" data-csv="${csv}">
                            <span class="material-symbols-outlined">download</span>Export CSV
                        </button>
                    </div>
                </header>

                <section class="grid grid-cols-2 md:grid-cols-4 gap-4" style="margin-top:1.5rem" aria-label="System stats">
                    ${Stat(all.length, 'Total complaints')}
                    ${Stat(pending, 'Pending')}
                    ${Stat(flagged.length, 'Flagged for review')}
                    ${Stat(resolved, 'Resolved')}
                </section>

                <section style="margin-top:2rem">
                    <div class="flex items-center justify-between flex-wrap gap-2" style="margin-bottom:.9rem">
                        <h2 class="display" style="font-size:1.25rem">Moderation queue</h2>
                        <span class="badge badge-flagged">Votes are a signal, not a verdict</span>
                    </div>
                    <div class="flex flex-col gap-4">${flaggedCards}</div>
                </section>

                <section style="margin-top:2rem">
                    <h2 class="display" style="font-size:1.25rem;margin-bottom:.9rem">Recent complaints</h2>
                    <div class="flex flex-col gap-4">${recentCards}</div>
                </section>

                <section style="margin-top:2rem">
                    <h2 class="display" style="font-size:1.25rem;margin-bottom:.9rem">False determinations (accountability record)</h2>
                    <div class="flex flex-col gap-3">${falseList}</div>
                </section>
            </main>
        `;
    },
};

function StatusPillInline(status) {
    return `<span class="pill pill-archived"><span class="material-symbols-outlined" style="font-size:.95rem">archive</span>${status}</span>`;
}
