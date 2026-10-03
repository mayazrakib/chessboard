import { type Color, DEFAULT_POSITION, type Move, type Piece, type PieceSymbol, type Square, } from "chess.js";

import { resolve_assets, } from "./asset.js";
import { BoardAudio, type BoardSound, } from "./audio.js";
import { type CustomizationOptions, matches_shortcut, resolve_customization, } from "./configuration.js";
import { render_material_rows, } from "./material.js";
import {
    advance_drag_spring,
    create_move_keyframes,
    DRAG_RESPONSE_MS,
    DRAG_SCALE,
    DRAG_SCALE_THRESHOLD,
    get_drag_tilt_degrees,
    MOVE_EASING,
} from "./motion.js";
import { create_piece_art, get_piece_name, get_promotion_name, is_point_over_piece, } from "./pieces.js";
import { type RulesGame, type RulesProvider, STANDARD_RULES_PROVIDER, } from "./rules.js";
import type {
    Annotation,
    BoardMark,
    BoardSquare,
    BoardTheme,
    ChangeReason,
    ChangeSource,
    ChessboardAssets,
    ChessboardChangeDetail,
    ChessboardErrorDetail,
    ChessboardOptions,
    ChessboardPositionDetail,
    ChessboardStatus,
    DragState,
    HistoryState,
    MoveInput,
    MoveRequest,
    PieceNode,
    PromotionRequest,
    QualityProfile,
    ResolvedChessboardOptions,
} from "./types.js";
import { format_uci_move, parse_uci_move, } from "./uci.js";

const FILES = "abcdefgh";
const HtmlElementBase = (globalThis.HTMLElement ?? class { }) as typeof HTMLElement;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const DEFAULT_FRAME_DURATION_MS = 1000 / 60;
const TILT_SETTLE_THRESHOLD_DEGREES = .02;
const TILT_RESPONSE_TIME_CONSTANT = 3;
const DRAG_MAXIMUM_LAG_SQUARES = .16;
const DRAG_OFFSET_SETTLE_THRESHOLD_PX = .05;
const DRAG_VELOCITY_SETTLE_THRESHOLD_PX_PER_SECOND = 2;
const RETURN_DURATION_MS = 220;
const MAXIMUM_PREMOVES = 32;
const DEFAULT_ANIMATION_DURATION_MS = 260;
const HINT_DURATION_MS = 220;
const STATE_DURATION_MS = 200;
const BOARD_SIZE = FILES.length;
const LAST_FILE_INDEX = BOARD_SIZE - 1;
const PROMOTION_DURATION_MS = 220;
const THEMES: BoardTheme[] = ["brown", "sage", "slate", "linen",];
const QUALITY_PROFILES: QualityProfile[] = ["full", "balanced", "minimal",];
const ERROR_OPERATIONS: Record<
    ChessboardErrorDetail["reason"],
    string
> = {
    illegal_move: "Failed to make the move",
    invalid_position: "Failed to load the position",
    invalid_pgn: "Failed to load the PGN",
    render_failed: "Failed to render board content",
    audio_failed: "Failed to play board audio",
};
const DEFAULT_OPTIONS: Required<Omit<
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

export class ChessboardElement extends HtmlElementBase {
    static get observedAttributes(): string[] {
        return ["fen", "orientation", "readonly", "coordinates", "theme",];
    }

    private revision = 0;
    private request_sequence = 0;
    private pending_request: MoveRequest | null = null;
    private interaction_source: ChangeSource = "api";
    private change_context: ChessboardChangeDetail = { revision: 0, reason: "position loaded", source: "system", };
    private assets = resolve_assets({},);
    private readonly stylesheet = document.createElement("link",);
    private stylesheet_state: "pending" | "loaded" | "failed" = "pending";
    private readonly ready_waiters: {
        resolve: () => void;
        reject: (error: Error,) => void;
    }[] = [];
    private readonly active_animations = new Set<Animation>();
    private animation_notification = 0;
    private readonly legal_moves_cache = new Map<
        Square,
        Move[]
    >();
    private readonly square_signatures = new Map<
        Square,
        string
    >();
    private readonly shape_nodes = new Map<
        string,
        {
            signature: string;
            node: SVGGElement;
        }
    >();
    private annotation_sequence = 0;
    private annotations: Annotation[] = [];
    private captured_pieces: Record<
        Color,
        PieceSymbol[]
    > = { w: [], b: [], };
    private material_revision = -1;
    private material_display = "";
    private rules_provider: RulesProvider = STANDARD_RULES_PROVIDER;
    private game: RulesGame = this.create_game();
    private recorded_moves: Pick<
        Move,
        "from" | "to" | "promotion" | "before" | "after" | "color" | "captured"
    >[] = [];
    private cached_pgn: string | null = null;
    private cached_status: ChessboardStatus | null = null;
    private readonly squares = new Map<
        Square,
        BoardSquare
    >();
    private readonly pieces = new Map<
        Square,
        PieceNode
    >();
    private readonly redo_moves: MoveInput[] = [];
    private readonly shadow = this.attachShadow({ mode: "open", },);
    private readonly board_surface = document.createElement("div",);
    private readonly celebration_layer = document.createElement("div",);
    private readonly announcer = document.createElement("div",);
    private announcement_sequence = 0;
    private is_checkmate_displayed = false;
    private readonly material_rows = {
        w: document.createElement("div",),
        b: document.createElement("div",),
    };
    private readonly board = document.createElement("div",);
    private readonly shape_layer = document.createElementNS(
        SVG_NAMESPACE,
        "svg",
    );
    private readonly promotion_layer = document.createElement("div",);
    private customization = resolve_customization({},);
    private options: ChessboardOptions = { ...DEFAULT_OPTIONS, };
    private marks: BoardMark[] = [];
    private selected_square: Square | null = null;
    private focused_square: Square = "e2";
    private last_move: Pick<
        Move,
        "from" | "to"
    > | null = null;
    private drag_state: DragState | null = null;
    private drag_ghost: HTMLSpanElement | null = null;
    private drag_target: Square | null = null;
    private move_origin: DOMRect | null = null;
    private premoves: MoveInput[] = [];

    private get premove(): MoveInput | null {
        return this.premoves[0] ?? null;
    }

    private queued_premove_color: Color | null = null;
    private promotion_request: PromotionRequest | null = null;
    private promotion_capture: PieceNode | null = null;
    private resize_observer: ResizeObserver | null = null;
    private is_ready = false;
    private drag_frame_id: number | null = null;
    private drag_pointer: PointerEvent | null = null;
    private processed_drag_pointer: PointerEvent | null = null;
    private drag_geometry: {
        rect: DOMRect;
        scale_x: number;
        scale_y: number;
    } | null = null;
    private drag_tilt_degrees = 0;
    private drag_offset_x_px = 0;
    private drag_offset_y_px = 0;
    private drag_velocity_x_px_per_second = 0;
    private drag_velocity_y_px_per_second = 0;
    private drag_frame_timestamp_ms = 0;
    private last_pointer_x_px = 0;
    private last_pointer_y_px = 0;
    private last_pointer_timestamp_ms = 0;
    private drag_return_animation: Animation | null = null;
    private pointer_release_controller: AbortController | null = null;
    private ready_frame_id: number | null = null;
    private readonly audio = new BoardAudio(
        this.ownerDocument,
        (error,) => this.emit_error(
            "audio_failed",
            error,
        ),
    );

    constructor() {
        super();

        const stylesheet = this.stylesheet;
        stylesheet.rel = "stylesheet";
        stylesheet.addEventListener(
            "load",
            () => {
                this.stylesheet_state = "loaded";
                this.schedule_ready_state();
            },
        );
        stylesheet.addEventListener(
            "error",
            () => {
                this.stylesheet_state = "failed";
                const error = new Error("Failed to load the chessboard stylesheet.",);

                for (const waiter of this.ready_waiters.splice(0,)) {
                    waiter.reject(error,);
                }
            },
        );

        if (this.assets.stylesheet_url === null) {
            this.stylesheet_state = "loaded";
        } else {
            stylesheet.href = this.assets.stylesheet_url;
        }

        this.board.className = "board";
        this.board.setAttribute(
            "part",
            "board",
        );
        this.board.setAttribute(
            "role",
            "grid",
        );
        this.board.setAttribute(
            "aria-label",
            "Chessboard",
        );
        this.shape_layer.classList.add("shapes",);
        this.shape_layer.setAttribute(
            "part",
            "annotations",
        );
        this.shape_layer.setAttribute(
            "viewBox",
            "0 0 8 8",
        );
        this.shape_layer.setAttribute(
            "aria-hidden",
            "true",
        );
        this.promotion_layer.className = "promotion_layer";
        this.promotion_layer.setAttribute(
            "part",
            "promotion-layer",
        );
        this.board_surface.className = "board_surface";
        this.board_surface.setAttribute(
            "part",
            "board-surface",
        );
        this.celebration_layer.className = "celebration_layer";
        this.celebration_layer.setAttribute(
            "aria-hidden",
            "true",
        );
        this.announcer.className = "visually_hidden";
        this.announcer.setAttribute(
            "role",
            "status",
        );
        this.announcer.setAttribute(
            "aria-live",
            "polite",
        );
        this.announcer.setAttribute(
            "aria-atomic",
            "true",
        );
        this.board_surface.append(
            this.board,
            this.shape_layer,
            this.promotion_layer,
            this.celebration_layer,
        );
        this.shadow.append(
            stylesheet,
            this.material_rows.b,
            this.board_surface,
            this.material_rows.w,
            this.announcer,
        );
        this.addEventListener(
            "pointerdown",
            this.handle_pointer_down,
        );
        this.addEventListener(
            "pointermove",
            this.handle_pointer_move,
        );
        this.addEventListener(
            "pointerup",
            this.handle_pointer_up,
        );
        this.addEventListener(
            "pointercancel",
            this.handle_pointer_cancel,
        );
        this.board.addEventListener(
            "lostpointercapture",
            this.handle_pointer_cancel,
        );
        this.addEventListener(
            "keydown",
            this.handle_key_down,
        );
        this.addEventListener(
            "contextmenu",
            this.handle_context_menu,
        );
    }

    connectedCallback(): void {
        if (!this.is_ready) {
            this.is_ready = true;
            this.read_attributes();
            this.build_squares();
        }

        this.render_position();
        this.ownerDocument.addEventListener(
            "scroll",
            this.invalidate_drag_geometry,
            true,
        );
        this.ownerDocument.defaultView?.addEventListener(
            "resize",
            this.invalidate_drag_geometry,
        );

        if (this.stylesheet.sheet || this.stylesheet_state === "loaded") {
            this.stylesheet_state = "loaded";
            this.schedule_ready_state();
        }

        if (!this.resize_observer && typeof ResizeObserver !== "undefined") {
            this.resize_observer = new ResizeObserver(() => {
                this.cancel_piece_animations();
                this.invalidate_drag_geometry();
            },);
            this.resize_observer.observe(this.board,);
        }
    }

    private schedule_ready_state(): void {
        if (!this.isConnected || this.stylesheet_state !== "loaded") {
            return;
        }

        if (this.ready_frame_id !== null) {
            cancelAnimationFrame(this.ready_frame_id,);
        }

        this.ready_frame_id = requestAnimationFrame(() => {
            this.ready_frame_id = requestAnimationFrame(() => {
                this.ready_frame_id = null;
                this.board.classList.add("ready",);

                for (const waiter of this.ready_waiters.splice(0,)) {
                    waiter.resolve();
                }

                this.dispatchEvent(new CustomEvent(
                    "chessboard:ready",
                    { detail: { revision: this.revision, }, bubbles: true, composed: true, },
                ),);
            },);
        },);
    }

    disconnectedCallback(): void {
        this.audio.stop();
        this.announcement_sequence += 1;
        this.announcer.textContent = "";
        this.celebration_layer.replaceChildren();
        this.is_checkmate_displayed = false;
        this.board.classList.remove("ready",);
        this.end_move_request("rejected",);
        this.ownerDocument.removeEventListener(
            "scroll",
            this.invalidate_drag_geometry,
            true,
        );
        this.ownerDocument.defaultView?.removeEventListener(
            "resize",
            this.invalidate_drag_geometry,
        );

        if (this.ready_frame_id !== null) {
            cancelAnimationFrame(this.ready_frame_id,);
            this.ready_frame_id = null;
        }

        this.resize_observer?.disconnect();
        this.resize_observer = null;
        this.move_origin = null;
        this.reset_interaction();
        this.cancel_piece_animations();
    }

    attributeChangedCallback(
        name: string,
        old_value: string | null,
        new_value: string | null,
    ): void {
        if (!this.is_ready || old_value === new_value) {
            return;
        }

        if (name === "fen" && new_value) {
            this.set_position(new_value,);
        }

        if (name === "orientation" && (new_value === "white" || new_value === "black")) {
            this.set_options({ orientation: new_value, },);
        }

        if (name === "readonly") {
            this.set_options({ interactive: new_value === null, },);
        }

        if (name === "coordinates") {
            this.set_options({ show_coordinates: new_value !== "false", },);
        }

        if (name === "theme") {
            this.set_options({ theme: new_value && THEMES.includes(new_value as BoardTheme,) ? new_value as BoardTheme : "brown", },);
        }
    }

    when_ready(): Promise<void> {
        if (this.stylesheet_state === "failed") {
            return Promise.reject(new Error("Failed to load the chessboard stylesheet.",),);
        }

        if (this.isConnected && this.board.classList.contains("ready",)) {
            return Promise.resolve();
        }

        return new Promise((
            resolve,
            reject,
        ) => {
            this.ready_waiters.push({ resolve, reject, },);
        },);
    }

    async when_animation_complete(): Promise<void> {
        while (this.active_animations.size > 0) {
            await Promise.allSettled([...this.active_animations,].map((animation,) => animation.finished,),);
        }
    }

    get_revision(): number {
        return this.revision;
    }

    get_history_state(): HistoryState {
        return {
            index: this.recorded_moves.length,
            length: this.recorded_moves.length + this.redo_moves.length,
            can_undo: this.recorded_moves.length > 0,
            can_redo: this.redo_moves.length > 0,
        };
    }

    get_pending_move(): MoveRequest | null {
        return this.pending_request ? { ...this.pending_request, input: { ...this.pending_request.input, }, } : null;
    }

    request_move(
        input: MoveInput,
        source: ChangeSource = "api",
    ): MoveRequest | null {
        const legal_move = this.get_legal_moves(input.from,).find((move,) => move.to === input.to && move.promotion === input.promotion,);

        if (!legal_move) {
            this.emit_error(
                "illegal_move",
                new Error("The requested move is not legal in this position.",),
            );

            return null;
        }

        this.end_move_request("rejected",);
        const request: MoveRequest = { id: ++this.request_sequence, revision: this.revision, input: { ...input, }, source, };
        this.pending_request = request;
        const move_origin = this.move_origin;
        this.reset_interaction();

        if (this.options.move_mode === "controlled") {
            this.render_position();
        }

        this.move_origin = move_origin;
        const event = new CustomEvent(
            "chessboard:move_request",
            { detail: this.get_pending_move()!, bubbles: true, composed: true, cancelable: true, },
        );
        this.dispatchEvent(event,);

        if (this.pending_request?.id === request.id && this.options.move_mode === "automatic" && !event.defaultPrevented) {
            this.commit_move(request.id,);
        } else if (this.pending_request?.id === request.id) {
            this.move_origin = null;

            if (this.options.move_mode !== "controlled") {
                this.render_position();
            }
        }

        return { ...request, input: { ...request.input, }, };
    }

    commit_move(request_id: number,): Move | null {
        const request = this.pending_request;

        if (!request || request.id !== request_id) {
            return null;
        }

        if (request.revision !== this.revision) {
            this.end_move_request("stale",);

            return null;
        }

        this.pending_request = null;
        const move = this.apply_move(
            request.input,
            request.source,
        );
        this.emit_request_end(
            request,
            move ? "committed" : "rejected",
        );

        return move;
    }

    reject_move(request_id: number,): boolean {
        if (this.pending_request?.id !== request_id) {
            return false;
        }

        this.end_move_request("rejected",);

        return true;
    }

    get_assets(): Required<ChessboardAssets> {
        return { ...this.assets, };
    }

    set_assets(assets: ChessboardAssets,): void {
        const previous_stylesheet = this.assets.stylesheet_url;
        const resolved_assets = resolve_assets({ ...this.assets, ...assets, },);
        this.reset_interaction();
        this.cancel_piece_animations();
        this.assets = resolved_assets;

        if (previous_stylesheet !== this.assets.stylesheet_url) {
            this.board.classList.remove("ready",);
            this.stylesheet_state = this.assets.stylesheet_url === null ? "loaded" : "pending";

            if (this.assets.stylesheet_url === null) {
                this.stylesheet.removeAttribute("href",);
                this.schedule_ready_state();
            } else {
                this.stylesheet.href = this.assets.stylesheet_url;
            }
        }

        for (const piece of this.pieces.values()) {
            piece.piece_key = undefined;
        }

        this.material_revision = -1;
        this.render_position();
        this.emit_change(
            "assets changed",
            "api",
        );
    }

    get_position(): string {
        return this.game.fen();
    }

    get_pgn(): string {
        this.cached_pgn ??= this.game.pgn();

        return this.cached_pgn;
    }

    get_uci_moves(): string[] {
        return this.recorded_moves.map(format_uci_move,);
    }

    get_uci_position(): string {
        const history = this.recorded_moves;
        const initial_position = history[0]?.before ?? this.game.fen();
        const position = initial_position === DEFAULT_POSITION ? "position startpos" : `position fen ${initial_position}`;
        const moves = history.map(format_uci_move,).join(" ",);

        return moves ? `${position} moves ${moves}` : position;
    }

    get_turn(): "w" | "b" {
        return this.game.turn();
    }

    get_status(): ChessboardStatus {
        this.cached_status ??= {
            turn: this.game.turn(),
            is_check: this.game.isCheck(),
            is_checkmate: this.game.isCheckmate(),
            is_stalemate: this.game.isStalemate(),
            is_draw: this.game.isDraw(),
            is_game_over: this.game.isGameOver(),
        };

        return { ...this.cached_status, };
    }

    get_legal_moves(square?: Square,): Move[] {
        if (!square) {
            return this.game.moves({ verbose: true, },);
        }

        let moves = this.legal_moves_cache.get(square,);

        if (!moves) {
            moves = this.game.moves({ square, verbose: true, },);
            this.legal_moves_cache.set(
                square,
                moves,
            );
        }

        return moves.map((move,) => Object.assign(
            Object.create(Object.getPrototypeOf(move,),),
            move,
        ),);
    }

    reset_options(): void {
        this.set_options({
            ...DEFAULT_OPTIONS,
            assets: resolve_assets({},),
            piece_renderer: undefined,
            premove_color: undefined,
            accessibility: undefined,
            interaction: undefined,
            annotations: undefined,
            pieces: undefined,
            sound: undefined,
            promotion: undefined,
            labels: undefined,
            renderers: undefined,
        },);
    }

    get_options(): ResolvedChessboardOptions {
        return {
            ...DEFAULT_OPTIONS, ...this.options, ...resolve_customization(
                {},
                this.customization,
            ), assets: this.get_assets(),
        };
    }

    is_muted(): boolean {
        return this.options.is_muted ?? false;
    }

    set_muted(is_muted: boolean,): void {
        this.set_options({ is_muted, },);
    }

    play_sound(
        sound: BoardSound,
        category: "moves" | "history" | "replay" = "moves",
    ): void {
        const settings = this.customization.sound;

        if (!["moves", "history", "replay",].includes(category,)) {
            throw new TypeError("Failed to play sound: the operation category is unsupported.",);
        }

        if (!Object.hasOwn(
            settings.enabled,
            sound,
        )) {
            throw new TypeError("Failed to play sound: the sound name is unsupported.",);
        }

        if (!this.is_muted() && settings.enabled[sound] && settings[`should_play_on_${category}`]) {
            this.audio.play(
                sound,
                { volume: settings.volume, url: settings.urls[sound], },
            );
        }
    }

    private play_move_sound(
        move: Pick<
            Move,
            "captured"
        >,
        category: "moves" | "history" | "replay" = "moves",
    ): void {
        const status = this.get_status();
        const player_color = this.customization.sound.player_color;
        const sound: BoardSound = status.is_checkmate ? (player_color ? (status.turn === player_color ? "lose" : "win") : "checkmate")
            : status.is_draw ? "draw"
                : status.is_check ? "check"
                    : move.captured ? "capture" : "move";
        this.play_sound(
            sound,
            category,
        );
    }

    get_marks(): BoardMark[] {
        return this.marks.map((mark,) => ({ ...mark, }),);
    }

    get_premove(): MoveInput | null {
        return this.premove ? { ...this.premove, } : null;
    }

    set_premove(
        input: MoveInput | null,
        source: ChangeSource = "api",
    ): boolean {
        let piece: Piece | undefined;

        if (input && !this.customization.interaction.can_premove) {
            return false;
        }

        if (input) {
            const position = this.get_premove_position();
            piece = position.get(input.from,);

            const target = position.get(input.to,);

            if (!piece || piece.color === this.game.turn() || target?.color === piece.color || input.from === input.to || this.premoves.length >= MAXIMUM_PREMOVES) {
                return false;
            }

            const legal_moves = this.get_premove_game(piece.color,).moves({ square: input.from, verbose: true, },);

            if (!legal_moves.some((move,) => move.to === input.to && (move.promotion ? move.promotion === (input.promotion ?? "q") : !input.promotion),)) {
                return false;
            }

            if ((this.options.premove_color && piece.color !== this.options.premove_color)
                || (this.options.playable_color !== "both" && piece.color !== this.options.playable_color)
                || (this.queued_premove_color && piece.color !== this.queued_premove_color)) {
                return false;
            }
        }

        this.premoves = input ? [...this.premoves, { ...input, },] : [];
        this.queued_premove_color = piece?.color ?? null;
        this.publish_premoves(source,);

        return true;
    }

    get_premoves(): MoveInput[] {
        return this.premoves.map((input,) => ({ ...input, }),);
    }

    cancel_premove(source: ChangeSource = "api",): boolean {
        if (!this.premoves.length) {
            return false;
        }

        this.premoves.pop();
        this.publish_premoves(source,);

        return true;
    }

    private publish_premoves(source: ChangeSource,): void {
        if (!this.premoves.length) {
            this.queued_premove_color = null;
        }

        this.render_position();
        this.dispatchEvent(new CustomEvent(
            "chessboard:premove",
            {
                detail: this.get_premove(),
                bubbles: true,
                composed: true,
            },
        ),);

        this.emit_change(
            "premove changed",
            source,
        );
    }

    private get_premove_game(color: Color,): RulesGame {
        let game = this.game;
        const set_turn = (): void => {
            const fields = game.fen().split(" ",);

            if (game.turn() !== color) {
                fields[1] = color;
                fields[3] = "-";
            }

            game = this.create_game(fields.join(" ",),);
        };
        set_turn();

        for (const input of this.premoves) {
            const move = game.moves({ square: input.from, verbose: true, },).find((candidate,) => candidate.to === input.to && (!candidate.promotion || candidate.promotion === (input.promotion ?? "q")),);

            if (!move) {
                break;
            }

            game.move({ from: move.from, to: move.to, promotion: move.promotion, },);
            set_turn();
        }

        return game;
    }

    private get_premove_position(): Map<
        Square,
        Piece
    > {
        const position = new Map<
            Square,
            Piece
        >();
        const game = this.premoves.length && this.queued_premove_color && this.queued_premove_color !== this.game.turn()
            ? this.get_premove_game(this.queued_premove_color,)
            : this.game;

        for (const row of game.board()) {
            for (const piece of row) {
                if (piece) {
                    position.set(
                        piece.square,
                        piece,
                    );
                }
            }
        }

        return position;
    }

    set_options(options: ChessboardOptions,): void {
        this.validate_options(options,);
        const customization = resolve_customization(
            options,
            this.customization,
        );
        const previous_options = this.options;
        const should_restore_position = Boolean(this.promotion_request || this.drag_state || (options.animation_duration === 0 && this.selected_square),);

        if (options.move_mode && options.move_mode !== previous_options.move_mode) {
            this.end_move_request("rejected",);
        }

        if (this.promotion_request || this.drag_state) {
            this.reset_interaction();
        }

        if (this.premove && "premove_color" in options && options.premove_color !== this.options.premove_color) {
            this.set_premove(null,);
        }

        if ((options.orientation && options.orientation !== this.options.orientation) || options.animation_duration === 0 || (options.quality_profile && options.quality_profile !== this.options.quality_profile)) {
            this.reset_interaction();
            this.cancel_piece_animations();
        }

        this.options = {
            ...this.options,
            ...options,
        };
        this.customization = customization;

        if (!customization.interaction.can_premove && this.premove) {
            this.set_premove(null,);
        }

        this.board.setAttribute(
            "aria-label",
            customization.labels.board,
        );
        this.board.style.setProperty(
            "--chessboard-piece-scale",
            String(customization.pieces.scale,),
        );
        this.board.style.setProperty(
            "--chessboard-piece-padding",
            `${customization.pieces.padding_px}px`,
        );

        for (const key of Object.keys(DEFAULT_OPTIONS,) as (keyof typeof DEFAULT_OPTIONS)[]) {
            if (this.options[key] === undefined) {
                Object.assign(
                    this.options,
                    { [key]: DEFAULT_OPTIONS[key], },
                );
            }
        }

        const duration_ms = this.options.animation_duration;
        this.options.animation_duration = typeof duration_ms === "number" && Number.isFinite(duration_ms,) ? Math.max(
            0,
            duration_ms,
        ) : DEFAULT_OPTIONS.animation_duration;

        if (this.options.is_muted) {
            this.audio.stop();
        }

        if (options.assets) {
            this.set_assets(options.assets,);
        }

        if (options.theme && this.getAttribute("theme",) !== options.theme) {
            this.setAttribute(
                "theme",
                options.theme,
            );
        }

        this.update_motion_tokens();

        if (!this.is_ready) {
            return;
        }

        if ("piece_renderer" in options || "pieces" in options) {
            for (const piece of this.pieces.values()) {
                piece.piece_key = undefined;
            }
        }

        const has_changed = (keys: (keyof ChessboardOptions)[],): boolean => keys.some((key,) => key in options && options[key] !== previous_options[key],);
        const has_customization = ["accessibility", "interaction", "annotations", "pieces", "sound", "promotion", "labels", "renderers",].some((key,) => key in options,);

        if (has_customization) {
            this.square_signatures.clear();
            this.material_revision = -1;
        }

        if (should_restore_position || "piece_renderer" in options || has_customization) {
            this.render_position();
        } else {
            if (has_changed(["orientation", "interactive", "show_coordinates", "show_legal_moves", "show_last_move", "premove_color", "playable_color",],)) {
                this.render_squares();
            }

            if (has_changed(["orientation", "show_captured_pieces", "captured_piece_display",],)) {
                this.render_material();
            }
        }

        if (has_changed(["orientation",],) || has_customization) {
            this.render_shapes();
        }

        if (has_changed(["quality_profile",],)) {
            this.is_checkmate_displayed = false;
            this.update_celebration();
        }

        this.emit_change(
            "options changed",
            "api",
        );
    }

    create_game(fen?: string,): RulesGame {
        return this.rules_provider.create_game(fen,);
    }

    set_rules_provider(
        provider: RulesProvider = STANDARD_RULES_PROVIDER,
        fen: string = this.get_position(),
    ): void {
        if (!provider || typeof provider.create_game !== "function") {
            throw new TypeError("Failed to configure rules: a game factory is required.",);
        }

        const game = provider.create_game(fen,);

        for (const name of ["board", "fen", "get", "getHeaders", "history", "isCheck", "isCheckmate", "isDraw", "isGameOver", "isStalemate", "loadPgn", "move", "moves", "pgn", "turn", "undo",] as const) {
            if (!game || typeof game[name] !== "function") {
                throw new TypeError(`Failed to configure rules: the game requires ${name}.`,);
            }
        }

        game.board();
        game.fen();
        this.cancel_piece_animations();
        this.rules_provider = { create_game: provider.create_game.bind(provider,), };
        this.game = game;
        this.begin_position_change(
            "position loaded",
            "api",
        );
        this.cached_pgn = null;
        this.cached_status = null;
        this.recorded_moves = game.history({ verbose: true, },);
        this.rebuild_captures();
        this.reset_interaction();
        this.redo_moves.length = 0;
        this.last_move = null;
        this.premoves = [];
        this.queued_premove_color = null;
        this.render_position();
        this.emit_position();
    }

    set_position(fen: string,): boolean {
        let game: RulesGame;

        try {
            game = this.create_game(fen,);
        } catch (error) {
            this.emit_error(
                "invalid_position",
                error,
            );

            return false;
        }

        this.cancel_piece_animations();
        this.game = game;
        this.begin_position_change(
            "position loaded",
            "api",
        );
        this.cached_pgn = null;
        this.cached_status = null;
        this.recorded_moves = game.history({ verbose: true, },);
        this.rebuild_captures();
        this.reset_interaction();
        this.redo_moves.length = 0;
        this.last_move = null;
        this.render_position();
        this.emit_position();
        this.execute_premove();

        return true;
    }

    set_pgn(pgn: string,): boolean {
        let game: RulesGame;

        try {
            game = this.create_game();
            game.loadPgn(pgn,);
        } catch (error) {
            this.emit_error(
                "invalid_pgn",
                error,
            );

            return false;
        }

        this.cancel_piece_animations();
        this.game = game;
        this.begin_position_change(
            "game loaded",
            "api",
        );
        this.cached_pgn = null;
        this.cached_status = null;
        this.recorded_moves = game.history({ verbose: true, },);
        this.rebuild_captures();
        this.reset_interaction();
        this.redo_moves.length = 0;

        const history = this.recorded_moves;
        const previous_move = history[history.length - 1];
        this.last_move = previous_move ? {
            from: previous_move.from,
            to: previous_move.to,
        } : null;
        this.render_position();
        this.emit_position();
        this.execute_premove();

        return true;
    }

    move(input: MoveInput,): Move | null {
        return this.apply_move(
            input,
            "api",
        );
    }

    private apply_move(
        input: MoveInput,
        source: ChangeSource,
    ): Move | null {
        let move: Move;

        try {
            move = this.game.move(input,);
        } catch (error) {
            this.emit_error(
                "illegal_move",
                error,
            );

            return null;
        }

        this.redo_moves.length = 0;
        this.finish_move(
            move,
            "move",
            source,
        );

        return move;
    }

    move_uci(text: string,): Move | null {
        let input: MoveInput;

        try {
            input = parse_uci_move(text,);
            const is_legal = this.get_legal_moves(input.from,).some((move,) => move.to === input.to && move.promotion === input.promotion,);

            if (!is_legal) {
                throw new Error(`The UCI move ${text.trim()} is not legal in this position.`,);
            }
        } catch (error) {
            this.emit_error(
                "illegal_move",
                error,
            );

            return null;
        }

        return this.move(input,);
    }

    undo(source: ChangeSource = "api",): Move | null {
        const move = this.game.undo();

        if (!move) {
            return null;
        }

        this.begin_position_change(
            "undo",
            source,
        );
        this.recorded_moves.pop();

        if (move.captured) {
            this.captured_pieces[move.color].pop();
        }

        this.cached_pgn = null;
        this.cached_status = null;
        this.cancel_piece_animations();

        if (this.premove) {
            this.set_premove(
                null,
                source,
            );
        }

        this.redo_moves.push({
            from: move.from,
            to: move.to,
            promotion: move.promotion,
        },);

        const previous_move = this.recorded_moves[this.recorded_moves.length - 1];
        this.last_move = previous_move ? {
            from: previous_move.from,
            to: previous_move.to,
        } : null;
        this.reset_interaction();
        this.render_position(
            move,
            true,
        );
        this.play_sound(
            "move",
            "history",
        );
        this.emit_position();

        return move;
    }

    redo(source: ChangeSource = "api",): Move | null {
        const input = this.redo_moves.pop();

        if (!input) {
            return null;
        }

        const move = this.game.move(input,);
        this.finish_move(
            move,
            "redo",
            source,
        );

        return move;
    }

    flip(): void {
        const orientation = this.options.orientation === "white" ? "black" : "white";
        this.set_options({ orientation, },);
    }

    get_annotations(group?: string,): Annotation[] {
        return this.annotations.filter((annotation,) => group === undefined || annotation.group === group,).map((annotation,) => ({ ...annotation, }),);
    }

    set_annotations(
        annotations: BoardMark[],
        group?: string,
        source: ChangeSource = "api",
    ): void {
        if (group !== undefined && typeof group !== "string") {
            throw new TypeError("Failed to set annotations: the group must be a string.",);
        }

        const identifiers = new Set<string>();
        const normalized = annotations.map((annotation,) => {
            if ((annotation.id !== undefined && typeof annotation.id !== "string") || (annotation.group !== undefined && typeof annotation.group !== "string") || (annotation.label !== undefined && typeof annotation.label !== "string")) {
                throw new TypeError("Failed to set annotations: identifiers, groups, and labels must be strings.",);
            }

            if (annotation.source !== undefined && !["user", "engine",].includes(annotation.source,)) {
                throw new TypeError("Failed to set annotations: the source is invalid.",);
            }

            if (!/^[a-h][1-8]$/.test(annotation.from,) || (annotation.to !== undefined && !/^[a-h][1-8]$/.test(annotation.to,))) {
                throw new TypeError("Failed to set annotations: a square is invalid.",);
            }

            if (annotation.color !== undefined && !["amber", "blue", "green", "red",].includes(annotation.color,)) {
                throw new TypeError("Failed to set annotations: a color is invalid.",);
            }

            const previous = this.annotations.find((candidate,) => candidate.from === annotation.from && candidate.to === annotation.to && candidate.group === (group ?? annotation.group ?? annotation.source ?? "user"),);
            let id = annotation.id ?? previous?.id;

            while (!id || (annotation.id === undefined && identifiers.has(id,))) {
                id = `annotation_${++this.annotation_sequence}`;

                if (this.annotations.some((candidate,) => candidate.id === id,) || annotations.some((candidate,) => candidate.id === id,)) {
                    id = undefined;
                }
            }

            if (!id || identifiers.has(id,)) {
                throw new TypeError("Failed to set annotations: identifiers must be unique and nonempty.",);
            }

            identifiers.add(id,);

            return { ...annotation, id, group: group ?? annotation.group ?? annotation.source ?? "user", };
        },);
        const retained = group === undefined ? [] : this.annotations.filter((annotation,) => annotation.group !== group,);

        if (retained.some((annotation,) => identifiers.has(annotation.id,),)) {
            throw new TypeError("Failed to set annotations: an identifier belongs to another group.",);
        }

        this.annotations = [...retained, ...normalized,];
        this.marks = [...retained, ...annotations,].map((annotation,) => ({ ...annotation, }),);
        this.render_shapes();

        if (this.customization.accessibility.announce_annotations) {
            this.announce(`${this.annotations.length} ${this.annotations.length === 1 ? "annotation" : "annotations"}.`,);
        }

        this.dispatchEvent(new CustomEvent(
            "chessboard:marks",
            { detail: this.get_marks(), bubbles: true, composed: true, },
        ),);
        const detail = this.emit_change(
            "annotations changed",
            source,
        );
        this.dispatchEvent(new CustomEvent(
            "chessboard:annotations",
            { detail: { ...detail, annotations: this.get_annotations(), }, bubbles: true, composed: true, },
        ),);
    }

    set_marks(marks: BoardMark[],): void {
        this.set_annotations(marks,);
    }

    add_annotation(annotation: BoardMark,): Annotation {
        const previous_ids = new Set(this.annotations.map((entry,) => entry.id,),);
        this.set_annotations([...this.annotations, annotation,],);

        return this.get_annotations().find((entry,) => !previous_ids.has(entry.id,),)!;
    }

    update_annotation(
        id: string,
        changes: Partial<Omit<
            BoardMark,
            "id"
        >>,
    ): boolean {
        if (!this.annotations.some((annotation,) => annotation.id === id,)) {
            return false;
        }

        this.set_annotations(this.annotations.map((annotation,) => annotation.id === id ? { ...annotation, ...changes, id, } : annotation,),);

        return true;
    }

    remove_annotation(id: string,): boolean {
        if (!this.annotations.some((annotation,) => annotation.id === id,)) {
            return false;
        }

        this.set_annotations(this.annotations.filter((annotation,) => annotation.id !== id,),);

        return true;
    }

    clear_annotations(group?: string,): void {
        this.set_annotations(
            [],
            group,
        );
    }

    clear_marks(): void {
        this.clear_annotations();
    }

    seek_history(
        index: number,
        sound_category: "history" | "replay" = "history",
    ): boolean {
        const state = this.get_history_state();

        if (!Number.isInteger(index,) || index < 0 || index > state.length) {
            throw new RangeError("Failed to seek history: the index is outside the game.",);
        }

        if (index === state.index) {
            return false;
        }

        this.cancel_piece_animations();
        this.reset_interaction();
        this.set_premove(
            null,
            "replay",
        );

        while (this.recorded_moves.length > index) {
            const move = this.game.undo()!;
            this.recorded_moves.pop();
            this.redo_moves.push({ from: move.from, to: move.to, promotion: move.promotion, },);
        }

        while (this.recorded_moves.length < index) {
            const move = this.game.move(this.redo_moves.pop()!,);
            this.recorded_moves.push({ ...move, },);
        }

        this.begin_position_change(
            "replay seek",
            "replay",
        );
        this.rebuild_captures();
        this.last_move = this.recorded_moves[this.recorded_moves.length - 1] ?? null;
        this.render_position();

        if (index === state.index + 1 && this.last_move) {
            this.play_move_sound(
                this.recorded_moves[index - 1]!,
                sound_category,
            );
        } else if (index === state.index - 1) {
            this.play_sound(
                "move",
                sound_category,
            );
        }

        this.emit_position();

        return true;
    }

    private read_attributes(): void {
        const orientation = this.getAttribute("orientation",);

        if (orientation === "white" || orientation === "black") {
            this.options.orientation = orientation;
        }

        const theme = this.getAttribute("theme",);

        if (theme && THEMES.includes(theme as BoardTheme,)) {
            this.options.theme = theme as BoardTheme;
        }

        this.options.interactive = !this.hasAttribute("readonly",);
        this.options.show_coordinates = this.getAttribute("coordinates",) !== "false";

        const fen = this.getAttribute("fen",);

        if (fen) {
            this.set_position(fen,);
        }

        this.update_motion_tokens();
    }

    private update_motion_tokens(): void {
        const configured_duration_ms = Math.max(
            0,
            this.options.animation_duration ?? 0,
        );
        const quality_profile = this.options.quality_profile ?? DEFAULT_OPTIONS.quality_profile;
        const duration_ms = quality_profile === "minimal" ? 0 : configured_duration_ms;
        this.dataset.qualityProfile = quality_profile;
        this.board.classList.toggle(
            "motion_disabled",
            duration_ms === 0,
        );
        this.style.setProperty(
            "--chessboard-animation-duration",
            `${duration_ms}ms`,
        );
        this.style.setProperty(
            "--chessboard-state-duration",
            `${Math.min(
                STATE_DURATION_MS,
                duration_ms,
            )}ms`,
        );
        this.style.setProperty(
            "--chessboard-hint-duration",
            `${Math.min(
                HINT_DURATION_MS,
                duration_ms,
            )}ms`,
        );
    }

    private build_squares(): void {
        const fragment = document.createDocumentFragment();

        for (let rank = BOARD_SIZE; rank >= 1; rank--) {
            for (const file of FILES) {
                const square = `${file}${rank}` as Square;
                const button = document.createElement("button",) as BoardSquare;
                button.type = "button";
                button.className = "square";
                button.setAttribute(
                    "part",
                    "square",
                );
                button.square_name = square;
                button.dataset.square = square;
                button.setAttribute(
                    "role",
                    "gridcell",
                );
                button.tabIndex = square === this.focused_square ? 0 : -1;

                const hint = document.createElement("span",);
                hint.className = "hint";
                hint.setAttribute(
                    "part",
                    "hint",
                );
                hint.setAttribute(
                    "aria-hidden",
                    "true",
                );
                const focus_ring = document.createElement("span",);
                focus_ring.className = "square_focus";
                focus_ring.setAttribute(
                    "part",
                    "square-focus",
                );
                focus_ring.setAttribute(
                    "aria-hidden",
                    "true",
                );
                const status_ring = document.createElement("span",);
                status_ring.className = "square_status";
                status_ring.setAttribute(
                    "part",
                    "square-status",
                );
                status_ring.setAttribute(
                    "aria-hidden",
                    "true",
                );
                button.append(
                    hint,
                    focus_ring,
                    status_ring,
                );
                this.squares.set(
                    square,
                    button,
                );
                fragment.append(button,);
            }
        }

        this.board.append(fragment,);
    }

    private update_celebration(): void {
        const is_checkmate = this.game.isCheckmate();

        if (!is_checkmate || !this.can_animate()) {
            this.celebration_layer.replaceChildren();
        } else if (!this.is_checkmate_displayed) {
            const colors = ["#e9b949", "#e76f51", "#2a9d8f", "#77a8e8", "#f4e9cf",];
            const fragment = this.ownerDocument.createDocumentFragment();
            const particle_count = this.options.quality_profile === "balanced" ? 16 : 40;

            for (let index = 0; index < particle_count; index += 1) {
                const particle = this.ownerDocument.createElement("span",);
                particle.className = "confetti";
                particle.style.left = `${(index * 37) % 100}%`;
                particle.style.backgroundColor = colors[index % colors.length]!;
                particle.style.animationDelay = `${(index % 8) * 65}ms`;
                const drift_cqw = ((index * 13) % 30) - 15;
                particle.style.setProperty(
                    "--confetti-mid-drift",
                    `${drift_cqw}cqw`,
                );
                particle.style.setProperty(
                    "--confetti-end-drift",
                    `${drift_cqw * -.35}cqw`,
                );
                particle.addEventListener(
                    "animationend",
                    () => particle.remove(),
                    { once: true, },
                );
                particle.addEventListener(
                    "animationcancel",
                    () => particle.remove(),
                    { once: true, },
                );
                fragment.append(particle,);
            }

            this.celebration_layer.replaceChildren(fragment,);
        }

        this.is_checkmate_displayed = is_checkmate;
    }

    private render_squares(): void {
        const is_black = this.options.orientation === "black";
        const status = this.get_status();
        const preview_position = this.get_premove_position();
        const move_square = this.drag_state?.is_dragging ? this.drag_state.from : this.selected_square;
        const selected_piece = move_square ? preview_position.get(move_square,) : undefined;
        const legal_moves = move_square && selected_piece && this.options.show_legal_moves
            ? selected_piece.color === this.game.turn()
                ? this.get_legal_moves(move_square,)
                : this.get_premove_game(selected_piece.color,).moves({ square: move_square, verbose: true, },)
            : [];
        const legal_targets = new Map(legal_moves.map((move,) => [move.to, move.isCapture() || move.isEnPassant(),],),);
        this.board.classList.toggle(
            "readonly",
            !this.options.interactive,
        );
        this.board.style.touchAction = this.options.interactive ? "none" : "auto";

        for (const [square, button,] of this.squares) {
            const piece = this.promotion_request?.to === square
                ? this.game.get(this.promotion_request.from,)
                : this.promotion_request?.from === square ? undefined : preview_position.get(square,);
            const is_checked = status.is_check && piece?.type === "k" && piece.color === status.turn;
            const is_legal = legal_targets.has(square,);
            const is_capture = legal_targets.get(square,) === true;
            const classes: Record<
                string,
                boolean
            > = {
                last_move: Boolean(this.options.show_last_move && (this.last_move?.from === square || this.last_move?.to === square),),
                selected: this.selected_square === square,
                premove_from: this.premoves.some((input,) => input.from === square,),
                premove_to: this.premoves.some((input,) => input.to === square,),
                checked: Boolean(is_checked,),
                checkmated: Boolean(is_checked && status.is_checkmate,),
                coordinates: Boolean(this.options.show_coordinates,),
                legal: is_legal && !is_capture,
                legal_capture: is_legal && is_capture,
            };
            const signature = `${is_black}:${piece?.color ?? ""}${piece?.type ?? ""}:${Object.values(classes,).map(Number,).join("",)}`;

            if (this.customization.renderers.square_overlay) {
                let overlay = button.querySelector<HTMLElement>(".square_overlay",);

                if (!overlay) {
                    overlay = this.ownerDocument.createElement("span",);
                    overlay.className = "square_overlay";
                    overlay.setAttribute(
                        "part",
                        "square-overlay",
                    );
                    overlay.setAttribute(
                        "aria-hidden",
                        "true",
                    );
                    button.append(overlay,);
                }

                const rendered = this.render_content(
                    () => this.customization.renderers.square_overlay!({
                        square,
                        piece: piece ? { ...piece, } : null,
                        status: { ...status, },
                        is_selected: this.selected_square === square,
                    },),
                    "",
                );
                overlay.replaceChildren(rendered,);
            } else {
                button.querySelector(".square_overlay",)?.remove();
            }

            if (this.square_signatures.get(square,) === signature) {
                continue;
            }

            this.square_signatures.set(
                square,
                signature,
            );
            const file_index = FILES.indexOf(square[0] ?? "",);
            const rank = Number(square[1],);
            const column = is_black ? LAST_FILE_INDEX - file_index : file_index;
            const row = is_black ? rank - 1 : BOARD_SIZE - rank;
            button.style.gridColumn = String(column + 1,);
            button.style.gridRow = String(row + 1,);
            button.classList.toggle(
                "dark",
                (file_index + rank) % 2 !== 0,
            );
            button.classList.toggle(
                "light",
                (file_index + rank) % 2 === 0,
            );

            for (const [name, is_active,] of Object.entries(classes,)) {
                button.classList.toggle(
                    name,
                    is_active,
                );
            }

            button.dataset.file_label = row === LAST_FILE_INDEX ? square[0] ?? "" : "";
            button.dataset.rank_label = column === 0 ? square[1] ?? "" : "";
            const states = [
                classes.selected ? "selected" : "",
                classes.legal ? "legal move" : "",
                classes.legal_capture ? "capture target" : "",
                classes.premove_from ? "premove source" : "",
                classes.premove_to ? "premove destination" : "",
                classes.checkmated ? "checkmate" : classes.checked ? "check" : "",
            ].filter(Boolean,);
            const default_label = `${square}, ${piece ? get_piece_name(piece,) : "empty"}${states.length ? `, ${states.join(", ",)}` : ""}`;
            button.setAttribute(
                "aria-label",
                this.format_label(
                    () => this.customization.labels.format_square(
                        square,
                        piece ? { ...piece, } : undefined,
                        classes.selected!,
                        is_legal,
                        Boolean(is_checked,),
                        default_label,
                    ),
                    default_label,
                ),
            );
        }
    }

    private render_position(
        move?: Move,
        is_undo = false,
    ): void {
        if (!this.is_ready || this.squares.size === 0) {
            return;
        }

        this.render_material();

        const movement_from = is_undo ? move?.to : move?.from;
        const movement_to = is_undo ? move?.from : move?.to;
        const moving_piece = movement_from ? this.pieces.get(movement_from,) : undefined;
        const old_rect = move ? this.move_origin ?? moving_piece?.getBoundingClientRect() : undefined;
        this.move_origin = null;

        const castle_rank = move?.color === "w" ? "1" : "8";
        const castle_rook_from = move?.isKingsideCastle() ? `h${castle_rank}` as Square : move?.isQueensideCastle() ? `a${castle_rank}` as Square : null;
        const castle_rook_to = move?.isKingsideCastle() ? `f${castle_rank}` as Square : move?.isQueensideCastle() ? `d${castle_rank}` as Square : null;
        const rook_from = is_undo ? castle_rook_to : castle_rook_from;
        const rook_to = is_undo ? castle_rook_from : castle_rook_to;
        const rook_piece = rook_from ? this.pieces.get(rook_from,) : undefined;
        const rook_rect = rook_piece?.getBoundingClientRect();
        moving_piece?.getAnimations?.().forEach((animation,) => animation.cancel(),);
        rook_piece?.getAnimations?.().forEach((animation,) => animation.cancel(),);

        const expected_pieces = this.get_premove_position();

        for (const [square, node,] of this.pieces) {
            if ((square === movement_from && moving_piece === node) || (square === rook_from && rook_piece === node)) {
                continue;
            }

            const piece = expected_pieces.get(square,);

            if (!piece || node.piece_key !== `${piece.color}${piece.type}${(this.options.piece_renderer || this.customization.pieces.resolve_url) ? `:${square}` : ""}`) {
                node.remove();
                this.pieces.delete(square,);
            }
        }

        if (move && moving_piece && movement_from && movement_to) {
            this.pieces.delete(movement_from,);
            moving_piece.remove();

            if (move.promotion) {
                moving_piece.replaceChildren();
                moving_piece.piece_key = undefined;
            }

            this.pieces.set(
                movement_to,
                moving_piece,
            );
        }

        if (rook_from && rook_to && rook_piece) {
            this.pieces.delete(rook_from,);
            rook_piece.remove();
            this.pieces.set(
                rook_to,
                rook_piece,
            );
        }

        for (const [square, piece,] of expected_pieces) {
            let node = this.pieces.get(square,);

            if (!node) {
                node = document.createElement("span",) as PieceNode;
                node.className = "piece";
                node.setAttribute(
                    "part",
                    "piece",
                );
                node.setAttribute(
                    "aria-hidden",
                    "true",
                );
                this.pieces.set(
                    square,
                    node,
                );
            }

            const piece_key = `${piece.color}${piece.type}${(this.options.piece_renderer || this.customization.pieces.resolve_url) ? `:${square}` : ""}`;

            if (node.piece_key !== piece_key) {
                node.piece_key = piece_key;
                node.dataset.color = piece.color;
                node.dataset.type = piece.type;

                const rendered_piece = this.render_piece_art(
                    piece,
                    square,
                );
                node.replaceChildren(rendered_piece,);
            }

            const button = this.squares.get(square,);

            if (button && node.parentElement !== button) {
                button.append(node,);
            }
        }

        this.render_squares();
        this.update_celebration();

        if (this.can_animate() && move) {
            const moving_target = moving_piece && old_rect ? moving_piece.getBoundingClientRect() : null;
            const rook_target = rook_piece && rook_rect ? rook_piece.getBoundingClientRect() : null;

            if (moving_piece && old_rect && moving_target) {
                this.animate_piece(
                    moving_piece,
                    old_rect,
                    moving_target,
                );
            }

            if (rook_piece && rook_rect && rook_target) {
                this.animate_piece(
                    rook_piece,
                    rook_rect,
                    rook_target,
                );
            }

        }
    }

    private render_content(
        render: () => Node | string | null,
        fallback: Node | string,
    ): Node | string {
        try {
            const rendered = render();

            if (rendered === null) {
                return fallback;
            }

            if (typeof rendered === "string" || (rendered && typeof rendered.nodeType === "number")) {
                return rendered;
            }

            throw new TypeError("The renderer must return a DOM node, string, or null.",);
        } catch (error) {
            this.emit_error(
                "render_failed",
                error,
            );
        }

        return fallback;
    }

    private format_label(
        format: () => string,
        fallback: string,
    ): string {
        const rendered = this.render_content(
            format,
            fallback,
        );

        return typeof rendered === "string" ? rendered : fallback;
    }

    private announce(message: string,): void {
        const sequence = ++this.announcement_sequence;
        this.announcer.textContent = "";
        queueMicrotask(() => {
            if (sequence === this.announcement_sequence && this.isConnected) {
                this.announcer.textContent = message;
            }
        },);
    }

    private render_piece_art(
        piece: Piece,
        square: Square,
    ): Node | string {
        if (this.options.piece_renderer) {
            try {
                const rendered = this.options.piece_renderer(
                    { ...piece, },
                    square,
                );

                if (typeof rendered === "string" || (rendered && typeof rendered === "object" && typeof rendered.nodeType === "number")) {
                    return rendered;
                }

                throw new TypeError("The piece renderer must return a DOM node or a string.",);
            } catch (error) {
                this.emit_error(
                    "render_failed",
                    error,
                );
            }
        }

        try {
            const settings = this.customization.pieces;
            const url = settings.resolve_url?.(
                { ...piece, },
                square,
            ) ?? settings.urls[`${piece.color}${piece.type}`];

            if (url !== undefined && url !== null) {
                if (typeof url !== "string" || !url.trim()) {
                    throw new TypeError("The piece resolver must return a nonempty URL or null.",);
                }

                const image = this.ownerDocument.createElement("img",);
                image.src = url;
                image.alt = "";
                image.draggable = false;

                return image;
            }
        } catch (error) {
            this.emit_error(
                "render_failed",
                error,
            );
        }

        return create_piece_art(
            piece,
            this.assets.piece_sprite_url,
        );
    }

    private render_material(): void {
        for (const row of Object.values(this.material_rows,)) {
            row.hidden = !this.options.show_captured_pieces;
        }

        if (!this.options.show_captured_pieces) {
            return;
        }

        const display = this.options.captured_piece_display ?? DEFAULT_OPTIONS.captured_piece_display;

        if (this.material_revision !== this.revision || this.material_display !== display) {
            render_material_rows(
                this.game,
                this.material_rows,
                this.captured_pieces,
                display,
                this.assets.piece_sprite_url,
                {
                    labels: {
                        ...this.customization.labels,
                        format_material_label: (
                            context,
                            fallback,
                        ) => this.format_label(
                            () => this.customization.labels.format_material_label(
                                context,
                                fallback,
                            ),
                            fallback,
                        ),
                        format_capture: (
                            color,
                            piece,
                            count,
                            fallback,
                        ) => this.format_label(
                            () => this.customization.labels.format_capture(
                                color,
                                piece,
                                count,
                                fallback,
                            ),
                            fallback,
                        ),
                        format_advantage: (
                            difference,
                            fallback,
                        ) => this.format_label(
                            () => this.customization.labels.format_advantage(
                                difference,
                                fallback,
                            ),
                            fallback,
                        ),
                        format_material: (context,) => this.format_label(
                            () => this.customization.labels.format_material(context,),
                            `${context.piece_count} pieces · ${context.points} pts`,
                        ),
                    },
                    render: this.customization.renderers.material,
                    render_content: (
                        render,
                        fallback,
                    ) => this.render_content(
                        render,
                        fallback,
                    ),
                },
            );
            this.material_revision = this.revision;
            this.material_display = display;
        }

        const bottom_color = this.options.orientation === "white" ? "w" : "b";
        const top_color = bottom_color === "w" ? "b" : "w";

        if (this.board_surface.previousElementSibling !== this.material_rows[top_color]) {
            this.board_surface.before(this.material_rows[top_color],);
        }

        if (this.board_surface.nextElementSibling !== this.material_rows[bottom_color]) {
            this.board_surface.after(this.material_rows[bottom_color],);
        }
    }

    private can_animate(): boolean {
        return Boolean(this.options.quality_profile !== "minimal" && typeof this.board.animate === "function" && this.options.animation_duration && !this.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)",).matches,);
    }

    private cancel_piece_animations(): void {
        for (const animation of this.active_animations) {
            animation.cancel();
        }

        for (const piece of this.pieces.values()) {
            piece.getAnimations?.().forEach((animation,) => animation.cancel(),);
            piece.classList.remove("moving",);
        }

        for (const animation of this.shadow.getAnimations?.() ?? []) {
            animation.cancel();
        }
    }

    private animate_piece(
        piece: PieceNode,
        from_rect: DOMRect,
        to_rect: DOMRect = piece.getBoundingClientRect(),
    ): Animation | null {
        if (typeof piece.animate !== "function" || to_rect.width === 0 || to_rect.height === 0) {
            return null;
        }

        const scale_x = piece.offsetWidth / to_rect.width;
        const scale_y = piece.offsetHeight / to_rect.height;
        const offset_x_px = ((from_rect.left + (from_rect.width / 2)) - (to_rect.left + (to_rect.width / 2))) * scale_x;
        const offset_y_px = ((from_rect.top + (from_rect.height / 2)) - (to_rect.top + (to_rect.height / 2))) * scale_y;
        const initial_scale = from_rect.width / to_rect.width;
        const configured_duration_ms = this.options.animation_duration ?? DEFAULT_ANIMATION_DURATION_MS;
        const duration_ms = initial_scale > DRAG_SCALE_THRESHOLD ? Math.min(
            configured_duration_ms,
            RETURN_DURATION_MS,
        ) : configured_duration_ms;
        piece.classList.add("moving",);

        const animation = this.track_animation(piece.animate(
            create_move_keyframes(
                offset_x_px,
                offset_y_px,
                initial_scale,
            ),
            {
                duration: duration_ms,
                easing: "linear",
                fill: "both",
            },
        ),);
        const finish_animation = (): void => {
            animation.cancel();

            if (!(piece.getAnimations?.() ?? []).some((active,) => active !== animation && active.playState === "running",)) {
                piece.classList.remove("moving",);
            }
        };
        void animation.finished.then(
            finish_animation,
            finish_animation,
        );

        return animation;
    }

    private invalidate_drag_geometry = (): void => {
        this.drag_geometry = null;

        if (this.drag_pointer && this.drag_ghost) {
            this.update_drag_target(this.drag_pointer,);
            this.schedule_drag_frame();
        }
    };

    private schedule_drag_frame(): void {
        if (this.drag_frame_id === null) {
            this.drag_frame_id = requestAnimationFrame(this.render_drag_frame,);
        }
    }

    private render_drag_frame = (timestamp_ms: number,): void => {
        if (this.drag_frame_id !== null) {
            cancelAnimationFrame(this.drag_frame_id,);
            this.drag_frame_id = null;
        }

        const event = this.drag_pointer;
        const state = this.drag_state;
        const ghost = this.drag_ghost;

        if (!event || !state?.is_dragging || !ghost) {
            return;
        }

        if (!this.drag_geometry) {
            const rect = this.board.getBoundingClientRect();
            this.drag_geometry = {
                rect,
                scale_x: this.board.clientWidth / rect.width,
                scale_y: this.board.clientHeight / rect.height,
            };
        }

        const { rect, scale_x, scale_y, } = this.drag_geometry;
        const x = (event.clientX - rect.left - state.grab_offset_x_px) * scale_x;
        const y = (event.clientY - rect.top - state.grab_offset_y_px) * scale_y;
        const can_animate = this.can_animate();
        const elapsed_ms = this.drag_frame_timestamp_ms ? Math.max(
            0,
            timestamp_ms - this.drag_frame_timestamp_ms,
        ) : DEFAULT_FRAME_DURATION_MS;
        this.drag_frame_timestamp_ms = timestamp_ms;
        let target_tilt_degrees = 0;

        if (this.processed_drag_pointer !== event) {
            const pointer_delta_x_px = (event.clientX - this.last_pointer_x_px) * scale_x;
            const pointer_delta_y_px = (event.clientY - this.last_pointer_y_px) * scale_y;
            target_tilt_degrees = get_drag_tilt_degrees(
                event.clientX - this.last_pointer_x_px,
                event.timeStamp - this.last_pointer_timestamp_ms,
            );
            this.drag_offset_x_px -= pointer_delta_x_px;
            this.drag_offset_y_px -= pointer_delta_y_px;
            const maximum_lag_px = this.board.clientWidth / BOARD_SIZE * DRAG_MAXIMUM_LAG_SQUARES;
            const lag_distance_px = Math.hypot(
                this.drag_offset_x_px,
                this.drag_offset_y_px,
            );

            if (lag_distance_px > maximum_lag_px) {
                const lag_scale = maximum_lag_px / lag_distance_px;
                this.drag_offset_x_px *= lag_scale;
                this.drag_offset_y_px *= lag_scale;
            }

            this.last_pointer_x_px = event.clientX;
            this.last_pointer_y_px = event.clientY;
            this.last_pointer_timestamp_ms = event.timeStamp;
            this.processed_drag_pointer = event;
        }

        const response = 1 - Math.exp(-elapsed_ms / (DRAG_RESPONSE_MS / TILT_RESPONSE_TIME_CONSTANT),);
        this.drag_tilt_degrees = can_animate ? this.drag_tilt_degrees + (target_tilt_degrees - this.drag_tilt_degrees) * response : 0;

        if (can_animate) {
            const horizontal_motion = advance_drag_spring(
                this.drag_offset_x_px,
                this.drag_velocity_x_px_per_second,
                elapsed_ms,
            );
            const vertical_motion = advance_drag_spring(
                this.drag_offset_y_px,
                this.drag_velocity_y_px_per_second,
                elapsed_ms,
            );
            this.drag_offset_x_px = horizontal_motion.offset_px;
            this.drag_offset_y_px = vertical_motion.offset_px;
            this.drag_velocity_x_px_per_second = horizontal_motion.velocity_px_per_second;
            this.drag_velocity_y_px_per_second = vertical_motion.velocity_px_per_second;
        } else {
            this.drag_offset_x_px = 0;
            this.drag_offset_y_px = 0;
            this.drag_velocity_x_px_per_second = 0;
            this.drag_velocity_y_px_per_second = 0;
        }

        if (
            Math.abs(this.drag_offset_x_px,) < DRAG_OFFSET_SETTLE_THRESHOLD_PX
            && Math.abs(this.drag_velocity_x_px_per_second,) < DRAG_VELOCITY_SETTLE_THRESHOLD_PX_PER_SECOND
        ) {
            this.drag_offset_x_px = 0;
            this.drag_velocity_x_px_per_second = 0;
        }

        if (
            Math.abs(this.drag_offset_y_px,) < DRAG_OFFSET_SETTLE_THRESHOLD_PX
            && Math.abs(this.drag_velocity_y_px_per_second,) < DRAG_VELOCITY_SETTLE_THRESHOLD_PX_PER_SECOND
        ) {
            this.drag_offset_y_px = 0;
            this.drag_velocity_y_px_per_second = 0;
        }

        if (Math.abs(this.drag_tilt_degrees,) < TILT_SETTLE_THRESHOLD_DEGREES) {
            this.drag_tilt_degrees = 0;
        }

        ghost.style.transform = `translate3d(${x + this.drag_offset_x_px}px, ${y + this.drag_offset_y_px}px, 0) scale(${can_animate ? DRAG_SCALE : 1})`;
        const artwork = ghost.firstElementChild as HTMLElement | SVGElement | null;

        if (artwork) {
            artwork.style.transform = this.drag_tilt_degrees ? `rotate(${this.drag_tilt_degrees}deg)` : "";
        }

        if (
            this.drag_tilt_degrees !== 0
            || this.drag_offset_x_px !== 0
            || this.drag_offset_y_px !== 0
        ) {
            this.schedule_drag_frame();
        }
    };

    private update_drag_target(event: PointerEvent,): void {
        const square = this.get_square_at_point(
            event.clientX,
            event.clientY,
        );
        const next_target = square && this.drag_state?.legal_targets.has(square,) ? square : null;

        if (next_target === this.drag_target) {
            return;
        }

        if (this.drag_target) {
            this.squares.get(this.drag_target,)?.classList.remove("drag_target",);
        }

        this.drag_target = next_target;

        if (next_target) {
            this.squares.get(next_target,)?.classList.add("drag_target",);
        }
    }

    private stop_drag_frames(): void {
        if (this.drag_frame_id !== null) {
            cancelAnimationFrame(this.drag_frame_id,);
            this.drag_frame_id = null;
        }

        const artwork = this.drag_ghost?.firstElementChild as HTMLElement | SVGElement | null;

        if (artwork) {
            artwork.style.transform = "";
        }

        this.drag_pointer = null;
        this.processed_drag_pointer = null;
        this.drag_geometry = null;
        this.drag_tilt_degrees = 0;
        this.drag_offset_x_px = 0;
        this.drag_offset_y_px = 0;
        this.drag_velocity_x_px_per_second = 0;
        this.drag_velocity_y_px_per_second = 0;
        this.drag_frame_timestamp_ms = 0;
    }

    private render_shapes(): void {
        const is_black = this.options.orientation === "black";
        const retained_ids = new Set(this.annotations.map((annotation,) => annotation.id,),);

        for (const [id, entry,] of this.shape_nodes) {
            if (!retained_ids.has(id,)) {
                entry.node.remove();
                this.shape_nodes.delete(id,);
            }
        }

        let previous_node: SVGGElement | null = null;

        for (const mark of this.annotations) {
            const signature = JSON.stringify([is_black, mark, this.customization.annotations,],);
            const existing = this.shape_nodes.get(mark.id,);

            if (existing?.signature === signature) {
                const expected_node: ChildNode | null = previous_node ? previous_node.nextSibling : this.shape_layer.firstChild;

                if (expected_node !== existing.node) {
                    this.shape_layer.insertBefore(
                        existing.node,
                        expected_node,
                    );
                }

                previous_node = existing.node;
                continue;
            }

            existing?.node.remove();
            const start = this.get_shape_point(
                mark.from,
                is_black,
            );
            const color = `var(--chessboard-mark-${mark.color ?? this.customization.annotations.default_color})`;
            const shape = document.createElementNS(
                SVG_NAMESPACE,
                "g",
            );
            shape.setAttribute(
                "transform",
                `translate(${start.x} ${start.y})`,
            );
            shape.style.color = color;
            shape.setAttribute(
                "part",
                "annotation",
            );

            if (mark.source === "engine") {
                shape.classList.add("engine_mark",);
            }

            if (mark.to && mark.to !== mark.from) {
                const end = this.get_shape_point(
                    mark.to,
                    is_black,
                );
                const offset_x_squares = end.x - start.x;
                const offset_y_squares = end.y - start.y;
                const arrow_length_squares = Math.hypot(
                    offset_x_squares,
                    offset_y_squares,
                );
                const angle_degrees = Math.atan2(
                    offset_y_squares,
                    offset_x_squares,
                ) * 180 / Math.PI;
                const shaft_half_width_squares = this.customization.annotations.arrow_width_squares / 2 * (mark.source === "engine" ? 2 / 3 : 1);
                const head_length_squares = this.customization.annotations.arrow_head_length_squares;
                const head_half_width_squares = this.customization.annotations.arrow_head_width_squares / 2;
                const head_base_squares = arrow_length_squares - head_length_squares;
                const arrow = document.createElementNS(
                    SVG_NAMESPACE,
                    "path",
                );
                arrow.setAttribute(
                    "transform",
                    `rotate(${angle_degrees})`,
                );
                arrow.setAttribute(
                    "d",
                    `M 0 ${-shaft_half_width_squares}
                    H ${head_base_squares}
                    V ${-head_half_width_squares}
                    L ${arrow_length_squares} 0
                    L ${head_base_squares} ${head_half_width_squares}
                    V ${shaft_half_width_squares}
                    H 0 Z`,
                );
                const is_knight_move = Math.abs(offset_x_squares) * Math.abs(offset_y_squares) === 2
                    && Math.abs(offset_x_squares) + Math.abs(offset_y_squares) === 3;

                if (is_knight_move) {
                    const is_horizontal_first = Math.abs(offset_x_squares) === 2;
                    const bend_angle_degrees = is_horizontal_first
                        ? (offset_x_squares > 0 ? 0 : 180)
                        : (offset_y_squares > 0 ? 90 : -90);
                    const turn_direction = Math.sign(offset_x_squares * offset_y_squares) * (is_horizontal_first ? 1 : -1);
                    const bend_distance_squares = 2;
                    const final_leg_squares = 1;
                    const bent_head_base_squares = final_leg_squares - head_length_squares;
                    arrow.setAttribute(
                        "transform",
                        `rotate(${bend_angle_degrees}) scale(1 ${turn_direction})`,
                    );
                    arrow.setAttribute(
                        "d",
                        `M 0 ${-shaft_half_width_squares}
                        H ${bend_distance_squares + shaft_half_width_squares}
                        V ${bent_head_base_squares}
                        H ${bend_distance_squares + head_half_width_squares}
                        L ${bend_distance_squares} ${final_leg_squares}
                        L ${bend_distance_squares - head_half_width_squares} ${bent_head_base_squares}
                        H ${bend_distance_squares - shaft_half_width_squares}
                        V ${shaft_half_width_squares}
                        H 0 Z`,
                    );
                }

                arrow.setAttribute(
                    "fill",
                    "currentColor",
                );
                shape.classList.add("arrow_mark",);
                shape.append(arrow,);
            } else {
                const tint = document.createElementNS(
                    SVG_NAMESPACE,
                    "rect",
                );
                tint.setAttribute(
                    "x",
                    "-.39",
                );
                tint.setAttribute(
                    "y",
                    "-.39",
                );
                tint.setAttribute(
                    "width",
                    ".78",
                );
                tint.setAttribute(
                    "height",
                    ".78",
                );
                tint.setAttribute(
                    "rx",
                    ".06",
                );
                const corners = document.createElementNS(
                    SVG_NAMESPACE,
                    "path",
                );
                corners.setAttribute(
                    "d",
                    "M -.15 -.39 H -.33 Q -.39 -.39 -.39 -.33 V -.15 "
                    + "M .15 -.39 H .33 Q .39 -.39 .39 -.33 V -.15 "
                    + "M .39 .15 V .33 Q .39 .39 .33 .39 H .15 "
                    + "M -.39 .15 V .33 Q -.39 .39 -.33 .39 H -.15",
                );
                shape.classList.add("square_mark",);
                shape.append(
                    tint,
                    corners,
                );
            }

            shape.dataset.annotationId = mark.id;

            if (mark.label) {
                const title = document.createElementNS(
                    SVG_NAMESPACE,
                    "title",
                );
                title.textContent = mark.label;
                shape.append(title,);
            }

            this.shape_layer.insertBefore(
                shape,
                previous_node ? previous_node.nextSibling : this.shape_layer.firstChild,
            );
            previous_node = shape;
            this.shape_nodes.set(
                mark.id,
                { signature, node: shape, },
            );
        }
    }

    private get_shape_point(
        square: Square,
        is_black: boolean,
    ): {
        x: number;
        y: number;
    } {
        const file = FILES.indexOf(square[0] ?? "",);
        const rank = Number(square[1],);

        return {
            x: (is_black ? LAST_FILE_INDEX - file : file) + 0.5,
            y: (is_black ? rank - 1 : BOARD_SIZE - rank) + 0.5,
        };
    }

    private handle_pointer_down = (event: PointerEvent,): void => {
        this.interaction_source = "pointer";

        if (this.drag_state || !this.options.interactive || (event.button !== 0 && event.button !== 2)) {
            return;
        }

        const square = this.get_event_square(event,);

        if (!square) {
            return;
        }

        const is_annotation_gesture = event.button === 2
            || (event.button === 0 && event.ctrlKey)
            || (event.pointerType === "touch" && this.customization.interaction.touch_mode === "annotate");
        const policy = this.customization.annotations;

        if (!is_annotation_gesture && event.button === 0 && this.annotations.length > 0 && policy.clear_on_left_click !== "none") {
            const retained = this.annotations.filter((mark,) => policy.clear_on_left_click === "user"
                ? (mark.source ?? "user") !== "user"
                : policy.clear_on_left_click === "groups" && !policy.clear_groups.includes(mark.group,),);
            this.set_annotations(
                retained,
                undefined,
                "pointer",
            );
        }

        this.remove_drag_ghost();
        this.last_pointer_x_px = event.clientX;
        this.last_pointer_y_px = event.clientY;
        this.last_pointer_timestamp_ms = event.timeStamp;

        if (is_annotation_gesture && !this.customization.interaction.can_draw_annotations) {
            return;
        }

        if (is_annotation_gesture) {
            this.drag_state = {
                from: square,
                pointer_id: event.pointerId,
                start_x_px: event.clientX,
                start_y_px: event.clientY,
                grab_offset_x_px: 0,
                grab_offset_y_px: 0,
                can_drag: false,
                is_drawing: true,
                is_dragging: false,
                legal_targets: new Set(),
            };
            this.try_set_pointer_capture(event.pointerId,);
            event.preventDefault();

            return;
        }

        const piece = this.get_premove_position().get(square,);

        if (piece && this.can_select_piece(piece,)) {
            const piece_node = this.pieces.get(square,);
            const piece_rect = piece_node?.getBoundingClientRect() ?? this.squares.get(square,)?.getBoundingClientRect();
            const legal_targets = piece.color === this.game.turn()
                ? new Set(this.get_legal_moves(square,).map((move,) => move.to,),)
                : new Set(this.get_premove_game(piece.color,).moves({ square, verbose: true, },).map((move,) => move.to,),);
            this.drag_state = {
                from: square,
                pointer_id: event.pointerId,
                start_x_px: event.clientX,
                start_y_px: event.clientY,
                grab_offset_x_px: piece_rect ? event.clientX - piece_rect.left : 0,
                grab_offset_y_px: piece_rect ? event.clientY - piece_rect.top : 0,
                can_drag: Boolean(this.customization.interaction.can_drag && piece_node && is_point_over_piece(
                    piece_node,
                    event.clientX,
                    event.clientY,
                ),),
                is_drawing: false,
                is_dragging: false,
                legal_targets,
            };
            this.try_set_pointer_capture(event.pointerId,);
        }
    };

    private try_set_pointer_capture(pointer_id: number,): void {
        try {
            this.board.setPointerCapture?.(pointer_id,);
        } catch (error) {
            if (!(error instanceof DOMException) || error.name !== "NotFoundError") {
                throw error;
            }
        }
    }

    private handle_pointer_move = (event: PointerEvent,): void => {
        const state = this.drag_state;

        if (!state || state.pointer_id !== event.pointerId || state.is_drawing || !state.can_drag) {
            return;
        }

        if (!state.is_dragging && Math.hypot(
            event.clientX - state.start_x_px,
            event.clientY - state.start_y_px,
        ) > this.customization.interaction.drag_threshold_px) {
            state.is_dragging = true;
            this.remove_drag_ghost();
            this.board.classList.add("dragging",);
            this.drag_ghost = this.pieces.get(state.from,) ?? null;

            if (this.drag_ghost) {
                this.drag_ghost.getAnimations?.().forEach((animation,) => animation.cancel(),);
                this.drag_ghost.classList.add("drag_ghost",);
                this.board_surface.append(this.drag_ghost,);
            }

            this.render_squares();
        }

        if (state.is_dragging && this.drag_ghost) {
            this.drag_pointer = event;
            this.update_drag_target(event,);
            this.schedule_drag_frame();
            event.preventDefault();
        }
    };
    private handle_pointer_up = (event: PointerEvent,): void => {
        const state = this.drag_state;

        if (state && state.pointer_id !== event.pointerId) {
            return;
        }

        if (state && !state.is_drawing) {
            this.handle_pointer_move(event,);

            if (state.is_dragging && this.drag_pointer !== this.processed_drag_pointer) {
                this.drag_geometry = null;
                this.render_drag_frame(performance.now(),);
            }
        }

        const square = state?.is_dragging ? this.drag_target : this.get_square_at_point(
            event.clientX,
            event.clientY,
        );

        if (state?.pointer_id === event.pointerId) {
            const drag_origin = this.drag_ghost?.getBoundingClientRect() ?? null;
            this.stop_pointer_release_watch();
            this.drag_state = null;
            this.render_squares();

            if (this.board.hasPointerCapture?.(event.pointerId,)) {
                this.board.releasePointerCapture?.(event.pointerId,);
            }

            if (state.is_drawing) {
                if (square) {
                    this.toggle_mark({
                        from: state.from,
                        to: square === state.from ? undefined : square,
                    },);
                }

                return;
            }

            if (!state.can_drag && Math.hypot(
                event.clientX - state.start_x_px,
                event.clientY - state.start_y_px,
            ) > this.customization.interaction.drag_threshold_px) {
                return;
            }

            if (state.is_dragging) {
                if (square && state.legal_targets.has(square,)) {
                    this.move_origin = drag_origin;
                    this.remove_drag_ghost();

                    if (this.get_premove_position().get(state.from,)?.color !== this.game.turn()) {
                        this.set_premove(
                            { from: state.from, to: square, },
                            "pointer",
                        );
                        this.move_origin = null;
                    } else if (!this.try_move(
                        state.from,
                        square,
                    )) {
                        this.move_origin = null;
                    }
                } else {
                    this.return_drag_ghost(state.from,);
                }

                return;
            }
        }

        if (event.button !== 0 || !square || !this.options.interactive || !this.customization.interaction.can_click_move) {
            return;
        }

        this.activate_square(square,);
    };

    private start_pointer_release_watch(): void {
        if (this.pointer_release_controller) {
            return;
        }

        this.pointer_release_controller = new AbortController();
        const options = { signal: this.pointer_release_controller.signal, };

        for (const name of ["pointermove", "pointerup", "pointercancel",] as const) {
            this.ownerDocument.addEventListener(
                name,
                this.handle_uncaptured_pointer,
                options,
            );
        }

        this.ownerDocument.addEventListener(
            "pointerdown",
            this.handle_pointer_restart,
            { ...options, capture: true, },
        );
        this.ownerDocument.defaultView?.addEventListener(
            "blur",
            this.cancel_pointer_release,
            options,
        );
    }

    private stop_pointer_release_watch(): void {
        this.pointer_release_controller?.abort();
        this.pointer_release_controller = null;
    }

    private handle_uncaptured_pointer = (event: PointerEvent,): void => {
        if (!this.drag_state || event.composedPath().includes(this,)) {
            return;
        }

        if (event.type === "pointermove") {
            this.handle_pointer_move(event,);
        } else if (event.type === "pointerup") {
            this.handle_pointer_up(event,);
        } else if (event.type === "pointercancel") {
            this.handle_pointer_cancel(event,);
        }
    };
    private handle_pointer_restart = (event: PointerEvent,): void => {
        if (this.drag_state?.pointer_id === event.pointerId) {
            this.cancel_pointer_release();
        }
    };
    private cancel_pointer_release = (): void => {
        this.move_origin = null;
        this.reset_interaction();
        this.render_squares();
    };
    private handle_pointer_cancel = (event: PointerEvent,): void => {
        if (this.drag_state?.pointer_id !== event.pointerId) {
            return;
        }

        if (event.type === "lostpointercapture") {
            if (this.board.hasPointerCapture?.(event.pointerId,)) {
                return;
            }

            if (event.buttons === 0) {
                this.start_pointer_release_watch();

                return;
            }
        }

        this.stop_pointer_release_watch();
        this.release_pointer_capture();
        this.drag_state = null;
        this.move_origin = null;
        this.remove_drag_ghost();
        this.render_squares();
    };
    private handle_context_menu = (event: MouseEvent,): void => {
        if (this.options.interactive) {
            event.preventDefault();
        }
    };
    private handle_key_down = (event: KeyboardEvent,): void => {
        this.interaction_source = "keyboard";
        const target = event.composedPath()[0];

        if (!this.customization.interaction.can_use_keyboard || event.defaultPrevented || (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select",)))) {
            return;
        }

        const shortcuts = this.customization.interaction.keyboard_shortcuts;

        if (matches_shortcut(
            event,
            shortcuts.undo,
        )) {
            event.preventDefault();
            this.undo("keyboard",);

            return;
        }

        if (matches_shortcut(
            event,
            shortcuts.redo,
        )) {
            event.preventDefault();
            this.redo("keyboard",);

            return;
        }

        const square = this.get_event_square(event,);

        if (!square) {
            return;
        }

        const file = FILES.indexOf(square[0] ?? "",);
        const rank = Number(square[1],);
        const direction = this.options.orientation === "black" ? -1 : 1;
        const next_file = file + (matches_shortcut(
            event,
            shortcuts.right,
        ) ? direction : matches_shortcut(
            event,
            shortcuts.left,
        ) ? -direction : 0);
        const next_rank = rank + (matches_shortcut(
            event,
            shortcuts.up,
        ) ? direction : matches_shortcut(
            event,
            shortcuts.down,
        ) ? -direction : 0);

        if ((next_file !== file || next_rank !== rank) && next_file >= 0 && next_file < BOARD_SIZE && next_rank >= 1 && next_rank <= BOARD_SIZE) {
            event.preventDefault();

            const next_square = `${FILES[next_file]}${next_rank}` as Square;
            this.squares.get(this.focused_square,)!.tabIndex = -1;
            this.focused_square = next_square;

            const button = this.squares.get(next_square,)!;
            button.tabIndex = 0;
            button.focus();
        }

        if (matches_shortcut(
            event,
            this.customization.interaction.keyboard_shortcuts.cancel,
        )) {
            this.reset_interaction();

            if (this.premove) {
                this.cancel_premove("keyboard",);
            }

            this.render_squares();
        }

        if (matches_shortcut(
            event,
            shortcuts.activate,
        ) && this.options.interactive) {
            event.preventDefault();
            this.activate_square(square,);
        }
    };

    private get_event_square(event: Event,): Square | null {
        for (const target of event.composedPath()) {
            if (target instanceof HTMLButtonElement && (target as BoardSquare).square_name) {
                return (target as BoardSquare).square_name ?? null;
            }
        }

        return null;
    }

    private get_square_at_point(
        x: number,
        y: number,
    ): Square | null {
        const has_browser_geometry = typeof this.shadow.elementFromPoint === "function";
        const bounds = this.board.getBoundingClientRect();

        if (x < bounds.left || x >= bounds.right || y < bounds.top || y >= bounds.bottom) {
            return null;
        }

        const column = Math.floor((x - bounds.left) * BOARD_SIZE / bounds.width,);
        const row = Math.floor((y - bounds.top) * BOARD_SIZE / bounds.height,);
        const is_black = this.options.orientation === "black";

        const estimate = `${FILES[is_black ? LAST_FILE_INDEX - column : column]}${is_black ? row + 1 : BOARD_SIZE - row}` as Square;

        if (!has_browser_geometry) {
            return estimate;
        }

        const candidates = [estimate,];

        for (const row_offset of [-1, 0, 1,]) {
            for (const column_offset of [-1, 0, 1,]) {
                const candidate_column = column + column_offset;
                const candidate_row = row + row_offset;

                if ((row_offset === 0 && column_offset === 0) || candidate_column < 0 || candidate_column >= BOARD_SIZE || candidate_row < 0 || candidate_row >= BOARD_SIZE) {
                    continue;
                }

                candidates.push(`${FILES[is_black ? LAST_FILE_INDEX - candidate_column : candidate_column]}${is_black ? candidate_row + 1 : BOARD_SIZE - candidate_row}` as Square,);
            }
        }

        for (const candidate of candidates) {
            const square_bounds = this.squares.get(candidate,)?.getBoundingClientRect();

            if (square_bounds && x >= square_bounds.left && x < square_bounds.right && y >= square_bounds.top && y < square_bounds.bottom) {
                return candidate;
            }
        }

        return null;
    }

    private activate_square(square: Square,): void {
        const piece = this.get_premove_position().get(square,);

        if (this.selected_square && this.selected_square !== square) {
            const selected_piece = this.get_premove_position().get(this.selected_square,);

            if (selected_piece?.color !== this.game.turn() && this.set_premove(
                { from: this.selected_square, to: square, },
                this.interaction_source,
            )) {
                this.selected_square = null;
                this.render_squares();

                return;
            }

            if (this.try_move(
                this.selected_square,
                square,
            )) {
                return;
            }
        }

        this.selected_square = piece && this.can_select_piece(piece,) ? square : null;
        this.render_squares();
        this.dispatchEvent(new CustomEvent(
            "chessboard:select",
            {
                detail: { square: this.selected_square, revision: this.revision, reason: "selection changed", source: this.interaction_source, },
                bubbles: true,
                composed: true,
            },
        ),);
    }

    private can_select_piece(piece: Piece,): boolean {
        if (!this.customization.interaction.can_premove && piece.color !== this.game.turn()) {
            return false;
        }

        if (this.options.playable_color !== "both" && this.options.playable_color !== piece.color) {
            return false;
        }

        return !this.options.premove_color || piece.color === this.options.premove_color;
    }

    private execute_premove(): void {
        const input = this.premove;

        if (!input || this.pending_request?.source === "premove") {
            return;
        }

        const piece = this.game.get(input.from,);

        if (!piece || piece.color !== this.queued_premove_color) {
            this.set_premove(
                null,
                "premove",
            );

            return;
        }

        if (piece.color !== this.game.turn()) {
            return;
        }

        const legal_move = this.get_legal_moves(input.from,).find((move,) => move.to === input.to && (!move.promotion || move.promotion === (input.promotion ?? "q")),);

        if (!legal_move) {
            this.set_premove(
                null,
                "premove",
            );

            return;
        }

        this.premoves.shift();
        this.publish_premoves("premove",);
        this.request_move(
            { ...input, promotion: legal_move.promotion, },
            "premove",
        );
    }

    private try_move(
        from: Square,
        to: Square,
    ): MoveRequest | PromotionRequest | null {
        const legal_moves = this.get_legal_moves(from,).filter((move,) => move.to === to,);

        if (legal_moves.length === 0) {
            return null;
        }

        if (legal_moves.some((move,) => move.promotion,)) {
            const request = {
                from,
                to,
                color: this.game.turn(),
            };
            const settings = this.customization.promotion;

            if (settings.mode === "automatic") {
                return this.request_move(
                    { from, to, promotion: settings.default_piece, },
                    this.interaction_source,
                );
            }

            if (settings.mode === "external") {
                this.promotion_request = request;
                const revision = this.revision;
                const source = this.interaction_source;

                try {
                    settings.request!(
                        { ...request, },
                        (promotion,) => {
                            if (this.revision !== revision || this.promotion_request !== request) {
                                return;
                            }

                            this.reset_interaction();
                            this.render_position();

                            if (promotion !== null) {
                                if (!settings.choices.includes(promotion,)) {
                                    this.emit_error(
                                        "illegal_move",
                                        "The promotion choice is not enabled.",
                                    );

                                    return;
                                }

                                this.request_move(
                                    { from, to, promotion, },
                                    source,
                                );
                            }
                        },
                    );
                } catch (error) {
                    this.reset_interaction();
                    this.render_position();
                    this.emit_error(
                        "render_failed",
                        error,
                    );
                }
            } else {
                this.show_promotion(request,);
            }

            return request;
        }

        return this.request_move(
            { from, to, },
            this.interaction_source,
        );
    }

    private show_promotion(request: PromotionRequest,): void {
        this.promotion_request = request;
        this.promotion_capture = this.pieces.get(request.to,) ?? null;
        this.promotion_capture?.classList.add("promotion_capture",);

        const pawn = this.pieces.get(request.from,);
        const destination = this.squares.get(request.to,);
        const old_rect = this.move_origin ?? pawn?.getBoundingClientRect();
        this.move_origin = null;

        if (pawn && destination) {
            destination.append(pawn,);

            if (old_rect && this.can_animate()) {
                this.animate_piece(
                    pawn,
                    old_rect,
                );
            }
        }

        this.render_squares();

        const panel = document.createElement("div",);
        panel.className = "promotion_panel";
        panel.setAttribute(
            "part",
            "promotion-panel",
        );
        panel.setAttribute(
            "role",
            "dialog",
        );
        panel.setAttribute(
            "aria-label",
            this.customization.labels.promotion,
        );
        panel.addEventListener(
            "keydown",
            (event,) => {
                if (matches_shortcut(
                    event,
                    this.customization.interaction.keyboard_shortcuts.cancel,
                )) {
                    this.reset_interaction();
                    this.render_position();
                    this.squares.get(request.from,)?.focus();
                }
            },
        );

        for (const promotion of this.customization.promotion.choices) {
            const button = document.createElement("button",);
            button.type = "button";
            button.className = "promotion_choice";
            button.setAttribute(
                "part",
                "promotion-choice",
            );
            button.setAttribute(
                "aria-label",
                this.format_label(
                    () => this.customization.labels.format_promotion(promotion,),
                    `Promote to ${get_promotion_name(promotion,)}`,
                ),
            );
            const piece = { color: request.color, type: promotion, };
            const artwork = this.render_piece_art(
                piece,
                request.to,
            );
            button.append(this.customization.renderers.promotion_choice
                ? this.render_content(
                    () => this.customization.renderers.promotion_choice!(piece,),
                    artwork,
                )
                : artwork,);
            button.dataset.color = request.color;
            button.addEventListener(
                "click",
                () => {
                    this.promotion_layer.replaceChildren();
                    this.request_move(
                        { from: request.from, to: request.to, promotion, },
                        this.interaction_source,
                    );
                    this.squares.get(request.to,)?.focus();
                },
            );
            panel.append(button,);
        }

        this.promotion_layer.replaceChildren(panel,);

        if (this.can_animate()) {
            this.track_animation(panel.animate(
                [
                    {
                        opacity: 0,
                        transform: "translateY(6%) scale(.96)",
                    },
                    {
                        opacity: 1,
                        transform: "translateY(0) scale(1)",
                    },
                ],
                {
                    duration: Math.min(
                        PROMOTION_DURATION_MS,
                        this.options.animation_duration ?? DEFAULT_ANIMATION_DURATION_MS,
                    ),
                    easing: MOVE_EASING,
                },
            ),);
        }

        (panel.firstElementChild as HTMLButtonElement)?.focus();
    }

    private toggle_mark(mark: BoardMark,): void {
        const index = this.marks.findIndex((existing,) => existing.from === mark.from && existing.to === mark.to && (existing.source ?? "user") === (mark.source ?? "user"),);

        if (index >= 0) {
            this.marks.splice(
                index,
                1,
            );
        } else {
            this.marks.push(mark,);
        }

        this.set_annotations(
            this.marks,
            undefined,
            "pointer",
        );
    }

    private finish_move(
        move: Move,
        reason: ChangeReason,
        source: ChangeSource,
    ): void {
        this.begin_position_change(
            reason,
            source,
        );
        this.recorded_moves.push({ ...move, },);

        if (move.captured) {
            this.captured_pieces[move.color].push(move.captured,);
        }

        this.cached_pgn = null;
        this.cached_status = null;
        this.last_move = {
            from: move.from,
            to: move.to,
        };
        this.reset_interaction();
        this.render_position(move,);

        if (this.customization.accessibility.announce_moves) {
            const status = this.get_status();
            const parts = [`Move ${move.san}.`,];

            if (move.captured) {
                parts.push("Capture.",);
            }

            if (move.promotion) {
                parts.push("Promotion.",);
            }

            if (status.is_checkmate) {
                parts.push("Checkmate.",);
            } else if (status.is_check) {
                parts.push("Check.",);
            }

            this.announce(parts.join(" ",),);
        }

        this.play_move_sound(
            move,
            reason === "redo" ? "history" : "moves",
        );
        const detail = this.get_position_detail();
        this.dispatchEvent(new CustomEvent(
            "chessboard:move",
            {
                detail: {
                    ...detail,
                    move,
                },
                bubbles: true,
                composed: true,
            },
        ),);

        if (this.revision !== detail.revision) {
            return;
        }

        this.emit_position();

        if (this.revision !== detail.revision) {
            return;
        }

        if (this.get_status().is_game_over) {
            this.dispatchEvent(new CustomEvent(
                "chessboard:gameover",
                {
                    detail: { ...this.get_status(), ...this.change_context, },
                    bubbles: true,
                    composed: true,
                },
            ),);
        }

        this.execute_premove();
    }

    private release_pointer_capture(): void {
        const pointer_id = this.drag_state?.pointer_id;

        if (pointer_id !== undefined && this.board.hasPointerCapture?.(pointer_id,)) {
            this.board.releasePointerCapture?.(pointer_id,);
        }
    }

    private reset_interaction(): void {
        this.stop_pointer_release_watch();
        this.release_pointer_capture();
        this.drag_state = null;
        this.selected_square = null;
        this.promotion_request = null;
        this.promotion_capture?.classList.remove("promotion_capture",);
        this.promotion_capture = null;
        this.promotion_layer.replaceChildren();
        this.remove_drag_ghost();
    }

    private remove_drag_ghost(): void {
        this.board.classList.remove("dragging",);
        this.stop_drag_frames();
        this.drag_return_animation = null;
        const ghost = this.drag_ghost;
        this.drag_ghost = null;

        if (ghost) {
            ghost.getAnimations?.().forEach((animation,) => animation.cancel(),);
            ghost.classList.remove(
                "drag_ghost",
                "moving",
            );
            ghost.style.transform = "";
            ghost.style.left = "";
            ghost.style.top = "";

            for (const [square, piece,] of this.pieces) {
                if (piece === ghost) {
                    this.squares.get(square,)?.append(piece,);

                    break;
                }
            }
        }

        if (this.drag_target) {
            this.squares.get(this.drag_target,)?.classList.remove("drag_target",);
        }

        this.drag_target = null;
    }

    private return_drag_ghost(square: Square,): void {
        this.board.classList.remove("dragging",);
        const ghost = this.drag_ghost;
        const destination = this.squares.get(square,)?.getBoundingClientRect();

        if (!ghost || !destination || !this.can_animate() || typeof ghost.animate !== "function") {
            this.remove_drag_ghost();

            return;
        }

        if (this.drag_target) {
            this.squares.get(this.drag_target,)?.classList.remove("drag_target",);
        }

        this.drag_target = null;

        const origin = ghost.getBoundingClientRect();
        const board_rect = this.board.getBoundingClientRect();
        const target_x_px = (destination.left - board_rect.left) * this.board.clientWidth / board_rect.width;
        const target_y_px = (destination.top - board_rect.top) * this.board.clientHeight / board_rect.height;
        ghost.style.left = `${target_x_px}px`;
        ghost.style.top = `${target_y_px}px`;
        ghost.style.transform = "";
        this.stop_drag_frames();

        const animation = this.animate_piece(
            ghost,
            origin,
            destination,
        );

        if (!animation) {
            this.remove_drag_ghost();

            return;
        }

        animation.effect?.updateTiming({
            duration: Math.min(
                RETURN_DURATION_MS,
                (this.options.animation_duration ?? DEFAULT_ANIMATION_DURATION_MS) * 1.1,
            ),
        },);

        this.drag_return_animation = animation;
        const finish_return = (): void => {
            if (this.drag_return_animation === animation && this.drag_ghost === ghost) {
                this.remove_drag_ghost();
            }
        };
        void animation.finished.then(
            finish_return,
            finish_return,
        );
    }

    private validate_options(options: ChessboardOptions,): void {
        const enums: Partial<Record<
            keyof ChessboardOptions,
            readonly string[]
        >> = {
            orientation: ["white", "black",],
            theme: THEMES,
            quality_profile: QUALITY_PROFILES,
            captured_piece_display: ["counts", "stacked",],
            move_mode: ["automatic", "controlled",],
            event_detail: ["full", "compact",],
            playable_color: ["w", "b", "both",],
            premove_color: ["w", "b",],
        };

        for (const key of Object.keys(options,) as (keyof ChessboardOptions)[]) {
            const option = options[key];

            if (option === undefined) {
                continue;
            }

            const allowed = enums[key];

            if (allowed && !allowed.includes(String(option,),)) {
                throw new TypeError(`Failed to set options: ${key} is invalid.`,);
            }

            if (["interactive", "show_coordinates", "show_captured_pieces", "show_legal_moves", "show_last_move", "is_muted",].includes(key,) && typeof option !== "boolean") {
                throw new TypeError(`Failed to set options: ${key} must be a boolean.`,);
            }
        }

        if (options.piece_renderer !== undefined && typeof options.piece_renderer !== "function") {
            throw new TypeError("Failed to set options: piece_renderer must be a function.",);
        }

        if (options.assets) {
            resolve_assets(options.assets,);
        }
    }

    private begin_position_change(
        reason: ChangeReason,
        source: ChangeSource,
    ): void {
        this.revision += 1;
        this.change_context = { revision: this.revision, reason, source, };
        this.cached_pgn = null;
        this.cached_status = null;
        this.legal_moves_cache.clear();
        this.end_move_request("stale",);
    }

    private get_position_detail(): ChessboardPositionDetail {
        return {
            ...this.change_context,
            fen: this.game.fen(),
            ...(this.options.event_detail === "compact" ? {} : { pgn: this.get_pgn(), }),
        };
    }

    private emit_change(
        reason: ChangeReason,
        source: ChangeSource,
    ): ChessboardChangeDetail {
        const detail = { revision: this.revision, reason, source, };
        this.dispatchEvent(new CustomEvent(
            "chessboard:change",
            { detail, bubbles: true, composed: true, },
        ),);

        return detail;
    }

    private rebuild_captures(): void {
        this.captured_pieces = { w: [], b: [], };

        for (const move of this.recorded_moves) {
            if (move.captured) {
                this.captured_pieces[move.color].push(move.captured,);
            }
        }
    }

    private emit_request_end(
        request: MoveRequest,
        status: "committed" | "rejected" | "stale",
    ): void {
        this.dispatchEvent(new CustomEvent(
            "chessboard:move_request_end",
            { detail: { request: { ...request, input: { ...request.input, }, }, status, }, bubbles: true, composed: true, },
        ),);
    }

    private end_move_request(status: "rejected" | "stale",): void {
        const request = this.pending_request;

        if (request) {
            this.pending_request = null;

            if (request.source === "premove" && this.premoves.length) {
                this.set_premove(
                    null,
                    "premove",
                );
            }

            this.emit_request_end(
                request,
                status,
            );
        }
    }

    private track_animation(animation: Animation,): Animation {
        this.active_animations.add(animation,);
        const finish = (): void => {
            this.active_animations.delete(animation,);
            this.schedule_animation_notification();
        };
        void animation.finished.then(
            finish,
            finish,
        );

        return animation;
    }

    private schedule_animation_notification(): void {
        const notification = ++this.animation_notification;
        void this.when_animation_complete().then(() => {
            if (notification === this.animation_notification) {
                this.dispatchEvent(new CustomEvent(
                    "chessboard:animation_complete",
                    { detail: { revision: this.revision, }, bubbles: true, composed: true, },
                ),);
            }
        },);
    }

    private emit_position(): void {
        this.schedule_animation_notification();
        const detail = this.get_position_detail();
        this.dispatchEvent(new CustomEvent(
            "chessboard:position",
            {
                detail,
                bubbles: true,
                composed: true,
            },
        ),);

        if (this.revision === detail.revision) {
            this.emit_change(
                detail.reason,
                detail.source,
            );
        }
    }

    private emit_error(
        reason: ChessboardErrorDetail["reason"],
        error: unknown,
    ): void {
        const cause_message = error instanceof Error ? error.message : String(error,);
        let message = `${ERROR_OPERATIONS[reason]}: ${cause_message.replace(
            /[.!?]$/,
            "",
        )}.`;

        try {
            const translated = this.customization.labels.format_error(
                reason,
                message,
            );

            if (typeof translated === "string") {
                message = translated;
            }
        } catch (format_error) {
            message += ` The error label formatter failed: ${String(format_error,)}.`;
        }

        this.dispatchEvent(new CustomEvent(
            "chessboard:error",
            {
                detail: {
                    reason,
                    message,
                },
                bubbles: true,
                composed: true,
            },
        ),);
    }
}

export function define_chessboard(): void {
    if (globalThis.customElements && !customElements.get("chess-board",)) {
        customElements.define(
            "chess-board",
            ChessboardElement,
        );
    }
}
