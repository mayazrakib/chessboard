import type { Color, Move, Piece, PieceSymbol, Square, } from "chess.js";

import type { CustomizationOptions, ResolvedCustomization, } from "./configuration.js";

export type { Color, Move, Piece, PieceSymbol, Square, } from "chess.js";

export type Orientation = "white" | "black";

export type BoardTheme = "brown" | "sage" | "slate" | "linen";

export type QualityProfile = "full" | "balanced" | "minimal";

export type CapturedPieceDisplay = "counts" | "stacked";

export type MarkColor = "amber" | "blue" | "green" | "red";

export type BoardMark = {
    id?: string;
    group?: string;
    label?: string;
    from: Square;
    to?: Square;
    color?: MarkColor;
    source?: "user" | "engine";
};

export type PieceRenderer = (
    piece: Piece,
    square: Square,
) => Node | string;

export type ChessboardOptions = CustomizationOptions & {
    is_muted?: boolean;
    orientation?: Orientation;
    theme?: BoardTheme;
    quality_profile?: QualityProfile;
    interactive?: boolean;
    show_coordinates?: boolean;
    show_captured_pieces?: boolean;
    captured_piece_display?: CapturedPieceDisplay;
    show_legal_moves?: boolean;
    show_last_move?: boolean;
    animation_duration?: number;
    premove_color?: Color;
    piece_renderer?: PieceRenderer;
    move_mode?: "automatic" | "controlled";
    event_detail?: "full" | "compact";
    playable_color?: Color | "both";
    assets?: ChessboardAssets;
};

export type ChessboardMoveDetail = ChessboardChangeDetail & {
    move: Move;
    fen: string;
    pgn?: string;
};

export type ChessboardPositionDetail = ChessboardChangeDetail & {
    fen: string;
    pgn?: string;
};

export type ChessboardStatus = {
    turn: Color;
    is_check: boolean;
    is_checkmate: boolean;
    is_stalemate: boolean;
    is_draw: boolean;
    is_game_over: boolean;
};

export type ChessboardErrorDetail = {
    reason: "illegal_move" | "invalid_position" | "invalid_pgn" | "render_failed" | "audio_failed";
    message: string;
};

export type MoveInput = {
    from: Square;
    to: Square;
    promotion?: PieceSymbol;
};

export type DragState = {
    from: Square;
    pointer_id: number;
    start_x_px: number;
    start_y_px: number;
    grab_offset_x_px: number;
    grab_offset_y_px: number;
    is_drawing: boolean;
    is_dragging: boolean;
    can_drag: boolean;
    legal_targets: Set<Square>;
};

export type PieceNode = HTMLSpanElement & {
    piece_key?: string;
};

export type BoardSquare = HTMLButtonElement & {
    square_name?: Square;
};

export type PromotionRequest = {
    from: Square;
    to: Square;
    color: Color;
};

export type ChessboardAssets = {
    stylesheet_url?: string | null;
    piece_sprite_url?: string;
};

export type ChangeSource = "api" | "pointer" | "keyboard" | "premove" | "replay" | "system";

export type ChangeReason = "move" | "undo" | "redo" | "position loaded" | "game loaded" | "replay seek" | "options changed" | "annotations changed" | "selection changed" | "premove changed" | "assets changed";

export type ChessboardChangeDetail = {
    revision: number;
    reason: ChangeReason;
    source: ChangeSource;
};

export type MoveRequest = {
    id: number;
    revision: number;
    input: MoveInput;
    source: ChangeSource;
};

export type MoveRequestEndDetail = {
    request: MoveRequest;
    status: "committed" | "rejected" | "stale";
};

export type Annotation = BoardMark & {
    id: string;
    group: string;
};

export type AnnotationsDetail = ChessboardChangeDetail & {
    annotations: Annotation[];
};

export type HistoryState = {
    index: number;
    length: number;
    can_undo: boolean;
    can_redo: boolean;
};

export type ResolvedChessboardOptions = Required<Omit<
    ChessboardOptions,
    "assets" | "piece_renderer" | "premove_color" | keyof CustomizationOptions
>> & Pick<
    ChessboardOptions,
    "piece_renderer" | "premove_color"
> & ResolvedCustomization & {
    assets: Required<ChessboardAssets>;
};
