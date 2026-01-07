# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Klecks is an open-source online painting application (TypeScript/JavaScript). It uses Parcel for bundling and CanvasKit for GPU-accelerated rendering. It can run as a standalone app (kleki.com) or as an embedded widget.

## Development Commands

- `bun run start` - Start dev server (standalone)
- `bun run dev` - Start dev server with `DEV_MODE=true` and HMR
- `bun run build` - Build standalone for production
- `bun run build:embed` - Build embed version
- `bun run lang:build` - **Required**: Generate language files from JSON5
- `bun run lang:add <code>` - Create a new language file
- `bun run lang:sync` - Sync language files with English base
- `docker-compose up -d` - Run standalone in Docker (port 5050)

## Architecture & Structure

### Core Components
- `KlApp` (`src/app/script/app/kl-app.ts`): Central controller. Connects UI, canvas, and history.
- `KlCanvas` (`src/app/script/klecks/canvas/kl-canvas.ts`): Manages layers, compositing, and pixel data.
- `Easel` (`src/app/script/klecks/ui/easel/`): Handles the viewport, zoom/pan, and tool interactions (brushes, shapes, etc.).
- `KlHistory` (`src/app/script/klecks/history/`): Tile-based undo/redo system. Stores changes as efficient deltas.
- `CanvasKit` (`src/app/script/canvaskit/`): GPU-accelerated rendering and compositing layer.

### Directory Map
- `src/app/script/bb/`: "Bitbof Base" utility library (input, math, transforms).
- `src/app/script/klecks/`: Main logic for brushes, filters, UI components, and storage.
- `src/app/script/fx-canvas/`: WebGL filter implementations.
- `src/languages/`: JSON5 translation sources.

### Data Flow & Patterns
- **Input Processing**: Uses chained event handlers (`event-chain/`) for pointer and touch input.
- **Rendering**: Two-pass approach. Main canvas for painting, separate layer for UI/selections.
- **Storage**: IndexedDB-based persistence with fallback. Supports PSD export via `ag-psd`.
- **i18n**: JSON5 sources are compiled into TypeScript/JSON in `src/app/languages/`. Always run `lang:build` after editing translations.

## Coding Guidelines

- **Style**: Use project-specific conventions. Prefer clarity and minimalism.
- **Comments**: Minimal, plain language. Avoid AI-like verbosity.
- **Tools**: Use `bun` for package management and `gt` (Graphite) for branch/stack management.
- **Testing**: Manual testing via dev server is currently the primary method.
