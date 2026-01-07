import { BB } from '../../../../bb/bb';
import { KlSlider } from '../../components/kl-slider';
import { Select } from '../../components/select';
import { Checkbox } from '../../components/checkbox';
import { TabRow } from '../../components/tab-row';
import { LANG } from '../../../../language/language';
import { css } from '../../../../bb/base/base';
import { TBrushSettings, TBrushShape } from './brush-library';

export type TBrushStudioParams = {
    settings: TBrushSettings;
    brushName: string;
    onChange: (settings: TBrushSettings) => void;
    onClose: () => void;
};

/**
 * Procreate-style Brush Studio
 * Full-screen modal for deep brush customization with tabbed sections.
 */
export class BrushStudio {
    private readonly rootEl: HTMLElement;
    private settings: TBrushSettings;
    private readonly onChange: TBrushStudioParams['onChange'];
    private previewCanvas: HTMLCanvasElement;
    private previewCtx: CanvasRenderingContext2D;

    constructor(p: TBrushStudioParams) {
        this.settings = { ...p.settings };
        this.onChange = p.onChange;

        // Full-screen overlay
        this.rootEl = BB.el({
            className: 'brush-studio',
            css: {
                position: 'fixed',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
                zIndex: '2000',
                display: 'flex',
                flexDirection: 'column',
                color: '#fff',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            },
        });

        // Header
        const header = this.createHeader(p.brushName, p.onClose);
        this.rootEl.append(header);

        // Main content
        const content = BB.el({
            css: {
                flex: '1',
                display: 'flex',
                flexDirection: 'row',
                gap: '24px',
                padding: '24px',
                overflow: 'hidden',
            },
        });

        // Left: Preview
        const previewSection = this.createPreviewSection();
        content.append(previewSection);

        // Right: Tabbed settings
        const settingsSection = this.createSettingsSection();
        content.append(settingsSection);

        this.rootEl.append(content);

        // Initialize preview
        this.previewCanvas = previewSection.querySelector('canvas')!;
        this.previewCtx = BB.ctx(this.previewCanvas);
        this.updatePreview();
    }

    private createHeader(brushName: string, onClose: () => void): HTMLElement {
        const header = BB.el({
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.3)',
            },
        });

        BB.el({
            parent: header,
            content: LANG('brush-studio'),
            css: { fontSize: '18px', fontWeight: '600' },
        });

        BB.el({
            parent: header,
            content: brushName,
            css: {
                fontSize: '14px',
                color: 'rgba(255,255,255,0.6)',
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
            },
        });

        const closeBtn = BB.el({
            tagName: 'button',
            parent: header,
            content: LANG('done'),
            onClick: onClose,
            css: {
                background: 'linear-gradient(135deg, #0a84ff 0%, #0066cc 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                fontWeight: '600',
                cursor: 'pointer',
            },
        });

        return header;
    }

    private createPreviewSection(): HTMLElement {
        const section = BB.el({
            css: {
                width: '300px',
                flexShrink: '0',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
            },
        });

        BB.el({
            parent: section,
            content: LANG('preview'),
            css: { fontSize: '14px', fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
        });

        const canvasContainer = BB.el({
            parent: section,
            css: {
                background: '#fff',
                borderRadius: '12px',
                overflow: 'hidden',
                aspectRatio: '1',
            },
        });

        const canvas = BB.canvas(300, 300);
        css(canvas, { width: '100%', height: '100%', display: 'block' });
        canvasContainer.append(canvas);

        return section;
    }

    private createSettingsSection(): HTMLElement {
        const section = BB.el({
            css: {
                flex: '1',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            },
        });

        // Tab content containers
        const strokeContent = this.createStrokeTab();
        const shapeContent = this.createShapeTab();
        const dynamicsContent = this.createDynamicsTab();
        const grainContent = this.createGrainTab();

        // Hide all but first
        shapeContent.style.display = 'none';
        dynamicsContent.style.display = 'none';
        grainContent.style.display = 'none';

        const tabRow = new TabRow({
            initialId: 'stroke',
            tabArr: [
                {
                    id: 'stroke', label: LANG('stroke'), onOpen: () => {
                        strokeContent.style.display = 'block';
                        shapeContent.style.display = 'none';
                        dynamicsContent.style.display = 'none';
                        grainContent.style.display = 'none';
                    }, onClose: () => { }
                },
                {
                    id: 'shape', label: LANG('shape'), onOpen: () => {
                        strokeContent.style.display = 'none';
                        shapeContent.style.display = 'block';
                        dynamicsContent.style.display = 'none';
                        grainContent.style.display = 'none';
                    }, onClose: () => { }
                },
                {
                    id: 'dynamics', label: LANG('dynamics'), onOpen: () => {
                        strokeContent.style.display = 'none';
                        shapeContent.style.display = 'none';
                        dynamicsContent.style.display = 'block';
                        grainContent.style.display = 'none';
                    }, onClose: () => { }
                },
                {
                    id: 'grain', label: LANG('grain'), onOpen: () => {
                        strokeContent.style.display = 'none';
                        shapeContent.style.display = 'none';
                        dynamicsContent.style.display = 'none';
                        grainContent.style.display = 'block';
                    }, onClose: () => { }
                },
            ],
        });
        section.append(tabRow.getElement());

        const contentWrapper = BB.el({
            parent: section,
            css: { flex: '1', overflow: 'auto', padding: '20px 0' },
        });
        contentWrapper.append(strokeContent, shapeContent, dynamicsContent, grainContent);

        return section;
    }

    private createStrokeTab(): HTMLElement {
        const tab = BB.el({ css: { display: 'flex', flexDirection: 'column', gap: '20px' } });

        // Spacing slider
        const spacingSlider = new KlSlider({
            label: LANG('spacing'),
            width: 280,
            height: 30,
            min: 0.01,
            max: 2,
            value: this.settings.spacing ?? 0.1,
            resolution: 200,
            onChange: (val) => {
                this.settings.spacing = val;
                this.emitChange();
            },
        });
        tab.append(spacingSlider.getElement());

        // Scatter slider
        const scatterSlider = new KlSlider({
            label: LANG('scatter'),
            width: 280,
            height: 30,
            min: 0,
            max: 1,
            value: this.settings.scatter ?? 0,
            resolution: 100,
            onChange: (val) => {
                this.settings.scatter = val;
                this.emitChange();
            },
        });
        tab.append(scatterSlider.getElement());

        return tab;
    }

    private createShapeTab(): HTMLElement {
        const tab = BB.el({ css: { display: 'flex', flexDirection: 'column', gap: '20px' } });

        // Shape selector
        const shapeSelect = new Select<TBrushShape>({
            optionArr: [
                ['circle', LANG('brush-pen-circle')],
                ['square', LANG('brush-pen-square')],
                ['chalk', LANG('brush-pen-chalk')],
                ['calligraphy', LANG('brush-pen-calligraphy')],
            ],
            initValue: this.settings.shape ?? 'circle',
            onChange: (val) => {
                this.settings.shape = val;
                this.emitChange();
            },
            name: 'brush-shape',
        });
        const row = BB.el({ parent: tab, css: { display: 'flex', alignItems: 'center', gap: '12px' } });
        BB.el({ parent: row, content: LANG('shape') });
        row.append(shapeSelect.getElement());

        return tab;
    }

    private createDynamicsTab(): HTMLElement {
        const tab = BB.el({ css: { display: 'flex', flexDirection: 'column', gap: '20px' } });

        // Size pressure
        const sizePressure = new Checkbox({
            init: this.settings.sizePressure ?? true,
            label: LANG('dynamics-size-pressure'),
            callback: (val) => {
                this.settings.sizePressure = val;
                this.emitChange();
            },
            name: 'size-pressure',
        });
        tab.append(sizePressure.getElement());

        // Opacity pressure
        const opacityPressure = new Checkbox({
            init: this.settings.opacityPressure ?? false,
            label: LANG('dynamics-opacity-pressure'),
            callback: (val) => {
                this.settings.opacityPressure = val;
                this.emitChange();
            },
            name: 'opacity-pressure',
        });
        tab.append(opacityPressure.getElement());

        // Tilt to angle
        const tiltAngleSlider = new KlSlider({
            label: LANG('dynamics-tilt-angle'),
            width: 280,
            height: 30,
            min: 0,
            max: 1,
            value: this.settings.tiltToAngle ?? 0,
            resolution: 100,
            onChange: (val) => {
                this.settings.tiltToAngle = val;
                this.emitChange();
            },
        });
        tab.append(tiltAngleSlider.getElement());

        // Tilt to size
        const tiltSizeSlider = new KlSlider({
            label: LANG('dynamics-tilt-size'),
            width: 280,
            height: 30,
            min: 0,
            max: 1,
            value: this.settings.tiltToSize ?? 0,
            resolution: 100,
            onChange: (val) => {
                this.settings.tiltToSize = val;
                this.emitChange();
            },
        });
        tab.append(tiltSizeSlider.getElement());

        // Tilt to opacity
        const tiltOpacitySlider = new KlSlider({
            label: LANG('dynamics-tilt-opacity'),
            width: 280,
            height: 30,
            min: 0,
            max: 1,
            value: this.settings.tiltToOpacity ?? 0,
            resolution: 100,
            onChange: (val) => {
                this.settings.tiltToOpacity = val;
                this.emitChange();
            },
        });
        tab.append(tiltOpacitySlider.getElement());

        return tab;
    }

    private createGrainTab(): HTMLElement {
        const tab = BB.el({ css: { display: 'flex', flexDirection: 'column', gap: '20px' } });

        // Grain scale
        const grainScaleSlider = new KlSlider({
            label: LANG('grain-scale'),
            width: 280,
            height: 30,
            min: 0.1,
            max: 4,
            value: this.settings.grainScale ?? 1,
            resolution: 40,
            onChange: (val) => {
                this.settings.grainScale = val;
                this.emitChange();
            },
        });
        tab.append(grainScaleSlider.getElement());

        // Grain opacity
        const grainOpacitySlider = new KlSlider({
            label: LANG('grain-opacity'),
            width: 280,
            height: 30,
            min: 0,
            max: 1,
            value: this.settings.grainOpacity ?? 0,
            resolution: 100,
            onChange: (val) => {
                this.settings.grainOpacity = val;
                this.emitChange();
            },
        });
        tab.append(grainOpacitySlider.getElement());

        return tab;
    }


    private emitChange(): void {
        this.onChange({ ...this.settings });
        this.updatePreview();
    }

    private updatePreview(): void {
        const ctx = this.previewCtx;
        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;

        // Clear
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);

        // Draw sample stroke
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(40, h - 60);
        ctx.bezierCurveTo(100, 60, 200, h - 40, w - 40, 80);
        ctx.stroke();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getSettings(): TBrushSettings {
        return { ...this.settings };
    }

    show(): void {
        document.body.append(this.rootEl);
    }

    hide(): void {
        this.rootEl.remove();
    }

    destroy(): void {
        this.rootEl.remove();
    }
}
