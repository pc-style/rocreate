/**
 * Development mode configuration
 * When DEV_MODE is enabled:
 * - Disables unload warning prompts
 * - Enables element inspector (Ctrl+Shift+G)
 * - Shows debug information
 */

// Check if running in dev mode - Parcel sets NODE_ENV
// Also check for localhost as fallback
const checkDevMode = (): boolean => {
    // Check URL parameters for explicit dev mode
    if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('dev')) return true;

        // Running on localhost is dev mode
        if (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1') {
            return true;
        }
    }
    return false;
};

export const IS_DEV_MODE = checkDevMode();

// Dev mode settings
export const DEV_CONFIG = {
    // Disable "unsaved changes" prompt
    disableUnloadWarning: IS_DEV_MODE,

    // Enable element inspector
    enableInspector: IS_DEV_MODE,

    // Show debug overlay
    showDebugInfo: IS_DEV_MODE,

    // Console logging verbosity
    verboseLogging: IS_DEV_MODE,
};
