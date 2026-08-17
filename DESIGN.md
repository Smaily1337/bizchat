---
name: Automovia Core
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b4b4'
  tertiary: '#ffffff'
  on-tertiary: '#2f3131'
  tertiary-container: '#e2e2e2'
  on-tertiary-container: '#636565'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Fira Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style
The design system embodies "Architectural Liquidity"—a fusion of structural solidity and ethereal glass effects. It is engineered for high-end technical environments, evoking a sense of precision, premium craftsmanship, and deep-space engineering. 

The aesthetic leverages **Dark Glassmorphism** and **Tech Monochrome**. Interfaces should feel like looking through polished obsidian or floating panels in a high-tech cockpit. Use 3D abstract dark glass objects as environmental decor to provide depth without color interference. The emotional response is one of calm, focused authority and cutting-edge technological sophistication.

## Colors
The palette is strictly monochromatic to emphasize form, texture, and light. 
- **Void Black (#0A0A0A):** The infinite canvas. Used for the primary background to eliminate visual noise.
- **Graphite Surface (#161616):** Used for non-glass containers and subtle UI grounding.
- **Pure White (#FFFFFF):** Reserved for high-impact headers and primary actions.
- **Frost White (#EDEDED):** The standard text color, providing high legibility while reducing eye strain against the black background.
- **Glass Tint:** 3% opacity white creates the "liquid" surface effect when combined with heavy background blurs.

## Typography
Typography is a critical structural element. **Geist** provides the clean, modern architectural frame for all headings and primary body copy. For technical readouts, telemetry, or system data, **JetBrains Mono** (or Fira Code) is utilized to reinforce the "engineered" persona.

Headers should use tight letter-spacing to appear like solid blocks. Data labels should always be in uppercase with increased tracking for maximum clarity at small sizes.

## Layout & Spacing
The system utilizes a 12-column fluid grid on desktop with generous margins to create an "airy" premium feel. 

- **Desktop:** 64px side margins, 24px gutters.
- **Tablet:** 40px side margins, 20px gutters.
- **Mobile:** 20px side margins, 16px gutters.

Spacing follows an 8px linear scale. Use larger gaps (64px+) between major sections to allow the glass elements to "breathe" against the Void Black background.

## Elevation & Depth
Depth is not achieved through shadows, but through **refraction and transparency**.

1.  **Level 1 (Base):** Void Black background.
2.  **Level 2 (Panels):** Glass cards with a 16px `backdrop-filter: blur()`.
3.  **Level 3 (Interactive):** Floating elements with a slightly higher background tint (6% white) and an inner "top-lit" white border (0.5px) to simulate a light source catching the edge of the glass.

Avoid drop shadows entirely; they muddy the dark aesthetic. Use subtle outer glows (white, 5% opacity) only for active states.

## Shapes
The shape language is "Soft Industrial." Everything follows a disciplined 4px (Soft) radius. This provides just enough curvature to feel modern and premium while maintaining the architectural rigidity required by the brand. 

Interactive elements like buttons or small chips may use the `rounded-lg` (8px) variant to feel more tactile, but primary layout containers must stay at 4px.

## Components

### Glass Cards
The signature component. 
- **Background:** `rgba(255, 255, 255, 0.03)`
- **Blur:** 16px Backdrop Filter.
- **Border:** 1px solid `rgba(255, 255, 255, 0.12)`. Apply a linear gradient to the border (Top-Left: White 20%, Bottom-Right: Transparent) to create a "top-lit" effect.

### Buttons
- **Primary:** Solid White background, Black text. No radius (0px) to contrast against glass elements.
- **Secondary:** Ghost style. Transparent background, 1px White border.
- **Tertiary:** Text only, JetBrains Mono, with an underline on hover.

### Inputs
Fields should be dark and recessed. 
- **Background:** `#161616`.
- **Border:** Bottom-only 1px white border for a minimal, architectural look.
- **Focus:** The border expands to 2px; text glows slightly.

### Telemetry Lists
Used for displaying technical data.
- **Style:** Zebra-striping using `#161616` at 50% opacity. 
- **Font:** JetBrains Mono. 
- **Alignment:** Right-aligned numeric data to ensure vertical scanning.

### Status Indicators
Monochrome status markers.
- **Active:** Pulsing white dot.
- **Inactive/Standby:** Hollow white circle (1px stroke).
- **Critical:** Solid white circle with high-frequency strobe animation.