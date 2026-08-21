import { CONFIG } from '../js/config.js?v=17';
import { Auth } from '../js/auth.js?v=17';
import { router } from '../js/router.js?v=17';
import { Footer, ThemeToggle, Loading } from '../js/components.js?v=17';

const portals = [
    {
        href: '#/login/student', icon: 'school', title: 'Student Portal',
        desc: 'Report concerns, bullying, or feedback anonymously. Your name never appears.',
        tone: 'emerald',
    },
    {
        href: '#/login/teacher', icon: 'badge', title: 'Teacher Portal',
        desc: 'Verify assigned complaints and review how the community rates your mentorship.',
        tone: 'ink',
    },
    {
        href: '#/login/admin', icon: 'admin_panel_settings', title: 'Administration',
        desc: 'Oversee moderation, resolve complaints, and manage the audit trail.',
        tone: 'gold',
    },
];

export const LandingView = {
    render: async () => {
        if (Auth.isLoggedIn()) {
            const user = Auth.getCurrentUser();
            setTimeout(() => router.navigate(`/${user.role}`), 0);
            return Loading('Redirecting…');
        }

        const portalCards = portals.map((p, i) => `
            <a href="${p.href}" class="card card-padded card-hover animate-slide-up delay-${(i + 1) * 100}"
               style="display:flex;flex-direction:column;align-items:flex-start;gap:.9rem;color:var(--color-ink)">
                <span class="avatar lg" style="background:linear-gradient(140deg, var(--color-${p.tone === 'emerald' ? 'emerald' : p.tone === 'gold' ? 'gold' : 'ink'}), var(--color-${p.tone === 'emerald' ? 'emerald-strong' : p.tone === 'gold' ? 'gold-strong' : 'ink'})">
                    <span class="material-symbols-outlined" style="color:#fff">${p.icon}</span>
                </span>
                <div>
                    <h2 class="display" style="font-size:1.25rem">${p.title}</h2>
                    <p class="small muted" style="margin-top:.3rem">${p.desc}</p>
                </div>
                <span class="btn btn-ghost btn-sm" style="margin-top:auto">Enter
                    <span class="material-symbols-outlined" style="font-size:1rem">arrow_forward</span>
                </span>
            </a>
        `).join('');

        return `
            ${NavbarLoggedOut()}
            <main id="app-main">
                <!-- Hero -->
                <section style="padding:4.5rem 0 2.5rem;text-align:center" class="animate-slide-up">
                    <span class="eyebrow">${CONFIG.schoolName} · ${CONFIG.tagline}</span>
                    <h1 class="display" style="font-size:clamp(2.4rem, 6vw, 4rem);max-width:16em;margin:1rem auto 0">
                        A safe, anonymous way to <em style="color:var(--color-emerald)">speak up</em>.
                    </h1>
                    <p class="muted" style="max-width:38em;margin:1.2rem auto 0;font-size:1.05rem">
                        Students can raise real concerns without fear. Every report is reviewed by a
                        teacher, weighed by the community, and judged by a moderator — never by a mob.
                    </p>
                    <div class="flex justify-center gap-3 flex-wrap" style="margin-top:1.8rem">
                        <a href="#/register/student" class="btn btn-primary btn-lg">Get started</a>
                        <a href="#/login/student" class="btn btn-soft btn-lg">I have an account</a>
                    </div>
                </section>

                <!-- Trust stats -->
                <section class="grid grid-cols-1 sm:grid-cols-3 gap-4" style="max-width:760px;margin:0 auto 3rem" aria-label="Platform highlights">
                    ${[
                        ['100%', 'Anonymous to peers'],
                        ['Multi-step', 'Teacher + community + admin review'],
                        ['Open', 'The audit trail is accountable'],
                    ].map(([v, l], i) => `
                        <div class="stat animate-fade-in delay-${i * 100}">
                            <div class="stat-value" style="color:var(--color-emerald)">${v}</div>
                            <div class="stat-label">${l}</div>
                        </div>`).join('')}
                </section>

                <!-- Portals -->
                <section class="grid grid-cols-1 md:grid-cols-3 gap-4" aria-label="Portals">
                    ${portalCards}
                </section>

                <!-- How it works -->
                <section class="card card-padded" style="margin-top:3rem">
                    <span class="eyebrow">How it works</span>
                    <h2 class="display" style="font-size:1.6rem;margin:.6rem 0 1.2rem">Four steps from report to resolution</h2>
                    <ol class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        ${[
                            ['Submit anonymously', 'Choose a category and select a verifier teacher. Your identity is never attached.'],
                            ['A teacher verifies', 'The assigned teacher reviews the report — and can never review one about themselves.'],
                            ['The community weighs in', 'Votes move a complaint into a moderation review if its score collapses.'],
                            ['A moderator decides', 'Only an admin marks a report false or legitimate. Consequences follow a decision, not a vote.'],
                        ].map(([t, d], i) => `
                            <li class="flex flex-col gap-1">
                                <span class="badge" style="align-self:flex-start">Step ${i + 1}</span>
                                <strong class="small" style="margin-top:.4rem">${t}</strong>
                                <span class="small muted">${d}</span>
                            </li>`).join('')}
                    </ol>
                </section>

                ${Footer()}
            </main>
        `;
    },
};

function NavbarLoggedOut() {
    return `
        <header class="navbar">
            <div class="nav-inner">
                <a class="nav-brand" href="#/" aria-label="${CONFIG.schoolName} home">
                    <img src="${CONFIG.logo}" alt="" loading="lazy">
                    <span>${CONFIG.schoolName}</span>
                </a>
                <nav class="nav-links" aria-label="Primary">
                    ${ThemeToggle()}
                    <a href="#/login/student" class="nav-link">Sign in</a>
                    <a href="#/register/student" class="btn btn-primary btn-sm">Register</a>
                </nav>
            </div>
        </header>
    `;
}
