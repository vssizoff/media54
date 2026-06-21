export default class PlayerController {
    protected element: HTMLVideoElement | HTMLAudioElement | undefined = undefined;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private mediaSource: MediaSource | null = null;
    public isLoading = true;
    public isReady = false;
    public isPlaying = false;
    public isSeeking = false;
    public currentTime = 0;
    protected seeked = 0;
    protected fetchController: AbortController | null = null;
    protected isAppending: boolean = false;
    protected pendingBuffers: Array<Uint8Array<ArrayBuffer>> = [];
    protected sourceBuffer: SourceBuffer | null = null;

    static async create(src: string) {
        const playerId: string = await window.electron.ipcRenderer.invoke('player-create');
        console.log('player-get-info', playerId, src);
        const info = await window.electron.ipcRenderer.invoke('player-get-info', playerId, src);
        return new PlayerController(src, playerId, info.duration);
    }

    private processPendingBuffers() {
        if (this.isAppending || !this.sourceBuffer || this.sourceBuffer.updating || this.pendingBuffers.length === 0) {
            return;
        }

        const chunk = this.pendingBuffers.shift();
        if (!chunk) return;

        try {
            this.isAppending = true;
            this.sourceBuffer.appendBuffer(chunk);
        } catch (e) {
            console.error('[MSE] appendBuffer error:', e);
            this.isAppending = false;
            // Если квад переполнен, ждем и пробуем снова
            if ((e as Error).name === 'QuotaExceededError') {
                this.pendingBuffers.unshift(chunk);
                setTimeout(() => this.processPendingBuffers(), 100);
            }
        }
    }

    private cleanupBuffer() {
        if (!this.sourceBuffer || this.sourceBuffer.updating || this.isAppending || !this.element) return;

        try {
            if (this.sourceBuffer.buffered.length > 0) {
                const start = this.sourceBuffer.buffered.start(0);
                const ct = this.element.currentTime;

                if (ct - start > 30) {
                    this.isAppending = true;
                    this.sourceBuffer.remove(start, ct - 10);
                }
            }
        } catch (e) {
            this.isAppending = false;
        }
    }

    private async fetchStream(seekTime = 0) {
        if (this.fetchController) {
            this.fetchController.abort();
        }

        this.fetchController = new AbortController();
        const streamUrl = await window.electron.ipcRenderer.invoke('player-get-url', this.playerId, this.src, seekTime);

        console.log('[Stream] Fetching:', streamUrl);

        try {
            const response = await fetch(streamUrl, {
                signal: this.fetchController.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            if (!response.body) return;

            const reader = response.body.getReader();
            let totalReceived = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    console.log('[Stream] Done. Total received:', totalReceived, 'bytes');
                    // Ждем пока все данные обработаются
                    const waitForFinish = () => {
                        if (this.isAppending || this.pendingBuffers.length > 0) {
                            setTimeout(waitForFinish, 100);
                        } else {
                            if (this.mediaSource?.readyState === 'open') {
                                try {
                                    this.mediaSource.endOfStream();
                                } catch (e) {
                                    // ignore
                                }
                            }
                        }
                    };
                    waitForFinish();
                    break;
                }

                totalReceived += value.length;
                this.pendingBuffers.push(value);
                this.processPendingBuffers();

                // Показываем готовность, когда есть достаточно буфера
                if (!this.isReady && this.sourceBuffer && this.sourceBuffer.buffered.length > 0) {
                    const bufferedEnd = this.sourceBuffer.buffered.end(this.sourceBuffer.buffered.length - 1);
                    if (bufferedEnd > 1) {
                        this.isReady = true;
                        this.isLoading = false;
                        console.log('[Controls] Ready to play');
                    }
                }
            }
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error('[Stream] Fetch error:', err);
                this.isLoading = false;
            }
        }
    }

    private onSourceOpen(seekTime = 0) {
        if (!this.mediaSource) return;

        // fMP4 с H.264 + AAC
        const mimeType = 'video/mp4; codecs="avc1.4D002A, mp4a.40.2"';

        if (!MediaSource.isTypeSupported(mimeType)) {
            // Fallback на более совместимый профиль
            const fallbackMime = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
            if (!MediaSource.isTypeSupported(fallbackMime)) {
                console.error('[MSE] No supported MIME type found');
                console.log('[MSE] Supported types:', MediaSource.isTypeSupported('video/mp4'));
                this.isLoading = false;
                return;
            }
            console.log('[MSE] Using fallback MIME type');
        }

        try {
            this.sourceBuffer = this.mediaSource.addSourceBuffer(mimeType);
        } catch (e) {
            console.error('[MSE] Failed to add SourceBuffer:', e);
            this.isLoading = false;
            return;
        }

        this.sourceBuffer.mode = 'segments';

        this.sourceBuffer.addEventListener('updateend', () => {
            this.isAppending = false;
            this.processPendingBuffers();
        });

        this.sourceBuffer.addEventListener('error', (e) => {
            console.error('[MSE] SourceBuffer error:', e);
            this.isLoading = false;
        });

        // Запуск очистки буфера
        this.cleanupInterval = setInterval(() => {
            this.cleanupBuffer();
        }, 5000);

        this.fetchStream(seekTime);
    }

    protected initMediaSource(seekTime = 0) {
        if (!this.element) return;

        // Очистка предыдущего состояния
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.fetchController) {
            this.fetchController.abort();
            this.fetchController = null;
        }

        if (this.mediaSource) {
            try {
                if (this.mediaSource.readyState === 'open') {
                    this.mediaSource.endOfStream();
                }
            } catch (e) {
                // ignore
            }
        }

        this.isAppending = false;
        this.pendingBuffers = [];

        this.mediaSource = new MediaSource();
        this.element.src = URL.createObjectURL(this.mediaSource);

        this.mediaSource.addEventListener('sourceopen', () => {
            console.log('[MSE] Source opened');
            this.onSourceOpen(seekTime);
        }, { once: true });

        this.mediaSource.addEventListener('sourceerror', (e) => {
            console.error('[MSE] Source error:', e);
            this.isLoading = false;
        });
    }

    constructor(
        protected src: string,
        protected playerId: string,
        public duration: number
    ) {}

    init(element: HTMLVideoElement | HTMLAudioElement | undefined) {
        this.element = element;
        this.element?.addEventListener("timeupdate", event => {
            this.currentTime = this.seeked + (event.target as HTMLVideoElement | HTMLAudioElement)?.currentTime;
        });
        this.initMediaSource();
    }

    play() {
        if (!this.element) return;
        this.element.play();
        this.isPlaying = true;
    }

    pause() {
        if (!this.element) return;
        this.element.pause();
        this.isPlaying = false;
    }

    toggle() {
        if (!this.element) return;
        if (this.element.paused) this.play();
        else this.pause();
    }

    seekInput() {
        this.isSeeking = true;
    }

    async seekChange(time: number) {
        this.isSeeking = false;
        this.seeked = time;
        if (!this.element) return;

        const wasPlaying = !this.element.paused;

        await window.electron.ipcRenderer.invoke('player-stop', this.playerId);
        this.initMediaSource(time);

        if (wasPlaying) {
            const tryPlay = () => {
                if (this.isReady) {
                    this.element?.play();
                    this.isPlaying = true;
                } else {
                    setTimeout(tryPlay, 100);
                }
            };
            tryPlay();
        }
    }

    fadeIn() {
        if (!this.element) return;

    }

    fadeOut() {
        if (!this.element) return;

    }

    cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.fetchController) {
            this.fetchController.abort();
        }
        if (this.playerId) {
            window.electron.ipcRenderer.invoke('player-destroy', this.playerId);
        }
    }
}