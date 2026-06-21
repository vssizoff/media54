import ffmpeg, {FfmpegCommand} from "fluent-ffmpeg";
import {path as ffmpegPath} from "@ffmpeg-installer/ffmpeg";
import * as http from "node:http";
import type {AddressInfo} from "node:net";
import {ipcMain} from "electron";

ffmpeg.setFfmpegPath(ffmpegPath);

let server: http.Server | null = null;
let serverPort: number = 0;

// Хранилище активных плееров: Map<playerId, { process, filePath }>
const activePlayers = new Map<string, {process: FfmpegCommand | null, filePath: string | null}>();

export function startVideoServer() {
    server = http.createServer((req, res) => {
        if (!req.url) return;

        // Парсим URL: /stream/:playerId?file=...&seek=...
        const urlMatch = req.url.match(/^\/stream\/([^/?]+)(\?.*)?$/);

        if (!urlMatch) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        const playerId = decodeURIComponent(urlMatch[1]);
        const urlParams = new URL(req.url, `http://${req.headers.host}`);
        const filePath = urlParams.searchParams.get('file');
        const seekTime = urlParams.searchParams.get('seek') || '0';

        if (!filePath) {
            res.writeHead(400);
            res.end('Missing file parameter');
            return;
        }

        // Убиваем предыдущий процесс этого плеера (например, при перемотке)
        const existing = activePlayers.get(playerId);
        if (existing && existing.process) {
            existing.process.kill('SIGKILL');
        }

        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
        });

        // Запускаем новый FFmpeg-процесс для этого плеера
        const ffmpegProcess = ffmpeg(filePath)
            .seekInput(seekTime)
            .outputOptions([
                '-c:v libx264',
                '-preset veryfast',          // Баланс между скоростью и качеством (было ultrafast)
                '-tune zerolatency',
                '-profile:v high',           // High profile для лучшего качества (было main)
                '-level 4.1',
                '-crf 20',                   // Constant Rate Factor: 18-23 = хорошее качество, 20 = оптимально
                '-maxrate 8000k',            // Максимальный битрейт 8 Mbps (было 3000k)
                '-bufsize 16000k',           // Буфер для стабилизации битрейта
                '-g 48',
                '-keyint_min 48',
                '-sc_threshold 0',
                '-c:a aac',
                '-b:a 192k',                 // Улучшенный аудио битрейт (было 128k)
                '-ar 48000',                 // Частота дискретизации 48kHz
                '-f mp4',
                '-movflags frag_keyframe+empty_moov+default_base_moof',
                '-frag_duration 2000000'
            ])
            .on('error', (err) => {
                // Ошибки при остановке/перемотке — это нормально
                if (!err.message.includes('SIGKILL') && !err.message.includes('SIGTERM')) {
                    console.log(`[Player ${playerId}] FFmpeg error:`, err.message);
                }
            })
            .on('end', () => {
                activePlayers.delete(playerId);
            });

        ffmpegProcess.pipe(res, { end: true });

        // Сохраняем процесс в хранилище
        activePlayers.set(playerId, {
            process: ffmpegProcess,
            filePath: filePath
        });

        // Если клиент отключился — убиваем процесс
        req.on('close', () => {
            if (ffmpegProcess) {
                ffmpegProcess.kill('SIGKILL');
                activePlayers.delete(playerId);
            }
        });
    });

    server.listen(0, '127.0.0.1', () => {
        serverPort = (server?.address() as AddressInfo).port;
        console.log(`Video streaming server running on http://127.0.0.1:${serverPort}`);
    });
}

// === IPC обработчики ===

// Получить уникальный ID для нового плеера
ipcMain.handle('player-create', () => {
    const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    activePlayers.set(playerId, { process: null, filePath: null });
    return playerId;
});

// Получить метаданные видео (длительность, разрешение)
ipcMain.handle('player-get-info', async (_, _0, filePath: string) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

            resolve({
                duration: metadata.format.duration || 0,
                width: videoStream ? videoStream.width : 0,
                height: videoStream ? videoStream.height : 0,
                hasAudio: !!audioStream
            });
        });
    });
});

// Получить URL для стриминга конкретного плеера
ipcMain.handle('player-get-url', (_, playerId, filePath, seekTime = 0) => {
    // Обновляем путь в хранилище
    const existing = activePlayers.get(playerId);
    if (existing) {
        existing.filePath = filePath;
    } else {
        activePlayers.set(playerId, { process: null, filePath: filePath });
    }

    return `http://127.0.0.1:${serverPort}/stream/${encodeURIComponent(playerId)}?file=${encodeURIComponent(filePath)}&seek=${seekTime}`;
});

// Остановить конкретный плеер
ipcMain.handle('player-stop', (_, playerId) => {
    const player = activePlayers.get(playerId);
    if (player && player.process) {
        player.process.kill('SIGKILL');
        player.process = null;
    }
    return true;
});

// Удалить плеер (при unmount компонента)
ipcMain.handle('player-destroy', (_, playerId) => {
    const player = activePlayers.get(playerId);
    if (player && player.process) {
        player.process.kill('SIGKILL');
    }
    activePlayers.delete(playerId);
    return true;
});

export function killPlayers() {
    for (const [_, player] of activePlayers) {
        if (player.process) {
            player.process.kill('SIGKILL');
        }
    }
    activePlayers.clear();
}