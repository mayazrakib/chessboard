import assert from "node:assert/strict";
import { afterEach, test, } from "node:test";

import { Chess, } from "chess.js";

import { create_dom_environment, } from "../unit/dom.js";

const browser_window = create_dom_environment();
const { configure_chessboard_assets, define_chessboard, PgnReplay, } = await import("../../dist/core.js",);
configure_chessboard_assets({ stylesheet_url: null, },);
define_chessboard();
afterEach(() => document.body.replaceChildren(),);

function create_board() {
    const board = document.createElement("meson-chessboard",);
    board.set_options({ animation_duration: 0, is_muted: true, },);
    document.body.append(board,);

    return board;
}

test(
    "Board options are independent, invalid updates are atomic, and reset preserves the position.",
    () => {
        const board = create_board();
        const other = create_board();
        board.set_options({ interaction: { can_drag: false, }, sound: { volume: 0.3, }, },);
        const options = board.get_options();
        options.interaction.can_drag = true;
        options.sound.enabled.move = false;

        assert.equal(
            board.get_options().interaction.can_drag,
            false,
        );
        assert.equal(
            other.get_options().interaction.can_drag,
            true,
        );
        assert.equal(
            board.get_options().sound.enabled.move,
            true,
        );
        assert.throws(
            () => board.set_options({ orientation: "black", sound: { volume: -1, }, },),
            RangeError,
        );
        assert.equal(
            board.get_options().orientation,
            "white",
        );
        board.move_uci("e2e4",);
        const fen = board.get_position();
        board.reset_options();

        assert.equal(
            board.get_position(),
            fen,
        );
        assert.equal(
            board.get_options().interaction.can_drag,
            true,
        );
        assert.equal(
            board.get_options().sound.volume,
            0.6,
        );
        assert.equal(
            board.get_options().quality_profile,
            "full",
        );
        assert.equal(
            board.get_options().interaction.touch_mode,
            "move",
        );
        assert.equal(
            board.get_options().accessibility.announce_moves,
            false,
        );
    },
);

for (const [policy, remaining,] of [["all", [],], ["user", ["engine",],], ["groups", ["user",],], ["none", ["user", "engine",],],]) {
    test(
        `Left-button clearing applies the ${policy} policy.`,
        () => {
            const board = create_board();
            board.set_options({ annotations: { clear_on_left_click: policy, clear_groups: ["analysis",], }, },);
            board.set_annotations([{ id: "user", from: "e4", }, { id: "engine", from: "e2", to: "e4", group: "analysis", source: "engine", },],);
            const square = board.shadowRoot.querySelector('[data-square="a3"]',) ?? board.squares.get("a3",);
            square.dispatchEvent(new browser_window.PointerEvent(
                "pointerdown",
                { bubbles: true, composed: true, button: 0, pointerId: 1, },
            ),);

            assert.deepEqual(
                board.get_annotations().map((mark,) => mark.id,),
                remaining,
            );
        },
    );
}

test(
    "Custom images follow their square, overlays use plain text, and supported parts are exposed.",
    () => {
        const board = create_board();
        board.set_options({
            pieces: {
                resolve_url: (
                    piece,
                    square,
                ) => `/pieces/${piece.color}${piece.type}/${square}.svg`, scale: 0.8, padding_px: 2,
            },
            renderers: { square_overlay: (context,) => context.square === "e4" ? "<b>Target</b>" : null, },
        },);
        board.move_uci("e2e4",);
        const square = board.squares.get("e4",);

        assert.ok(square.querySelector('img[src="/pieces/wp/e4.svg"]',),);
        assert.equal(
            square.querySelector(".square_overlay",).textContent,
            "<b>Target</b>",
        );
        assert.equal(
            square.querySelector(".square_overlay b",),
            null,
        );
        assert.equal(
            square.getAttribute("part",),
            "square",
        );
        assert.equal(
            board.shadowRoot.querySelector(".piece",).getAttribute("part",),
            "piece",
        );
        board.set_options({ renderers: undefined, },);

        assert.equal(
            square.querySelector(".square_overlay",),
            null,
        );
    },
);

test(
    "Label and material callbacks localize presentation and recover from callback failures.",
    () => {
        const board = create_board();
        const errors = [];
        board.addEventListener(
            "chessboard:error",
            (event,) => errors.push(event.detail,),
        );
        board.set_options({
            labels: {
                board: "Tablero",
                white: "Blancas",
                black: "Negras",
                no_captures: "Sin capturas",
                format_square: (square,) => `Casilla ${square}`,
                format_material: (context,) => `${context.points} puntos`,
                format_error: (reason,) => `Error: ${reason}.`,
            },
            renderers: { material: (context,) => `Material ${context.points}`, },
        },);

        assert.equal(
            board.board.getAttribute("aria-label",),
            "Tablero",
        );
        assert.equal(
            board.squares.get("a1",).getAttribute("aria-label",),
            "Casilla a1",
        );
        assert.equal(
            board.material_rows.w.textContent,
            "Material 39",
        );
        board.set_options({ renderers: { square_overlay: () => { throw new Error("Overlay failed.",); }, }, },);

        assert.ok(errors.length > 0,);
        assert.equal(
            errors[0].message,
            "Error: render_failed.",
        );
        assert.ok(board.move_uci("e2e4",),);
    },
);

test(
    "Promotion supports automatic underpromotion and configurable choices.",
    () => {
        const board = create_board();
        board.set_position("7k/P7/8/8/8/8/8/K7 w - - 0 1",);
        board.set_options({ promotion: { mode: "automatic", default_piece: "n", choices: ["n",], }, },);
        board.try_move(
            "a7",
            "a8",
        );

        assert.equal(
            board.game.get("a8",).type,
            "n",
        );
        board.set_position("7k/P7/8/8/8/8/8/K7 w - - 0 1",);
        board.set_options({ promotion: { mode: "choose", choices: ["n", "r",], }, renderers: { promotion_choice: (piece,) => piece.type, }, },);
        board.try_move(
            "a7",
            "a8",
        );

        assert.equal(
            board.shadowRoot.querySelectorAll(".promotion_choice",).length,
            2,
        );
        assert.equal(
            board.shadowRoot.querySelector(".promotion_choice",).textContent,
            "n",
        );
    },
);

test(
    "External promotion completes once and ignores completion after replacement or position changes.",
    () => {
        const board = create_board();
        const complete = [];
        board.set_options({
            promotion: {
                mode: "external", request: (
                    request,
                    callback,
                ) => complete.push(callback,),
            },
        },);
        board.set_position("7k/P7/8/8/8/8/8/K7 w - - 0 1",);
        board.try_move(
            "a7",
            "a8",
        );
        complete[0]("r",);
        const revision = board.get_revision();
        complete[0]("q",);

        assert.equal(
            board.game.get("a8",).type,
            "r",
        );
        assert.equal(
            board.get_revision(),
            revision,
        );
        board.set_position("7k/P7/8/8/8/8/8/K7 w - - 0 1",);
        board.try_move(
            "a7",
            "a8",
        );
        board.set_position(new Chess().fen(),);
        complete[1]("q",);

        assert.equal(
            board.get_position(),
            new Chess().fen(),
        );
    },
);

test(
    "Per-effect sound settings and history and replay preferences are independent.",
    () => {
        const board = create_board();
        const sounds = [];
        board.audio.play = (
            sound,
            settings,
        ) => sounds.push({ sound, settings, },);
        board.set_options({ is_muted: false, sound: { volume: 0.25, urls: { move: "/move.mp3", }, should_play_on_history: false, }, },);
        board.move_uci("e2e4",);
        board.undo();
        board.redo();

        assert.deepEqual(
            sounds,
            [{ sound: "move", settings: { volume: 0.25, url: "/move.mp3", }, },],
        );
        const replay = new PgnReplay(
            board,
            "1. e4 e5",
        );
        replay.load();
        board.set_options({ sound: { should_play_on_replay: false, }, },);
        replay.seek(1,);

        assert.equal(
            sounds.length,
            1,
        );
        board.set_options({ sound: { enabled: { move: false, }, }, },);
        board.move_uci("e7e5",);

        assert.equal(
            sounds.length,
            1,
        );
    },
);

test(
    "Disabling premoves clears existing queues and keyboard bindings can be replaced.",
    () => {
        const board = create_board();
        board.set_options({ interaction: { can_premove: true, }, },);
        board.set_premove({ from: "e7", to: "e5", },);
        board.set_options({ interaction: { can_premove: false, keyboard_shortcuts: { undo: ["u",], }, }, },);

        assert.equal(
            board.get_premove(),
            null,
        );
        assert.equal(
            board.set_premove({ from: "e7", to: "e5", },),
            false,
        );
        board.move_uci("e2e4",);
        board.board.dispatchEvent(new browser_window.KeyboardEvent(
            "keydown",
            { bubbles: true, composed: true, key: "u", },
        ),);

        assert.equal(
            board.get_history_state().index,
            0,
        );
        board.move_uci("e2e4",);
        board.set_options({ interaction: { can_use_keyboard: false, }, },);
        board.board.dispatchEvent(new browser_window.KeyboardEvent(
            "keydown",
            { bubbles: true, composed: true, key: "u", },
        ),);

        assert.equal(
            board.get_history_state().index,
            1,
        );
    },
);

test(
    "Rules factories supply independent position loaders and replay games, and invalid providers preserve state.",
    () => {
        const board = create_board();
        const created = [];
        const provider = {
            create_game: (fen,) => {
                const game = new Chess(fen,); created.push(game,);

                return game;
            },
        };
        board.set_rules_provider(provider,);
        board.move_uci("e2e4",);
        const fen = board.get_position();
        assert.throws(
            () => board.set_rules_provider({ create_game: () => ({}), },),
            TypeError,
        );
        assert.equal(
            board.get_position(),
            fen,
        );
        const replay = new PgnReplay(
            board,
            "1. d4 d5",
        );
        replay.load();
        replay.seek(1,);

        assert.equal(
            created.length,
            3,
        );
        assert.equal(
            board.game.get("d4",).type,
            "p",
        );
        assert.notEqual(
            created[0],
            created[1],
        );
        board.set_rules_provider();

        assert.equal(
            board.get_history_state().length,
            0,
        );
    },
);

for (const [player_color, expected_sound,] of [[null, "checkmate",], ["w", "win",], ["b", "lose",],]) {
    test(
        `Checkmate selects ${expected_sound} for perspective ${player_color}.`,
        () => {
            const board = create_board();
            const sounds = [];
            board.audio.play = (sound,) => sounds.push(sound,);
            board.set_options({ is_muted: false, sound: { player_color, }, },);
            board.set_position("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",);
            board.move_uci("f7g7",);

            assert.equal(
                board.get_status().is_checkmate,
                true,
            );
            assert.deepEqual(
                sounds,
                [expected_sound,],
            );
        },
    );
}

test(
    "Public sound playback honors muting and individual effect settings.",
    () => {
        const board = create_board();
        const sounds = [];
        board.audio.play = (sound,) => sounds.push(sound,);
        board.play_sound("win",);
        board.set_muted(false,);
        board.play_sound("win",);
        board.play_sound("lose",);
        board.set_options({ sound: { enabled: { win: false, }, }, },);
        board.play_sound("win",);

        assert.deepEqual(
            sounds,
            ["win", "lose",],
        );
        assert.throws(
            () => board.play_sound("unknown",),
            TypeError,
        );
    },
);
