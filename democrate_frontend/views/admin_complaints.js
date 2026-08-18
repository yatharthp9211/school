// views/admin_complaints.js — full complaint list with status/category filters + live search.
import { CONFIG } from '../js/config.js?v=17';
import { api } from '../js/api.js?v=17';
import { Auth } from '../js/auth.js?v=17';
import { Navbar, ComplaintCard, Empty } from '../js/components.js?v=17';

const STATUSES = ['', 'pending', 'published', 'voting', 'flagged', 'moderated', 'resolved', 'archived'];

function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const AdminComplaintsView = {
    render: async () => {
        const user = Auth.getCurrentUser();
        if (!user || user.role !== 'admin') {
            return '<main id="app-main"><div class="empty" style="margin-top:8rem">Unauthorized.</div></main>';
        }

        const all = await api.adminGetComplaints({ limit: 100 });

        const statusOptions = STATUSES
            .map((s) => `<option value="${s}">${s === '' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}</option>`)
            .join('');
        const categoryOptions = `<option value="">All categories</option>`
            + CONFIG.categories.map((c) => `<option value="${esc(c)}">${c}</option>`).join('');

        return `
            ${Navbar(user)}
            <main id="app-main" style="padding:2rem 0 3rem">
                <header class="animate-fade-in">
                    <span class="eyebrow">Administration</span>
                    <h1 class="display" style="font-size:1.7rem;margin-top:.2rem">All complaints</h1>
                    <p class="muted small">Every report, including private and flagged. Identity is only exposed in moderation views.</p>
                </header>

                <form id="filter-form" class="card card-padded flex flex-wrap items-end gap-3" style="margin-top:1.2rem">
                    <div class="field" style="min-width:140px">
                        <label class="label" for="f-status">Status</label>
                        <select class="select" id="f-status">${statusOptions}</select>
                    </div>
                    <div class="field" style="min-width:150px">
                        <label class="label" for="f-category">Category</label>
                        <select class="select" id="f-category">${categoryOptions}</select>
                    </div>
                    <div class="field" style="min-width:160px">
                        <label class="label" for="f-sort">Sort by</label>
                        <select class="select" id="f-sort">
                            <option value="date-desc">Newest first</option>
                            <option value="date-asc">Oldest first</option>
                            <option value="score-desc">Highest score</option>
                            <option value="score-asc">Lowest score</option>
                            <option value="text-asc">Complaint (A to Z)</option>
                            <option value="text-desc">Complaint (Z to A)</option>
                        </select>
                    </div>
                    <div class="field" style="flex:1;min-width:200px">
                        <label class="label" for="f-q">Search</label>
                        <input class="input" id="f-q" type="search" placeholder="Search text or ID…">
                    </div>
                    <button type="submit" class="btn btn-primary">Apply</button>
                </form>

                <div id="complaint-list" class="flex flex-col gap-4" style="margin-top:1.5rem"
                     aria-live="polite"></div>
            </main>
        `;
    },

    init: () => {
        const list = document.getElementById('complaint-list');
        const form = document.getElementById('filter-form');
        if (!list || !form) return;
        const user = Auth.getCurrentUser();

        let all = [];

        const render = (rows) => {
            const sort = document.getElementById('f-sort')?.value || 'date-desc';
            const sorted = [...rows];
            sorted.sort((a, b) => {
                switch (sort) {
                    case 'date-asc':
                        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
                    case 'date-desc':
                        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                    case 'score-desc':
                        return (b.score ?? 0) - (a.score ?? 0);
                    case 'score-asc':
                        return (a.score ?? 0) - (b.score ?? 0);
                    case 'text-asc':
                        return (a.text || '').localeCompare(b.text || '', undefined, { sensitivity: 'base' });
                    case 'text-desc':
                        return (b.text || '').localeCompare(a.text || '', undefined, { sensitivity: 'base' });
                    default:
                        return 0;
                }
            });

            if (!sorted.length) {
                list.innerHTML = Empty('No complaints match these filters.', 'search_off');
                return;
            }
            list.innerHTML = sorted.map((c) => ComplaintCard(c, 'admin', user.id)).join('');
        };

        const apply = async () => {
            form.querySelector('button[type="submit"]').disabled = true;
            try {
                const status = document.getElementById('f-status').value;
                const category = document.getElementById('f-category').value;
                const q = document.getElementById('f-q').value.trim().toLowerCase();

                if (status || category) {
                    all = await api.adminGetComplaints({ limit: 100, status, category });
                } else {
                    all = await api.adminGetComplaints({ limit: 100 });
                }
                render(q ? all.filter((c) => (c.text || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q)) : all);
            } catch (err) {
                list.innerHTML = Empty(err.message || 'Could not load complaints.', 'error');
            } finally {
                form.querySelector('button[type="submit"]').disabled = false;
            }
        };

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            apply();
        });

        document.getElementById('f-sort')?.addEventListener('change', () => {
            const q = document.getElementById('f-q')?.value.trim().toLowerCase() || '';
            render(q ? all.filter((c) => (c.text || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q)) : all);
        });

        apply();
    },
};

