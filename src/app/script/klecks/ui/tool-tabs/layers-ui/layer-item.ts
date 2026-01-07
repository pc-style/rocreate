import { BB } from '../../../../bb/bb';
import { PointSlider } from '../../components/point-slider';
import { KlCanvas } from '../../../canvas/kl-canvas';
import { LANG } from '../../../../language/language';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import { TPointerEvent } from '../../../../bb/input/event.types';
import { css, throwIfNull } from '../../../../bb/base/base';
import { HAS_POINTER_EVENTS } from '../../../../bb/base/browser';
import { alphaLockManager } from '../../../canvas/alpha-lock-manager';

export type TLayerEl = HTMLElement & {
    label: HTMLElement;
    opacityLabel: HTMLElement;
    thumb: HTMLCanvasElement;

    spot: number;
    posY: number;
    layerName: string;
    opacity: number;
    pointerListener: PointerListener;
    opacitySlider: PointSlider;
    isSelected: boolean;
    isMultiSelected: boolean;
    alphaLockUnsub?: () => void;
};

export type TLayerItemParams = {
    klCanvas: KlCanvas;
    index: number;
    layerHeight: number;
    layerSpacing: number;
    totalLayers: number;
    onSelect: (layerSpot: number, pushHistory: boolean) => void;
    onRename: (layerSpot: number) => void;
    onDrag: (event: TPointerEvent, layer: TLayerEl) => void;
    onUpdateProject: () => void;
    applyUncommitted: () => void;
    klHistory: { pause: (p: boolean) => void };
    largeThumbPreview: {
        show: (layerCanvas: HTMLCanvasElement, clientY: number) => void;
        hide: () => void;
    };
};

// creates a single layer entry element with all its functionality
export function createLayerItem(p: TLayerItemParams): TLayerEl {
    const {
        klCanvas,
        index,
        layerHeight,
        layerSpacing,
        totalLayers,
        onSelect,
        onRename,
        onDrag,
        onUpdateProject,
        applyUncommitted,
        klHistory,
        largeThumbPreview,
    } = p;

    const klLayerOld = throwIfNull(klCanvas.getLayerOld(index));
    const realLayerId = klCanvas.getLayer(index).id;
    const layerName = klLayerOld.name;
    const klCanvasLayerArr = klCanvas.getLayers();
    const opacity = klCanvasLayerArr[index].opacity;
    const isVisible = klLayerOld.isVisible;
    const isClippingMask = klCanvasLayerArr[index].isClippingMask;
    const layercanvas = klCanvasLayerArr[index].context.canvas;

    const layer: TLayerEl = BB.el({
        className: 'kl-layer',
        css: {
            borderRadius: '12px',
            marginBottom: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            transition: 'background 0.2s, box-shadow 0.2s, transform 0.2s',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        }
    }) as HTMLElement as TLayerEl;

    const innerLayer = BB.el({
        css: {
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            position: 'relative',
            height: layerHeight + 'px',
        }
    });

    const container1 = BB.el({
        css: {
            display: 'flex',
            alignItems: 'center',
            flex: '1',
            gap: '12px',
            position: 'relative',
        }
    });
    const container2 = BB.el();
    layer.append(innerLayer);
    innerLayer.append(container1, container2);

    layer.spot = index;

    // visibility checkbox
    createVisibilityCheckbox(container1, layer, klCanvas, onSelect, isVisible);

    // thumbnail
    createThumbnail(layer, container1, layercanvas, isClippingMask, layerHeight, realLayerId, largeThumbPreview);

    // layer label
    createLabel(layer, layerName, layerHeight, applyUncommitted, onRename);

    // opacity label
    createOpacityLabel(layer, opacity, layerHeight, isVisible);

    // opacity slider
    const opacitySlider = createOpacitySlider(layer, opacity, klCanvas, klHistory, onUpdateProject);
    layer.opacitySlider = opacitySlider;

    container1.append(
        layer.thumb,
        layer.label,
        layer.opacityLabel,
        opacitySlider.getElement(),
    );

    // pointer listener for drag events
    layer.pointerListener = new BB.PointerListener({
        target: container1,
        onPointer: (event) => onDrag(event, layer),
    });

    return layer;
}

function createVisibilityCheckbox(
    container: HTMLElement,
    layer: TLayerEl,
    klCanvas: KlCanvas,
    onSelect: (layerSpot: number, pushHistory: boolean) => void,
    isVisible: boolean,
): void {
    const checkWrapper = BB.el({
        tagName: 'label',
        parent: container,
        title: LANG('layers-visibility-toggle'),
        css: {
            display: 'flex',
            position: 'absolute',
            right: '8px',
            top: '0',
            width: '30px',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            zIndex: '2',
        },
    });
    const check = BB.el({
        tagName: 'input',
        parent: checkWrapper,
        custom: {
            type: 'checkbox',
            tabindex: '-1',
            name: 'layer-visibility',
        },
        css: {
            display: 'block',
            cursor: 'pointer',
            margin: '0',
            marginRight: '5px',
        },
    });
    check.checked = isVisible;
    check.onchange = () => {
        klCanvas.setLayerIsVisible(layer.spot, check.checked);
        // refresh only if this layer is selected
        onSelect(layer.spot, false);
    };

    // prevent layer getting dragged when clicking checkbox
    const preventFunc = (e: PointerEvent | MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };
    if (HAS_POINTER_EVENTS) {
        checkWrapper.onpointerdown = preventFunc;
    } else {
        checkWrapper.onmousedown = preventFunc;
    }
}

function createThumbnail(
    layer: TLayerEl,
    container: HTMLElement,
    layercanvas: HTMLCanvasElement,
    isClippingMask: boolean | undefined,
    layerHeight: number,
    realLayerId: string,
    largeThumbPreview: TLayerItemParams['largeThumbPreview'],
): void {
    const thumbDimensions = BB.fitInto(
        layercanvas.width,
        layercanvas.height,
        30,
        30,
        1,
    );
    layer.thumb = BB.canvas(thumbDimensions.width, thumbDimensions.height);

    const thc = BB.ctx(layer.thumb);
    thc.save();
    if (layer.thumb.width > layercanvas.width) {
        thc.imageSmoothingEnabled = false;
    }
    thc.drawImage(layercanvas, 0, 0, layer.thumb.width, layer.thumb.height);
    thc.restore();

    css(layer.thumb, {
        width: thumbDimensions.width + 'px',
        height: thumbDimensions.height + 'px',
        borderRadius: '6px',
        background: 'var(--kl-checkerboard-background)',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
        flexShrink: '0',
    });

    // alpha lock indicator
    const lockDiv = BB.el({
        parent: layer.thumb,
        className: 'layer-alpha-lock',
    });

    if (isClippingMask) {
        BB.el({
            parent: layer.thumb,
            css: {
                position: 'absolute',
                left: '-22px',
                top: '40%',
                width: '12px',
                height: '12px',
                borderLeft: '2px solid var(--kl-color-text)',
                borderBottom: '2px solid var(--kl-color-text)',
                pointerEvents: 'none',
            },
        });
    }

    const updateLockStatus = (locked: boolean) => {
        if (locked) {
            lockDiv.classList.add('layer-alpha-lock--active');
        } else {
            lockDiv.classList.remove('layer-alpha-lock--active');
        }
    };

    // initial state
    updateLockStatus(alphaLockManager.isLocked(realLayerId));

    // subscribe to lock changes
    const unsub = alphaLockManager.subscribe((id, isLocked) => {
        if (id === realLayerId) {
            updateLockStatus(isLocked);
        }
    });
    layer.alphaLockUnsub = unsub;

    // large thumbnail preview on hover
    layer.thumb.onpointerover = (e) => {
        if (e.buttons !== 0 && (!e.pointerType || e.pointerType !== 'touch')) {
            return;
        }
        largeThumbPreview.show(layercanvas, e.clientY);
    };
    layer.thumb.onpointerout = () => {
        largeThumbPreview.hide();
    };
}

function createLabel(
    layer: TLayerEl,
    layerName: string,
    layerHeight: number,
    applyUncommitted: () => void,
    onRename: (layerSpot: number) => void,
): void {
    layer.label = BB.el({
        className: 'kl-layer__label',
    });
    layer.layerName = layerName;
    layer.label.append(layer.layerName);

    css(layer.label, {
        fontSize: '14px',
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.9)',
        flex: '1',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
    });

    layer.label.ondblclick = () => {
        applyUncommitted();
        onRename(layer.spot);
    };
}

function createOpacityLabel(
    layer: TLayerEl,
    opacity: number,
    layerHeight: number,
    isVisible: boolean,
): void {
    layer.opacityLabel = BB.el({
        className: 'kl-layer__opacity-label',
    });
    layer.opacity = opacity;
    layer.opacityLabel.append(parseInt('' + layer.opacity * 100) + '%');

    css(layer.opacityLabel, {
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.4)',
        width: '35px',
        textAlign: 'right',
        marginRight: '35px',
        transition: 'color 0.2s ease-in-out',
        textDecoration: isVisible ? undefined : 'line-through',
    });
}

function createOpacitySlider(
    layer: TLayerEl,
    opacity: number,
    klCanvas: KlCanvas,
    klHistory: { pause: (p: boolean) => void },
    onUpdateProject: () => void,
): PointSlider {
    let oldOpacity: number;
    const opacitySlider = new PointSlider({
        init: opacity,
        width: 200,
        pointSize: 14,
        callback: (sliderValue, isFirst, isLast) => {
            if (isFirst) {
                oldOpacity = klCanvas.getLayerOld(layer.spot)!.opacity;
                klHistory.pause(true);
                return;
            }
            if (isLast) {
                klHistory.pause(false);
                if (oldOpacity !== sliderValue) {
                    klCanvas.setOpacity(layer.spot, sliderValue);
                }
                return;
            }
            layer.opacityLabel.innerHTML = Math.round(sliderValue * 100) + '%';
            klCanvas.setOpacity(layer.spot, sliderValue);
            onUpdateProject();
        },
    });
    css(opacitySlider.getElement(), {
        display: 'none', // hidden, using procreate UI or alternative
    });
    return opacitySlider;
}
