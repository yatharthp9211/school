---
colors:
  primary: "#0E6B45"      # Emerald
  secondary: "#C6A15B"    # Gold
  background: "#FAF7F2"   # Ivory
  surface: "#FFFFFF"
  text: "#1B2530"         # Ink
  danger: "#B3423E"
typography:
  display: "Fraunces, Georgia, serif"
  body: "Inter, -apple-system, sans-serif"
spacing:
  base: "4px"
  nav_height: "68px"
radii:
  sm: "8px"
  md: "12px"
  lg: "18px"
  pill: "999px"
shadows:
  sm: "0 1px 2px rgba(27, 37, 48, 0.04)"
  md: "0 4px 12px -2px rgba(27, 37, 48, 0.08)"
  lg: "0 14px 34px -10px rgba(27, 37, 48, 0.16)"
---

# Design System

## Overview

The Democrate application embraces an "Editorial Prestige" visual identity. The UI feels academic, authoritative, yet modern and accessible. It uses high-contrast serif typography for headings to convey importance, paired with clean sans-serif for readability.

## Colors

- **Emerald (`#0E6B45`)**: Used for primary actions, success states, and branding.
- **Gold (`#C6A15B`)**: Used for accents, warnings, and highlighting key UI elements (like teacher rankings).
- **Ivory (`#FAF7F2`)**: The primary background color, providing a warm, paper-like feel to reduce eye strain compared to harsh whites.
- **Ink (`#1B2530`)**: High-contrast dark blue/black for primary text.

## Typography

- **Display Font (`Fraunces`)**: Used for all major headings (`h1`, `h2`), dashboard titles, and brand logos. Conveys academic prestige.
- **Body Font (`Inter`)**: Used for complaint text, UI buttons, and navigation. Highly legible at small sizes.

## Layout & Spacing

- The application uses a standard 8px grid system for padding and margins.
- **Navigation Bar**: Fixed at `68px` height.
- Content is centrally constrained with generous horizontal padding on mobile to ensure readability.

## Elevation & Depth

- **Sunken Surfaces**: Used for backgrounds.
- **Elevated Cards**: Used for complaints and leaderboard rows. Shadows are warm-tinted (`rgba(27, 37, 48, x)`) to blend naturally with the Ivory background.

## Shapes

- **Cards & Modals**: Soft corners (`12px` to `18px` radii).
- **Buttons & Tags**: Fully rounded pill shapes (`999px` radius) for primary actions to distinguish them from content cards.

## Components

- **Buttons**: Must use the Emerald solid color for primary actions, or a soft Emerald background for secondary actions.
- **Complaint Cards**: Should have a white surface, slight drop shadow, and display the AI category as a distinct pill badge.
- **Leaderboard Rows**: Should highlight the top 3 teachers using the Gold accent color.

## Do's and Don'ts

- **DO** use the Fraunces font for all major titles.
- **DO** use the Ivory background to maintain the academic feel.
- **DON'T** use harsh generic colors like pure red (`#FF0000`); use the designated `--color-danger` (`#B3423E`).
- **DON'T** remove the pill-radius from primary action buttons.

---
