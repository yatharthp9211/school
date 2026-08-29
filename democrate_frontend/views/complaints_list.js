// views/complaints_list.js — the public, verified feed (all roles can view & vote).
import { CONFIG } from '../js/config.js?v=18';
import { api } from '../js/api.js?v=18';
import { Auth } from '../js/auth.js?v=18';
import { Navbar, ComplaintCard, Empty, esc, Unauthorized, filterAndSortComplaints } from '../js/components.js?v=18';

export const ComplaintsListView = {
    render: async () => {
        const user = Auth.getCurrentUser();
        if (!user) {
            return Unauthorized();
        }

        const categoryOptions = CONFIG.categories
            .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
            .join('');

        return `
            ${Navbar(user)}
            <main id="app-main" style="padding:2rem 0 3rem">
                <header class="flex flex-wrap justify-between items-end gap-3 animate-fade-in">
                    <div>
                        <span class="eyebrow">Public feed</span>
                        <h1 class="display" style="font-size:1.9rem;margin-top:.2rem">Community complaints</h1>
                        <p class="muted small">All verified complaints, ordered by community weight.</p>
                    </div>
                </header>

                <div class="card card-padded flex flex-wrap gap-3 items-center" style="margin-top:1.5rem">
                    <div class="form-group" style="flex:1;min-width:200px;margin:0">
                        <input type="search" id="fb-q" class="input" placeholder="Search complaints or IDs…">
                    </div>
                    <div class="form-group" style="min-width:160px;margin:0">
                        <select id="fb-category" class="input">
                            <option value="">All categories</option>
                            ${categoryOptions}
                        </select>
                    </div>
                    <div class="form-group" style="min-width:160px;margin:0">
                        <select id="fb-sort" class="input">
                            <option value="date-desc">Newest first</option>
                            <option value="date-asc">Oldest first</option>
                            <option value="score-desc">Highest score</option>
                            <option value="score-asc">Lowest score</option>
                            <option value="text-asc">Complaint (A-Z)</option>
                            <option value="text-desc">Complaint (Z-A)</option>
                        </select>
                    </div>
                    ${user.role === 'admin' || user.role === 'teacher' ? `
                    <div class="form-group" style="min-width:160px;margin:0">
                        <select id="fb-class-group" class="input">
                            <option value="">All class groups</option>
                            <option value="pre-primary">Pre-primary</option>
                            <option value="primary">Primary</option>
                            <option value="upper-primary">Upper primary</option>
                            <option value="secondary">Secondary</option>
                        </select>
                    </div>
                    ` : ''}
                </div>

                <section style="margin-top:1.5rem">
                    <div id="feed-list" class="flex flex-col gap-4">
                        <div class="card card-padded animate-pulse" aria-busy="true">
                            <div class="skeleton line w-40 mb-3"></div>
                            <div class="skeleton line w-80 mb-2"></div>
                            <div class="skeleton line w-60"></div>
                        </div>
                    </div>
                </section>
            </main>
        `;
    },

    init: () => {
        const list = document.getElementById('feed-list');
        const qInput = document.getElementById('fb-q');
        const catSel = document.getElementById('fb-category');
        const sortSel = document.getElementById('fb-sort');
        const cgSel = document.getElementById('fb-class-group');
        if (!list) return;
        const user = Auth.getCurrentUser();

        let all = [];

        const render = (rows) => {
            if (!rows.length) {
                list.innerHTML = Empty('No public complaints match.', 'inbox');
                return;
            }
            list.innerHTML = rows.map((c) => ComplaintCard(c, user.role, user.id)).join('');
        };

        const reRender = () => {
            let rows = filterAndSortComplaints(all, {
                query: qInput?.value || '',
                category: catSel?.value || '',
                sort: sortSel?.value || 'date-desc',
            });
            if (cgSel && cgSel.value) {
                rows = rows.filter(c => c.class_group === cgSel.value);
            }
            render(rows);
        };

        qInput?.addEventListener('input', () => {
            clearTimeout(window._complaintsFilterTimeout);
            window._complaintsFilterTimeout = setTimeout(reRender, 150);
        });
        catSel?.addEventListener('change', reRender);
        sortSel?.addEventListener('change', reRender);
        
        const fetchComplaints = () => {
            const params = cgSel && cgSel.value ? { class_group: cgSel.value } : {};
            api.getComplaints(params)
                .then((feed) => {
                    all = feed.filter((c) => !c.is_private);
                    reRender();
                })
                .catch((e) => {
                    list.innerHTML = `<div class="field-error-text">Failed to load feed: ${e.message}</div>`;
                });
        };

        cgSel?.addEventListener('change', fetchComplaints);
        
        fetchComplaints();
    },
};