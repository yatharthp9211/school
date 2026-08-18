// views/complaints_list.js — the public, verified feed (all roles can view & vote).
import { CONFIG } from '../js/config.js?v=17';
import { api } from '../js/api.js?v=17';
import { Auth } from '../js/auth.js?v=17';
import { Navbar, ComplaintCard, Empty } from '../js/components.js?v=17';

function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const ComplaintsListView = {
    render: async () => {
        const user = Auth.getCurrentUser();
        if (!user) {
            return '<main id="app-main"><div class="empty" style="margin-top:8rem">Unauthorized.</div></main>';
        }

        const feed = await api.getComplaints(); // backend is role-aware
        const publicOnly = feed.filter((c) => !c.is_private);

        const categoryOptions = `<option value="">All categories</option>`
            + CONFIG.categories.map((c) => `<option value="${esc(c)}">${c}</option>`).join('');

        return `
            ${Navbar(user)}
            <main id="app-main" style="padding:2rem 0 3rem">
                <header class="animate-fade-in">
                    <span class="eyebrow">Community</span>
                    <h1 class="display" style="font-size:1.9rem;margin-top:.2rem">Public complaints</h1>
                    <p class="muted small">Verified reports the community weighs in on. Your vote counts — students ×1, teachers ×10.</p>
                </header>

                <div class="card card-padded flex flex-wrap items-end gap-3" style="margin-top:1.2rem">
                    <div class="field" style="min-width:160px">
                        <label class="label" for="fb-category">Category</label>
                        <select class="select" id="fb-category">${categoryOptions}</select>
                    </div>
                    <div class="field" style="min-width:170px">
                        <label class="label" for="fb-sort">Sort by</label>
                        <select class="select" id="fb-sort">
                            <option value="date-desc">Newest first</option>
                            <option value="date-asc">Oldest first</option>
                            <option value="score-desc">Highest score</option>
                            <option value="score-asc">Lowest score</option>
                            <option value="text-asc">Complaint (A to Z)</option>
                            <option value="text-desc">Complaint (Z to A)</option>
                        </select>
                    </div>
                    <div class="field" style="flex:1;min-width:200px">
                        <label class="label" for="fb-q">Search</label>
                        <input class="input" id="fb-q" type="search" placeholder="Search reports…">
                    </div>
                </div>

                <div id="feed-list" class="flex flex-col gap-4" style="margin-top:1.5rem" aria-live="polite"></div>
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

        const render = () => {
            const q = (qInput?.value || '').trim().toLowerCase();
            const cat = catSel?.value || '';
            const sort = sortSel?.value || 'date-desc';

            const rows = all.filter((c) => {
                if (cat && (c.category || '') !== cat) return false;
                if (q && !((c.text || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q))) return false;
                return true;
            });

            rows.sort((a, b) => {
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

            if (!rows.length) {
                list.innerHTML = Empty('No public complaints match.', 'inbox');
                return;
            }

            // First 20 visible; the rest hidden for the global load-more action.
            list.innerHTML = rows
                .map((c, i) => {
                    const card = ComplaintCard(c, user.role, user.id);
                    return i >= 20 ? card.replace('<article', '<article data-hidden-row') : card;
                })
                .join('')
                + `<div class="flex justify-center"><button class="btn btn-soft" data-action="load-more" data-target="feed-list">Load more</button></div>`;
        };

        qInput?.addEventListener('input', render);
        catSel?.addEventListener('change', render);
        sortSel?.addEventListener('change', render);

        api.getComplaints()
            .then((feed) => { all = feed.filter((c) => !c.is_private); render(); })
            .catch(() => { list.innerHTML = Empty('Could not load complaints.', 'error'); });
    },
};

