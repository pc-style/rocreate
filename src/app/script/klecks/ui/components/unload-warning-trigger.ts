import { KlHistory } from '../../history/kl-history';
import { DEV_CONFIG } from '../../../dev/dev-config';

export type TUnloadWarningTriggerParams = {
    klHistory: KlHistory;
    getLastSavedHistoryIndex: () => number;
};

export class UnloadWarningTrigger {
    private readonly klHistory: KlHistory;
    private readonly getLastSavedHistoryIndex: () => number;
    private readonly onBeforeUnload = (e: BeforeUnloadEvent) => {
        // Skip warning in dev mode
        if (DEV_CONFIG.disableUnloadWarning) {
            return;
        }
        e.preventDefault();
        e.returnValue = '';
    };

    // ----------------------------------- public -----------------------------------
    constructor(p: TUnloadWarningTriggerParams) {
        this.klHistory = p.klHistory;
        this.getLastSavedHistoryIndex = p.getLastSavedHistoryIndex;
        p.klHistory.addListener(() => this.update());
    }

    update(): void {
        // Don't add listener in dev mode
        if (DEV_CONFIG.disableUnloadWarning) {
            window.removeEventListener('beforeunload', this.onBeforeUnload);
            return;
        }

        const historyIndex = this.klHistory.getTotalIndex();
        if (this.getLastSavedHistoryIndex() !== historyIndex) {
            window.addEventListener('beforeunload', this.onBeforeUnload);
        } else {
            window.removeEventListener('beforeunload', this.onBeforeUnload);
        }
    }

    destroy(): void {
        window.removeEventListener('beforeunload', this.onBeforeUnload);
    }
}
