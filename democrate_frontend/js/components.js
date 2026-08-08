// js/components.js — reusable UI components (module exports only, no window globals)
import { CONFIG } from './config.js';
import { state } from './state.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// HTML-escape user-controlled strings before interpolation (XSS guard).
export function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function initials(name) {
    return (name || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');
}

export function Avatar(name, opts = {}) {
    const { photo, sizeClass = '', tone = '' } = opts;
    // name comes from user/teacher records — always escape it (XSS guard).
    if (photo) {
        return `<span class="avatar ${sizeClass} ${tone}"><img src="${esc(photo)}" alt="${esc(name)}" loading="lazy" decoding="async"></span>`;
    }
    return `<span class="avatar ${sizeClass} ${tone}" role="img" aria-label="${esc(name)}">${initials(name)}</span>`;
}

export function Badge(category) {
    const cat = category || 'Uncategorized';
    const catClass = cat.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return `<span class="badge badge-${catClass}"><span class="material-symbols-outlined">label</span>${esc(cat)}</span>`;
}

export function StatusPill(status) {
    const s = (status || '').toLowerCase();
    const cls = `pill pill-${s}`;
    const icon = {
        pending: 'schedule', moderated: 'visibility', published: 'verified',
        voting: 'how_to_vote', flagged: 'flag', resolved: 'task_alt', archived: 'archive',
    }[s] || 'circle';
    return `<span class="${cls}"><span class="material-symbols-outlined" style="font-size:.95rem">${icon}</span>${status || 'Unknown'}</span>`;
}

export function ScorePill(score) {
    const cls = score >= 0 ? 'positive' : 'negative';
    return `<span class="score-pill ${cls}">Score ${score}</span>`;
}

export function Skeleton({ lines = 3 } = {}) {
    const l = Array.from({ length: lines }, (_, i) =>
        `<div class="skeleton line ${['w-40', 'w-80', 'w-60'][i % 3]} mb-2"></div>`).join('');
    return `<div class="card card-padded" aria-busy="true">${l}</div>`;
}

export function Empty(message, icon = 'inbox') {
    return `<div class="empty"><span class="material-symbols-outlined">${icon}</span><p>${message}</p></div>`;
}

export function Stat(value, label) {
    return `
        <div class="stat">
            <div class="stat-value">${value}</div>
            <div class="stat-label">${label}</div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    const isError = type === 'error';
    el.className = `toast ${isError ? 'error' : 'success'}`;
    el.setAttribute('role', 'status');

    // Build with createElement + textContent so user-controlled messages can
    // never inject HTML (XSS guard).
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = isError ? 'error' : 'check_circle';
    const text = document.createElement('span');
    text.textContent = message;

    el.appendChild(icon);
    el.appendChild(text);
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 260);
    }, 3200);
}

// ---------------------------------------------------------------------------
// Navbar + mobile drawer
// ---------------------------------------------------------------------------

// Dark-mode toggle button. Renders with the current theme's icon; the global
// click dispatcher (app.js) handles the actual toggle + icon sync. Add to any
// navbar so the toggle exists on every page, logged in or not.
export function ThemeToggle() {
    const dark = state.theme === 'dark';
    const icon = dark ? 'light_mode' : 'dark_mode';
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    return `
        <button type="button" class="icon-btn" data-action="theme-toggle" aria-label="${label}" title="${label}">
            <span class="material-symbols-outlined" data-theme-icon>${icon}</span>
        </button>
    `;
}

function roleLinks(user) {
    if (!user) return '';
    switch (user.role) {
        case 'student':
            return [
                ['/student', 'dashboard', 'Dashboard'],
                ['/complaint', 'edit_note', 'Submit'],
                ['/complaints', 'public', 'Public'],
                ['/leaderboard', 'leaderboard', 'Leaderboard'],
                ['/ratings', 'star', 'Ratings'],
                ['/profile', 'person', 'Profile'],
            ];
        case 'teacher':
            return [
                ['/teacher', 'dashboard', 'Dashboard'],
                ['/complaints', 'public', 'Public'],
                ['/leaderboard', 'leaderboard', 'Leaderboard'],
                ['/profile', 'person', 'Profile'],
            ];
        case 'admin':
            return [
                ['/admin', 'dashboard', 'Dashboard'],
                ['/admin/complaints', 'inventory_2', 'Complaints'],
                ['/admin/audit', 'receipt_long', 'Audit'],
                ['/leaderboard', 'leaderboard', 'Leaderboard'],
                ['/profile', 'person', 'Profile'],
            ];
        default:
            return [];
    }
}

export function Navbar(user) {
    const links = roleLinks(user)
        .map(([href, icon, label]) => {
            const active = state.currentView === href ? ' active' : '';
            return `<a href="#${href}" class="nav-link${active}" data-nav="${href}"><span class="material-symbols-outlined" style="font-size:1.05rem">${icon}</span>${label}</a>`;
        })
        .join('');

    let right;
    if (user) {
        right = `
            <div class="nav-user">
                ${ThemeToggle()}
                <span class="small muted" style="display:none" data-user-name>${esc(user.name)}</span>
                <button class="btn btn-soft btn-sm" data-action="logout">Logout</button>
            </div>
        `;
    } else {
        right = `
            <div class="nav-user">
                ${ThemeToggle()}
                <a href="#/login/student" class="btn btn-primary btn-sm">Sign in</a>
            </div>
        `;
    }

    return `
        <header class="navbar navbar-auth">
            <div class="nav-inner">
                <a class="nav-brand" href="#/" aria-label="${CONFIG.schoolName} home">
                    <img src="${CONFIG.logo}" alt="" loading="lazy">
                    <span>${CONFIG.schoolName}</span>
                </a>

                <nav class="nav-links" aria-label="Primary">
                    ${links}
                </nav>

                ${right}

                <button class="icon-btn nav-hamburger" data-action="open-drawer" aria-label="Open menu" aria-expanded="false">
                    <span class="material-symbols-outlined">menu</span>
                </button>
            </div>
        </header>

        <div class="drawer-backdrop" data-action="close-drawer" tabindex="-1"></div>
        <nav class="drawer" aria-label="Mobile menu" aria-hidden="true">
            <div class="drawer-header">
                <span class="eyebrow">Menu</span>
                <button class="icon-btn" data-action="close-drawer" aria-label="Close menu">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            ${roleLinks(user).map(([href, icon, label]) => `
                <a class="drawer-link" href="#${href}" data-nav="${href}">
                    <span class="material-symbols-outlined">${icon}</span>${label}
                </a>`).join('')}
            ${user ? `<button class="drawer-link" data-action="logout"><span class="material-symbols-outlined">logout</span>Logout</button>` : ''}
        </nav>
    `;
}

// ---------------------------------------------------------------------------
// Complaint card
// ---------------------------------------------------------------------------

export function ComplaintCard(complaint, role, currentUserId) {
    const score = complaint.score ?? 0;
    const dateFormatted = new Date(complaint.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const status = (complaint.status || '').toLowerCase();
    const upCount = (complaint.student_up || 0) + (complaint.teacher_up || 0);
    const downCount = (complaint.student_down || 0) + (complaint.teacher_down || 0);

    let actions = '';

    // Only the assigned verifier sees Verify/Reject — no one else can act on it.
    const isAssigned = role === 'teacher' && currentUserId && complaint.verifier_teacher === currentUserId;
    if (role === 'teacher' && status === 'pending' && isAssigned) {
        actions = `
            <div class="flex items-center gap-2 mt-4 pt-4" style="border-top:1px solid var(--color-hairline)">
                <button class="btn btn-primary btn-sm" data-action="verify" data-id="${complaint.id}">Verify</button>
                <button class="btn btn-danger btn-sm" data-action="reject" data-id="${complaint.id}">Reject</button>
                <span class="small muted" style="margin-left:auto">Assigned to you</span>
            </div>
        `;
    } else if (role === 'admin') {
        // MODERATED (admin-flagged, now private) is resolvable too — without this
        // there was no path off a moderated complaint except archiving it.
        const resolved = ['published', 'voting', 'moderated'].includes(status);
        actions = `
            <div class="flex items-center gap-2 mt-4 pt-4" style="border-top:1px solid var(--color-hairline)">
                ${status === 'resolved'
                    ? '<span class="pill pill-resolved">Resolved</span>'
                    : resolved
                        ? `<button class="btn btn-primary btn-sm" data-action="resolve" data-id="${complaint.id}">Mark Solved</button>
                           <button class="btn btn-soft btn-sm" data-action="archive" data-id="${complaint.id}">Archive</button>`
                        : `<button class="btn btn-soft btn-sm" data-action="archive" data-id="${complaint.id}">Archive</button>`}
            </div>
        `;
    } else {
        // Voters (student / general public). No vote buttons on your own
        // complaint (the backend rejects self-votes) or once voting is closed —
        // they'd just 400 on every click.
        const isOwn = !!currentUserId && complaint.author_id === currentUserId;
        const votable = ['published', 'voting'].includes(status);
        actions = (isOwn || !votable) ? '' : `
            <div class="flex items-center gap-3 mt-4 pt-4" style="border-top:1px solid var(--color-hairline)">
                <button class="btn btn-ghost btn-sm" data-action="vote" data-id="${complaint.id}" data-type="upvote" aria-label="Upvote">
                    <span class="material-symbols-outlined">thumb_up</span><span data-vote-up>${upCount}</span>
                </button>
                <button class="btn btn-ghost btn-sm" data-action="vote" data-id="${complaint.id}" data-type="downvote" aria-label="Downvote">
                    <span class="material-symbols-outlined">thumb_down</span><span data-vote-down>${downCount}</span>
                </button>
            </div>
        `;
    }

    return `
        <article class="card card-padded card-hover animate-slide-up" data-complaint="${complaint.id}">
            <div class="flex justify-between items-start gap-3 flex-wrap">
                <div class="flex flex-col gap-1.5">
                    <span class="small muted">${complaint.id} · ${dateFormatted}</span>
                    <div class="flex flex-wrap items-center gap-2">
                        ${Badge(complaint.category)}
                        ${StatusPill(complaint.status)}
                    </div>
                </div>
                ${ScorePill(score)}
            </div>
            <p style="margin-top:.85rem;color:var(--color-ink);white-space:pre-wrap">${esc(complaint.text)}</p>
            ${actions}
        </article>
    `;
}

// Flagged-review card (admin only — includes complainant identity via accountability model)
export function FlaggedCard(entry) {
    const c = entry.complaint;
    const a = entry.author;
    const score = c.score ?? 0;
    return `
        <article class="card card-padded animate-slide-up">
            <div class="flex justify-between items-start gap-3 flex-wrap">
                <div class="flex flex-col gap-1.5">
                    <span class="small muted">${c.id} · flagged for review</span>
                    <div class="flex flex-wrap items-center gap-2">${Badge(c.category)} ${StatusPill('flagged')}</div>
                </div>
                ${ScorePill(score)}
            </div>
            <p style="margin:.85rem 0;color:var(--color-ink);white-space:pre-wrap">${esc(c.text)}</p>
            <div class="card card-padded" style="background:var(--color-surface-sunken);border-style:dashed">
                <span class="small muted">Complainant (admin only):</span>
                <span style="font-weight:600">${a ? `${esc(a.name)} (${esc(a.id)})` : 'Unknown'}</span>
            </div>
            <div class="flex items-center gap-2 mt-4 pt-4" style="border-top:1px solid var(--color-hairline)">
                <button class="btn btn-primary btn-sm" data-action="moderate" data-id="${c.id}" data-decision="legitimate">Legitimate</button>
                <button class="btn btn-danger btn-sm" data-action="moderate" data-id="${c.id}" data-decision="false">False</button>
                <button class="btn btn-soft btn-sm" data-action="moderate" data-id="${c.id}" data-decision="insufficient">Insufficient</button>
            </div>
        </article>
    `;
}

// Teacher leaderboard row
export function TeacherCard(teacher, { showRank = true } = {}) {
    const tone = teacher.rank === 1 ? 'gold' : (teacher.rank === 2 || teacher.rank === 3 ? '' : 'ink');
    return `
        <div class="card card-padded card-hover flex items-center gap-4">
            ${showRank ? `<div class="display" style="font-size:1.8rem;color:var(--color-gold);min-width:2.4rem;text-align:center">${teacher.rank}</div>` : ''}
            ${Avatar(teacher.name, { photo: teacher.photo, tone })}
            <div style="flex-grow:1;min-width:0">
                <h3 style="font-family:var(--font-display);font-weight:600;font-size:1.05rem">${esc(teacher.name)}</h3>
                <p class="small muted truncate">${esc(teacher.subject)}</p>
            </div>
            <div class="flex flex-col items-end gap-0.5">
                <div class="flex items-center gap-1" style="color:var(--color-gold)">
                    <span class="material-symbols-outlined fill" style="font-size:1.1rem">star</span>
                    <span style="font-weight:700">${teacher.rating}</span>
                </div>
                <span class="small muted">${teacher.totalRatings} ratings · ${teacher.verifiedComplaints} verified</span>
                ${teacher.penaltyCount > 0 ? `<span class="badge badge-harassment">${teacher.penaltyCount} penalty</span>` : ''}
            </div>
        </div>
    `;
}

export function Footer() {
    return `
        <footer class="flex flex-col items-center gap-1 py-8 mt-8" style="border-top:1px solid var(--color-hairline);color:var(--color-ink-muted);font-size:.8rem">
            <span style="font-family:var(--font-display);font-size:1rem;color:var(--color-ink)">${CONFIG.schoolName}</span>
            <span>${CONFIG.tagline} — your identity stays anonymous to students and teachers.</span>
        </footer>
    `;
}
