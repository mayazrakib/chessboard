import type { Square, } from "chess.js";

import type { ChessboardElement, } from "./chessboard.js";
import type {
    AnnotationsDetail,
    BoardMark,
    ChessboardChangeDetail,
    ChessboardErrorDetail,
    ChessboardMoveDetail,
    ChessboardPositionDetail,
    ChessboardStatus,
    MoveInput,
    MoveRequest,
    MoveRequestEndDetail,
} from "./types.js";

export { configure_chessboard_assets, } from "./asset.js";
export { ChessboardElement, define_chessboard, } from "./chessboard.js";
export type { BoardSound, } from "./audio.js";
export type { AccessibilityOptions, AnnotationOptions, BoardLabels, BoardRenderers, CustomizationOptions, InteractionOptions, KeyboardShortcuts, MaterialContext, PieceKey, PieceOptions, PromotionOptions, ResolvedCustomization, SoundOptions, SquareContext, } from "./configuration.js";
export { PgnReplay, } from "./replay.js";
export { STANDARD_RULES_PROVIDER, } from "./rules.js";
export type { RulesGame, RulesProvider, } from "./rules.js";
export type {
    Annotation,
    AnnotationsDetail,
    BoardMark,
    BoardTheme,
    CapturedPieceDisplay,
    ChangeReason,
    ChangeSource,
    ChessboardAssets,
    ChessboardChangeDetail,
    ChessboardErrorDetail,
    ChessboardMoveDetail,
    ChessboardOptions,
    ChessboardPositionDetail,
    ChessboardStatus,
    Color,
    HistoryState,
    MarkColor,
    Move,
    MoveInput,
    MoveRequest,
    MoveRequestEndDetail,
    Orientation,
    Piece,
    PieceRenderer,
    PieceSymbol,
    PromotionRequest,
    QualityProfile,
    ResolvedChessboardOptions,
    Square,
} from "./types.js";

declare global {

    interface HTMLElementTagNameMap {
        "meson-chessboard": ChessboardElement;
    }

    interface HTMLElementEventMap {
        "chessboard:move_request": CustomEvent<MoveRequest>;
        "chessboard:move_request_end": CustomEvent<MoveRequestEndDetail>;
        "chessboard:change": CustomEvent<ChessboardChangeDetail>;
        "chessboard:annotations": CustomEvent<AnnotationsDetail>;
        "chessboard:ready": CustomEvent<{
            revision: number;
        }>;
        "chessboard:animation_complete": CustomEvent<{
            revision: number;
        }>;
        "chessboard:move": CustomEvent<ChessboardMoveDetail>;
        "chessboard:position": CustomEvent<ChessboardPositionDetail>;
        "chessboard:select": CustomEvent<ChessboardChangeDetail & {
            square: Square | null;
        }>;
        "chessboard:marks": CustomEvent<BoardMark[]>;
        "chessboard:premove": CustomEvent<MoveInput | null>;
        "chessboard:error": CustomEvent<ChessboardErrorDetail>;
        "chessboard:gameover": CustomEvent<ChessboardStatus & ChessboardChangeDetail>;
    }
}
