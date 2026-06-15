import ffmpeg, {FfmpegCommand} from "fluent-ffmpeg";
import {path as ffmpegPath} from "@ffmpeg-installer/ffmpeg";
import * as stream from "node:stream";

ffmpeg.setFfmpegPath(ffmpegPath);

export type VideoInfo = {
    width: number;
    height: number;
    duration: number;
    fps: number;
};

export type VideoFrame = {
    data: any;
    width: number;
    height: number;
}

function concatUint8Arrays(arrays: Array<Uint8Array>) {
    const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
    const result = new Uint8Array(totalLength);

    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }

    return result;
}

export default class VideoPlayer {
    private ffmpegProcess: FfmpegCommand | null = null
    private ffmpegStream: stream.Writable | stream.PassThrough | null = null
    protected isPlaying: boolean = false;
    protected currentFile: string | undefined = undefined;
    protected handler: (frame: VideoFrame) => void = () => {};

    async loadVideo(filePath: string): Promise<VideoInfo> {
        this.currentFile = filePath;

        // Получаем информацию о видео
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) return reject(err);

                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                if (!videoStream || !videoStream.width || !videoStream.height || !metadata.format.duration || !videoStream.r_frame_rate) return reject();
                resolve({
                    width: videoStream.width,
                    height: videoStream.height,
                    duration: metadata.format.duration,
                    fps: eval(videoStream.r_frame_rate)
                });
            });
        });
    }

    async play(startPosition = 0) {
        if (!this.currentFile) return;
        if (this.isPlaying) this.stop();

        const videoInfo = await this.loadVideo(this.currentFile);

        // Запускаем FFmpeg для декодирования в RAW frames
        this.ffmpegProcess = ffmpeg(this.currentFile)
            .seekInput(startPosition)
            .outputOptions([
                '-f rawvideo',
                '-pix_fmt rgb24',
                '-vcodec rawvideo',
                '-an' // без аудио
            ])
            .on('error', (err) => {
                console.error('FFmpeg error:', err);
            });

        this.ffmpegStream = this.ffmpegProcess.pipe();

        this.isPlaying = true;

        // Читаем кадры и отправляем в renderer
        let frameSize = videoInfo.width * videoInfo.height * 3;

        let buffer = new Uint8Array();
        this.ffmpegStream.on('data', (chunk: Buffer) => {
            buffer = concatUint8Arrays([buffer, Uint8Array.from(chunk)]);
            if (buffer.length >= frameSize) {
                this.handler({
                    data: buffer,
                    width: videoInfo.width,
                    height: videoInfo.height
                });
                buffer = buffer.slice(frameSize);
            }
        });
    }

    stop() {
        if (this.ffmpegProcess) {
            this.ffmpegProcess.kill("SIGKILL");
            this.ffmpegProcess = null;
        }
        this.isPlaying = false;
    }

    async seek(position: number) {
        this.stop();
        await this.play(position);
    }

    onFrame(handler: (frame: VideoFrame) => void) {
        this.handler = handler;
    }
}