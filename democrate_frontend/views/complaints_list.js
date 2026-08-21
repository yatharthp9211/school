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
                        <input type="search" id="fb-q" placeholder="Search complaints or IDs…">
                    </div>
                    <div class="form-group" style="min-width:160px;margin:0">
                        <select id="fb-category">
                            <option value="">All categories</option>
                            ${categoryOptions}
                        </select>
                    </div>
                    <div class="form-group" style="min-width:180px;margin:0">
                        <select id="fb-sort">
                            <option value="date-desc">Newest first</option>
                            <option value="date-asc">Oldest first</option>
                            <option value="score-desc">Highest score</option>
                            <option value="score-asc">Lowest score</option>
                            <option value="text-asc">Complaint (A-Z)</option>
                            <option value="text-desc">Complaint (Z-A)</option>
                        </select>
                    </div>
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
            const rows = filterAndSortComplaints(all, {
                query: qInput?.value || '',
                category: catSel?.value || '',
                sort: sortSel?.value || 'date-desc',
            });
            render(rows);
        };

        qInput?.addEventListener('input', () => {
            clearTimeout(window._complaintsFilterTimeout);
            window._complaintsFilterTimeout = setTimeout(reRender, 150);
        });
        catSel?.addEventListener('change', reRender);
        sortSel?.addEventListener('change', reRender);

        api.getComplaints()
            .then((feed) => {
                all = feed.filter((c) => !c.is_private);
                reRender();
            })
            .catch(() => { list.innerHTML = Empty('Could not load complaints.', 'error'); });
    },
};