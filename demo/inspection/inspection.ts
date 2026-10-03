import type { Square, } from "chess.js";

import type { ChessboardElement, } from "../../src/chessboard";
import { is_point_over_piece, } from "../../src/pieces";
import type { BoardMark, } from "../../src/types";
import { BOARD_EVENTS, STYLE_PROPERTIES, TEST_POSITIONS, } from "./inspection_catalog";

const MAXIMUM_EVENT_COUNT = 100;
const MAXIMUM_MARK_COUNT = 100;
const SQUARE_PATTERN = /^[a-h][1-8]$/;

type RecordedEvent = {
    name: string;
    timestamp: string;
    detail: unknown;
    bubbles: boolean;
    composed: boolean;
};

function get_control<ElementType extends HTMLElement,>(identifier: string,): ElementType {
    const element = document.getElementById(identifier,);

    if (!element) {
        throw new Error(`Failed to find the inspection control: ${identifier}.`,);
    }

    return element as ElementType;
}

function get_input(identifier: string,): string {
    return get_control<HTMLInputElement>(identifier,).value.trim();
}

function serialize_snapshot(snapshot: unknown,): string {
    return JSON.stringify(
        snapshot,
        (
            key,
            entry: unknown,
        ) => typeof entry === "function" ? `[Function: ${key}]` : entry,
        4,
    );
}

function download_snapshot(
    filename: string,
    snapshot: unknown,
): void {
    const url = URL.createObjectURL(new Blob(
        [serialize_snapshot(snapshot,),],
        { type: "application/json", },
    ),);
    const anchor = document.createElement("a",);
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(
        () => URL.revokeObjectURL(url,),
        0,
    );
}

export function initialize_inspection(
    board: ChessboardElement,
    prepare_position_change: () => void,
    refresh_controls: () => void,
): void {
    const events: RecordedEvent[] = [];
    const initial_options = board.get_options();
    const shadow = board.shadowRoot!;
    let pointer_frame_id: number | null = null;
    let pending_pointer: PointerEvent | null = null;
    let release_target: string | null = null;
    let is_refresh_pending = false;
    let pickup: {
        square: string | null;
        is_within_pickup_bounds: boolean;
        artwork_bounds: DOMRect | null;
    } | null = null;

    const set_feedback = (
        message: string,
        tone = "neutral",
    ): void => {
        for (const identifier of ["inspect_feedback", "feedback",]) {
            const element = get_control(identifier,);
            element.textContent = message;
            element.dataset.tone = tone;
        }
    };
    const get_snapshot = () => {
        const square_text = get_input("inspect_square",);
        const is_valid_square = !square_text || SQUARE_PATTERN.test(square_text,);
        const styles = getComputedStyle(board,);
        const grid = shadow.querySelector<HTMLElement>(".board",)!;
        const squares = [...shadow.querySelectorAll<HTMLButtonElement>(".square",),];
        const animations = [...shadow.querySelectorAll<HTMLElement>(".piece",),].flatMap((piece,) => piece.getAnimations().map((animation,) => ({
            square: piece.parentElement?.dataset.square ?? null,
            state: animation.playState,
            current_time_ms: animation.currentTime,
            timing: animation.effect?.getComputedTiming(),
        }),),);

        return {
            status: {
                status: board.get_status(),
                turn: board.get_turn(),
                options: board.get_options(),
                attributes: Object.fromEntries(board.getAttributeNames().map((name,) => [name, board.getAttribute(name,),],),),
                prefers_reduced_motion: matchMedia("(prefers-reduced-motion: reduce)",).matches,
            },
            moves: {
                square: square_text || null,
                error: is_valid_square ? null : "Enter a square from a1 to h8, or leave the field empty.",
                legal_moves: is_valid_square ? board.get_legal_moves(square_text ? square_text as Square : undefined,) : [],
                uci_history: board.get_uci_moves(),
            },
            position: {
                fen: board.get_position(),
                pgn: board.get_pgn(),
                uci_position: board.get_uci_position(),
            },
            marks: { marks: board.get_marks(), premoves: board.get_premoves(), },
            rendered: {
                is_connected: board.isConnected,
                is_hidden: board.hidden,
                board_bounds: grid.getBoundingClientRect().toJSON(),
                square_count: squares.length,
                piece_count: shadow.querySelectorAll(".piece",).length,
                drag_target: shadow.querySelector<HTMLElement>(".drag_target",)?.dataset.square ?? null,
                promotion_choices: [...shadow.querySelectorAll(".promotion_choice",),].map((choice,) => choice.getAttribute("aria-label",),),
                material_rows: [...shadow.querySelectorAll("[role=group]",),].map((row,) => row.getAttribute("aria-label",),),
                active_element: shadow.activeElement?.getAttribute("aria-label",) ?? null,
                animations,
                squares: squares.map((square,) => ({
                    square: square.dataset.square,
                    label: square.getAttribute("aria-label",),
                    tab_index: square.tabIndex,
                    classes: square.className,
                }),),
            },
            styles: Object.fromEntries(STYLE_PROPERTIES.map((name,) => [`--chessboard-${name}`, {
                inline: board.style.getPropertyValue(`--chessboard-${name}`,) || null,
                computed: styles.getPropertyValue(`--chessboard-${name}`,).trim() || null,
            },],),),
        };
    };
    const refresh_snapshot = (): void => {
        const snapshot = get_snapshot();

        for (const [name, section,] of Object.entries(snapshot,)) {
            get_control(`inspect_${name}`,).textContent = serialize_snapshot(section,);
        }
    };
    const refresh_events = (): void => {
        const filter = get_input("inspect_event_filter",);
        get_control("inspect_events",).textContent = serialize_snapshot(events.filter((event,) => filter === "all" || event.name === filter,),);
    };
    const schedule_refresh = (): void => {
        if (is_refresh_pending) {
            return;
        }

        is_refresh_pending = true;
        queueMicrotask(() => {
            is_refresh_pending = false;
            refresh_snapshot();
            refresh_events();
        },);
    };
    const bind_action = (
        identifier: string,
        action: () => void,
    ): void => {
        get_control(identifier,).addEventListener(
            "click",
            () => {
                try {
                    action();
                    refresh_controls();
                    refresh_snapshot();
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error,);
                    set_feedback(`Failed to run the playground action: ${message.replace(
                        /[.!?]$/,
                        "",
                    )}.`, "error",);
                }
            },
        );
    };

    for (const name of BOARD_EVENTS) {
        board.addEventListener(
            name,
            (event,) => {
                if (!get_control<HTMLInputElement>("inspect_events_paused",).checked) {
                    events.unshift({
                        name,
                        timestamp: new Date().toISOString(),
                        detail: JSON.parse(serialize_snapshot(event.detail,),),
                        bubbles: event.bubbles,
                        composed: event.composed,
                    },);
                    events.length = Math.min(
                        events.length,
                        MAXIMUM_EVENT_COUNT,
                    );
                }

                schedule_refresh();
            },
        );
    }

    for (const name of ["click", "change", "controlchange", "keydown",]) {
        get_control("controls",).addEventListener(
            name,
            schedule_refresh,
            true,
        );
    }

    get_control("inspect_square",).addEventListener(
        "input",
        refresh_snapshot,
    );
    get_control("inspect_event_filter",).addEventListener(
        "change",
        refresh_events,
    );
    bind_action(
        "inspect_refresh",
        refresh_snapshot,
    );
    bind_action(
        "inspect_download",
        () => download_snapshot(
            "chessboard_snapshot.json",
            get_snapshot(),
        ),
    );
    bind_action(
        "inspect_events_download",
        () => download_snapshot(
            "chessboard_events.json",
            events,
        ),
    );
    bind_action(
        "inspect_events_clear",
        () => {
            events.length = 0;
            refresh_events();
        },
    );
    bind_action(
        "inspect_focus",
        () => {
            const square = get_input("inspect_square",);

            if (!SQUARE_PATTERN.test(square,)) {
                throw new Error("Enter a square from a1 to h8 to focus.",);
            }

            shadow.querySelector<HTMLButtonElement>(`[data-square="${square}"]`,)?.focus();
        },
    );

    const get_test_position = () => TEST_POSITIONS.find((position,) => position.key === get_input("test_position",),)!;
    bind_action(
        "test_load",
        () => {
            const position = get_test_position();
            prepare_position_change();
            board.set_premove(null,);
            board.set_options({ interactive: true, premove_color: undefined, },);
            const is_loaded = "fen" in position ? board.set_position(position.fen,) : board.set_pgn(position.pgn,);

            if (is_loaded) {
                set_feedback(`${position.label} loaded.`,);
            }
        },
    );
    bind_action(
        "test_reset_options",
        () => {
            for (const name of ["fen", "orientation", "theme", "readonly", "coordinates",]) {
                board.removeAttribute(name,);
            }

            board.set_options({ ...initial_options, premove_color: undefined, piece_renderer: undefined, },);
            board.hidden = false;
            set_feedback("Restored the initial options without changing the position.",);
        },
    );
    bind_action(
        "test_second_create",
        () => {
            const container = get_control("test_second_board",);

            if (container.childElementCount) {
                set_feedback("The second board already exists.",);

                return;
            }

            const second_board = document.createElement("chess-board",);
            second_board.setAttribute(
                "aria-label",
                "Independent test board",
            );
            container.append(second_board,);
            second_board.set_options({ show_captured_pieces: false, },);
        },
    );
    bind_action(
        "test_second_remove",
        () => get_control("test_second_board",).replaceChildren(),
    );
    bind_action(
        "test_pgn_load",
        () => {
            prepare_position_change();

            if (board.set_pgn(get_input("test_pgn",),)) {
                set_feedback("Loaded the final PGN position.",);
            }
        },
    );
    bind_action(
        "test_layout",
        () => {
            const width_text = get_input("test_width",);
            const width_px = Number(width_text,);
            const zoom = Number(get_input("test_zoom",),);

            if ((width_text && (!Number.isFinite(width_px,) || width_px < 160 || width_px > 1200)) || !Number.isFinite(zoom,) || zoom < .25 || zoom > 2) {
                throw new Error("Use a width from 160 to 1200 pixels and zoom from 0.25 to 2.",);
            }

            board.style.width = width_text ? `${width_px}px` : "";
            board.style.zoom = String(zoom,);
            board.parentElement?.classList.add("is_layout_test",);
            set_feedback("Applied the test layout. The board stage scrolls when the board exceeds its bounds.",);
        },
    );
    bind_action(
        "test_layout_reset",
        () => {
            board.style.removeProperty("width",);
            board.style.removeProperty("zoom",);
            board.parentElement?.classList.remove("is_layout_test",);
            get_control<HTMLInputElement>("test_width",).value = "";
            get_control<HTMLInputElement>("test_zoom",).value = "1";
        },
    );
    bind_action(
        "test_reconnect",
        () => {
            prepare_position_change();
            const parent = board.parentElement!;
            const sibling = board.nextSibling;
            board.remove();
            parent.insertBefore(
                board,
                sibling,
            );
            set_feedback("Reconnected the same board element. Inspect the position and interaction cleanup.",);
        },
    );
    bind_action(
        "test_hidden",
        () => {
            board.hidden = !board.hidden;
            set_feedback(board.hidden ? "Board hidden. Toggle again to restore it." : "Board restored.",);
        },
    );
    bind_action(
        "test_attribute_apply",
        () => {
            const name = get_input("test_attribute",);

            if (name === "fen") {
                prepare_position_change();
            }

            board.setAttribute(
                name,
                get_input("test_attribute_value",),
            );
        },
    );
    bind_action(
        "test_attribute_remove",
        () => board.removeAttribute(get_input("test_attribute",),),
    );
    bind_action(
        "test_style_apply",
        () => {
            const name = get_input("test_style",);
            const css_value = get_input("test_style_value",);
            const property = name.includes("duration",) ? "transition-duration"
                : name === "shadow" ? "box-shadow"
                : name === "coordinate-opacity" ? "opacity"
                : name === "coordinate-weight" ? "font-weight"
                : name === "radius" ? "border-radius"
                : ["frame-width", "coordinate-size",].includes(name,) ? "width" : "color";

            if (!CSS.supports(
                property,
                css_value,
            )) {
                throw new Error(`Enter a valid ${property} value.`,);
            }

            board.style.setProperty(
                `--chessboard-${name}`,
                css_value,
            );
        },
    );
    bind_action(
        "test_style_remove",
        () => { board.style.removeProperty(`--chessboard-${get_input("test_style",)}`,); },
    );
    bind_action(
        "test_style_reset",
        () => {
            for (const name of STYLE_PROPERTIES) {
                board.style.removeProperty(`--chessboard-${name}`,);
            }

            board.set_options({},);
        },
    );

    bind_action(
        "inspect_marks_current",
        () => {
            get_control<HTMLTextAreaElement>("inspect_marks_input",).value = serialize_snapshot(board.get_marks(),);
        },
    );
    bind_action(
        "inspect_marks_apply",
        () => {
            const parsed_marks: unknown = JSON.parse(get_input("inspect_marks_input",),);

            if (!Array.isArray(parsed_marks,) || parsed_marks.length > MAXIMUM_MARK_COUNT) {
                throw new Error(`Enter an array of at most ${MAXIMUM_MARK_COUNT} marks.`,);
            }

            const marks: BoardMark[] = parsed_marks.map((entry: unknown,) => {
                if (!entry || typeof entry !== "object" || Array.isArray(entry,)) {
                    throw new Error("Each mark must be an object.",);
                }

                const mark = entry as Record<
                    string,
                    unknown
                >;
                const has_valid_keys = Object.keys(mark,).every((name,) => ["from", "to", "color", "source",].includes(name,),);
                const has_valid_squares = typeof mark.from === "string" && SQUARE_PATTERN.test(mark.from,)
                    && (mark.to === undefined || (typeof mark.to === "string" && SQUARE_PATTERN.test(mark.to,)));
                const has_valid_color = mark.color === undefined || ["amber", "blue", "green", "red",].includes(String(mark.color,),);
                const has_valid_source = mark.source === undefined || mark.source === "user" || mark.source === "engine";

                if (!has_valid_keys || !has_valid_squares || !has_valid_color || !has_valid_source) {
                    throw new Error("Use valid squares, supported colors, and user or engine sources.",);
                }

                return mark as BoardMark;
            },);
            board.set_marks(marks,);
            set_feedback(`Replaced the board annotations with ${marks.length} marks.`,);
        },
    );

    for (const source of ["user", "engine",]) {
        bind_action(
            `inspect_marks_${source}`,
            () => board.set_marks(board.get_marks().filter((mark,) => (mark.source ?? "user") !== source,),),
        );
    }

    for (const [identifier, action,] of [
        ["test_invalid_fen", () => board.set_position("invalid",),],
        ["test_invalid_pgn", () => board.set_pgn("1. InvalidMove",),],
        ["test_invalid_uci", () => board.move_uci("z9z0",),],
        ["test_illegal_move", () => board.move({ from: "a1", to: "a1", },),],
        ["test_invalid_premove", () => set_feedback(
            board.set_premove({ from: "a1", to: "a1", },) ? "Premove accepted unexpectedly." : "Premove rejected without changing the position. This method returns false without emitting an error event.",
            "error",
        ),],
    ] as const) {
        bind_action(
            identifier,
            () => { action(); },
        );
    }

    const render_pointer = (): void => {
        pointer_frame_id = null;
        const event = pending_pointer;

        if (!event || !get_control<HTMLInputElement>("inspect_pointer_enabled",).checked) {
            return;
        }

        const squares = [...shadow.querySelectorAll<HTMLElement>(".square",),];
        const square = squares.find((candidate,) => {
            const bounds = candidate.getBoundingClientRect();

            return event.clientX >= bounds.left && event.clientX < bounds.right && event.clientY >= bounds.top && event.clientY < bounds.bottom;
        },);
        const ghost = shadow.querySelector<HTMLElement>(".drag_ghost",);
        get_control("inspect_pointer",).textContent = serialize_snapshot({
            event: event.type,
            pointer_type: event.pointerType,
            pointer_id: event.pointerId,
            client_x_px: event.clientX,
            client_y_px: event.clientY,
            buttons: event.buttons,
            pickup,
            square_under_pointer: square?.dataset.square ?? null,
            square_bounds: square?.getBoundingClientRect().toJSON() ?? null,
            highlighted_destination: shadow.querySelector<HTMLElement>(".drag_target",)?.dataset.square ?? null,
            highlighted_before_release: release_target,
            has_pointer_capture: shadow.querySelector(".board",)!.hasPointerCapture(event.pointerId,),
            ghost_bounds: ghost?.getBoundingClientRect().toJSON() ?? null,
            artwork_viewport_bounds: ghost?.firstElementChild?.getBoundingClientRect().toJSON() ?? null,
            latest_move: board.get_uci_moves().at(-1,) ?? null,
        },);
    };

    for (const name of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture",]) {
        board.addEventListener(
            name,
            (raw_event,) => {
                if (!get_control<HTMLInputElement>("inspect_pointer_enabled",).checked) {
                    return;
                }

                pending_pointer = raw_event as PointerEvent;

                if (name === "pointerup") {
                    release_target = shadow.querySelector<HTMLElement>(".drag_target",)?.dataset.square ?? null;
                } else if (name === "pointerdown") {
                    release_target = null;
                    const square = raw_event.composedPath().find((element,) => element instanceof HTMLElement && element.dataset.square,) as HTMLElement | undefined;
                    const piece = square?.querySelector<HTMLElement>(".piece",);
                    const artwork = piece?.querySelector("use",) ?? piece?.firstElementChild ?? piece;
                    pickup = {
                        square: square?.dataset.square ?? null,
                        is_within_pickup_bounds: Boolean(piece && is_point_over_piece(
                            piece,
                            pending_pointer.clientX,
                            pending_pointer.clientY,
                        ),),
                        artwork_bounds: artwork?.getBoundingClientRect() ?? null,
                    };
                }

                if (pointer_frame_id === null) {
                    pointer_frame_id = requestAnimationFrame(render_pointer,);
                }
            },
            true,
        );
    }

    get_control("inspect_pointer_enabled",).addEventListener(
        "change",
        () => {
            if (!get_control<HTMLInputElement>("inspect_pointer_enabled",).checked) {
                if (pointer_frame_id !== null) {
                    cancelAnimationFrame(pointer_frame_id,);
                    pointer_frame_id = null;
                }

                pending_pointer = null;
                get_control("inspect_pointer",).textContent = "Pointer recording is off.";
            }
        },
    );
    refresh_events();
    refresh_snapshot();
}
