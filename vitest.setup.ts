// vitest global setup for jsdom environment

// mock matchMedia for jsdom which doesn't support it
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => false,
    }),
});

// mock requestAnimationFrame if not present
if (typeof window.requestAnimationFrame === 'undefined') {
    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
        return setTimeout(() => callback(Date.now()), 16) as unknown as number;
    };
}

if (typeof window.cancelAnimationFrame === 'undefined') {
    window.cancelAnimationFrame = (id: number): void => {
        clearTimeout(id);
    };
}

// mock performance.timing (deprecated but used)
if (window.performance && !window.performance.timing) {
    (window.performance as any).timing = {
        navigationStart: Date.now(),
    };
}

// Global mock for canvas getContext to handle environments without 'canvas' package
(HTMLCanvasElement.prototype as any).getContext = function (type: string) {
    if (type === '2d') {
        const ctx = {
            canvas: this,
            save: () => { },
            restore: () => { },
            drawImage: () => { },
            clearRect: () => { },
            fillRect: () => { },
            strokeRect: () => { },
            fill: () => { },
            stroke: () => { },
            beginPath: () => { },
            moveTo: () => { },
            lineTo: () => { },
            rect: () => { },
            arc: () => { },
            setTransform: () => { },
            translate: () => { },
            scale: () => { },
            rotate: () => { },
            measureText: () => ({
                width: 0,
                actualBoundingBoxAscent: 0,
                actualBoundingBoxDescent: 0,
                actualBoundingBoxLeft: 0,
                actualBoundingBoxRight: 0,
                fontBoundingBoxAscent: 0,
                fontBoundingBoxDescent: 0
            }),
            fillText: () => { },
            strokeText: () => { },
            createLinearGradient: () => ({ addColorStop: () => { } }),
            createRadialGradient: () => ({ addColorStop: () => { } }),
            createPattern: () => { },
            createImageData: function (w: number, h: number) {
                return {
                    data: new Uint8ClampedArray(w * h * 4),
                    width: w,
                    height: h,
                    colorSpace: 'srgb'
                };
            },
            getImageData: function (x: number, y: number, w: number, h: number) {
                return {
                    data: new Uint8ClampedArray(w * h * 4),
                    width: w,
                    height: h,
                    colorSpace: 'srgb'
                };
            },
            putImageData: () => { },
        };
        return ctx;
    }
    return null;
};