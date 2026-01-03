# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Klecks is an open-source online painting application that can run standalone (kleki.com) or embedded in drawing communities. It's a TypeScript/JavaScript canvas-based web app built with Parcel bundler.

## Build Commands

**Package manager**: Use `bun` (preferred) or `npm`

### Development
- `bun install` or `npm ci` - install dependencies
- `bun run lang:build` - generate language files (required before first run)
- `bun run start` - start dev server with hot reload (parcel serve)

### Build
- `bun run build` - build standalone into `/dist/`
- `bun run build:embed` - build embed version into `/dist/`
- `bun run build:help` - build help page into `/dist/`

### Language Management
- `bun run lang:build` - generate language files (TS/JSON from JSON5 sources)
- `bun run lang:build -- --missing` - generate and list missing translations
- `bun run lang:add <code>` - create new language file (ISO 639-1 code)
- Language files are in `src/languages/` as JSON5, generated into `src/app/languages/`
- English (`_base-en.json5`) is the source of truth

## Architecture

### Two Entry Points
1. **Standalone** (`src/index.html` → `src/app/script/main-standalone.ts`): Full app with file storage, recovery manager, IndexedDB
2. **Embed** (`src/embed.ts` → `src/app/script/main-embed.ts`): Embeddable widget for other sites, simplified functionality

Both instantiate `KlApp` which is the core application controller.

### Core Modules (src/app/script/)

**bb/** - "bitbof base" utility library
- `base/`: DOM helpers, canvas utilities, browser detection, storage wrappers
- `input/`: event handling (pointer, keyboard, gesture, touch)
- `math/`: Vec2, Matrix, line algorithms, Perlin noise
- `multi-polygon/`: selection geometry operations
- `transform/`: coordinate transforms and matrix operations

**klecks/** - Main painting application
- `kl.ts` / `kl-types.ts`: core types and project structure
- `canvas/`: KlCanvas (layer management, compositing)
- `brushes/` & `brushes-ui/`: drawing tools (pen, blend, sketchy, pixel, chemy, smudge, eraser)
- `history/`: undo/redo system (KlHistory, layer tiles, entry types)
- `filters/`: image filters (blur, curves, distort, noise, etc)
- `ui/`: UI components (toolspace, layers panel, modals, easel)
- `storage/`: project persistence (IndexedDB, PSD import/export, recovery)
- `select-tool/`: selection tool implementation
- `image-operations/`: transform, crop, resize, text rendering

**fx-canvas/** - WebGL-powered filters
- `filters/`: WebGL filter implementations
- `fx-canvas.ts`: WebGL context management

**app/** - Application layer
- `kl-app.ts`: main application controller connecting UI to KlCanvas
- `kl-app-select.ts`: selection tool integration
- `kl-app-import-handler.ts`: file import handling

**language/** - i18n system using generated TypeScript from JSON5

**theme/** - dark/light theme detection and switching

### Key Data Flow

1. User input → Easel tools (easel-brush, easel-hand, etc)
2. Tools manipulate KlCanvas (layer operations)
3. KlHistory tracks changes as history entries (layer tiles, composed states)
4. KlApp coordinates between UI components and canvas state
5. ProjectStore / IndexedDB handles persistence

### Important Patterns

- **Layer system**: KlCanvas manages layers, each with context, opacity, blend mode
- **History tiles**: Changes tracked as canvas tiles (not full layers) for efficiency
- **Event chains**: Input processing via chained event handlers (event-chain/)
- **Easel**: viewport/canvas interaction layer with tools
- **Two-pass rendering**: Selection uses multi-polygon geometry, rendered separately

## TypeScript Configuration

- Target: ESNext with bundler module resolution
- Strict mode enabled
- Located at `src/tsconfig.json`
- Excludes: `app/script/fx-canvas/filters/unused`, `languages/`

## Testing & Quality

No test framework is currently configured. Manual testing via dev server.

## Notes

- Embed examples in `/examples/embed/`
- PSD support via `ag-psd` library
- Uses Parcel transformer plugins for GLSL shaders (`@parcel/transformer-glsl`) and Sass
- Language files must be built before running - translations won't update otherwise
- Storage system uses IndexedDB with fallback behavior when unavailable
