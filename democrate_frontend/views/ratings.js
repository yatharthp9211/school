// views/ratings.js?v=5 — anonymous teacher feedback (students only).
import { CONFIG } from '../js/config.js?v=5';
import { api } from '../js/api.js?v=5';
import { Auth } from '../js/auth.js?v=5';
import { Navbar, Avatar, Empty, Footer, showToast } from '../js/components.js?v=5';

function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const RatingsView = {
    render: async () => {
        const user = Auth.getCurrentUser();
        if (!user || user.role !== 'student') {
            return '<main id="app-main"><div class="empty" style="margin-top:8rem">Unauthorized.</div></main>';
        }

        let teachers = [];
        try { teachers = await api.getLeaderboard(); } catch (e) { /* offline */ }

        const cards = teachers.length
            ? teachers.map((t) => TeacherRow(t)).join('')
            : Empty('No teachers to rate yet.', 'star');

        return `
            ${Navbar(user)}
            <main id="app-main" style="padding:2rem 0 3rem;max-width:760px">
                <header class="flex flex-wrap justify-between items-end gap-3 animate-fade-in">
                    <div>
                        <span class="eyebrow">Feedback</span>
                        <h1 class="display" style="font-size:1.9rem;margin-top:.2rem">Rate your mentors</h1>
                        <p class="muted small">Anonymous feedback shapes the teacher leaderboard. One rating per teacher — submitting again updates it.</p>
                    </div>
                    <span class="badge"><span class="material-symbols-outlined" style="font-size:.95rem">lock</span>Anonymous</span>
                </header>

                <div id="ratings-list" class="flex flex-col gap-3" style="margin-top:1.5rem">
                    ${cards}
                </div>
            </main>
            ${Footer()}
        `;
    },

    init: () => {
        document.querySelectorAll('.rating-row').forEach((row) => {
            const teacherId = row.dataset.teacherId;
            const stars = Array.from(row.querySelectorAll('.rating-star'));
            const display = row.querySelector('.rating-val');
            const submit = row.querySelector('.submit-rating');

            const select = (rating) => {
                stars.forEach((s, i) => {
                    const active = i < rating;
                    s.classList.toggle('on', active);
                    s.setAttribute('aria-pressed', String(active));
                });
                display.textContent = rating || '';
            };
            stars.forEach((s) => s.addEventListener('click', () => select(parseInt(s.dataset.val, 10))));

            submit.addEventListener('click', async () => {
                const rating = parseInt(display.textContent || '0', 10);
                if (!rating) { showToast('Select a star rating first.', 'error'); return; }

                const tags = Array.from(row.querySelectorAll('.tag-chip.on')).map((t) => t.dataset.tag).join(',');

                submit.disabled = true;
                submit.textContent = 'Submitting…';
                try {
                    await api.submitRating(teacherId, rating, tags || null);
                    showToast('Feedback submitted — thank you.');
                    row.classList.add('rated');
                    submit.textContent = '✓ Submitted';
                    stars.forEach((s) => (s.disabled = true));
                    row.querySelectorAll('.tag-chip').forEach((t) => (t.disabled = true));
                } catch (err) {
                    showToast(err.message || 'Could not submit.', 'error');
                    submit.disabled = false;
                    submit.textContent = 'Submit';
                }
            });
        });
    },
};

function TeacherRow(teacher) {
    return `
        <div class="card card-padded animate-slide-up rating-row" data-teacher-id="${teacher.id}">
            <div class="flex flex-wrap items-center gap-4">
                ${Avatar(teacher.name, { photo: teacher.photo })}
                <div style="min-width:0;flex:1">
                    <h3 style="font-family:var(--font-display);font-weight:600;font-size:1.05rem">${esc(teacher.name)}</h3>
                    <p class="small muted truncate">${esc(teacher.subject)}</p>
                </div>
                <div class="flex items-center gap-1" role="radiogroup" aria-label="Rating for ${esc(teacher.name)}">
                    ${[1, 2, 3, 4, 5].map((v) => `
                        <button type="button" class="rating-star" data-val="${v}" aria-pressed="false" aria-label="${v} star${v > 1 ? 's' : ''}">
                            <span class="material-symbols-outlined">star</span>
                        </button>`).join('')}
                    <span class="rating-val" style="min-width:1.4ch;font-weight:700;color:var(--color-gold)"></span>
                </div>
                <button type="button" class="btn btn-primary btn-sm submit-rating">Submit</button>
            </div>
            <div class="flex flex-wrap gap-2" style="margin-top:.9rem">
                ${CONFIG.ratingTags.map((tag) => `<button type="button" class="tag-chip" data-tag="${tag}">${tag}</button>`).join('')}
            </div>
        </div>
    `;
}
