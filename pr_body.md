feat: introduce new service architecture, flood fill, chromatic aberration filter, and Polish localization with new Procreate-style UI components and Canvaskit brush renderer

new file:   .claude/ralph-loop.local.md
	modified:   CLAUDE.md
	modified:   bun.lock
	modified:   package.json
	new file:   prompt.md
	new file:   src/app/img/ui/procreate/chromatic-aberration.svg
	modified:   src/app/languages/languages.ts
	new file:   src/app/languages/pl.json
	modified:   src/app/script/app/kl-app-events.ts
	modified:   src/app/script/app/kl-app.ts
	new file:   src/app/script/app/services/__tests__/brush-service.test.ts
	new file:   src/app/script/app/services/__tests__/service-container.test.ts
	new file:   src/app/script/app/services/brush-service.ts
	new file:   src/app/script/app/services/history-coordinator.ts
	new file:   src/app/script/app/services/index.ts
	new file:   src/app/script/app/services/layer-service.ts
	new file:   src/app/script/app/services/layout-service.ts
	new file:   src/app/script/app/services/service-container.ts
	new file:   src/app/script/app/services/tool-service.ts
	new file:   src/app/script/app/services/types.ts
	modified:   src/app/script/bb/bb-types.ts
	modified:   src/app/script/bb/input/pointer-listener.ts
	modified:   src/app/script/bb/math/perlin.ts
	new file:   src/app/script/canvaskit/canvaskit-brush-renderer.ts
	modified:   src/app/script/canvaskit/canvaskit-types.ts
	modified:   src/app/script/canvaskit/index.ts
	new file:   src/app/script/klecks/brushes-ui/brush-ui.types.ts
	modified:   src/app/script/klecks/brushes-ui/pen-brush-ui.ts
	new file:   src/app/script/klecks/brushes/__tests__/brush.interface.test.ts
	modified:   src/app/script/klecks/brushes/blend-brush.ts
	new file:   src/app/script/klecks/brushes/brush.interface.ts
	modified:   src/app/script/klecks/brushes/brushes.ts
	new file:   src/app/script/klecks/brushes/pen-brush-hybrid.ts
	modified:   src/app/script/klecks/brushes/pen-brush.ts
	modified:   src/app/script/klecks/brushes/smudge-brush.ts
	modified:   src/app/script/klecks/canvas/kl-canvas.ts
	modified:   src/app/script/klecks/filters/filter-bloom.ts
	modified:   src/app/script/klecks/filters/filter-chromatic-aberration.ts
	modified:   src/app/script/klecks/filters/filter-resize.ts
	modified:   src/app/script/klecks/filters/filters.ts
	new file:   src/app/script/klecks/image-operations/__tests__/flood-fill-async.test.ts
	new file:   src/app/script/klecks/image-operations/__tests__/flood-fill.test.ts
	new file:   src/app/script/klecks/image-operations/flood-fill-async.ts
	new file:   src/app/script/klecks/image-operations/flood-fill-worker.ts
	modified:   src/app/script/klecks/kl-types.ts
	modified:   src/app/script/klecks/select-tool/select-transform-tool.ts
	new file:   src/app/script/klecks/storage/__tests__/project-store.test.ts
	modified:   src/app/script/klecks/storage/project-store.ts
	modified:   src/app/script/klecks/ui/components/crop-copy.ts
	modified:   src/app/script/klecks/ui/components/cropper.ts
	modified:   src/app/script/klecks/ui/components/free-transform.ts
	modified:   src/app/script/klecks/ui/components/kl-color-slider-small.ts
	modified:   src/app/script/klecks/ui/components/kl-color-slider.ts
	modified:   src/app/script/klecks/ui/components/kl-slider.ts
	modified:   src/app/script/klecks/ui/components/point-slider.ts
	modified:   src/app/script/klecks/ui/components/procreate/floating-panel.ts
	modified:   src/app/script/klecks/ui/components/procreate/perspective-guide.ts
	modified:   src/app/script/klecks/ui/components/procreate/procreate-layout.ts
	modified:   src/app/script/klecks/ui/components/toolspace-scroller.ts
	modified:   src/app/script/klecks/ui/project-viewport/gpu-project-viewport.ts
	modified:   src/app/script/klecks/ui/tool-tabs/edit-ui.ts
	new file:   src/app/script/klecks/ui/tool-tabs/layers-ui/__tests__/layer-drag-controller.test.ts
	new file:   src/app/script/klecks/ui/tool-tabs/layers-ui/__tests__/layer-item.test.ts
	new file:   src/app/script/klecks/ui/tool-tabs/layers-ui/layer-drag-controller.ts
	new file:   src/app/script/klecks/ui/tool-tabs/layers-ui/layer-item.ts
	modified:   src/app/script/klecks/ui/tool-tabs/layers-ui/layers-ui.ts
	modified:   src/app/style/procreate.scss
	new file:   src/languages/pl.json5
	new file:   vitest.config.ts
	new file:   vitest.setup.ts

fix(input): Handle corrupted pointer state and add tests

- Add cleanupCorruptedPointer to PointerListener to recover from missing drag objects
- Resolve TODOs in pointermove, pointerup, and pointerleave handlers
- Add vitest setup for performance.timing
- Add unit tests for PointerListener corruption recovery

feat: improve blend mode handling, PSD compatibility, and CanvasKit GPU texture management

feat: Refine brush rendering updates, fix pointerup button, and add extensive test coverage for canvas, base utilities, and filters.

fix: validate and default save reminder setting from local storage

refactor: inject brush definitions into BrushService and remove unused filter localization strings.
