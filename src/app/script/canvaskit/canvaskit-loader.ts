/**
 * Lazy-loading singleton for CanvasKit WASM module.
 * Provides async initialization with status tracking and error handling.
 */

import type { CanvasKit } from 'canvaskit-wasm';
import type { CanvasKitStatus } from './canvaskit-types';

let canvasKitInstance: CanvasKit | null = null;
let loadPromise: Promise<CanvasKit> | null = null;
let status: CanvasKitStatus = 'unavailable';

/**
 * Check if WebGL 2.0 is available in the current browser.
 */
function isWebGL2Available(): boolean {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        return gl !== null;
    } catch {
        return false;
    }
}

/**
 * Load and initialize CanvasKit WASM module.
 * Returns cached instance if already loaded.
 * 
 * @returns Promise resolving to CanvasKit instance
 * @throws Error if loading fails or WebGL is unavailable
 */
export async function loadCanvasKit(): Promise<CanvasKit> {
    // Return cached instance
    if (canvasKitInstance) {
        return canvasKitInstance;
    }

    // Return existing load promise if already loading
    if (loadPromise) {
        return loadPromise;
    }

    // Check WebGL availability before loading
    if (!isWebGL2Available()) {
        status = 'unavailable';
        throw new Error('WebGL 2.0 is not available in this browser');
    }

    status = 'loading';

    loadPromise = (async () => {
        try {
            // Dynamic import for code splitting
            const CanvasKitInit = (await import('canvaskit-wasm')).default;

            canvasKitInstance = await CanvasKitInit({
                // Use CDN for WASM files - pinned to same version as npm package
                locateFile: (file: string) => {
                    return `https://unpkg.com/canvaskit-wasm@0.40.0/bin/full/${file}`;
                },
            });

            status = 'ready';
            console.log('[CanvasKit] GPU compositor initialized successfully');
            return canvasKitInstance;
        } catch (error) {
            status = 'failed';
            loadPromise = null;
            console.warn('[CanvasKit] Failed to initialize:', error);
            throw error;
        }
    })();

    return loadPromise;
}

/**
 * Get the CanvasKit instance if already loaded.
 * Returns null if not yet loaded or loading failed.
 */
export function getCanvasKit(): CanvasKit | null {
    return canvasKitInstance;
}

/**
 * Get the current status of CanvasKit initialization.
 */
export function getCanvasKitStatus(): CanvasKitStatus {
    return status;
}

/**
 * Check if GPU compositing is available and ready.
 */
export function isGPUCompositingAvailable(): boolean {
    return status === 'ready' && canvasKitInstance !== null;
}
