import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectConverter } from '../project-converter';
import { TKlProject } from '../../kl-types';

// Mock dependencies
vi.mock('../../bb/bb', async (importActual) => {
    const actual = await importActual() as any;
    return {
        ...actual,
        BB: {
            ...actual.BB,
            fitInto: vi.fn((w, h, maxW, maxH) => ({ width: 100, height: 100 })),
            imageBlobToUrl: vi.fn((blob) => 'mock-url'),
            copyObj: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
        }
    };
});

vi.mock('../../../bb/base/canvas', async (importActual) => {
    const actual = await importActual() as any;
    return {
        ...actual,
        canvasToBlob: vi.fn().mockResolvedValue(new Blob(['test-blob'])),
    };
});

vi.mock('../../canvas/draw-project', () => ({
    drawProject: vi.fn().mockReturnValue(document.createElement('canvas')),
}));

// Mock URL
if (!global.URL.createObjectURL) {
    global.URL.createObjectURL = vi.fn().mockReturnValue('mock-url');
}
if (!global.URL.revokeObjectURL) {
    global.URL.revokeObjectURL = vi.fn();
}

describe('ProjectConverter', () => {
    const mockProject: TKlProject = {
        projectId: 'test-project',
        width: 1000,
        height: 1000,
        layers: [
            {
                name: 'Layer 1',
                isVisible: true,
                opacity: 1,
                mixModeStr: 'source-over',
                image: document.createElement('canvas'),
            },
        ],
    };

    describe('createStorageProject', () => {
        it('should convert project to storage format', async () => {
            const result = await ProjectConverter.createStorageProject(mockProject);

            expect(result.projectId).toBe('test-project');
            expect(result.width).toBe(1000);
            expect(result.height).toBe(1000);
            expect(result.layers).toHaveLength(1);
            expect(result.layers[0].name).toBe('Layer 1');
            expect(result.layers[0].blob).toBeDefined();
            expect(result.thumbnail).toBeDefined();
        });
    });

    describe('readStorageProject', () => {
        const mockStorageProject = {
            id: 1 as const,
            projectId: 'test-project',
            timestamp: 123456789,
            thumbnail: new Blob(['thumb']),
            width: 1000,
            height: 1000,
            layers: [
                {
                    name: 'Layer 1',
                    isVisible: true,
                    opacity: 1,
                    mixModeStr: 'source-over' as const,
                    blob: new Blob(['layer-blob']),
                },
            ],
        };

        it('should convert storage project back to TKlProject', { timeout: 10000 }, async () => {
            // Mock Image loading
            const originalImage = global.Image;

            (global as any).Image = function () {
                const img: any = {
                    _onload: null,
                    _src: '',
                    set onload(v: any) {
                        this._onload = v;
                        if (this._src && v) {
                            setTimeout(() => v(), 10);
                        }
                    },
                    get onload() { return this._onload; },
                    set src(v: string) {
                        this._src = v;
                        if (this._onload) {
                            setTimeout(() => this._onload(), 10);
                        }
                    },
                    get src() { return this._src; }
                };
                return img;
            };

            const result = await ProjectConverter.readStorageProject(mockStorageProject);

            expect(result.project.projectId).toBe('test-project');
            expect(result.project.width).toBe(1000);
            expect(result.project.height).toBe(1000);
            expect(result.timestamp).toBe(123456789);
            expect(result.project.layers).toHaveLength(1);
            expect(result.project.layers[0].name).toBe('Layer 1');

            global.Image = originalImage;
        });

        it('should throw error for invalid canvas size', async () => {
            const invalidProject = { ...mockStorageProject, width: 0 };
            await expect(ProjectConverter.readStorageProject(invalidProject)).rejects.toThrow('readStorageProject invalid canvas size');
        });
    });
});
