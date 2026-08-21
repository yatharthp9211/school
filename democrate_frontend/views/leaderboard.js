// views/leaderboard.js — teacher leaderboard with podium, search, and subject filter.
import { api } from '../js/api.js?v=17';
import { Auth } from '../js/auth.js?v=17';
import { Navbar, TeacherCard, Avatar, Empty, Footer, esc, Unauthorized } from '../js/components.js?v=17';

function PodiumSlot(teacher, rank) {
    if (!teacher) return '';
    const medal = rank === 1 ? 'gold' : (rank === 2 ? 'silver' : 'bronze');
    const accent = rank === 1 ? 'var(--color-gold)' : (rank === 2 ? '#8B93A1' : '#A9744A');
    return `
        <div class="card card-padded card-hover flex flex-col items-center text-center" style="min-width:0;border-top:4px solid ${accent};order:${rank === 1 ? 2 : rank === 2 ? 1 : 3}">
            <span class="display" style="font-size:2rem;color:${accent}">${rank}</span>
            ${Avatar(teacher.name, { photo: teacher.photo, sizeClass: 'lg' })}
            <h3 class="display" style="font-size:1.1rem;margin-top:.6rem">${esc(teacher.name)}</h3>
            <p class="small muted truncate" style="max-width:100%">${esc(teacher.subject)}</p>
            <div class="flex items-center gap-1" style="color:var(--color-gold);margin-top:.4rem">
                <span class="material-symbols-outlined fill" style="font-size:1.2rem">star</span>
                <span style="font-weight:700">${teacher.rating}</span>
            </div>
            <span class="small muted">${teacher.totalRatings} ratings</span>
        </div>
    `;
}

export const LeaderboardView = {
    render: async () => {
        const user = Auth.getCurrentUser();
        if (!user) {
            return Unauthorized();
        }

        const leaderboard = await api.getLeaderboard();
        const subjects = [...new Set(leaderboard.map((t) => t.subject).filter(Boolean))];

        const subjectOptions = `<option value="">All subjects</option>`
            + subjects.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');

        return `
            ${Navbar(user)}
            <main id="app-main" style="padding:2rem 0 3rem">
                <header class="animate-fade-in">
                    <span class="eyebrow">Recognition</span>
                    <h1 class="display" style="font-size:1.9rem;margin-top:.2rem">Teacher leaderboard</h1>
                    <p class="muted small">Rated by students for mentoring, fairness, and verified resolutions. Penalties reduce a rank.</p>
                </header>

                <section class="grid grid-cols-1 sm:grid-cols-3 gap-4" style="margin-top:1.5rem" aria-label="Top three teachers">
                    ${PodiumSlot(leaderboard[1], 2)}
                    ${PodiumSlot(leaderboard[0], 1)}
                    ${PodiumSlot(leaderboard[2], 3)}
                </section>

                <div class="card card-padded flex flex-wrap items-end gap-3" style="margin-top:2rem">
                    <div class="field" style="min-width:170px">
                        <label class="label" for="lb-subject">Subject</label>
                        <select class="select" id="lb-subject">${subjectOptions}</select>
                    </div>
                    <div class="field" style="flex:1;min-width:200px">
                        <label class="label" for="lb-q">Search</label>
                        <input class="input" id="lb-q" type="search" placeholder="Search teachers…">
                    </div>
                </div>

                <div id="lb-list" class="flex flex-col gap-3" style="margin-top:1.2rem" aria-live="polite"></div>
            </main>
            ${Footer()}
        `;
    },

    init: () => {
        const list = document.getElementById('lb-list');
        const qInput = document.getElementById('lb-q');
        const subjSel = document.getElementById('lb-subject');
        if (!list) return;

        let all = [];

        const render = () => {
            const q = (qInput?.value || '').trim().toLowerCase();
            const subj = subjSel?.value || '';
            const rows = all.filter((t) => {
                if (subj && (t.subject || '') !== subj) return false;
                if (q && !((t.name || '').toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q))) return false;
                return true;
            });
            list.innerHTML = rows.length
                ? rows.map((t) => TeacherCard(t)).join('')
                : Empty('No teachers match.', 'search_off');
        };

        qInput?.addEventListener('input', render);
        subjSel?.addEventListener('change', render);

        api.getLeaderboard()
            .then((data) => { all = data; render(); })
            .catch(() => { list.innerHTML = Empty('Could not load the leaderboard.', 'error'); });
    },
};
