# Procreate UI Design System

This document describes the design system used to recreate Procreate's iPad UI as closely as possible.

## Design Token Reference

All design values are centralized in `/src/app/style/procreate-tokens.scss`. 

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `$procreate-bg-primary` | `#1a1a1c` | Main background, canvas area |
| `$procreate-bg-secondary` | `#2c2c2e` | Panel backgrounds, buttons |
| `$procreate-bg-tertiary` | `#3a3a3c` | Hover states, active buttons |
| `$procreate-accent-blue` | `#0a84ff` | Selection highlights, active states |
| `$procreate-text-primary` | `rgba(255,255,255,0.95)` | Primary text |
| `$procreate-text-secondary` | `rgba(255,255,255,0.55)` | Labels, secondary text |

### Spacing Scale

Based on a 4px grid system:
- `xxs`: 2px
- `xs`: 4px
- `sm`: 8px
- `md`: 12px
- `lg`: 16px
- `xl`: 20px
- `xxl`: 24px

### Border Radii

| Token | Value | Usage |
|-------|-------|-------|
| `$procreate-radius-xs` | 4px | Small buttons, inputs |
| `$procreate-radius-sm` | 6px | Toolbar buttons |
| `$procreate-radius-md` | 10px | Panel buttons, cards |
| `$procreate-radius-lg` | 14px | Floating panels |

### Typography

- **Font Family**: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif`
- **Font Sizes**: 11px (labels), 13px (body), 14px (titles), 15px (gallery), 17px (headers)
- **Font Weights**: 400 (regular), 500 (medium), 600 (semibold)

## Component Structure

### Top Bar (`top-bar.ts`)

**Layout Order:**
- **LEFT**: Gallery (text) → Actions (Wrench) → Adjustments (Wand) → Selection → Transform
- **RIGHT**: Paint (Brush) → Smudge → Erase → [separator] → Layers → Color (circle)

**Dimensions:**
- Height: 44px
- Button size: 38px × 38px
- Icon size: 22px × 22px
- Color button: 30px diameter
- Gap between buttons: 2px

### Side Bar (`side-bar.ts`)

**Layout Order (top to bottom):**
1. Size preview circle (shows current brush size)
2. Size slider with +/- buttons
3. Modify button (brush settings square)
4. Opacity slider with +/- buttons
5. Undo / Redo stacked arrows

**Dimensions:**
- Width: 44px
- Slider height: 140px
- Slider track width: 4px
- Button size: 28px × 28px
- Offset from left edge: 12px

### Floating Panel (`floating-panel.ts`)

**Features:**
- Dark translucent glassmorphism background
- Draggable header with grab cursor
- Close button (X) in header
- Click-outside-to-close behavior
- Constrained to viewport bounds
- Anchored below toolbar buttons

**Dimensions:**
- Min width: 280px
- Max width: 400px
- Header height: 40px
- Body padding: 16px
- Max height: 85vh

## Icon Guidelines

All icons follow these specifications:
- **Viewbox**: 24 × 24
- **Stroke width**: 1.75 (consistent across all icons)
- **Stroke caps**: Round
- **Stroke joins**: Round
- **Fill**: None (outline-only style)
- **Color**: Uses `currentColor` for CSS theming

### Icon List

| Category | Icons |
|----------|-------|
| Tools | brush, eraser, smudge, pencil, bucket, picker |
| Panels | layers, wrench, wand, selection, transform |
| Actions | undo, cancel, check, copy, share, export, import |
| Layers | add-layer, duplicate-layer, remove-layer, merge-layers |
| Edit | crop, flip, rotate, resize, new-image |

## Usage

### Activating Procreate Mode

```typescript
import { ProcreateLayout } from './components/procreate';

const layout = new ProcreateLayout({
    rootEl: document.body,
    // ... other params
});

layout.activate();  // Show Procreate UI
layout.deactivate(); // Hide and show default UI
```

### UI Parity Debug

Press `Ctrl+Shift+P` to open the UI Parity Debug screen, which displays:
- All color tokens with swatches
- Complete icon library
- Component samples (buttons, sliders)
- Typography scale

Use this to verify visual parity with real Procreate.

## CSS Custom Properties

For runtime theming, CSS custom properties are also available:

```css
:root {
    --pc-bg-primary: #1a1a1c;
    --pc-accent: #0a84ff;
    --pc-text-primary: rgba(255, 255, 255, 0.95);
    /* ... see procreate-tokens.scss for full list */
}
```

## Responsive Behavior

- **768px and below**: Compact top bar height (40px), smaller buttons
- **600px height and below**: Shorter sliders, hidden size preview

## File Organization

```
src/app/
├── img/ui/procreate/        # SVG icons
├── style/
│   ├── procreate-tokens.scss  # Design tokens (source of truth)
│   └── procreate.scss         # Component styles
└── script/klecks/ui/components/procreate/
    ├── index.ts               # Barrel exports
    ├── top-bar.ts             # Top toolbar
    ├── side-bar.ts            # Left sidebar with sliders
    ├── floating-panel.ts      # Draggable popup panels
    ├── procreate-layout.ts    # Layout controller
    └── ui-parity-debug.ts     # Debug/testing screen
```
