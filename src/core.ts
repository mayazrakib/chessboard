import type { Square, } from "chess.js";

import type { AnnotationsDetail, BoardMark, ChessboardChangeDetail, ChessboardErrorDetail, ChessboardMoveDetail, ChessboardPositionDetail, ChessboardStatus, MoveInput, MoveRequest, MoveRequestEndDetail, } from "./api/types.js";
import type { ChessboardElement, } from "./element/chessboard_element.js";

export { configure_chessboard_assets, } from "./infrastructure/assets.js";
export { ChessboardElement, define_chessboard, } from "./element/chessboard_element.js";
export type { BoardSound, } from "./media/audio.js";
export type { AccessibilityOptions, AnnotationOptions, BoardLabels, BoardRenderers, CustomizationOptions, InteractionOptions, KeyboardShortcuts, MaterialContext, PieceKey, PieceOptions, PromotionOptions, ResolvedCustomization, SoundOptions, SquareContext, } from "./configuration/options.js";
export { PgnReplay, } from "./replay.js";
export { STANDARD_RULES_PROVIDER, } from "./chess/rules.js";
export type { RulesGame, RulesProvider, } from "./chess/rules.js";
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
} from "./api/types.js";

declare global {

    interface HTMLElementTagNameMap {
        "chess-board": ChessboardElement;
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
