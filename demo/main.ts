import type { PieceSymbol, Square, } from "chess.js";

import type { ChessboardElement, } from "../src/chessboard.ts";
import "../src/index.ts";
import type { BoardMark, BoardTheme, MarkColor, Orientation, } from "../src/types.ts";

import { update_control, } from "./controls/control_bindings";
import { initialize_inspection, } from "./inspection/inspection";
import { PgnReplay, render_replay_buttons, } from "./replay/replay";

const board = get_element<ChessboardElement>("chessboard",);

const PRESETS: Record<
    string,
    {
        fen?: string;
        pgn?: string;
        label: string;
    }
> = {
    start: {
        fen: "start",
        label: "Starting position",
    },
    castling: {
        fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
        label: "Castling position",
    },
    en_passant: {
        fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
        label: "En passant position",
    },
    promotion: {
        fen: "7k/P7/8/8/8/8/8/K7 w - - 0 1",
        label: "Promotion position",
    },
    check: {
        fen: "7k/8/5Q2/6K1/8/8/8/8 b - - 0 1",
        label: "Check position",
    },
    black_checkmate: {
        pgn: "1. f3 e5 2. g4 Qh4#",
        label: "Black checkmate position",
    },
    checkmate: {
        fen: "7k/6Q1/5K2/8/8/8/8/8 b - - 0 1",
        label: "Checkmate position",
    },
    stalemate: {
        fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
        label: "Stalemate position",
    },
};
const START_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const SAMPLE_MOVES: {
    from: Square;
    to: Square;
}[] = [
        {
            from: "e2",
            to: "e4",
        },
        {
            from: "e7",
            to: "e5",
        },
        {
            from: "g1",
            to: "f3",
        },
        {
            from: "b8",
            to: "c6",
        },
        {
            from: "f1",
            to: "c4",
        },
        {
            from: "f8",
            to: "c5",
        },
        {
            from: "e1",
            to: "g1",
        },
    ];
const MAXIMUM_EVENT_COUNT = 30;
const PLAYBACK_INTERVAL_MS = 520;
const SQUARE_PATTERN = /^[a-h][1-8]$/;
let playback_generation = 0;
let selected_square: Square | null = null;
let replay: PgnReplay | null = null;
let replay_timer: number | null = null;
let is_fen_dirty = false;

function get_element<ElementType extends HTMLElement,>(identifier: string,): ElementType {
    const element = document.getElementById(identifier,);

    if (!element) {
        throw new Error(`Failed to find the control: ${identifier}.`,);
    }

    return element as ElementType;
}

function get_square(identifier: string,): Square | null {
    const square_text = get_element<HTMLInputElement>(identifier,).value.trim().toLowerCase();

    return SQUARE_PATTERN.test(square_text,) ? square_text as Square : null;
}

function set_feedback(
    message: string,
    tone = "neutral",
): void {
    const element = get_element<HTMLElement>("feedback",);
    element.textContent = message;
    element.dataset.tone = tone;
}

function append_event(
    name: string,
    detail: string,
): void {
    const list = get_element<HTMLOListElement>("event_log",);
    const entry = document.createElement("li",);
    const timestamp = document.createElement("time",);
    timestamp.textContent = new Date().toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        },
    );

    const description = document.createElement("span",);
    description.textContent = `${name[0]?.toUpperCase()}${name.slice(1,)}: ${detail.replace(
        /[.!?]$/,
        "",
    )}.`;
    entry.append(
        timestamp,
        description,
    );
    list.prepend(entry,);

    while (list.children.length > MAXIMUM_EVENT_COUNT) {
        list.lastElementChild?.remove();
    }
}

function get_status_label(): string {
    const status = board.get_status();

    if (status.is_checkmate) {
        return "Checkmate";
    }

    if (status.is_stalemate) {
        return "Stalemate";
    }

    if (status.is_draw) {
        return "Draw";
    }

    if (status.is_check) {
        return "Check";
    }

    return "In play";
}

function update_state(): void {
    const status = board.get_status();
    const side = status.turn === "w" ? "White" : "Black";
    const winner = status.turn === "w" ? "Black" : "White";
    const turn_label = status.is_checkmate
        ? `${winner} wins!`
        : status.is_check ? `${side} in check` : status.is_game_over ? get_status_label() : `${side} to move`;
    get_element<HTMLElement>("turn_indicator",).textContent = turn_label;
    get_element<HTMLButtonElement>("restart_button",).hidden = !status.is_checkmate;
    get_element<HTMLElement>("state_turn",).textContent = side;
    get_element<HTMLElement>("state_status",).textContent = get_status_label();
    get_element<HTMLElement>("state_legal",).textContent = String(board.get_legal_moves().length,);
    get_element<HTMLElement>("state_selected",).textContent = selected_square ?? "None";
    get_element<HTMLElement>("state_square_moves",).textContent = selected_square
        ? board.get_legal_moves(selected_square,).map((move,) => move.san,).join(", ",) || "None"
        : "Select a piece";
    get_element<HTMLElement>("state_marks",).textContent = String(board.get_marks().length,);

    const mark_count = board.get_marks().length;
    get_element<HTMLElement>("marks_count",).textContent = mark_count === 0 ? "No marks" : `${mark_count} mark${mark_count === 1 ? "" : "s"} on board`;

    const premoves = board.get_premoves();
    get_element<HTMLOutputElement>("premove_output",).textContent = premoves.map((premove,) => `${premove.from} → ${premove.to}`,).join(", ",) || "None";

    const fen_input = get_element<HTMLTextAreaElement>("fen_input",);

    if (!is_fen_dirty && document.activeElement !== fen_input) {
        fen_input.value = board.get_position();
    }

    get_element<HTMLTextAreaElement>("uci_position",).value = board.get_uci_position();
    render_replay_state();

    const options = board.get_options();
    update_control(
        "mute_toggle",
        { is_checked: board.is_muted(), },
    );
    get_element<HTMLSelectElement>("theme_select",).value = options.theme ?? "brown";
    get_element<HTMLSelectElement>("orientation_select",).value = options.orientation ?? "white";
    update_control(
        "interactive_toggle",
        { is_checked: options.interactive ?? true, },
    );
    update_control(
        "captures_toggle",
        { is_checked: options.show_captured_pieces ?? true, },
    );
    update_control(
        "coordinates_toggle",
        { is_checked: options.show_coordinates ?? true, },
    );
    update_control(
        "legal_toggle",
        { is_checked: options.show_legal_moves ?? true, },
    );
    update_control(
        "last_move_toggle",
        { is_checked: options.show_last_move ?? true, },
    );
    get_element<HTMLSelectElement>("premove_type",).value = options.interaction?.can_premove ? options.premove_color ?? "" : "disabled";

    get_element<HTMLSelectElement>("capture_display_select",).value = options.captured_piece_display ?? "stacked";

    const duration_ms = options.animation_duration ?? 260;
    update_control(
        "animation_range",
        { value: duration_ms, },
    );
    get_element<HTMLOutputElement>("animation_output",).textContent = `${duration_ms} ms`;
}

function stop_playback(): void {
    playback_generation += 1;

    if (replay_timer !== null) {
        window.clearTimeout(replay_timer,);
        replay_timer = null;
    }

    render_replay_state();
    update_control(
        "play_sample_button",
        { is_disabled: false, },
    );
    update_control(
        "stop_sample_button",
        { is_disabled: true, },
    );
}

function render_replay_state(): void {
    const index = replay?.get_index() ?? 0;
    const move_count = replay?.moves.length ?? 0;
    get_element<HTMLElement>("replay_title",).textContent = replay?.title ?? "Game Replay";
    get_element<HTMLElement>("replay_progress",).textContent = replay ? `${index} / ${move_count}` : "No game loaded";
    update_control(
        "replay_range",
        {
            maximum: move_count,
            value: index,
            is_disabled: move_count === 0,
            value_text: index === 0 ? "Starting position" : `Move ${index}: ${replay?.moves[index - 1]?.san}`,
        },
    );
    update_control(
        "replay_start",
        { is_disabled: index === 0, },
    );
    update_control(
        "replay_previous",
        { is_disabled: index === 0, },
    );
    update_control(
        "replay_next",
        { is_disabled: index === move_count, },
    );
    update_control(
        "replay_end",
        { is_disabled: index === move_count, },
    );
    update_control(
        "replay_play",
        {
            is_disabled: move_count === 0,
            label: replay_timer === null ? "Play" : "Pause",
        },
    );
    document.querySelectorAll<HTMLButtonElement>("[data-replay_index]",).forEach((button,) => {
        const is_current = Number(button.dataset.replay_index,) === index;
        button.setAttribute(
            "aria-current",
            is_current ? "step" : "false",
        );
    },);
}

function render_replay_moves(): void {
    render_replay_buttons(
        get_element<HTMLElement>("replay_moves",),
        replay?.moves ?? [],
        seek_replay,
        replay ? "This game contains no moves." : "No game loaded.",
    );
}

function clear_replay(): void {
    replay = null;
    stop_playback();
    render_replay_moves();
}

function seek_replay(index: number,): void {
    stop_playback();

    if (!replay) {
        return;
    }

    replay.seek(index,);
    update_state();
}

function schedule_replay(): void {
    const interval_ms = Number(get_element<HTMLSelectElement>("replay_speed",).value,);
    replay_timer = window.setTimeout(
        () => {
            replay_timer = null;

            if (!replay) {
                return;
            }

            replay.seek(replay.get_index() + 1,);

            if (replay.get_index() < replay.moves.length) {
                schedule_replay();
            } else {
                set_feedback(
                    "Replay complete.",
                    "success",
                );
            }

            update_state();
        },
        interval_ms,
    );
    render_replay_state();
}

async function copy_text(
    text: string,
    label: string,
): Promise<void> {
    try {
        await navigator.clipboard.writeText(text,);
        set_feedback(
            `${label} copied.`,
            "success",
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error,);
        set_feedback(
            `Failed to copy ${label}: ${message.replace(
                /[.!?]$/,
                "",
            )}.`,
            "error",
        );
    }
}

async function play_sample(): Promise<void> {
    clear_replay();
    board.set_position(START_POSITION,);

    const generation = playback_generation;
    update_control(
        "play_sample_button",
        { is_disabled: true, },
    );
    update_control(
        "stop_sample_button",
        { is_disabled: false, },
    );
    set_feedback("Playing the sample opening.",);

    for (const input of SAMPLE_MOVES) {
        await new Promise<void>((resolve,) => window.setTimeout(
            resolve,
            PLAYBACK_INTERVAL_MS,
        ),);

        if (generation !== playback_generation) {
            return;
        }

        if (!board.move(input,)) {
            stop_playback();

            return;
        }
    }

    stop_playback();
    set_feedback(
        "Sample opening complete.",
        "success",
    );
}

board.addEventListener(
    "chessboard:move",
    (event,) => {
        selected_square = null;
        append_event(
            "move",
            `${event.detail.move.san} · ${event.detail.move.from} → ${event.detail.move.to}`,
        );
        set_feedback(
            `${event.detail.move.san} played.`,
            "success",
        );
    },
);
board.addEventListener(
    "chessboard:position",
    () => {
        if (replay && !replay.has_current_position()) {
            clear_replay();
        }

        selected_square = null;
        append_event(
            "position",
            board.get_position(),
        );
        update_state();
    },
);
board.addEventListener(
    "chessboard:change",
    (event,) => {
        if (event.detail.reason === "options changed") {
            update_control(
                "mute_toggle",
                { is_checked: board.is_muted(), },
            );
        }
    },
);
board.addEventListener(
    "chessboard:select",
    (event,) => {
        selected_square = event.detail.square;
        append_event(
            "select",
            event.detail.square ?? "cleared",
        );
        update_state();
    },
);
board.addEventListener(
    "chessboard:marks",
    (event,) => {
        append_event(
            "marks",
            `${event.detail.length} total`,
        );
        update_state();
    },
);
board.addEventListener(
    "chessboard:premove",
    (event,) => {
        append_event(
            "premove",
            event.detail ? `${event.detail.from} → ${event.detail.to}` : "cleared",
        );
        update_state();
    },
);
board.addEventListener(
    "chessboard:error",
    (event,) => {
        append_event(
            "error",
            event.detail.reason,
        );
        set_feedback(
            event.detail.message,
            "error",
        );
    },
);
board.addEventListener(
    "chessboard:gameover",
    () => {
        append_event(
            "game over",
            get_status_label(),
        );
        update_state();
    },
);

document.addEventListener(
    "keydown",
    (event,) => {
        if (event.defaultPrevented || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }

        const has_other_board = event.composedPath().some((element,) => element instanceof HTMLElement && element.localName === "chess-board" && element !== board,);

        if (has_other_board) {
            return;
        }

        const target = event.composedPath()[0];

        if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="slider"], [role="switch"], [role="tab"]',))) {
            return;
        }

        const can_undo = event.key === "ArrowLeft" || event.key === "ArrowDown";
        const can_redo = event.key === "ArrowUp" || event.key === "ArrowRight";

        if (!can_undo && !can_redo) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        get_element<HTMLButtonElement>(can_undo ? "undo_button" : "redo_button",).click();
    },
    true,
);

get_element<HTMLButtonElement>("undo_button",).addEventListener(
    "click",
    () => {
        stop_playback();

        if (replay) {
            seek_replay(Math.max(
                0,
                replay.get_index() - 1,
            ),);

            return;
        }

        const move = board.undo();
        set_feedback(
            move ? `Undid ${move.san}.` : "No move to undo.",
            move ? "success" : "neutral",
        );
        update_state();
    },
);
get_element<HTMLButtonElement>("redo_button",).addEventListener(
    "click",
    () => {
        stop_playback();

        if (replay) {
            seek_replay(Math.min(
                replay.moves.length,
                replay.get_index() + 1,
            ),);

            return;
        }

        const move = board.redo();
        set_feedback(
            move ? `Redid ${move.san}.` : "No move to redo.",
            move ? "success" : "neutral",
        );
        update_state();
    },
);
get_element<HTMLButtonElement>("flip_button",).addEventListener(
    "click",
    () => {
        board.flip();
        set_feedback(`Viewing from ${board.get_options().orientation}.`,);
        update_state();
    },
);
get_element<HTMLButtonElement>("restart_button",).addEventListener(
    "click",
    () => {
        get_element<HTMLButtonElement>("reset_button",).click();
        get_element<HTMLButtonElement>("reset_button",).focus();
    },
);
get_element<HTMLButtonElement>("reset_button",).addEventListener(
    "click",
    () => {
        stop_playback();
        clear_replay();
        is_fen_dirty = false;
        board.set_position(START_POSITION,);
        board.clear_marks();
        set_feedback(
            "New game ready.",
            "success",
        );
    },
);

get_element<HTMLFormElement>("uci_form",).addEventListener(
    "submit",
    (event,) => {
        event.preventDefault();
        stop_playback();
        board.move_uci(get_element<HTMLInputElement>("uci_input",).value,);
    },
);
get_element<HTMLButtonElement>("copy_uci_button",).addEventListener(
    "click",
    () => {
        void copy_text(
            board.get_uci_position(),
            "UCI position",
        );
    },
);

get_element<HTMLFormElement>("move_form",).addEventListener(
    "submit",
    (event,) => {
        event.preventDefault();
        stop_playback();

        const from = get_square("move_from",);
        const to = get_square("move_to",);

        if (!from || !to) {
            set_feedback(
                "Enter valid squares, such as e2 and e4.",
                "error",
            );

            return;
        }

        const promotion = to.endsWith("1",) || to.endsWith("8",)
            ? get_element<HTMLSelectElement>("move_promotion",).value as PieceSymbol
            : undefined;
        board.move({
            from,
            to,
            ...(promotion ? { promotion, } : {}),
        },);
    },
);
get_element<HTMLSelectElement>("premove_type",).addEventListener(
    "change",
    (event,) => {
        const premove_color = (event.currentTarget as HTMLSelectElement).value;
        const can_premove = premove_color !== "disabled";
        board.set_options({
            interaction: { can_premove, },
            premove_color: premove_color === "w" || premove_color === "b" ? premove_color : undefined,
        },);
        set_feedback(can_premove ? premove_color ? `${premove_color === "w" ? "White" : "Black"} premoves enabled.` : "Premoves enabled for either side." : "Premoves disabled.",);
        update_state();
    },
);
get_element<HTMLButtonElement>("queue_premove_button",).addEventListener(
    "click",
    () => {
        const from = get_square("move_from",);
        const to = get_square("move_to",);

        if (!from || !to) {
            set_feedback(
                "Enter valid from and to squares above.",
                "error",
            );

            return;
        }

        const promotion = to.endsWith("1",) || to.endsWith("8",)
            ? get_element<HTMLSelectElement>("move_promotion",).value as PieceSymbol
            : undefined;
        const is_queued = board.set_premove({
            from,
            to,
            ...(promotion ? { promotion, } : {}),
        },);
        set_feedback(
            is_queued ? `Premove queued: ${from} → ${to}.` : "Choose a piece belonging to the side waiting to move.",
            is_queued ? "success" : "error",
        );
        update_state();
    },
);
get_element<HTMLButtonElement>("clear_premove_button",).addEventListener(
    "click",
    () => {
        board.set_premove(null,);
        set_feedback("Premove cleared.",);
    },
);
get_element<HTMLButtonElement>("play_sample_button",).addEventListener(
    "click",
    () => {
        void play_sample().catch((error: unknown,) => {
            stop_playback();

            const message = error instanceof Error ? error.message : String(error,);

            set_feedback(
                `Failed to play the sample: ${message.replace(
                    /[.!?]$/,
                    "",
                )}.`,
                "error",
            );
        },);
    },
);
get_element<HTMLButtonElement>("stop_sample_button",).addEventListener(
    "click",
    () => {
        stop_playback();
        set_feedback("Playback stopped.",);
    },
);

get_element<HTMLSelectElement>("theme_select",).addEventListener(
    "change",
    (event,) => {
        board.set_options({ theme: (event.currentTarget as HTMLSelectElement).value as BoardTheme, },);
        update_state();
    },
);
get_element<HTMLSelectElement>("orientation_select",).addEventListener(
    "change",
    (event,) => {
        board.set_options({ orientation: (event.currentTarget as HTMLSelectElement).value as Orientation, },);
        update_state();
    },
);
get_element<HTMLElement>("animation_range",).addEventListener(
    "controlchange",
    (event,) => {
        board.set_options({ animation_duration: Number((event as CustomEvent<{ value: number; }>).detail.value,), },);
        update_state();
    },
);

for (const [identifier, option,] of [
    ["interactive_toggle", "interactive",],
    ["coordinates_toggle", "show_coordinates",],
    ["captures_toggle", "show_captured_pieces",],
    ["legal_toggle", "show_legal_moves",],
    ["last_move_toggle", "show_last_move",],
    ["mute_toggle", "is_muted",],
] as const) {
    get_element<HTMLElement>(identifier,).addEventListener(
        "controlchange",
        (event,) => {
            board.set_options({ [option]: (event as CustomEvent<{ is_checked: boolean; }>).detail.is_checked, },);
            update_state();
        },
    );
}

document.querySelectorAll<HTMLButtonElement>("[data-preset]",).forEach((button,) => {
    button.addEventListener(
        "click",
        () => {
            stop_playback();

            const preset = PRESETS[button.dataset.preset ?? ""];

            if (!preset) {
                return;
            }

            if (button.hasAttribute("data-replay-effect",)) {
                board.set_position(START_POSITION,);
            }

            const is_loaded = preset.fen ? board.set_position(preset.fen === "start" ? START_POSITION : preset.fen,) : board.set_pgn(preset.pgn ?? "",);

            if (is_loaded) {
                clear_replay();
                is_fen_dirty = false;
                update_state();
                set_feedback(
                    `${preset.label} loaded.`,
                    "success",
                );
            }
        },
    );
},);
get_element<HTMLTextAreaElement>("fen_input",).addEventListener(
    "input",
    () => {
        is_fen_dirty = true;
    },
);
get_element<HTMLButtonElement>("current_fen_button",).addEventListener(
    "click",
    () => {
        is_fen_dirty = false;
        get_element<HTMLTextAreaElement>("fen_input",).value = board.get_position();
    },
);
get_element<HTMLButtonElement>("replay_start",).addEventListener(
    "click",
    () => seek_replay(0,),
);
get_element<HTMLButtonElement>("replay_previous",).addEventListener(
    "click",
    () => seek_replay(Math.max(
        0,
        (replay?.get_index() ?? 0) - 1,
    ),),
);
get_element<HTMLButtonElement>("replay_next",).addEventListener(
    "click",
    () => seek_replay(Math.min(
        replay?.moves.length ?? 0,
        (replay?.get_index() ?? 0) + 1,
    ),),
);
get_element<HTMLButtonElement>("replay_end",).addEventListener(
    "click",
    () => seek_replay(replay?.moves.length ?? 0,),
);
get_element<HTMLElement>("replay_range",).addEventListener(
    "controlchange",
    (event,) => seek_replay(Number((event as CustomEvent<{ value: number; }>).detail.value,),),
);
get_element<HTMLButtonElement>("replay_play",).addEventListener(
    "click",
    () => {
        const was_playing = replay_timer !== null;
        stop_playback();

        if (was_playing || !replay || replay.moves.length === 0) {
            return;
        }

        if (replay.get_index() === replay.moves.length) {
            replay.seek(0,);
        }

        schedule_replay();
    },
);

get_element<HTMLButtonElement>("load_fen_button",).addEventListener(
    "click",
    () => {
        stop_playback();

        if (board.set_position(get_element<HTMLTextAreaElement>("fen_input",).value.trim(),)) {
            clear_replay();
            is_fen_dirty = false;
            update_state();
            set_feedback(
                "FEN loaded.",
                "success",
            );
        }
    },
);
get_element<HTMLButtonElement>("copy_fen_button",).addEventListener(
    "click",
    () => {
        void copy_text(
            board.get_position(),
            "FEN",
        );
    },
);
get_element<HTMLButtonElement>("load_pgn_button",).addEventListener(
    "click",
    () => {
        stop_playback();

        try {
            const next_replay = new PgnReplay(
                board,
                get_element<HTMLTextAreaElement>("pgn_input",).value.trim(),
            );
            replay = next_replay;
            is_fen_dirty = false;
            replay.load();
            render_replay_moves();
            update_state();
            set_feedback(
                `Loaded ${replay.moves.length} moves for replay.`,
                "success",
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error,);
            set_feedback(
                `Failed to load PGN: ${message.replace(
                    /[.!?]$/,
                    "",
                )}.`,
                "error",
            );
        }
    },
);
get_element<HTMLButtonElement>("copy_pgn_button",).addEventListener(
    "click",
    () => {
        void copy_text(
            replay?.pgn ?? board.get_pgn(),
            "PGN",
        );
    },
);

get_element<HTMLFormElement>("mark_form",).addEventListener(
    "submit",
    (event,) => {
        event.preventDefault();

        const from = get_square("mark_from",);
        const to_text = get_element<HTMLInputElement>("mark_to",).value.trim();
        const to = to_text ? get_square("mark_to",) : null;

        if (!from || (to_text && !to)) {
            set_feedback(
                "Enter valid mark squares, such as e2 and e4.",
                "error",
            );

            return;
        }

        const mark: BoardMark = {
            from,
            color: get_element<HTMLSelectElement>("mark_color",).value as MarkColor,
            source: get_element<HTMLSelectElement>("mark_source",).value as "user" | "engine",
        };

        if (to) {
            mark.to = to;
        }

        board.set_marks([...board.get_marks(), mark,],);
        set_feedback(
            to ? `Arrow added: ${from} → ${to}.` : `Square marked: ${from}.`,
            "success",
        );
    },
);
get_element<HTMLButtonElement>("clear_marks_button",).addEventListener(
    "click",
    () => {
        board.clear_marks();
        set_feedback("Marks cleared.",);
    },
);
get_element<HTMLButtonElement>("clear_log_button",).addEventListener(
    "click",
    () => {
        get_element<HTMLOListElement>("event_log",).replaceChildren();
        set_feedback("Event log cleared.",);
    },
);

update_state();
append_event(
    "Ready",
    "Board initialized.",
);

get_element<HTMLSelectElement>("capture_display_select",).addEventListener(
    "change",
    (event,) => {
        const display = (event.currentTarget as HTMLSelectElement).value;
        board.set_options({ captured_piece_display: display === "stacked" ? "stacked" : "counts", },);
        update_state();
    },
);

initialize_inspection(
    board,
    () => {
        stop_playback();
        clear_replay();
        is_fen_dirty = false;
    },
    update_state,
);
