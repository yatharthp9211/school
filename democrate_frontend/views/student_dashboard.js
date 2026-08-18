// views/student_dashboard.js
import { api } from '../js/api.js?v=16';
import { Auth } from '../js/auth.js?v=16';
import { Navbar, ComplaintCard, Empty, Stat, Footer, esc } from '../js/components.js?v=16';

export const StudentDashboardView = {
    render: async () => {
        const user = Auth.getCurrentUser();
        if (!user || user.role !== 'student') {
            return '<main id="app-main"><div class="empty" style="margin-top:8rem">Unauthorized.</div></main>';
        }

        const my = await api.getMyComplaints();
        const total = my.length;
        const published = my.filter((c) => ['published', 'voting'].includes((c.status || '').toLowerCase())).length;
        const pending = my.filter((c) => ['pending', 'moderated'].includes((c.status || '').toLowerCase())).length;
        const resolved = my.filter((c) => (c.status || '').toLowerCase() === 'resolved').length;

        const cards = my.length
            ? my.map((c) => ComplaintCard(c, 'student', user.id)).join('')
            : Empty('You have not filed any complaints yet.', 'inbox');

        return `
            ${Navbar(user)}
            <main id="app-main" style="padding:2rem 0 3rem">
                <header class="flex flex-wrap justify-between items-end gap-3 animate-fade-in">
                    <div>
                        <span class="eyebrow">Student dashboard</span>
                        <h1 class="display" style="font-size:1.9rem;margin-top:.2rem">Welcome, ${esc(user.name)}</h1>
                        <p class="muted small">Track your complaints or file a new one. Your identity stays anonymous to peers and teachers.</p>
                    </div>
                    <a href="#/complaint" class="btn btn-primary">
                        <span class="material-symbols-outlined">edit_note</span>New complaint
                    </a>
                </header>

                <section class="grid grid-cols-2 md:grid-cols-4 gap-4" style="margin-top:1.5rem" aria-label="Your complaint stats">
                    ${Stat(total, 'Total filed')}
                    ${Stat(published, 'Published')}
                    ${Stat(pending, 'Under review')}
                    ${Stat(resolved, 'Resolved')}
                </section>

                <section style="margin-top:1.75rem">
                    <h2 class="display" style="font-size:1.25rem;margin-bottom:.9rem">Your reports</h2>
                    <div class="flex flex-col gap-4">${cards}</div>
                </section>
            </main>
            ${Footer()}
        `;
    },
};
