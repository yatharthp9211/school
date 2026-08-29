// views/teacher_dashboard.js
import { CONFIG } from '../js/config.js?v=18';
import { api } from '../js/api.js?v=18';
import { Auth } from '../js/auth.js?v=18';
import { Navbar, ComplaintCard, Empty, Stat, Footer, esc, Unauthorized } from '../js/components.js?v=18';

export const TeacherDashboardView = {
    render: async () => {
        let user = Auth.getCurrentUser();
        if (!user || user.role !== 'teacher') {
            return Unauthorized();
        }
        
        try {
            user = await api.me();
            Auth.setSession(Auth.getToken(), user); // Update local storage with full details
        } catch (e) {
            // Ignore error, fallback to cached user
        }
        
        let rosterHtml = '';
        if (user.is_class_teacher) {
            try {
                const students = await api.getMyStudents();
                if (students.length === 0) {
                    rosterHtml = Empty('No students registered in your class yet.', 'group');
                } else {
                    rosterHtml = `
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            ${students.map(s => `
                                <div class="card card-padded flex justify-between items-center animate-fade-in">
                                    <div>
                                        <div class="strong">${esc(s.name)}</div>
                                    </div>
                                    <button class="btn btn-ghost btn-sm remove-student-btn" data-id="${esc(s.id)}">Remove</button>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            } catch (err) {
                rosterHtml = `<div class="field-error-text">Failed to load class roster: ${err.message}</div>`;
            }
        }

        const feed = await api.getComplaints(); // role-aware: assigned pending + public feed
        const assignedPending = feed.filter((c) => c.verifier_teacher === user.id && (c.status || '').toLowerCase() === 'pending');
        const published = feed.filter((c) => CONFIG.statusGroups.LIVE.includes((c.status || '').toLowerCase())).length;
        const resolved = feed.filter((c) => CONFIG.statusGroups.RESOLVED.includes((c.status || '').toLowerCase())).length;
        const liveFeed = feed.filter((c) => !(c.verifier_teacher === user.id && (c.status || '').toLowerCase() === 'pending'));

        const verifyCards = assignedPending.length
            ? assignedPending.map((c) => ComplaintCard(c, 'teacher', user.id)).join('')
            : Empty('Nothing assigned to you right now.', 'check_circle');

        const feedCards = liveFeed.length
            ? liveFeed.slice(0, 8).map((c) => ComplaintCard(c, 'teacher', user.id)).join('')
            : Empty('No public complaints yet.', 'inbox');

        return `
            ${Navbar(user)}
            <main id="app-main" style="padding:2rem 0 3rem">
                <header class="flex flex-wrap justify-between items-end gap-3 animate-fade-in">
                    <div>
                        <span class="eyebrow">Teacher dashboard</span>
                        <h1 class="display" style="font-size:1.9rem;margin-top:.2rem">Welcome, ${esc(user.name)}</h1>
                        <p class="muted small">Verify the reports assigned to you — you never review a complaint about yourself.</p>
                    </div>
                </header>

                <section class="grid grid-cols-2 md:grid-cols-3 gap-4" style="margin-top:1.5rem" aria-label="Your review stats">
                    ${Stat(assignedPending.length, 'Awaiting your review')}
                    ${Stat(published, 'Published')}
                    ${Stat(resolved, 'Resolved')}
                </section>

                <section style="margin-top:1.75rem">
                    <h2 class="display" style="font-size:1.25rem;margin-bottom:.9rem">Verify queue</h2>
                    <div class="flex flex-col gap-4">${verifyCards}</div>
                </section>

                ${user.is_class_teacher ? `
                <section style="margin-top:2rem">
                    <h2 class="display" style="font-size:1.25rem;margin-bottom:.9rem">My Class Roster (${esc(user.class_name)} ${esc(user.section_name)})</h2>
                    ${rosterHtml}
                </section>
                ` : ''}

                <section style="margin-top:2rem">
                    <h2 class="display" style="font-size:1.25rem;margin-bottom:.9rem">Recent public reports</h2>
                    <div class="flex flex-col gap-4">${feedCards}</div>
                    <a href="#/complaints" class="btn btn-ghost btn-sm" style="margin-top:1rem">View all</a>
                </section>
            </main>
            ${Footer()}
        `;
    },
    
    init: () => {
        document.querySelectorAll('.remove-student-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Are you sure you want to remove this student? They will not be able to log in anymore.')) {
                    const studentId = e.target.dataset.id;
                    e.target.disabled = true;
                    e.target.textContent = 'Removing...';
                    try {
                        await api.removeStudent(studentId);
                        e.target.closest('.card').remove();
                    } catch (err) {
                        alert(err.message || 'Failed to remove student');
                        e.target.disabled = false;
                        e.target.textContent = 'Remove';
                    }
                }
            });
        });
    }
};
