export type BoardSound = "move" | "capture" | "check" | "checkmate" | "draw" | "win" | "lose";

const SOUND_URLS: Record<
    BoardSound,
    string
> = {
    win: new URL(
        "../asset/audio/notification.mp3",
        import.meta.url,
    ).href,
    lose: new URL(
        "../asset/audio/notification.mp3",
        import.meta.url,
    ).href,
    move: new URL(
        "../asset/audio/move.mp3",
        import.meta.url,
    ).href,
    capture: new URL(
        "../asset/audio/capture.mp3",
        import.meta.url,
    ).href,
    check: new URL(
        "../asset/audio/check.mp3",
        import.meta.url,
    ).href,
    checkmate: new URL(
        "../asset/audio/checkmate.mp3",
        import.meta.url,
    ).href,
    draw: new URL(
        "../asset/audio/notification.mp3",
        import.meta.url,
    ).href,
};

export class BoardAudio {
    private readonly owner_document: Document;
    private readonly report_error: (error: unknown,) => void;
    private audio: HTMLAudioElement | null = null;

    constructor(
        owner_document: Document,
        report_error: (error: unknown,) => void,
    ) {
        this.owner_document = owner_document;
        this.report_error = report_error;
    }

    play(
        sound: BoardSound,
        settings: { volume?: number; url?: string | null; } = {},
    ): void {
        if (settings.url === null) {
            return;
        }

        this.audio ??= this.owner_document.createElement("audio",);
        const audio = this.audio;
        audio.pause();
        audio.src = settings.url ?? SOUND_URLS[sound];
        audio.volume = settings.volume ?? 1;
        audio.currentTime = 0;

        try {
            void audio.play().catch((error: unknown,) => this.handle_playback_error(error,),);
        } catch (error) {
            this.handle_playback_error(error,);
        }
    }

    stop(): void {
        this.audio?.pause();
    }

    private handle_playback_error(error: unknown,): void {
        const name = error && typeof error === "object" && "name" in error ? error.name : undefined;

        if (name === "NotAllowedError" || name === "AbortError") {
            return;
        }

        this.report_error(error,);
    }
}
