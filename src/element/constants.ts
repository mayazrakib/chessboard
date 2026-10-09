import type { BoardTheme, ChessboardErrorDetail, ChessboardOptions, QualityProfile, } from "../api/types.js";
import type { CustomizationOptions, } from "../configuration/options.js";

export const FILES = "abcdefgh";
export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
export const DEFAULT_FRAME_DURATION_MS = 1000 / 60;
export const TILT_SETTLE_THRESHOLD_DEGREES = .02;
export const TILT_RESPONSE_TIME_CONSTANT = 3;
export const DRAG_MAXIMUM_LAG_SQUARES = .16;
export const DRAG_OFFSET_SETTLE_THRESHOLD_PX = .05;
export const DRAG_VELOCITY_SETTLE_THRESHOLD_PX_PER_SECOND = 2;
export const RETURN_DURATION_MS = 220;
export const MAXIMUM_PREMOVES = 32;
export const DEFAULT_ANIMATION_DURATION_MS = 260;
export const HINT_DURATION_MS = 220;
export const STATE_DURATION_MS = 200;
export const BOARD_SIZE = FILES.length;
export const LAST_FILE_INDEX = BOARD_SIZE - 1;
export const PROMOTION_DURATION_MS = 220;
export const THEMES: BoardTheme[] = ["brown", "sage", "slate", "linen",];
export const QUALITY_PROFILES: QualityProfile[] = ["full", "balanced", "minimal",];
export const ERROR_OPERATIONS: Record<
    ChessboardErrorDetail["reason"],
    string
> = {
    illegal_move: "Failed to make the move",
    invalid_position: "Failed to load the position",
    invalid_pgn: "Failed to load the PGN",
    render_failed: "Failed to render board content",
    audio_failed: "Failed to play board audio",
};
export const DEFAULT_OPTIONS: Required<Omit<
    ChessboardOptions,
    "piece_renderer" | "premove_color" | "assets" | keyof CustomizationOptions
>> = {
    orientation: "white",
    theme: "brown",
    quality_profile: "full",
    interactive: true,
    show_coordinates: true,
    show_captured_pieces: true,
    captured_piece_display: "stacked",
    show_legal_moves: true,
    show_last_move: true,
    animation_duration: DEFAULT_ANIMATION_DURATION_MS,
    move_mode: "automatic",
    event_detail: "full",
    playable_color: "both",
    is_muted: false,
};
