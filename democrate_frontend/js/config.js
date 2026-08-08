// js/config.js
// Configuration: school identity, theming, thresholds, API endpoints.

export const CONFIG = {
    schoolName: "Sanskar Global School",
    logo: "https://sanskarglobalschoolgauriganj.com/wp-content/uploads/2025/02/goriganj-log.png",

    // Editorial Prestige palette (matches css/styles.css tokens).
    theme: {
        primary: "#0E6B45",      // Emerald
        primaryStrong: "#0A5536",
        secondary: "#1B2530",    // Ink
        accent: "#C6A15B",       // Gold
        text: "#1B2530",         // Ink
        textMuted: "#5C6B7A",
        background: "#FAF7F2",   // Ivory
        surface: "#FFFFFF",
        surfaceSunken: "#F4EEE4",
        hairline: "#E6DDCF",
        error: "#B3423E",
    },

    // Complaint categories (chosen by the student — no server-side AI).
    categories: [
        "Harassment",
        "Teacher Misconduct",
        "Infrastructure",
        "Bullying",
        "Academic",
        "Safety",
        "Mental Health",
        "Other",
    ],

    // Rating tags (allowlisted server-side too).
    ratingTags: ["Helpful", "Clear", "Fair", "Punctual", "Passionate", "Empathetic"],

    // Voting Weights
    studentVote: 1,
    teacherVote: 10,

    // Thresholds
    falseThreshold: -50,

    tagline: "Speak Up. Stay Safe.",
};

// API Configuration
// Use relative path for API so it automatically works on local, network, and production domains.
const API_BASE = '/api/v1';
export const API = {
    BASE: API_BASE,
    LOGIN: `${API_BASE}/auth/login`,
    REGISTER: `${API_BASE}/auth/register`,
    REGISTER_TEACHER: `${API_BASE}/auth/register/teacher`,
    CHECK_ID: `${API_BASE}/auth/check-id`,
    ME: `${API_BASE}/auth/me`,
    COMPLAINTS: `${API_BASE}/complaints`,
    MY_COMPLAINTS: `${API_BASE}/complaints/mine`,
    VERIFY: `${API_BASE}/complaints/verify`,
    LEADERBOARD: `${API_BASE}/leaderboard`,
    RATINGS: `${API_BASE}/ratings`,
    ADMIN_COMPLAINTS: `${API_BASE}/admin/complaints`,
    ADMIN_FLAGGED: `${API_BASE}/admin/flagged`,
    ADMIN_FALSE: `${API_BASE}/admin/false`,
    ADMIN_MODERATE: `${API_BASE}/admin/moderate`,
    ADMIN_RESOLVE: `${API_BASE}/admin/resolve`,
    ADMIN_ARCHIVE: `${API_BASE}/admin/archive`,
    ADMIN_AUDIT: `${API_BASE}/admin/audit`,
    ADMIN_USERS: `${API_BASE}/admin/users`,
};

// Initialize Tailwind config globally (fallback for utility classes; the
// signature components use custom CSS driven by css/styles.css tokens).
tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: CONFIG.theme.primary,
                "primary-strong": CONFIG.theme.primaryStrong,
                secondary: CONFIG.theme.secondary,
                accent: CONFIG.theme.accent,
                "on-surface": CONFIG.theme.text,
                "on-surface-variant": CONFIG.theme.textMuted,
                background: CONFIG.theme.background,
                "surface-container-high": CONFIG.theme.surfaceSunken,
                "surface-container": CONFIG.theme.surface,
                "inverse-surface": CONFIG.theme.secondary,
                error: CONFIG.theme.error,
            },
            fontFamily: {
                display: ["Fraunces", "serif"],
                body: ["Inter", "sans-serif"],
            },
        },
    },
};
