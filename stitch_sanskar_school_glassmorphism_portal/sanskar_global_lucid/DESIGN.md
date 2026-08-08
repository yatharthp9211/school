---
name: Sanskar Global Lucid
colors:
  surface: '#f5faff'
  surface-dim: '#c3def1'
  surface-bright: '#f5faff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eaf5ff'
  surface-container: '#def0ff'
  surface-container-high: '#d2ecff'
  surface-container-highest: '#cce6fa'
  on-surface: '#011e2d'
  on-surface-variant: '#3e4a3b'
  inverse-surface: '#193342'
  inverse-on-surface: '#e4f3ff'
  outline: '#6e7b6a'
  outline-variant: '#bdcab7'
  surface-tint: '#006e1d'
  primary: '#006b1c'
  on-primary: '#ffffff'
  primary-container: '#008726'
  on-primary-container: '#f7fff1'
  inverse-primary: '#64df6a'
  secondary: '#b22545'
  on-secondary: '#ffffff'
  secondary-container: '#fd5e79'
  on-secondary-container: '#64001d'
  tertiary: '#0f6b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#158700'
  on-tertiary-container: '#f8ffef'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#80fd83'
  primary-fixed-dim: '#64df6a'
  on-primary-fixed: '#002204'
  on-primary-fixed-variant: '#005314'
  secondary-fixed: '#ffdadc'
  secondary-fixed-dim: '#ffb2b9'
  on-secondary-fixed: '#400010'
  on-secondary-fixed-variant: '#91022f'
  tertiary-fixed: '#78ff5b'
  tertiary-fixed-dim: '#59e23f'
  on-tertiary-fixed: '#022100'
  on-tertiary-fixed-variant: '#095300'
  background: '#f5faff'
  on-background: '#011e2d'
  surface-variant: '#cce6fa'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Montserrat
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is engineered for a school environment where trust, safety, and modern communication are paramount. The identity balances the institutional prestige of a global school with the accessibility required for a student-centric anonymous complaint portal.

The visual style is **Modern Glassmorphism**. This aesthetic utilizes translucent layers and depth to create a sense of "transparency"—symbolizing the openness and honesty of the reporting system. By using frosted glass effects and soft background blurs, the UI feels lightweight and non-intimidating. This atmosphere encourages students to speak up by providing a digital space that feels high-tech, safe, and distinctly contemporary.

## Colors

The palette is rooted in a professional "Forest and Crimson" scheme that mirrors institutional authority while maintaining high-energy accents for student engagement.

- **Primary & Navigation**: A deep emerald green represents growth and safety.
- **Accent/CTA**: Crimson Red is reserved for critical actions, such as submitting a final report or highlighting urgent alerts.
- **Highlights**: A bright, vibrant green is used for success states and progress indicators.
- **Surfaces**: The system relies on a base of White and Light Cyan. These are treated with varying opacities (60% to 80%) to achieve the glass effect against a subtle gradient background.

## Typography

This design system utilizes a dual-font strategy. **Montserrat** provides a bold, geometric authority for headings, ensuring that the school's identity feels structured and modern. **Inter** is used for all functional text and body copy due to its exceptional legibility at small sizes and its neutral, systematic tone.

For glassmorphism, typography must maintain high contrast against translucent backgrounds. Headings should always use the darkest ink (`#172b3f`), while body text uses a slightly softer slate (`#2f4858`) to reduce visual fatigue during longer reading sessions.

## Layout & Spacing

The design system employs a **Fluid Grid** model with generous white space to prevent the glass elements from feeling cluttered.

- **Desktop**: A 12-column grid with 24px gutters. Content is housed in a centered container maxing out at 1200px.
- **Mobile**: A 4-column grid with 16px margins. 
- **Rhythm**: All spacing (padding, margins, gap) follows an 8px base unit. 

Because glassmorphism relies on background visibility, layout containers should have wide margins (minimum 32px) from the edges of the viewport to allow the underlying background gradients to "peek" through, enhancing the depth effect.

## Elevation & Depth

Depth is achieved through the intersection of light and transparency rather than heavy black shadows.

1.  **Backdrop Blur**: Every glass surface must apply a `backdrop-filter: blur(12px)`.
2.  **Translucency**: Surface backgrounds use white with 70% opacity (`rgba(255, 255, 255, 0.7)`).
3.  **Glass Borders**: A 1px solid border is applied to all cards using a semi-transparent white (`rgba(255, 255, 255, 0.4)`). This creates a "specular highlight" effect on the edges.
4.  **Ambient Shadows**: Use very soft, large-radius shadows with a hint of the background color (e.g., `rgba(23, 43, 63, 0.08)`).
5.  **Z-Index Layers**: 
    - *Level 1 (Base)*: Subtle mesh gradient of Light Cyan and White.
    - *Level 2 (Cards)*: Frosted glass containers.
    - *Level 3 (Modals/Popovers)*: Higher blur (20px) and a brighter white border.

## Shapes

The shape language is friendly and organic. This design system uses "Rounded" corners (0.5rem base) to soften the UI, making the school environment feel approachable and less "bureaucratic." 

Larger containers like primary cards and the main complaint submission area should use `rounded-xl` (1.5rem) to emphasize the soft, modern aesthetic of glassmorphism. Avoid sharp 90-degree angles entirely, as they conflict with the "soft" nature of frosted glass.

## Components

### Glass Cards
The primary container for content. Features 70% opacity white background, 12px backdrop blur, 1.5rem corner radius, and a 1px internal white border.

### Frosted Navigation Bar
Sticky to the top of the viewport. Use a lower opacity (50%) and higher blur (16px) to allow content to scroll underneath while remaining legible. Navigation links use the Primary Green (`#079a2e`) with a subtle glow effect on hover.

### Input Fields
Inputs are semi-transparent with a 1px border that shifts from white to Primary Green on focus. The background is a very faint `rgba(228, 250, 255, 0.5)` (Light Cyan) to provide a clear hit-target.

### Buttons
- **Primary**: Solid Primary Green or Crimson Red with a subtle outer glow (box-shadow) of the same color at 30% opacity.
- **Ghost/Glass**: Transparent background with a 2px white border. Used for secondary actions like "Cancel" or "Save Draft."

### Success & Status Chips
Pill-shaped elements using the Highlight Green (`#25b509`) for "Resolved" or "Received" statuses. These should have a slight "inner glow" to appear like polished glass beads.

### Anonymous Toggle
A prominent, stylized switch using the Secondary Red for "Anonymous" and Primary Green for "Visible," ensuring students are clear on their privacy status at a glance.