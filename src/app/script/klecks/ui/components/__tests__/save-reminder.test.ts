import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SaveReminder, TSaveReminderParams } from '../save-reminder';
import { LocalStorage } from '../../../../bb/base/local-storage';

// Mock dependencies
vi.mock('../../../../bb/base/local-storage', () => ({
    LocalStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    },
}));

vi.mock('../../kl', () => ({
    KL: {
        popup: vi.fn(),
        DIALOG_COUNTER: {
            get: vi.fn().mockReturnValue(0),
        },
    },
}));

vi.mock('../../../bb/bb', () => ({
    BB: {
        el: vi.fn().mockReturnValue(document.createElement('div')),
        destroyEl: vi.fn(),
    },
}));

vi.mock('../../../language/language', () => ({
    LANG: vi.fn().mockReturnValue('mock-string'),
}));

vi.mock('./save-reminder.module.scss', () => ({
    psdWrapper: 'psdWrapper',
}));

vi.mock('./browser-storage-ui', () => ({
    BrowserStorageUi: vi.fn().mockImplementation(() => ({
        show: vi.fn(),
        getElement: vi.fn().mockReturnValue(document.createElement('div')),
        destroy: vi.fn(),
    })),
}));

describe('SaveReminder', () => {
    let mockParams: TSaveReminderParams;

    beforeEach(() => {
        vi.clearAllMocks();
        mockParams = {
            onSaveAsPsd: vi.fn(),
            isDrawing: vi.fn().mockReturnValue(false),
            projectStore: {} as any,
            getProject: vi.fn(),
            onStored: vi.fn(),
            applyUncommitted: vi.fn(),
            klHistory: {
                getTotalIndex: vi.fn().mockReturnValue(0),
            } as any,
        };
    });

    describe('initialization', () => {
        it('uses default "40min" if no setting stored', () => {
            vi.mocked(LocalStorage.getItem).mockReturnValue(null);
            const reminder = new SaveReminder(mockParams);
            expect(reminder.getSetting()).toBe('40min');
        });

        it('uses stored setting if valid', () => {
            vi.mocked(LocalStorage.getItem).mockReturnValue('20min');
            const reminder = new SaveReminder(mockParams);
            expect(reminder.getSetting()).toBe('20min');
        });

        it('uses default "40min" and updates storage if stored setting is invalid', () => {
            vi.mocked(LocalStorage.getItem).mockReturnValue('invalid-value');
            const reminder = new SaveReminder(mockParams);

            expect(reminder.getSetting()).toBe('40min');
            expect(LocalStorage.setItem).toHaveBeenCalledWith('kl-save-reminder', '40min');
        });

        it('uses "disabled" if stored', () => {
            vi.mocked(LocalStorage.getItem).mockReturnValue('disabled');
            const reminder = new SaveReminder(mockParams);
            expect(reminder.getSetting()).toBe('disabled');
        });
    });

    describe('setSetting', () => {
        it('updates setting and local storage', () => {
            vi.mocked(LocalStorage.getItem).mockReturnValue('20min');
            const reminder = new SaveReminder(mockParams);

            reminder.setSetting('disabled');

            expect(reminder.getSetting()).toBe('disabled');
            expect(LocalStorage.setItem).toHaveBeenCalledWith('kl-save-reminder', 'disabled');
        });
    });
});
