import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import penBrushImg from 'url:/src/app/img/ui/brush-pen.svg';
import blendBrushImg from 'url:/src/app/img/ui/brush-blend.svg';
import sketchyBrushImg from 'url:/src/app/img/ui/brush-sketchy.png';
import pixelBrushImg from 'url:/src/app/img/ui/brush-pixel.svg';
import chemyBrushImg from 'url:/src/app/img/ui/brush-chemy.svg';

export type TBrushCategory = {
    id: string;
    name: string;
    icon?: string;
    brushes: TBrushItem[];
};

export type TBrushItem = {
    id: string;
    name: string;
    image?: string;
};

export type TBrushLibraryParams = {
    onBrushSelect: (brushId: string) => void;
    currentBrushId: string;
    currentToolType: 'brush' | 'smudge' | 'eraser';
};

// Define brush categories like Procreate
const BRUSH_CATEGORIES: TBrushCategory[] = [
    {
        id: 'recent',
        name: 'Recent',
        brushes: [
            { id: 'penBrush', name: 'Pen', image: penBrushImg },
        ],
    },
    {
        id: 'pencils',
        name: 'Pencils',
        brushes: [
            { id: 'sketchyBrush', name: 'Sketchy', image: sketchyBrushImg },
        ],
    },
    {
        id: 'pens',
        name: 'Pens',
        brushes: [
            { id: 'penBrush', name: 'Pen Brush', image: penBrushImg },
        ],
    },
    {
        id: 'inks',
        name: 'Inks',
        brushes: [
            { id: 'penBrush', name: 'Ink Pen', image: penBrushImg },
        ],
    },
    {
        id: 'markers',
        name: 'Markers',
        brushes: [
            { id: 'blendBrush', name: 'Blend Marker', image: blendBrushImg },
        ],
    },
    {
        id: 'artistic',
        name: 'Artistic',
        brushes: [
            { id: 'chemyBrush', name: 'Chemy', image: chemyBrushImg },
            { id: 'blendBrush', name: 'Blend', image: blendBrushImg },
        ],
    },
    {
        id: 'pixel',
        name: 'Pixel Art',
        brushes: [
            { id: 'pixelBrush', name: 'Pixel', image: pixelBrushImg },
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
    private selectedCategoryId: string = 'recent';
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

    destroy(): void {
        this.rootEl.remove();
    }
}
