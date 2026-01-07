// vitest global setup for jsdom environment

// mock matchMedia for jsdom which doesn't support it
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
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