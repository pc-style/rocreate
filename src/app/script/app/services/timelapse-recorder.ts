/**
 * TimelapseRecorder - Records canvas painting sessions as video.
 *
 * Uses the MediaRecorder API to capture the canvas stream and export as WebM.
 */

export type TTimelapseRecorderParams = {
    canvas: HTMLCanvasElement;
    fps?: number; // Default: 30
    speedMultiplier?: number; // How many real-time seconds per recorded second (default: 60)
};

export type TTimelapseState = 'idle' | 'recording' | 'paused';

export class TimelapseRecorder {
    private canvas: HTMLCanvasElement;
    private readonly fps: number;
    private readonly speedMultiplier: number;
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private state: TTimelapseState = 'idle';
    private frameInterval: ReturnType<typeof setInterval> | null = null;
    private stream: MediaStream | null = null;

    // Callbacks
    private onStateChange?: (state: TTimelapseState) => void;

    constructor(p: TTimelapseRecorderParams) {
        this.canvas = p.canvas;
        this.fps = p.fps ?? 30;
        this.speedMultiplier = p.speedMultiplier ?? 60; // 1 minute real = 1 second video
    }

    /**
     * Start recording the canvas.
     */
    start(): boolean {
        if (this.state !== 'idle') {
            console.warn('[TimelapseRecorder] Already recording or paused');
            return false;
        }

        try {
            // Capture the canvas stream at specified framerate
            // Note: actual capture rate is controlled by MediaRecorder, we use frameRequestCallback
            this.stream = this.canvas.captureStream(this.fps / this.speedMultiplier);

            const options: MediaRecorderOptions = {
                mimeType: this.getSupportedMimeType(),
                videoBitsPerSecond: 2500000, // 2.5 Mbps
            };

            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('[TimelapseRecorder] Recording stopped, chunks:', this.recordedChunks.length);
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('[TimelapseRecorder] Error:', event);
                this.stop();
            };

            this.mediaRecorder.start(1000); // Collect data every second
            this.state = 'recording';
            this.onStateChange?.(this.state);

            console.log('[TimelapseRecorder] Started recording');
            return true;
        } catch (e) {
            console.error('[TimelapseRecorder] Failed to start recording:', e);
            return false;
        }
    }

    /**
     * Pause recording.
     */
    pause(): void {
        if (this.state !== 'recording' || !this.mediaRecorder) {
            return;
        }

        this.mediaRecorder.pause();
        this.state = 'paused';
        this.onStateChange?.(this.state);
    }

    /**
     * Resume recording.
     */
    resume(): void {
        if (this.state !== 'paused' || !this.mediaRecorder) {
            return;
        }

        this.mediaRecorder.resume();
        this.state = 'recording';
        this.onStateChange?.(this.state);
    }

    /**
     * Stop recording.
     */
    stop(): void {
        if (this.mediaRecorder && this.state !== 'idle') {
            this.mediaRecorder.stop();
            this.stream?.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }

        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }

        this.state = 'idle';
        this.onStateChange?.(this.state);
    }

    /**
     * Export the recorded video as a Blob.
     */
    async export(): Promise<Blob | null> {
        if (this.recordedChunks.length === 0) {
            console.warn('[TimelapseRecorder] No recorded data to export');
            return null;
        }

        // Wait for any pending data if still recording
        if (this.mediaRecorder?.state === 'recording') {
            this.stop();
            // Give a moment for the last chunk to be collected
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const blob = new Blob(this.recordedChunks, {
            type: this.getSupportedMimeType(),
        });

        console.log('[TimelapseRecorder] Exported blob, size:', blob.size);
        return blob;
    }

    /**
     * Export and download as a file.
     */
    async download(filename: string = 'timelapse.webm'): Promise<void> {
        const blob = await this.export();
        if (!blob) {
            return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Get the current recording state.
     */
    getState(): TTimelapseState {
        return this.state;
    }

    /**
     * Check if recording is active.
     */
    isRecording(): boolean {
        return this.state === 'recording';
    }

    /**
     * Set callback for state changes.
     */
    setOnStateChange(callback: (state: TTimelapseState) => void): void {
        this.onStateChange = callback;
    }

    /**
     * Update the canvas being recorded (e.g., after resize).
     */
    setCanvas(canvas: HTMLCanvasElement): void {
        const wasRecording = this.isRecording();
        if (wasRecording) {
            this.stop();
        }
        this.canvas = canvas;
        // Restart if was recording
        if (wasRecording) {
            this.start();
        }
    }

    /**
     * Get recorded duration estimate in seconds.
     */
    getRecordedDuration(): number {
        // Rough estimate based on chunks * 1 second per chunk
        return this.recordedChunks.length;
    }

    /**
     * Clear recorded data without stopping.
     */
    clear(): void {
        this.recordedChunks = [];
    }

    /**
     * Check if MediaRecorder is supported.
     */
    static isSupported(): boolean {
        return typeof MediaRecorder !== 'undefined' &&
            typeof HTMLCanvasElement.prototype.captureStream === 'function';
    }

    private getSupportedMimeType(): string {
        const types = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4',
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        // Fallback
        return 'video/webm';
    }

    destroy(): void {
        this.stop();
        this.recordedChunks = [];
        this.mediaRecorder = null;
    }
}
