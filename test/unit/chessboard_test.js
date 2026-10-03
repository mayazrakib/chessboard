import assert from "node:assert/strict";
import { test, } from "node:test";

import { create_dom_environment, } from "./dom.js";

create_dom_environment();

const { ChessboardElement, define_chessboard, } = await import("../../dist/core.js",);
define_chessboard();

function create_board() {
    return document.createElement("meson-chessboard",);
}

for (const [key, allowed,] of [
    ["orientation", ["white", "black",],],
    ["theme", ["brown", "sage", "slate", "linen",],],
    ["quality_profile", ["full", "balanced", "minimal",],],
    ["captured_piece_display", ["counts", "stacked",],],
    ["move_mode", ["automatic", "controlled",],],
    ["event_detail", ["full", "compact",],],
    ["playable_color", ["w", "b", "both",],],
    ["premove_color", ["w", "b",],],
]) {
    test(
        `The ${key} option accepts its supported values and rejects invalid updates atomically.`,
        () => {
            const board = create_board();

            for (const option of allowed) {
                board.set_options({ [key]: option, },);

                assert.equal(
                    board.get_options()[key],
                    option,
                );
            }

            const previous_options = board.get_options();

            for (const option of ["invalid", null, false, 0,]) {
                assert.throws(
                    () => board.set_options({ show_coordinates: false, [key]: option, },),
                    TypeError,
                );
                assert.deepEqual(
                    board.get_options(),
                    previous_options,
                );
            }
        },
    );
}

for (const key of ["interactive", "show_coordinates", "show_captured_pieces", "show_legal_moves", "show_last_move", "is_muted",]) {
    test(
        `The ${key} option requires boolean values and can restore its default.`,
        () => {
            const board = create_board();
            const default_option = board.get_options()[key];

            for (const is_enabled of [false, true,]) {
                board.set_options({ [key]: is_enabled, },);

                assert.equal(
                    board.get_options()[key],
                    is_enabled,
                );
            }

            for (const option of [0, 1, "true", "false", null,]) {
                assert.throws(
                    () => board.set_options({ [key]: option, },),
                    TypeError,
                );
            }

            board.set_options({ [key]: undefined, },);

            assert.equal(
                board.get_options()[key],
                default_option,
            );
        },
    );
}

test(
    "Animation duration clamps negative values and restores defaults for nonfinite input.",
    () => {
        const board = create_board();
        const default_duration_ms = board.get_options().animation_duration;
        assert.equal(
            default_duration_ms,
            260,
        );

        for (const [duration_ms, expected_ms,] of [[-1, 0,], [0, 0,], [12.5, 12.5,], [NaN, default_duration_ms,], [Infinity, default_duration_ms,], ["100", default_duration_ms,],]) {
            board.set_options({ animation_duration: duration_ms, },);

            assert.equal(
                board.get_options().animation_duration,
                expected_ms,
            );
        }
    },
);

test(
    "Piece renderers must be callable and invalid asset overrides leave options unchanged.",
    () => {
        const board = create_board();
        const render_piece = () => "piece";
        board.set_options({ piece_renderer: render_piece, },);

        assert.equal(
            board.get_options().piece_renderer,
            render_piece,
        );

        for (const renderer of [null, "piece", {},]) {
            assert.throws(
                () => board.set_options({ piece_renderer: renderer, },),
                TypeError,
            );
        }

        const previous_options = board.get_options();

        assert.throws(
            () => board.set_options({ orientation: "black", assets: { piece_sprite_url: "", }, },),
            TypeError,
        );
        assert.deepEqual(
            board.get_options(),
            previous_options,
        );
    },
);

test(
    "Returned options, asset paths, legal moves, and status cannot mutate component state.",
    () => {
        const board = create_board();
        const options = board.get_options();
        const original_sprite_url = options.assets.piece_sprite_url;
        options.orientation = "black";
        options.assets.piece_sprite_url = "/wrong.svg";
        const moves = board.get_legal_moves("e2",);
        moves[0].to = "a8";
        moves.pop();
        const status = board.get_status();
        status.turn = "b";

        assert.equal(
            board.get_options().orientation,
            "white",
        );
        assert.equal(
            board.get_assets().piece_sprite_url,
            original_sprite_url,
        );
        assert.deepEqual(
            board.get_legal_moves("e2",).map((move,) => move.to,),
            ["e3", "e4",],
        );
        assert.equal(
            board.get_status().turn,
            "w",
        );
    },
);

test(
    "Pending requests, annotations, marks, and premoves return independent snapshots.",
    () => {
        const board = create_board();
        board.set_options({ interaction: { can_premove: true, }, },);
        board.set_options({ move_mode: "controlled", },);
        const request = board.request_move({ from: "e2", to: "e4", },);
        request.input.to = "a8";
        const pending = board.get_pending_move();
        pending.input.from = "a1";

        assert.deepEqual(
            board.get_pending_move().input,
            { from: "e2", to: "e4", },
        );

        board.set_annotations([{ from: "d4", color: "blue", },],);
        board.get_annotations()[0].from = "a8";
        board.get_marks()[0].color = "red";

        assert.equal(
            board.get_annotations()[0].from,
            "d4",
        );
        assert.equal(
            board.get_marks()[0].color,
            "blue",
        );

        board.set_premove({ from: "e7", to: "e5", },);
        const premove = board.get_premove();
        premove.to = "e6";

        assert.equal(
            board.get_premove().to,
            "e5",
        );
    },
);

for (const invalid_mark of [
    { from: "a9", },
    { from: "a1", to: "i1", },
    { from: "a1", color: "purple", },
    { from: "a1", source: "unknown", },
    { from: "a1", id: 1, },
    { from: "a1", group: 1, },
    { from: "a1", label: false, },
]) {
    test(
        `Invalid annotation ${JSON.stringify(invalid_mark,)} preserves existing annotations.`,
        () => {
            const board = create_board();
            board.set_options({ interaction: { can_premove: true, }, },);
            board.set_annotations([{ id: "original", from: "e4", },],);
            const original_annotations = board.get_annotations();

            assert.throws(
                () => board.set_annotations([invalid_mark,],),
                TypeError,
            );
            assert.deepEqual(
                board.get_annotations(),
                original_annotations,
            );
        },
    );
}

test(
    "Annotation groups preserve unrelated entries and prevent identifier collisions.",
    () => {
        const board = create_board();
        board.set_annotations(
            [{ id: "engine_arrow", from: "e2", to: "e4", },],
            "engine",
        );
        board.set_annotations(
            [{ id: "user_circle", from: "d4", },],
            "user",
        );

        assert.throws(
            () => board.set_annotations(
                [{ id: "engine_arrow", from: "a1", },],
                "user",
            ),
            TypeError,
        );
        assert.throws(
            () => board.set_annotations([{ id: "same", from: "a1", }, { id: "same", from: "b1", },],),
            TypeError,
        );

        board.clear_annotations("user",);

        assert.deepEqual(
            board.get_annotations().map((annotation,) => annotation.id,),
            ["engine_arrow",],
        );
        assert.equal(
            board.update_annotation(
                "missing",
                { color: "red", },
            ),
            false,
        );
        assert.equal(
            board.remove_annotation("missing",),
            false,
        );
    },
);

for (const orientation of ["white", "black",]) {
    test(
        `All 64 square centers map correctly for ${orientation} orientation at fractional dimensions.`,
        () => {
            const bounds = new DOMRect(
                40.375,
                19.625,
                537.5,
                421.25,
            );
            const board = create_board();
            board.options.orientation = orientation;
            board.board.getBoundingClientRect = () => bounds;
            board.shadow.elementFromPoint = undefined;
            const files = orientation === "white" ? "abcdefgh" : "hgfedcba";

            for (let row = 0; row < 8; row += 1) {
                for (let column = 0; column < 8; column += 1) {
                    const square = `${files[column]}${orientation === "white" ? 8 - row : row + 1}`;

                    assert.equal(
                        board.get_square_at_point(
                            bounds.left + (column + 0.5) * bounds.width / 8,
                            bounds.top + (row + 0.5) * bounds.height / 8,
                        ),
                        square,
                    );
                    assert.deepEqual(
                        board.get_shape_point(
                            square,
                            orientation === "black",
                        ),
                        { x: column + 0.5, y: row + 0.5, },
                    );
                }
            }

            for (const [x, y,] of [[bounds.right, bounds.top,], [bounds.left, bounds.bottom,], [bounds.left - 0.001, bounds.top,], [bounds.left, bounds.top - 0.001,],]) {
                assert.equal(
                    board.get_square_at_point(
                        x,
                        y,
                    ),
                    null,
                );
            }
        },
    );
}

test(
    "Piece selection respects playable color, turn, and an explicit premove color.",
    () => {
        const board = create_board();
        board.set_options({ interaction: { can_premove: true, }, },);

        for (const playable_color of ["both", "w", "b",]) {
            for (const premove_color of [undefined, "w", "b",]) {
                board.set_options({ playable_color, premove_color, },);

                for (const color of ["w", "b",]) {
                    assert.equal(
                        board.can_select_piece({ color, type: "p", },),
                        (playable_color === "both" || playable_color === color) && (!premove_color || color === premove_color),
                    );
                }
            }
        }
    },
);

test(
    "Position changes invalidate cached state and pending approvals together.",
    () => {
        const board = create_board();
        board.set_options({ move_mode: "controlled", },);
        const request = board.request_move({ from: "e2", to: "e4", },);
        board.get_pgn();
        board.get_status();
        board.get_legal_moves("e2",);
        const revision = board.get_revision();
        const ended_requests = [];
        board.addEventListener(
            "chessboard:move_request_end",
            (event,) => ended_requests.push(event.detail,),
        );
        board.begin_position_change(
            "position loaded",
            "api",
        );

        assert.equal(
            board.get_revision(),
            revision + 1,
        );
        assert.equal(
            board.cached_pgn,
            null,
        );
        assert.equal(
            board.cached_status,
            null,
        );
        assert.equal(
            board.legal_moves_cache.size,
            0,
        );
        assert.equal(
            board.get_pending_move(),
            null,
        );
        assert.deepEqual(
            ended_requests,
            [{ request, status: "stale", },],
        );
    },
);

test(
    "Animation completion waits for resolved and cancelled animations and releases both.",
    async () => {
        const board = create_board();
        let finish_animation;
        let cancel_animation;
        const completed = {
            finished: new Promise((resolve,) => {
                finish_animation = resolve;
            },),
        };
        const cancelled = {
            finished: new Promise((
                resolve,
                reject,
            ) => {
                cancel_animation = reject;
            },),
        };
        board.track_animation(completed,);
        board.track_animation(cancelled,);
        let has_finished = false;
        const completion = board.when_animation_complete().then(() => {
            has_finished = true;
        },);
        finish_animation();
        await completed.finished;

        assert.equal(
            has_finished,
            false,
        );

        cancel_animation(new Error("The animation was cancelled.",),);
        await completion;

        assert.equal(
            has_finished,
            true,
        );
        assert.equal(
            board.active_animations.size,
            0,
        );
        assert.ok(board instanceof ChessboardElement,);
    },
);

test(
    "Detached board history supports captures, undo, redo, seeking, and branch replacement.",
    () => {
        const board = create_board();
        const initial_position = board.get_position();

        for (const notation of ["e2e4", "d7d5", "e4d5",]) {
            assert.ok(board.move_uci(notation,),);
        }

        assert.deepEqual(
            board.captured_pieces,
            { w: ["p",], b: [], },
        );
        assert.equal(
            board.get_uci_position(),
            "position startpos moves e2e4 d7d5 e4d5",
        );

        const captured_position = board.get_position();
        board.undo();

        assert.deepEqual(
            board.get_history_state(),
            { index: 2, length: 3, can_undo: true, can_redo: true, },
        );
        assert.deepEqual(
            board.captured_pieces.w,
            [],
        );

        board.redo();

        assert.equal(
            board.get_position(),
            captured_position,
        );

        board.seek_history(0,);

        assert.equal(
            board.get_position(),
            initial_position,
        );

        board.seek_history(3,);

        assert.equal(
            board.get_position(),
            captured_position,
        );

        board.undo();
        board.move_uci("g1f3",);

        assert.equal(
            board.redo(),
            null,
        );
        assert.deepEqual(
            board.get_uci_moves(),
            ["e2e4", "d7d5", "g1f3",],
        );
    },
);

for (const [operation, input, reason,] of [
    ["set_position", "invalid", "invalid_position",],
    ["set_pgn", "1. e5", "invalid_pgn",],
    ["move_uci", "e2e5", "illegal_move",],
    ["move_uci", "invalid", "illegal_move",],
    ["move", { from: "e2", to: "e5", }, "illegal_move",],
]) {
    test(
        `${operation} reports ${reason} without changing position or revision.`,
        () => {
            const board = create_board();
            const initial_position = board.get_position();
            const errors = [];
            board.addEventListener(
                "chessboard:error",
                (event,) => errors.push(event.detail,),
            );
            board[operation](input,);

            assert.equal(
                board.get_position(),
                initial_position,
            );
            assert.equal(
                board.get_revision(),
                0,
            );
            assert.equal(
                errors.length,
                1,
            );
            assert.equal(
                errors[0].reason,
                reason,
            );
            assert.match(
                errors[0].message,
                /^[A-Z].*\.$/,
            );
        },
    );
}

test(
    "Loading PGN rebuilds captures and loading a position resets history.",
    () => {
        const board = create_board();

        assert.equal(
            board.set_pgn("1. e4 d5 2. exd5 Qxd5",),
            true,
        );
        assert.deepEqual(
            board.captured_pieces,
            { w: ["p",], b: ["p",], },
        );

        const position = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";

        assert.equal(
            board.set_position(position,),
            true,
        );
        assert.deepEqual(
            board.get_history_state(),
            { index: 0, length: 0, can_undo: false, can_redo: false, },
        );
        assert.equal(
            board.get_uci_position(),
            `position fen ${position}`,
        );
        assert.deepEqual(
            board.captured_pieces,
            { w: [], b: [], },
        );
    },
);

test(
    "Automatic requests can be cancelled, explicitly committed, or rejected by identifier.",
    () => {
        const board = create_board();
        const prevent_move = (event,) => event.preventDefault();
        board.addEventListener(
            "chessboard:move_request",
            prevent_move,
        );
        const request = board.request_move({ from: "e2", to: "e4", },);

        assert.equal(
            board.get_revision(),
            0,
        );
        assert.equal(
            board.commit_move(request.id + 1,),
            null,
        );
        assert.equal(
            board.reject_move(request.id + 1,),
            false,
        );
        assert.equal(
            board.commit_move(request.id,).san,
            "e4",
        );

        const rejected = board.request_move({ from: "e7", to: "e5", },);

        assert.equal(
            board.reject_move(rejected.id,),
            true,
        );
        assert.equal(
            board.get_pending_move(),
            null,
        );

        board.removeEventListener(
            "chessboard:move_request",
            prevent_move,
        );
        board.request_move({ from: "e7", to: "e5", },);

        assert.equal(
            board.get_turn(),
            "w",
        );
    },
);

test(
    "Premoves reject unavailable pieces and execute only after the opponent moves.",
    () => {
        const board = create_board();
        board.set_options({ interaction: { can_premove: true, }, },);

        for (const input of [{ from: "a3", to: "a4", }, { from: "e2", to: "e4", }, { from: "e7", to: "d7", }, { from: "e7", to: "e7", }, { from: "e7", to: "e3", }, { from: "e7", to: "d6", }, { from: "c8", to: "h3", }, { from: "g8", to: "g6", }, { from: "e7", to: "e5", promotion: "q", },]) {
            assert.equal(
                board.set_premove(input,),
                false,
            );
        }

        assert.equal(
            board.set_premove({ from: "e7", to: "e5", },),
            true,
        );
        assert.equal(
            board.get_revision(),
            0,
        );

        board.move_uci("e2e4",);

        assert.deepEqual(
            board.get_uci_moves(),
            ["e2e4", "e7e5",],
        );
        assert.equal(
            board.get_premove(),
            null,
        );
    },
);

test(
    "A failing custom piece renderer reports the failure and uses default artwork.",
    () => {
        const board = create_board();
        const errors = [];
        board.addEventListener(
            "chessboard:error",
            (event,) => errors.push(event.detail.reason,),
        );

        for (const render_piece of [() => 42, () => {
            throw new Error("Rendering failed.",);
        },]) {
            board.set_options({ piece_renderer: render_piece, },);
            const artwork = board.render_piece_art(
                { color: "w", type: "n", },
                "b1",
            );

            assert.equal(
                artwork.tagName.toLowerCase(),
                "svg",
            );
        }

        assert.deepEqual(
            errors,
            ["render_failed", "render_failed",],
        );
    },
);

test(
    "Sound is enabled by default, muting stops playback, and boards retain independent mute state.",
    () => {
        const board = create_board();
        const other_board = create_board();
        const sounds = [];
        let stop_count = 0;
        board.audio.play = (sound,) => sounds.push(sound,);
        board.audio.stop = () => {
            stop_count += 1;
        };

        assert.equal(
            board.is_muted(),
            false,
        );

        board.move_uci("e2e4",);
        board.set_muted(true,);
        board.move_uci("e7e5",);

        assert.deepEqual(
            sounds,
            ["move",],
        );
        assert.equal(
            stop_count,
            1,
        );
        assert.equal(
            other_board.is_muted(),
            false,
        );

        board.set_options({ is_muted: false, },);
        board.move_uci("g1f3",);

        assert.deepEqual(
            sounds,
            ["move", "move",],
        );

        board.disconnectedCallback();

        assert.equal(
            stop_count,
            2,
        );
        assert.throws(
            () => board.set_muted("true",),
            TypeError,
        );
    },
);

for (const [description, fen, notation, sound,] of [
    ["ordinary movement", "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", "e2e4", "move",],
    ["capture", "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", "e4d5", "capture",],
    ["en passant", "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e5d6", "capture",],
    ["castling", "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1", "move",],
    ["check", "4k3/8/8/8/8/8/R7/4K3 w - - 0 1", "a2e2", "check",],
    ["checkmate", "7k/8/5KQ1/8/8/8/8/8 w - - 0 1", "g6g7", "checkmate",],
    ["stalemate", "7k/8/5K2/6Q1/8/8/8/8 w - - 0 1", "g5g6", "draw",],
    ["promotion with check", "7k/P7/8/8/8/8/8/K7 w - - 0 1", "a7a8q", "check",],
]) {
    test(
        `A completed ${description} plays exactly one ${sound} recording.`,
        () => {
            const board = create_board();
            const sounds = [];
            board.audio.play = (name,) => sounds.push(name,);
            board.set_position(fen,);

            assert.deepEqual(
                sounds,
                [],
            );
            assert.ok(board.move_uci(notation,),);
            assert.deepEqual(
                sounds,
                [sound,],
            );
        },
    );
}

test(
    "Rejected moves and pending approvals stay silent until a move commits.",
    () => {
        const board = create_board();
        const sounds = [];
        board.audio.play = (name,) => sounds.push(name,);
        board.set_options({ move_mode: "controlled", },);
        board.move_uci("e2e5",);
        const rejected = board.request_move({ from: "e2", to: "e4", },);
        board.reject_move(rejected.id,);
        const accepted = board.request_move({ from: "e2", to: "e4", },);

        assert.deepEqual(
            sounds,
            [],
        );

        board.commit_move(accepted.id,);

        assert.deepEqual(
            sounds,
            ["move",],
        );
    },
);

test(
    "History loading and jumps stay silent while undo, redo, and replay steps play sound.",
    () => {
        const board = create_board();
        const sounds = [];
        board.audio.play = (name,) => sounds.push(name,);
        board.set_pgn("1. e4 d5 2. exd5",);
        board.seek_history(0,);

        assert.deepEqual(
            sounds,
            [],
        );

        board.seek_history(1,);
        board.seek_history(2,);
        board.seek_history(3,);
        board.undo();
        board.redo();
        board.seek_history(2,);
        board.seek_history(2,);

        assert.deepEqual(
            sounds,
            ["move", "move", "capture", "move", "capture", "move",],
        );
    },
);

test(
    "Premoves append, execute in order, and cancel newest first without changing position.",
    () => {
        const board = create_board();
        board.set_options({ interaction: { can_premove: true, }, },);
        const position = board.get_position();
        assert.equal(
            board.set_premove({ from: "e7", to: "e5", },),
            true,
        );
        assert.equal(
            board.set_premove({ from: "e5", to: "e4", },),
            true,
        );
        assert.equal(
            board.set_premove({ from: "g8", to: "f6", },),
            true,
        );
        const snapshot = board.get_premoves();
        snapshot[0].to = "e6";
        assert.equal(
            board.get_premove().to,
            "e5",
        );
        assert.equal(
            board.get_position(),
            position,
        );
        assert.equal(
            board.cancel_premove(),
            true,
        );
        assert.equal(
            board.get_premoves().length,
            2,
        );
        board.move_uci("a2a3",);
        assert.deepEqual(
            board.get_uci_moves(),
            ["a2a3", "e7e5",],
        );
        assert.deepEqual(
            board.get_premoves(),
            [{ from: "e5", to: "e4", },],
        );
        board.move_uci("a3a4",);
        assert.deepEqual(
            board.get_uci_moves(),
            ["a2a3", "e7e5", "a3a4", "e5e4",],
        );
        assert.deepEqual(
            board.get_premoves(),
            [],
        );
        assert.equal(
            board.cancel_premove(),
            false,
        );
    },
);

test(
    "An illegal head premove clears all dependent queued moves.",
    () => {
        const board = create_board();
        board.set_options({ interaction: { can_premove: true, }, },);
        board.set_position("4k3/8/8/8/8/8/4r3/4K2R w - - 0 1",);
        assert.equal(
            board.set_premove({ from: "e2", to: "a2", },),
            true,
        );
        assert.equal(
            board.set_premove({ from: "a2", to: "a3", },),
            true,
        );
        board.move_uci("e1e2",);
        assert.deepEqual(
            board.get_premoves(),
            [],
        );
        assert.deepEqual(
            board.get_uci_moves(),
            ["e1e2",],
        );
    },
);

test(
    "Rejecting a controlled premove discards its dependent queue.",
    () => {
        const board = create_board();
        board.set_options({ interaction: { can_premove: true, }, },);
        board.set_options({ move_mode: "controlled", },);
        board.set_premove({ from: "e7", to: "e5", },);
        board.set_premove({ from: "e5", to: "e4", },);
        board.move_uci("a2a3",);
        const request = board.get_pending_move();
        assert.equal(
            request.source,
            "premove",
        );
        assert.equal(
            board.get_premoves().length,
            1,
        );
        board.reject_move(request.id,);
        assert.deepEqual(
            board.get_premoves(),
            [],
        );
        assert.deepEqual(
            board.get_uci_moves(),
            ["a2a3",],
        );
    },
);

test(
    "The premove queue rejects overflow without replacing earlier entries.",
    () => {
        const board = create_board();
        board.set_options({ interaction: { can_premove: true, }, },);

        for (let index = 0; index < 32; index++) {
            const input = index % 2 === 0 ? { from: "g8", to: "f6", } : { from: "f6", to: "g8", };
            assert.equal(
                board.set_premove(input,),
                true,
            );
        }

        assert.equal(
            board.set_premove({ from: "g8", to: "f6", },),
            false,
        );
        assert.equal(
            board.get_premoves().length,
            32,
        );
        board.set_premove(null,);
        assert.deepEqual(
            board.get_premoves(),
            [],
        );
    },
);

test(
    "Premoves reject pinned pieces and king moves into attack.",
    () => {
        const board = create_board();
        board.set_options({ interaction: { can_premove: true, }, },);
        board.set_position("4k3/4r3/8/8/8/8/8/K3R3 w - - 0 1",);
        assert.equal(
            board.set_premove({ from: "e7", to: "d7", },),
            false,
        );
        assert.equal(
            board.set_premove({ from: "e7", to: "e6", },),
            true,
        );
        board.set_premove(null,);
        board.set_position("4k3/8/8/8/8/8/8/K2R4 w - - 0 1",);
        assert.equal(
            board.set_premove({ from: "e8", to: "d8", },),
            false,
        );
        board.remove();
    },
);

test(
    "Premoves are disabled by default and can be explicitly enabled.",
    () => {
        const board = create_board();
        assert.equal(
            board.get_options().interaction.can_premove,
            false,
        );
        assert.equal(
            board.set_premove({ from: "e7", to: "e5", },),
            false,
        );
        board.set_options({ interaction: { can_premove: true, }, },);
        assert.equal(
            board.set_premove({ from: "e7", to: "e5", },),
            true,
        );
        board.set_options({ interaction: { can_premove: false, }, },);
        assert.deepEqual(
            board.get_premoves(),
            [],
        );
        board.remove();
    },
);
