// views/admin_complaints.js — full complaint list with status/category filters + live search.
import { CONFIG } from '../js/config.js?v=18';
import { api } from '../js/api.js?v=18';
import { Auth } from '../js/auth.js?v=18';
import { Navbar, ComplaintCard, Empty, esc, Unauthorized, filterAndSortComplaints } from '../js/components.js?v=18';

const STATUSES = ['', 'pending', 'published', 'flagged', 'moderated', 'resolved', 'archived'];

export const AdminComplaintsView = {
    render: async () => {
        const user = Auth.getCurrentUser();
        if (!user || user.role !== 'admin') {
            return Unauthorized();
        }

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
                    <div class="field" style="min-width:160px">
                        <label class="label" for="f-class-group">Class Group</label>
                        <select class="select" id="f-class-group">
                            <option value="">All class groups</option>
                            <option value="pre-primary">Pre-primary</option>
                            <option value="primary">Primary</option>
                            <option value="upper-primary">Upper primary</option>
                            <option value="secondary">Secondary</option>
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
            if (!rows.length) {
                list.innerHTML = Empty('No complaints match these filters.', 'search_off');
                return;
            }
            list.innerHTML = rows.map((c) => ComplaintCard(c, 'admin', user.id)).join('');
        };

        const reRender = () => {
            const rows = filterAndSortComplaints(all, {
                query: document.getElementById('f-q')?.value || '',
                sort: document.getElementById('f-sort')?.value || 'date-desc',
            });
            render(rows);
        };

        const apply = async () => {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            try {
                const status = document.getElementById('f-status')?.value;
                const category = document.getElementById('f-category')?.value;
                const classGroup = document.getElementById('f-class-group')?.value;

                let params = { limit: 200 };
                if (status) params.status = status;
                if (category) params.category = category;
                if (classGroup) params.class_group = classGroup;

                all = await api.adminGetComplaints(params);
                reRender();
            } catch (err) {
                list.innerHTML = Empty(err.message || 'Could not load complaints.', 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        };

        document.getElementById('f-sort')?.addEventListener('change', reRender);

        let searchTimeout;
        document.getElementById('f-q')?.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(reRender, 150);
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            apply();
        });

        apply();
    },
};