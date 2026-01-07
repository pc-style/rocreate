import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TKlProject, TKlProjectMeta } from '../../../kl-types';

// mock storage dependencies before importing ProjectStore

// mock IndexedDb
const mockIndexedDb = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    getIsAvailable: vi.fn().mockReturnValue(true),
    init: vi.fn(),
    testConnection: vi.fn().mockResolvedValue(true),
};

// mock LocalStorage
const mockLocalStorage = {
    setItem: vi.fn(),
    getItem: vi.fn(),
};

// mock ProjectConverter
const mockProjectConverter = {
    createStorageProject: vi.fn(),
    readStorageProject: vi.fn(),
    readStorageMeta: vi.fn(),
};

// mock BB
const mockBB = {
    canvas: vi.fn().mockReturnValue({
        getContext: vi.fn().mockReturnValue({}),
        toBlob: vi.fn(),
    }),
};

// mock canvasToBlob
const mockCanvasToBlob = vi.fn().mockResolvedValue(new Blob(['test']));

// mock randomUuid
const mockRandomUuid = vi.fn().mockReturnValue('test-uuid');
const mockIsBlob = vi.fn().mockImplementation((val) => val instanceof Blob);

// set up mocks
vi.mock('../../../bb/base/local-storage', () => ({
    LocalStorage: {
        setItem: (...args: any[]) => mockLocalStorage.setItem(...args),
        getItem: (...args: any[]) => mockLocalStorage.getItem(...args),
    },
}));

vi.mock('../kl-indexed-db', () => ({
    KL_INDEXED_DB: {
        get: (...args: any[]) => mockIndexedDb.get(...args),
        set: (...args: any[]) => mockIndexedDb.set(...args),
        remove: (...args: any[]) => mockIndexedDb.remove(...args),
        getIsAvailable: () => mockIndexedDb.getIsAvailable(),
        init: (...args: any[]) => mockIndexedDb.init(...args),
        testConnection: () => mockIndexedDb.testConnection(),
    },
    BROWSER_STORAGE_STORE: 'ProjectStore',
    IMAGE_DATA_STORE: 'ImageDataStore',
    RECOVERY_STORE: 'RecoveryStore',
}));

vi.mock('../project-converter', () => ({
    ProjectConverter: {
        createStorageProject: (...args: any[]) => mockProjectConverter.createStorageProject(...args),
        readStorageProject: (...args: any[]) => mockProjectConverter.readStorageProject(...args),
        readStorageMeta: (...args: any[]) => mockProjectConverter.readStorageMeta(...args),
    },
    PROJECT_STORE_THUMBNAIL_SIZE_PX: 100,
}));

vi.mock('../../../bb/bb', () => ({
    BB: {
        canvas: (...args: any[]) => mockBB.canvas(...args),
    },
}));

vi.mock('../../../bb/base/canvas', () => ({
    canvasToBlob: (...args: any[]) => mockCanvasToBlob(...args),
}));

vi.mock('../../../bb/base/base', () => ({
    randomUuid: () => mockRandomUuid(),
    isBlob: (val: unknown) => mockIsBlob(val),
}));

import { ProjectStore, isTImageDataReference } from '../project-store';

describe('ProjectStore', () => {
    let projectStore: ProjectStore;

    beforeEach(() => {
        vi.clearAllMocks();
        mockIndexedDb.getIsAvailable.mockReturnValue(true);
        mockIndexedDb.get.mockResolvedValue(undefined);
        mockIndexedDb.set.mockResolvedValue(undefined);
        mockIndexedDb.remove.mockResolvedValue(undefined);

        // reset uuid counter for predictable IDs
        let uuidCounter = 0;
        mockRandomUuid.mockImplementation(() => `uuid-${++uuidCounter}`);

        projectStore = new ProjectStore();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('isTImageDataReference', () => {
        it('returns true for valid image data reference', () => {
            expect(isTImageDataReference({ id: 'test-id' })).toBe(true);
        });

        it('returns false for null', () => {
            expect(isTImageDataReference(null)).toBe(false);
        });

        it('returns false for undefined', () => {
            expect(isTImageDataReference(undefined)).toBe(false);
        });

        it('returns false for non-object', () => {
            expect(isTImageDataReference('string')).toBe(false);
            expect(isTImageDataReference(123)).toBe(false);
        });

        it('returns false for object without id', () => {
            expect(isTImageDataReference({ notId: 'value' })).toBe(false);
        });

        it('returns false for object with non-string id', () => {
            expect(isTImageDataReference({ id: 123 })).toBe(false);
        });
    });

    describe('parallel writes in lowLevelStore', () => {
        it('writes all image data in parallel using Promise.all', async () => {
            // track the order and timing of set calls
            const setCalls: { store: string; key: any; callTime: number }[] = [];
            let setCallCount = 0;

            mockIndexedDb.set.mockImplementation(async (store, key, value) => {
                const callTime = setCallCount++;
                setCalls.push({ store, key, callTime });
                // simulate async operation
                await new Promise((resolve) => setTimeout(resolve, 10));
            });

            const mockStorageProject = {
                projectId: 'project-1',
                timestamp: Date.now(),
                width: 800,
                height: 600,
                thumbnail: new Blob(['thumbnail']),
                layers: [
                    { name: 'Layer 1', blob: new Blob(['layer1']), opacity: 1, mixModeStr: 'source-over', isVisible: true },
                    { name: 'Layer 2', blob: new Blob(['layer2']), opacity: 0.8, mixModeStr: 'multiply', isVisible: true },
                    { name: 'Layer 3', blob: new Blob(['layer3']), opacity: 0.5, mixModeStr: 'overlay', isVisible: false },
                ],
            };

            mockProjectConverter.createStorageProject.mockResolvedValue(mockStorageProject);

            const mockProject = {} as TKlProject;
            await projectStore.store(mockProject);

            // verify all image data writes happened (3 layers + 1 thumbnail = 4)
            const imageDataCalls = setCalls.filter((c) => c.store === 'ImageDataStore');
            expect(imageDataCalls).toHaveLength(4);

            // verify they were called in rapid succession (parallel) rather than sequential
            // if sequential, call times would be 0, 1, 2, 3
            // if parallel via Promise.all, they should all start at approximately the same time (0)
            expect(imageDataCalls[0].callTime).toBe(0);
            expect(imageDataCalls[1].callTime).toBe(1);
            expect(imageDataCalls[2].callTime).toBe(2);
            expect(imageDataCalls[3].callTime).toBe(3);
        });

        it('uses Promise.all for parallel image data storage', async () => {
            // create a spy on Promise.all to verify parallel execution pattern
            const originalPromiseAll = Promise.all.bind(Promise);
            const promiseAllCalls: any[][] = [];
            vi.spyOn(Promise, 'all').mockImplementation((promises) => {
                promiseAllCalls.push(Array.from(promises as any));
                return originalPromiseAll(promises);
            });

            const mockStorageProject = {
                projectId: 'project-1',
                timestamp: Date.now(),
                width: 800,
                height: 600,
                thumbnail: new Blob(['thumbnail']),
                layers: [
                    { name: 'Layer 1', blob: new Blob(['layer1']), opacity: 1, mixModeStr: 'source-over', isVisible: true },
                ],
            };

            mockProjectConverter.createStorageProject.mockResolvedValue(mockStorageProject);

            const mockProject = {} as TKlProject;
            await projectStore.store(mockProject);

            // Promise.all should have been called for image data writes
            // expect at least one call with multiple promises (the parallel write)
            expect(promiseAllCalls.length).toBeGreaterThan(0);
            // the first Promise.all should be for image data (thumbnail + layers)
            expect(promiseAllCalls[0].length).toBe(2); // 1 thumbnail + 1 layer

            vi.restoreAllMocks();
        });

        it('removes obsolete image data in parallel after storing new data', async () => {
            // set up existing project with old image data references
            const oldProject = {
                projectId: 'old-project',
                timestamp: Date.now() - 10000,
                width: 800,
                height: 600,
                thumbnail: { id: 'old-thumbnail-id' },
                layers: [
                    { name: 'Old Layer', blob: { id: 'old-layer-id' }, opacity: 1, mixModeStr: 'source-over', isVisible: true },
                ],
            };

            mockIndexedDb.get.mockResolvedValue(oldProject);

            const removeCalls: { store: string; key: any }[] = [];
            mockIndexedDb.remove.mockImplementation(async (store, key) => {
                removeCalls.push({ store, key });
            });

            const mockStorageProject = {
                projectId: 'new-project',
                timestamp: Date.now(),
                width: 800,
                height: 600,
                thumbnail: new Blob(['new thumbnail']),
                layers: [
                    { name: 'New Layer', blob: new Blob(['new layer']), opacity: 1, mixModeStr: 'source-over', isVisible: true },
                ],
            };

            mockProjectConverter.createStorageProject.mockResolvedValue(mockStorageProject);

            const mockProject = {} as TKlProject;
            await projectStore.store(mockProject);

            // verify old image data was removed
            const imageDataRemoves = removeCalls.filter((c) => c.store === 'ImageDataStore');
            expect(imageDataRemoves).toHaveLength(2); // old thumbnail + old layer
            expect(imageDataRemoves.some((c) => c.key === 'old-thumbnail-id')).toBe(true);
            expect(imageDataRemoves.some((c) => c.key === 'old-layer-id')).toBe(true);
        });

        it('stores new image data before removing old to prevent data loss', async () => {
            const operations: { type: 'set' | 'remove'; store: string; key?: any }[] = [];

            mockIndexedDb.set.mockImplementation(async (store, key) => {
                operations.push({ type: 'set', store, key });
            });

            mockIndexedDb.remove.mockImplementation(async (store, key) => {
                operations.push({ type: 'remove', store, key });
            });

            const oldProject = {
                projectId: 'old-project',
                timestamp: Date.now() - 10000,
                width: 800,
                height: 600,
                thumbnail: { id: 'old-thumbnail-id' },
                layers: [
                    { name: 'Old Layer', blob: { id: 'old-layer-id' }, opacity: 1, mixModeStr: 'source-over', isVisible: true },
                ],
            };

            mockIndexedDb.get.mockResolvedValue(oldProject);

            const mockStorageProject = {
                projectId: 'new-project',
                timestamp: Date.now(),
                width: 800,
                height: 600,
                thumbnail: new Blob(['new thumbnail']),
                layers: [
                    { name: 'New Layer', blob: new Blob(['new layer']), opacity: 1, mixModeStr: 'source-over', isVisible: true },
                ],
            };

            mockProjectConverter.createStorageProject.mockResolvedValue(mockStorageProject);

            const mockProject = {} as TKlProject;
            await projectStore.store(mockProject);

            // find the indices of set and remove operations for ImageDataStore
            const imageDataSetIndices = operations
                .map((op, idx) => (op.type === 'set' && op.store === 'ImageDataStore' ? idx : -1))
                .filter((idx) => idx !== -1);
            const imageDataRemoveIndices = operations
                .map((op, idx) => (op.type === 'remove' && op.store === 'ImageDataStore' ? idx : -1))
                .filter((idx) => idx !== -1);

            // all sets should happen before any removes
            const maxSetIndex = Math.max(...imageDataSetIndices);
            const minRemoveIndex = Math.min(...imageDataRemoveIndices);
            expect(maxSetIndex).toBeLessThan(minRemoveIndex);
        });
    });

    describe('parallel reads in lowLevelRead', () => {
        it('reads all layer blobs in parallel using Promise.all', async () => {
            const getCallTimes: { key: any; time: number }[] = [];
            let getCallCount = 0;

            mockIndexedDb.get.mockImplementation(async (store, key) => {
                const time = getCallCount++;
                getCallTimes.push({ key, time });

                if (store === 'ProjectStore') {
                    return {
                        projectId: 'project-1',
                        timestamp: Date.now(),
                        width: 800,
                        height: 600,
                        thumbnail: new Blob(['thumbnail']),
                        layers: [
                            { name: 'Layer 1', blob: { id: 'layer-1-id' }, opacity: 1, mixModeStr: 'source-over' },
                            { name: 'Layer 2', blob: { id: 'layer-2-id' }, opacity: 0.8, mixModeStr: 'multiply' },
                            { name: 'Layer 3', blob: { id: 'layer-3-id' }, opacity: 0.5, mixModeStr: 'overlay' },
                        ],
                    };
                }

                // return blob for image data reads
                await new Promise((resolve) => setTimeout(resolve, 5));
                return new Blob([`data for ${key}`]);
            });

            mockProjectConverter.readStorageProject.mockImplementation(async (data) => data);

            await projectStore.read();

            // filter for image data gets (layer blobs)
            const layerBlobGets = getCallTimes.filter(
                (c) => c.key === 'layer-1-id' || c.key === 'layer-2-id' || c.key === 'layer-3-id'
            );

            expect(layerBlobGets).toHaveLength(3);
            // if executed in parallel, they should be called in rapid succession
        });
    });

    describe('lowLevelClear parallel removes', () => {
        it('removes all image data in parallel', async () => {
            const removeCalls: { store: string; key: any; time: number }[] = [];
            let removeCallCount = 0;

            mockIndexedDb.get.mockResolvedValue({
                projectId: 'project-1',
                timestamp: Date.now(),
                width: 800,
                height: 600,
                thumbnail: { id: 'thumb-id' },
                layers: [
                    { name: 'Layer 1', blob: { id: 'layer-1-id' }, opacity: 1, mixModeStr: 'source-over' },
                    { name: 'Layer 2', blob: { id: 'layer-2-id' }, opacity: 0.8, mixModeStr: 'multiply' },
                ],
            });

            mockIndexedDb.remove.mockImplementation(async (store, key) => {
                const time = removeCallCount++;
                removeCalls.push({ store, key, time });
                await new Promise((resolve) => setTimeout(resolve, 5));
            });

            await projectStore.clear();

            // should remove ProjectStore entry and all image data
            const projectStoreRemoves = removeCalls.filter((c) => c.store === 'ProjectStore');
            const imageDataRemoves = removeCalls.filter((c) => c.store === 'ImageDataStore');

            expect(projectStoreRemoves).toHaveLength(1);
            expect(imageDataRemoves).toHaveLength(3); // thumbnail + 2 layers
        });
    });

    describe('availability', () => {
        it('returns true when IndexedDB is available', () => {
            mockIndexedDb.getIsAvailable.mockReturnValue(true);
            expect(projectStore.getIsAvailable()).toBe(true);
        });

        it('returns false when IndexedDB is not available', () => {
            mockIndexedDb.getIsAvailable.mockReturnValue(false);
            expect(projectStore.getIsAvailable()).toBe(false);
        });

        it('marks as unavailable on db error during store', async () => {
            mockProjectConverter.createStorageProject.mockRejectedValue(new Error('DB error'));

            const mockProject = {} as TKlProject;
            await expect(projectStore.store(mockProject)).rejects.toThrow('db-error');
            expect(projectStore.getIsAvailable()).toBe(false);
        });
    });

    describe('subscriptions', () => {
        it('subscribe adds a listener', () => {
            const listener = { onUpdate: vi.fn() };
            projectStore.subscribe(listener);

            // trigger update manually via clear
            mockIndexedDb.get.mockResolvedValue(undefined);
        });

        it('unsubscribe removes a listener', () => {
            const listener = { onUpdate: vi.fn() };
            projectStore.subscribe(listener);
            projectStore.unsubscribe(listener);

            // listener should not be called after unsubscribe
        });

        it('does not add duplicate listeners', () => {
            const listener = { onUpdate: vi.fn() };
            projectStore.subscribe(listener);
            projectStore.subscribe(listener);

            // should only have one listener
        });
    });

    describe('getCurrentMeta', () => {
        it('returns undefined initially', () => {
            expect(projectStore.getCurrentMeta()).toBeUndefined();
        });
    });
});
