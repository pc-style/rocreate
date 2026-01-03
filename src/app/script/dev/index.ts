/**
 * Development Tools Module
 * 
 * Import this in the main application to enable dev features.
 */

export { IS_DEV_MODE, DEV_CONFIG } from './dev-config';
export { ElementInspector, initElementInspector } from './element-inspector';

import { IS_DEV_MODE, DEV_CONFIG } from './dev-config';
import { initElementInspector } from './element-inspector';

/**
 * Initialize all dev tools
 * Call this once at application startup
 */
export function initDevTools(): void {
    if (!IS_DEV_MODE) return;

    // Initialize element inspector
    initElementInspector();

    // Log dev mode status
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #4a9eff;');
    console.log('%c  RoCreate Development Mode', 'color: #4a9eff; font-size: 16px; font-weight: bold;');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #4a9eff;');
    console.log('%c  📌 Ctrl+Shift+G  →  Element Inspector', 'color: #888; font-size: 12px;');
    console.log('%c  📌 No reload prompts', 'color: #888; font-size: 12px;');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #4a9eff;');
}
