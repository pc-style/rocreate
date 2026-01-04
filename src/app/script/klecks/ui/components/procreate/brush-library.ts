import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import penBrushImg from 'url:/src/app/img/ui/brush-pen.svg';
import blendBrushImg from 'url:/src/app/img/ui/brush-blend.svg';
import sketchyBrushImg from 'url:/src/app/img/ui/brush-sketchy.png';
import pixelBrushImg from 'url:/src/app/img/ui/brush-pixel.svg';
import chemyBrushImg from 'url:/src/app/img/ui/brush-chemy.svg';

// ============================================================================
// Types
// ============================================================================

/**
 * A category of brushes in the library.
 */
export interface TBrushCategory {
    /** Unique category identifier */
    id: string;
    /** Display name for the category */
    name: string;
    /** Optional icon URL for the category */
    icon?: string;
    /** Brushes in this category */
    brushes: TBrushItem[];
}

/**
 * A single brush item in the library.
 */
export interface TBrushItem {
    /** Brush engine identifier (e.g., 'penBrush', 'sketchyBrush') */
    id: string;
    /** Display name for the brush */
    name: string;
    /** Optional preview image URL */
    image?: string;
    /** Brush-specific configuration */
    settings?: TBrushSettings;
}

/** Available brush shape types */
export type TBrushShape = 'circle' | 'square' | 'chalk' | 'calligraphy';

/**
 * Procreate-style brush settings configuration.
 * These settings customize how a brush behaves.
 */
export interface TBrushSettings {
    // Shape settings
    /** Brush tip shape */
    shape?: TBrushShape;
    /** Spacing between dabs (0.01 - 2.0, lower = denser) */
    spacing?: number;
    /** Random offset amount (0 - 1) */
    scatter?: number;

    // Pressure curve
    /** Enable pressure-to-size mapping */
    sizePressure?: boolean;
    /** Enable pressure-to-opacity mapping */
    opacityPressure?: boolean;

    // Tilt dynamics (Procreate style)
    /** How much tilt affects brush angle (0 - 1) */
    tiltToAngle?: number;
    /** How much tilt affects brush size (0 - 1) */
    tiltToSize?: number;
    /** How much tilt affects opacity (0 - 1) */
    tiltToOpacity?: number;

    // Grain settings (for textured brushes)
    /** Grain texture scale (0.1 - 4.0) */
    grainScale?: number;
    /** Grain texture opacity (0 - 1) */
    grainOpacity?: number;
}

/**
 * Parameters for creating a BrushLibrary instance.
 */
export interface TBrushLibraryParams {
    /** Callback when a brush is selected */
    onBrushSelect: (brushId: string) => void;
    /** Currently selected brush ID */
    currentBrushId: string;
    /** Current tool type to filter relevant brushes */
    currentToolType: 'brush' | 'smudge' | 'eraser';
}

// Comprehensive Procreate-style brush categories
const BRUSH_CATEGORIES: TBrushCategory[] = [
    {
        id: 'recent',
        name: 'Recent',
        brushes: [
            { id: 'penBrush', name: 'Pen', image: penBrushImg },
        ],
    },
    {
        id: 'sketching',
        name: 'Sketching',
        brushes: [
            {
                id: 'sketchyBrush',
                name: '6B Pencil',
                image: sketchyBrushImg,
                settings: {
                    shape: 'chalk',
                    spacing: 0.05,
                    sizePressure: true,
                    opacityPressure: true,
                    tiltToSize: 0.5,
                    tiltToOpacity: 0.3,
                }
            },
            {
                id: 'penBrush',
                name: 'Derwent',
                image: penBrushImg,
                settings: {
                    shape: 'circle',
                    spacing: 0.1,
                    sizePressure: true,
                    opacityPressure: true,
                    tiltToAngle: 0.7,
                }
            },
            {
                id: 'sketchyBrush',
                name: 'HB Pencil',
                image: sketchyBrushImg,
                settings: {
                    shape: 'chalk',
                    spacing: 0.08,
                    sizePressure: true,
                    tiltToSize: 0.3,
                }
            },
        ],
    },
    {
        id: 'inking',
        name: 'Inking',
        brushes: [
            {
                id: 'penBrush',
                name: 'Studio Pen',
                image: penBrushImg,
                settings: {
                    shape: 'circle',
                    spacing: 0.05,
                    sizePressure: true,
                    opacityPressure: false,
                }
            },
            {
                id: 'penBrush',
                name: 'Technical Pen',
                image: penBrushImg,
                settings: {
                    shape: 'circle',
                    spacing: 0.1,
                    sizePressure: false,
                    opacityPressure: false,
                }
            },
            {
                id: 'penBrush',
                name: 'Syrup',
                image: penBrushImg,
                settings: {
                    shape: 'circle',
                    spacing: 0.02,
                    sizePressure: true,
                    opacityPressure: true,
                }
            },
            {
                id: 'penBrush',
                name: 'Gel Pen',
                image: penBrushImg,
                settings: {
                    shape: 'circle',
                    spacing: 0.08,
                    sizePressure: true,
                }
            },
        ],
    },
    {
        id: 'drawing',
        name: 'Drawing',
        brushes: [
            {
                id: 'sketchyBrush',
                name: 'Charcoal',
                image: sketchyBrushImg,
                settings: {
                    shape: 'chalk',
                    spacing: 0.05,
                    sizePressure: true,
                    opacityPressure: true,
                    tiltToSize: 0.8,
                    grainScale: 1.2,
                }
            },
            {
                id: 'sketchyBrush',
                name: 'Compressed',
                image: sketchyBrushImg,
                settings: {
                    shape: 'chalk',
                    spacing: 0.03,
                    tiltToOpacity: 0.5,
                }
            },
        ],
    },
    {
        id: 'painting',
        name: 'Painting',
        brushes: [
            {
                id: 'blendBrush',
                name: 'Round Brush',
                image: blendBrushImg,
                settings: {
                    shape: 'circle',
                    spacing: 0.1,
                    sizePressure: true,
                    opacityPressure: true,
                }
            },
            {
                id: 'blendBrush',
                name: 'Flat Brush',
                image: blendBrushImg,
                settings: {
                    shape: 'square',
                    spacing: 0.15,
                    sizePressure: true,
                    tiltToAngle: 1,
                }
            },
            {
                id: 'blendBrush',
                name: 'Oil Paint',
                image: blendBrushImg,
                settings: {
                    shape: 'circle',
                    spacing: 0.08,
                    sizePressure: true,
                    grainScale: 0.8,
                }
            },
            {
                id: 'chemyBrush',
                name: 'Acrylic',
                image: chemyBrushImg,
                settings: {
                    shape: 'circle',
                    spacing: 0.12,
                }
            },
        ],
    },
    {
        id: 'artistic',
        name: 'Artistic',
        brushes: [
            {
                id: 'chemyBrush',
                name: 'Alchemy',
                image: chemyBrushImg
            },
            {
                id: 'blendBrush',
                name: 'Soft Blend',
                image: blendBrushImg
            },
        ],
    },
    {
        id: 'airbrushing',
        name: 'Airbrushing',
        brushes: [
            {
                id: 'blendBrush',
                name: 'Soft Airbrush',
                image: blendBrushImg,
                settings: {
                    shape: 'circle',
                    spacing: 0.05,
                    sizePressure: true,
                    opacityPressure: true,
                }
            },
            {
                id: 'blendBrush',
                name: 'Hard Airbrush',
                image: blendBrushImg,
                settings: {
                    shape: 'circle',
                    spacing: 0.08,
                    sizePressure: true,
                }
            },
        ],
    },
    {
        id: 'calligraphy',
        name: 'Calligraphy',
        brushes: [
            {
                id: 'penBrush',
                name: 'Monoline',
                image: penBrushImg,
                settings: {
                    shape: 'circle',
                    spacing: 0.05,
                    sizePressure: false,
                }
            },
            {
                id: 'penBrush',
                name: 'Brush Pen',
                image: penBrushImg,
                settings: {
                    shape: 'calligraphy',
                    spacing: 0.05,
                    sizePressure: true,
                    tiltToAngle: 0.8,
                }
            },
            {
                id: 'penBrush',
                name: 'Script',
                image: penBrushImg,
                settings: {
                    shape: 'calligraphy',
                    spacing: 0.03,
                    sizePressure: true,
                }
            },
        ],
    },
    {
        id: 'textures',
        name: 'Textures',
        brushes: [
            {
                id: 'sketchyBrush',
                name: 'Noise',
                image: sketchyBrushImg,
                settings: {
                    scatter: 0.5,
                    grainScale: 2.0,
                }
            },
            {
                id: 'sketchyBrush',
                name: 'Grunge',
                image: sketchyBrushImg,
                settings: {
                    scatter: 0.3,
                    grainScale: 1.5,
                }
            },
        ],
    },
    {
        id: 'pixel',
        name: 'Pixel Art',
        brushes: [
            {
                id: 'pixelBrush',
                name: 'Pixel',
                image: pixelBrushImg,
                settings: {
                    shape: 'square',
                    spacing: 1,
                    sizePressure: false,
                }
            },
        ],
    },
];

/**
 * Procreate-style Brush Library
 * Two-column layout: categories on left, brushes on right
 */
export class BrushLibrary {
    private readonly rootEl: HTMLElement;
    private readonly categoriesEl: HTMLElement;
    private readonly brushesEl: HTMLElement;
    private selectedCategoryId: string = 'sketching';
    private selectedBrushId: string;
    private readonly onBrushSelect: TBrushLibraryParams['onBrushSelect'];
    private currentToolType: TBrushLibraryParams['currentToolType'];

    constructor(p: TBrushLibraryParams) {
        this.onBrushSelect = p.onBrushSelect;
        this.selectedBrushId = p.currentBrushId;
        this.currentToolType = p.currentToolType;

        this.rootEl = BB.el({
            className: 'procreate-brush-library',
        });

        const container = BB.el({
            className: 'procreate-brush-library__container',
        });

        // Left column: categories
        this.categoriesEl = BB.el({
            className: 'procreate-brush-library__categories',
        });

        // Right column: brushes
        this.brushesEl = BB.el({
            className: 'procreate-brush-library__brushes',
        });

        container.append(this.categoriesEl, this.brushesEl);
        this.rootEl.append(container);

        this.renderCategories();
        this.renderBrushes(this.selectedCategoryId);
    }

    private renderCategories(): void {
        this.categoriesEl.innerHTML = '';

        BRUSH_CATEGORIES.forEach((category) => {
            const categoryEl = BB.el({
                className: 'procreate-brush-library__category' +
                    (category.id === this.selectedCategoryId ? ' procreate-brush-library__category--active' : ''),
                textContent: category.name,
            });

            // Category icon (optional)
            if (category.icon) {
                const iconEl = BB.el({
                    className: 'procreate-brush-library__category-icon',
                    css: {
                        backgroundImage: `url('${category.icon}')`,
                    },
                });
                categoryEl.prepend(iconEl);
            }

            categoryEl.addEventListener('click', () => {
                this.selectedCategoryId = category.id;
                this.renderCategories();
                this.renderBrushes(category.id);
            });

            this.categoriesEl.append(categoryEl);
        });
    }

    private renderBrushes(categoryId: string): void {
        this.brushesEl.innerHTML = '';

        const category = BRUSH_CATEGORIES.find((c) => c.id === categoryId);
        if (!category) return;

        category.brushes.forEach((brush) => {
            const brushEl = BB.el({
                className: 'procreate-brush-library__brush' +
                    (brush.id === this.selectedBrushId ? ' procreate-brush-library__brush--active' : ''),
            });

            // Brush name
            const nameEl = BB.el({
                className: 'procreate-brush-library__brush-name',
                textContent: brush.name,
            });

            // Brush preview (stroke sample) - simplified for now
            const previewEl = BB.el({
                className: 'procreate-brush-library__brush-preview',
            });

            if (brush.image) {
                previewEl.style.backgroundImage = `url('${brush.image}')`;
            }

            brushEl.append(nameEl, previewEl);

            brushEl.addEventListener('click', () => {
                this.selectedBrushId = brush.id;
                this.renderBrushes(categoryId);
                this.onBrushSelect(brush.id);
            });

            this.brushesEl.append(brushEl);
        });
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setSelectedBrush(brushId: string): void {
        this.selectedBrushId = brushId;
        this.renderBrushes(this.selectedCategoryId);
    }

    setToolType(toolType: 'brush' | 'smudge' | 'eraser'): void {
        this.currentToolType = toolType;
    }

    /**
     * Get the brush settings for a specific brush
     */
    static getBrushSettings(brushName: string): TBrushSettings | undefined {
        for (const category of BRUSH_CATEGORIES) {
            const brush = category.brushes.find(b => b.name === brushName);
            if (brush?.settings) {
                return brush.settings;
            }
        }
        return undefined;
    }

    destroy(): void {
        this.rootEl.remove();
    }
}
