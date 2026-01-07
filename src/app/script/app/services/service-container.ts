import {
    IBrushService,
    ILayerService,
    IToolService,
    ILayoutService,
    IHistoryService,
} from './types';

export interface IServiceContainer {
    brush: IBrushService;
    layer: ILayerService;
    tool: IToolService;
    layout: ILayoutService;
    history: IHistoryService;
}

// simple service container - can be enhanced later with lazy loading
export class ServiceContainer implements IServiceContainer {
    public readonly brush: IBrushService;
    public readonly layer: ILayerService;
    public readonly tool: IToolService;
    public readonly layout: ILayoutService;
    public readonly history: IHistoryService;

    constructor(services: IServiceContainer) {
        this.brush = services.brush;
        this.layer = services.layer;
        this.tool = services.tool;
        this.layout = services.layout;
        this.history = services.history;
    }
}
