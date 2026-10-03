import type { Color, Piece, PieceSymbol, Square, } from "chess.js";

import type { BoardSound, } from "./audio.js";
import { get_promotion_name, } from "./pieces.js";
import type { ChessboardErrorDetail, ChessboardStatus, PromotionRequest, } from "./types.js";

export type PieceKey = `${Color}${PieceSymbol}`;

export type KeyboardShortcuts = {
    undo: string[];
    redo: string[];
    cancel: string[];
    activate: string[];
    left: string[];
    right: string[];
    up: string[];
    down: string[];
};

export type InteractionOptions = {
    can_drag: boolean;
    can_click_move: boolean;
    can_use_keyboard: boolean;
    can_draw_annotations: boolean;
    can_premove: boolean;
    touch_mode: "move" | "annotate";
    drag_threshold_px: number;
    keyboard_shortcuts: KeyboardShortcuts;
};

export type AccessibilityOptions = {
    announce_moves: boolean;
    announce_annotations: boolean;
};

export type AnnotationOptions = {
    clear_on_left_click: "all" | "user" | "groups" | "none";
    clear_groups: string[];
    default_color: "amber" | "blue" | "green" | "red";
    arrow_width_squares: number;
    arrow_head_width_squares: number;
    arrow_head_length_squares: number;
};

export type PieceOptions = {
    urls: Partial<Record<
        PieceKey,
        string
    >>;
    resolve_url: ((
        piece: Piece,
        square: Square,
    ) => string | null) | null;
    scale: number;
    padding_px: number;
};

export type SoundOptions = {
    volume: number;
    player_color: Color | null;
    urls: Partial<Record<
        BoardSound,
        string | null
    >>;
    enabled: Record<
        BoardSound,
        boolean
    >;
    should_play_on_moves: boolean;
    should_play_on_history: boolean;
    should_play_on_replay: boolean;
};

export type PromotionOptions = {
    mode: "choose" | "automatic" | "external";
    default_piece: "q" | "r" | "b" | "n";
    choices: ("q" | "r" | "b" | "n")[];
    request: ((
        request: PromotionRequest,
        complete: (piece: "q" | "r" | "b" | "n" | null,) => void,
    ) => void) | null;
};

export type MaterialContext = {
    color: Color;
    piece_count: number;
    points: number;
    difference: number;
    captures: readonly PieceSymbol[];
};

export type BoardLabels = {
    board: string;
    promotion: string;
    white: string;
    black: string;
    no_captures: string;
    captures_description: string;
    material_description: string;
    format_material_label: (
        context: MaterialContext,
        default_label: string,
    ) => string;
    format_capture: (
        color: Color,
        piece: PieceSymbol,
        count: number,
        default_label: string,
    ) => string;
    format_advantage: (
        difference: number,
        default_label: string,
    ) => string;
    format_square: (
        square: Square,
        piece: Piece | undefined,
        is_selected: boolean,
        is_legal: boolean,
        is_check: boolean,
        default_label: string,
    ) => string;
    format_promotion: (piece: PieceSymbol,) => string;
    format_material: (context: MaterialContext,) => string;
    format_error: (
        reason: ChessboardErrorDetail["reason"],
        message: string,
    ) => string;
};

export type SquareContext = {
    square: Square;
    piece: Piece | null;
    status: ChessboardStatus;
    is_selected: boolean;
};

export type BoardRenderers = {
    square_overlay: ((context: SquareContext,) => Node | string | null) | null;
    promotion_choice: ((piece: Piece,) => Node | string) | null;
    material: ((context: MaterialContext,) => Node | string) | null;
};

export type ResolvedCustomization = {
    accessibility: AccessibilityOptions;
    interaction: InteractionOptions;
    annotations: AnnotationOptions;
    pieces: PieceOptions;
    sound: SoundOptions;
    promotion: PromotionOptions;
    labels: BoardLabels;
    renderers: BoardRenderers;
};

export type CustomizationOptions = {
    accessibility?: Partial<AccessibilityOptions>;
    interaction?: Partial<Omit<
        InteractionOptions,
        "keyboard_shortcuts"
    >> & { keyboard_shortcuts?: Partial<KeyboardShortcuts>; };
    annotations?: Partial<AnnotationOptions>;
    pieces?: Partial<PieceOptions>;
    sound?: Partial<Omit<
        SoundOptions,
        "enabled"
    >> & { enabled?: Partial<SoundOptions["enabled"]>; };
    promotion?: Partial<PromotionOptions>;
    labels?: Partial<BoardLabels>;
    renderers?: Partial<BoardRenderers>;
};

export const DEFAULT_LABELS: BoardLabels = {
    board: "Chessboard",
    promotion: "Choose promotion piece",
    white: "White",
    black: "Black",
    no_captures: "No captures",
    captures_description: "Captured pieces from recorded moves.",
    material_description: "Remaining material: pawn 1, knight 3, bishop 3, rook 5, queen 9. Kings have no point value.",
    format_material_label: (
        context,
        default_label,
    ) => {
        void context;

        return default_label;
    },
    format_capture: (
        color,
        piece,
        count,
        default_label,
    ) => {
        void color;
        void piece;
        void count;

        return default_label;
    },
    format_advantage: (
        difference,
        default_label,
    ) => {
        void difference;

        return default_label;
    },
    format_square: (
        square,
        piece,
        is_selected,
        is_legal,
        is_check,
        default_label,
    ) => {
        void square;
        void piece;
        void is_selected;
        void is_legal;
        void is_check;

        return default_label;
    },
    format_promotion: (piece,) => `Promote to ${get_promotion_name(piece,)}`,
    format_material: (context,) => `${context.piece_count} pieces · ${context.points} ${context.points === 1 ? "pt" : "pts"}`,
    format_error: (
        reason,
        message,
    ) => {
        void reason;

        return message;
    },
};
const DEFAULT_CUSTOMIZATION: ResolvedCustomization = {
    accessibility: {
        announce_moves: false,
        announce_annotations: false,
    },
    interaction: {
        can_drag: true,
        can_click_move: true,
        can_use_keyboard: true,
        can_draw_annotations: true,
        can_premove: false,
        touch_mode: "move",
        drag_threshold_px: 5,
        keyboard_shortcuts: {
            undo: ["ArrowLeft", "ArrowDown",],
            redo: ["ArrowRight", "ArrowUp",],
            cancel: ["Escape",],
            activate: ["Enter", " ",],
            left: ["Shift+ArrowLeft",],
            right: ["Shift+ArrowRight",],
            up: ["Shift+ArrowUp",],
            down: ["Shift+ArrowDown",],
        },
    },
    annotations: {
        clear_on_left_click: "all",
        clear_groups: [],
        default_color: "amber",
        arrow_width_squares: 0.18,
        arrow_head_width_squares: 0.44,
        arrow_head_length_squares: 0.34,
    },
    pieces: { urls: {}, resolve_url: null, scale: 1, padding_px: 0, },
    sound: {
        volume: 0.6,
        player_color: null,
        urls: {},
        enabled: { move: true, capture: true, check: true, checkmate: true, draw: true, win: true, lose: true, },
        should_play_on_moves: true,
        should_play_on_history: true,
        should_play_on_replay: true,
    },
    promotion: { mode: "choose", default_piece: "q", choices: ["q", "r", "b", "n",], request: null, },
    labels: DEFAULT_LABELS,
    renderers: { square_overlay: null, promotion_choice: null, material: null, },
};

function copy_configuration(input: unknown,): unknown {
    if (Array.isArray(input,)) {
        return input.map(copy_configuration,);
    }

    if (input && typeof input === "object") {
        return Object.fromEntries(Object.entries(input,).map(([key, entry,],) => [key, copy_configuration(entry,),],),);
    }

    return input;
}

function merge_configuration(
    defaults: Record<
        string,
        unknown
    >,
    current: Record<
        string,
        unknown
    >,
    changes: Record<
        string,
        unknown
    >,
): Record<
    string,
    unknown
> {
    const merged = copy_configuration(current,) as Record<
        string,
        unknown
    >;

    for (const [key, entry,] of Object.entries(changes,)) {
        if (!Object.hasOwn(
            defaults,
            key,
        )) {
            throw new TypeError(`Failed to configure the board: unknown setting ${key}.`,);
        }

        const fallback = defaults[key];

        if (entry === undefined) {
            merged[key] = copy_configuration(fallback,);
        } else if (fallback && typeof fallback === "object" && !Array.isArray(fallback,)) {
            if (!entry || typeof entry !== "object" || Array.isArray(entry,)) {
                throw new TypeError(`Failed to configure the board: ${key} must be an object.`,);
            }

            merged[key] = Object.keys(fallback,).length === 0
                ? { ...(current[key] as object), ...entry, }
                : merge_configuration(
                    fallback as Record<
                        string,
                        unknown
                    >,
                    current[key] as Record<
                        string,
                        unknown
                    >,
                    entry as Record<
                        string,
                        unknown
                    >,
                );
        } else {
            const is_nullable_color = key === "player_color" && (entry === "w" || entry === "b");
            const is_invalid_nullable = entry !== null && typeof entry !== "function" && !is_nullable_color;
            const is_invalid_array = !Array.isArray(entry,) || entry.some((part,) => typeof part !== "string",);
            const is_invalid = fallback === null ? is_invalid_nullable
                : Array.isArray(fallback,) ? is_invalid_array
                    : typeof entry !== typeof fallback;

            if (is_invalid) {
                throw new TypeError(`Failed to configure the board: ${key} has an invalid type.`,);
            }

            merged[key] = copy_configuration(entry,);
        }
    }

    return merged;
}

export function resolve_customization(
    changes: CustomizationOptions,
    current: ResolvedCustomization = DEFAULT_CUSTOMIZATION,
): ResolvedCustomization {
    const selected: Record<
        string,
        unknown
    > = {};

    for (const key of Object.keys(DEFAULT_CUSTOMIZATION,) as (keyof CustomizationOptions)[]) {
        if (Object.hasOwn(
            changes,
            key,
        )) {
            selected[key] = changes[key];
        }
    }

    const resolved = merge_configuration(
        DEFAULT_CUSTOMIZATION,
        current,
        selected,
    ) as ResolvedCustomization;
    const ranges = [
        [resolved.interaction.drag_threshold_px, 0, 100,],
        [resolved.pieces.scale, 0.1, 2,],
        [resolved.pieces.padding_px, 0, 100,],
        [resolved.sound.volume, 0, 1,],
        [resolved.annotations.arrow_width_squares, 0.01, 1,],
        [resolved.annotations.arrow_head_width_squares, 0.01, 1,],
        [resolved.annotations.arrow_head_length_squares, 0.01, 1,],
    ];

    if (ranges.some(([number, minimum, maximum,],) => !Number.isFinite(number,) || number! < minimum! || number! > maximum!,)) {
        throw new RangeError("Failed to configure the board: a numeric setting is outside its supported range.",);
    }

    if (!["all", "user", "groups", "none",].includes(resolved.annotations.clear_on_left_click,) || !["amber", "blue", "green", "red",].includes(resolved.annotations.default_color,) || !["choose", "automatic", "external",].includes(resolved.promotion.mode,) || !["move", "annotate",].includes(resolved.interaction.touch_mode,)) {
        throw new TypeError("Failed to configure the board: an option has an unsupported value.",);
    }

    if (!resolved.promotion.choices.length || new Set(resolved.promotion.choices,).size !== resolved.promotion.choices.length || [...resolved.promotion.choices, resolved.promotion.default_piece,].some((piece,) => !["q", "r", "b", "n",].includes(piece,),)) {
        throw new TypeError("Failed to configure promotion: choices must be unique legal promotion pieces.",);
    }

    if (resolved.promotion.mode === "automatic" && !resolved.promotion.choices.includes(resolved.promotion.default_piece,)) {
        throw new TypeError("Failed to configure promotion: the automatic piece must appear in choices.",);
    }

    if (resolved.promotion.mode === "external" && !resolved.promotion.request) {
        throw new TypeError("Failed to configure promotion: external mode requires a request callback.",);
    }

    if (resolved.sound.player_color !== null && resolved.sound.player_color !== "w" && resolved.sound.player_color !== "b") {
        throw new TypeError("Failed to configure sound: the player color must be w, b, or null.",);
    }

    for (const [key, url,] of Object.entries(resolved.pieces.urls,)) {
        if (!/^[wb][pnbrqk]$/.test(key,) || (url !== undefined && (typeof url !== "string" || !url.trim()))) {
            throw new TypeError("Failed to configure pieces: a piece key or URL is invalid.",);
        }
    }

    for (const [key, url,] of Object.entries(resolved.sound.urls,)) {
        if (!Object.hasOwn(
            DEFAULT_CUSTOMIZATION.sound.enabled,
            key,
        ) || (url !== null && url !== undefined && (typeof url !== "string" || !url.trim()))) {
            throw new TypeError("Failed to configure sound: a sound name or URL is invalid.",);
        }
    }

    return resolved;
}

export function matches_shortcut(
    event: KeyboardEvent,
    bindings: readonly string[],
): boolean {
    const pressed = `${event.ctrlKey ? "Control+" : ""}${event.altKey ? "Alt+" : ""}${event.metaKey ? "Meta+" : ""}${event.shiftKey ? "Shift+" : ""}${event.key}`;

    return bindings.includes(pressed,);
}
