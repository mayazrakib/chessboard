import assert from "node:assert/strict";
import { after, afterEach, test, } from "node:test";

import { Window, } from "happy-dom";

const window = new Window({ url: "http://localhost", },);
globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLButtonElement = window.HTMLButtonElement;
globalThis.CustomEvent = window.CustomEvent;
globalThis.customElements = window.customElements;
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window,);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window,);

const { ChessboardElement, } = await import("../../dist/index.js",);

function create_board() {
    const board = document.createElement("chess-board",);
    document.body.append(board,);
    board.set_options({ animation_duration: 0, },);

    return board;
}

test(
    "Registers and renders an accessible initial board.",
    () => {
        const board = create_board();
        assert.ok(board instanceof ChessboardElement,);
        assert.equal(
            board.shadowRoot.querySelectorAll(".square",).length,
            64,
        );
        assert.equal(
            board.shadowRoot.querySelectorAll(".piece",).length,
            32,
        );
        assert.ok(board.shadowRoot.querySelector('[data-square="e2"] use',).getAttribute("href",).endsWith("#white-pawn",),);
        assert.ok(board.shadowRoot.querySelector('[data-square="a1"]',).classList.contains("dark",),);
        assert.equal(
            board.shadowRoot.querySelector('[data-square="e2"]',).getAttribute("aria-label",),
            "e2, white pawn",
        );
        assert.equal(
            board.get_legal_moves("e2",).length,
            2,
        );
        board.remove();
    },
);

test(
    "Moves, emits events, undoes, and redoes.",
    () => {
        const board = create_board();
        const details = [];
        board.addEventListener(
            "chessboard:move",
            (event,) => details.push(event.detail,),
        );

        const move = board.move({
            from: "e2",
            to: "e4",
        },);
        assert.equal(
            move.san,
            "e4",
        );
        assert.equal(
            board.get_turn(),
            "b",
        );
        assert.ok(board.shadowRoot.querySelector('[data-square="e4"] use',)?.getAttribute("href",).endsWith("#white-pawn",),);
        assert.equal(
            details.length,
            1,
        );
        assert.equal(
            details[0].fen,
            board.get_position(),
        );
        assert.equal(
            board.undo()?.san,
            "e4",
        );
        assert.equal(
            board.get_turn(),
            "w",
        );
        assert.equal(
            board.redo()?.san,
            "e4",
        );
        assert.match(
            board.get_pgn(),
            /1\. e4 \*$/,
        );
        board.remove();
    },
);

test(
    "Rejects invalid positions without changing the board.",
    () => {
        const board = create_board();
        const original_position = board.get_position();
        let reason = null;
        board.addEventListener(
            "chessboard:error",
            (event,) => {
                reason = event.detail.reason;
            },
        );
        assert.equal(
            board.set_position("invalid",),
            false,
        );
        assert.equal(
            board.get_position(),
            original_position,
        );
        assert.equal(
            reason,
            "invalid_position",
        );
        assert.equal(
            board.move({
                from: "e2",
                to: "e5",
            },),
            null,
        );
        assert.equal(
            board.get_position(),
            original_position,
        );
        board.remove();
    },
);

test(
    "Loads PGN, flips, and keeps marks in sync.",
    () => {
        const board = create_board();
        assert.equal(
            board.set_pgn("1. e4 e5 2. Nf3",),
            true,
        );
        assert.equal(
            board.get_turn(),
            "b",
        );
        board.flip();
        assert.equal(
            board.get_options().orientation,
            "black",
        );
        assert.equal(
            board.shadowRoot.querySelector('[data-square="h1"]',).style.gridColumn,
            "1",
        );
        board.set_marks([{
            from: "e2",
            to: "e4",
            color: "blue",
        }, { from: "d4", },],);
        assert.equal(
            board.shadowRoot.querySelectorAll(".shapes .arrow_mark",).length,
            1,
        );
        assert.equal(
            board.get_marks().length,
            2,
        );
        board.clear_marks();
        assert.equal(
            board.shadowRoot.querySelector(".shapes",).childElementCount,
            0,
        );
        board.remove();
    },
);

test(
    "Keeps castling pieces and custom rendering in sync.",
    () => {
        const board = create_board();
        assert.equal(
            board.set_pgn("1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O",),
            true,
        );
        assert.equal(
            board.shadowRoot.querySelector('[data-square="g1"] .piece',)?.dataset.color,
            "w",
        );
        assert.ok(board.shadowRoot.querySelector('[data-square="f1"] use',)?.getAttribute("href",).endsWith("#white-rook",),);
        assert.equal(
            board.shadowRoot.querySelector('[data-square="h1"] .piece',),
            null,
        );
        board.set_options({ piece_renderer: (piece,) => piece.type.toUpperCase(), },);
        assert.equal(
            board.shadowRoot.querySelector('[data-square="g1"] .piece',)?.textContent,
            "K",
        );
        assert.equal(
            board.undo()?.san,
            "O-O",
        );
        assert.equal(
            board.shadowRoot.querySelector('[data-square="h1"] .piece',)?.textContent,
            "R",
        );
        board.remove();
    },
);

test(
    "Invalid PGN leaves the current game intact.",
    () => {
        const board = create_board();
        board.move({
            from: "e2",
            to: "e4",
        },);

        const position = board.get_position();
        assert.equal(
            board.set_pgn("1. e4 e5 2. Impossible",),
            false,
        );
        assert.equal(
            board.get_position(),
            position,
        );
        board.remove();
    },
);

test(
    "Reports checkmate and emits a game over event.",
    () => {
        const board = create_board();
        let status = null;
        board.addEventListener(
            "chessboard:gameover",
            (event,) => {
                status = event.detail;
            },
        );
        board.move({
            from: "f2",
            to: "f3",
        },);
        board.move({
            from: "e7",
            to: "e5",
        },);
        board.move({
            from: "g2",
            to: "g4",
        },);
        board.move({
            from: "d8",
            to: "h4",
        },);
        assert.equal(
            board.get_status().is_checkmate,
            true,
        );
        assert.equal(
            status?.is_game_over,
            true,
        );
        const king_square = board.shadowRoot.querySelector('[data-square="e1"]',);
        assert.equal(
            king_square.classList.contains("checkmated",),
            true,
        );
        assert.match(
            king_square.getAttribute("aria-label",),
            /checkmate/,
        );

        board.undo();
        assert.equal(
            board.shadowRoot.querySelectorAll(".checked, .checkmated",).length,
            0,
        );
        board.redo();
        assert.equal(
            king_square.classList.contains("checkmated",),
            true,
        );
        board.remove();
    },
);

test(
    "Keyboard selection opens promotion choices.",
    () => {
        const board = create_board();
        assert.equal(
            board.set_position("7k/P7/8/8/8/8/8/K7 w - - 0 1",),
            true,
        );

        const pawn = board.shadowRoot.querySelector('[data-square="a7"]',);
        const destination = board.shadowRoot.querySelector('[data-square="a8"]',);
        pawn.dispatchEvent(new window.KeyboardEvent(
            "keydown",
            {
                key: "Enter",
                bubbles: true,
                composed: true,
            },
        ),);
        destination.dispatchEvent(new window.KeyboardEvent(
            "keydown",
            {
                key: "Enter",
                bubbles: true,
                composed: true,
            },
        ),);
        assert.equal(
            board.shadowRoot.querySelectorAll(".promotion_choice",).length,
            4,
        );
        assert.ok(board.shadowRoot.querySelector('.promotion_choice[aria-label="Promote to knight"] use',)?.getAttribute("href",).endsWith("#white-knight",),);
        board.shadowRoot.querySelector('.promotion_choice[aria-label="Promote to knight"]',).click();
        assert.equal(
            board.get_position().split(" ",)[0],
            "N6k/8/8/8/8/8/8/K7",
        );
        board.remove();
    },
);

test(
    "Queues and executes a premove after the opponent moves.",
    () => {
        const board = create_board();
        board.set_options({ interaction: { can_premove: true, }, },);
        board.set_options({ premove_color: "w", },);
        board.move({
            from: "e2",
            to: "e4",
        },);

        const knight = board.shadowRoot.querySelector('[data-square="g1"]',);
        const destination = board.shadowRoot.querySelector('[data-square="f3"]',);
        knight.dispatchEvent(new window.KeyboardEvent(
            "keydown",
            {
                key: "Enter",
                bubbles: true,
                composed: true,
            },
        ),);
        destination.dispatchEvent(new window.KeyboardEvent(
            "keydown",
            {
                key: "Enter",
                bubbles: true,
                composed: true,
            },
        ),);
        assert.deepEqual(
            board.get_premove(),
            {
                from: "g1",
                to: "f3",
            },
        );
        assert.match(
            destination.getAttribute("aria-label",),
            /premove destination/,
        );
        board.move({
            from: "e7",
            to: "e5",
        },);
        assert.equal(
            board.get_premove(),
            null,
        );
        assert.match(
            board.get_pgn(),
            /Nf3/,
        );
        assert.equal(
            board.get_turn(),
            "b",
        );
        board.remove();
    },
);

test(
    "Clears a premove when its source disappears.",
    () => {
        const board = create_board();
        board.set_options({ interaction: { can_premove: true, }, },);
        board.move({
            from: "e2",
            to: "e4",
        },);
        assert.equal(
            board.set_premove({
                from: "g1",
                to: "f3",
            },),
            true,
        );
        assert.equal(
            board.set_position("4k3/8/8/8/8/8/8/4K3 w - - 0 1",),
            true,
        );
        assert.equal(
            board.get_premove(),
            null,
        );
        board.remove();
    },
);

test(
    "Moves a promoting pawn into place before choosing a piece.",
    () => {
        const board = create_board();
        board.set_position("7k/P7/8/8/8/8/8/K7 w - - 0 1",);

        const source = board.shadowRoot.querySelector('[data-square="a7"]',);
        const destination = board.shadowRoot.querySelector('[data-square="a8"]',);
        source.dispatchEvent(new window.KeyboardEvent(
            "keydown",
            {
                key: "Enter",
                bubbles: true,
                composed: true,
            },
        ),);
        destination.dispatchEvent(new window.KeyboardEvent(
            "keydown",
            {
                key: "Enter",
                bubbles: true,
                composed: true,
            },
        ),);
        assert.ok(destination.querySelector('.piece',),);
        assert.equal(
            source.querySelector('.piece',),
            null,
        );
        board.shadowRoot.querySelector('.promotion_choice[aria-label="Promote to rook"]',).click();
        assert.equal(
            board.get_position().split(" ",)[0],
            "R6k/8/8/8/8/8/8/K7",
        );
        board.remove();
    },
);

test(
    "Supports every promotion choice.",
    () => {
        for (const [name, symbol,] of [["queen", "Q",], ["rook", "R",], ["bishop", "B",], ["knight", "N",],]) {
            const board = create_board();
            board.set_position("7k/P7/8/8/8/8/8/K7 w - - 0 1",);

            for (const square of ["a7", "a8",]) {
                board.shadowRoot.querySelector(`[data-square="${square}"]`,).dispatchEvent(new window.KeyboardEvent(
                    "keydown",
                    {
                        key: "Enter",
                        bubbles: true,
                        composed: true,
                    },
                ),);
            }

            board.shadowRoot.querySelector(`.promotion_choice[aria-label="Promote to ${name}"]`,).click();
            assert.equal(
                board.get_position().split(" ",)[0],
                `${symbol}6k/8/8/8/8/8/8/K7`,
            );
            board.remove();
        }
    },
);

test(
    "Keeps a promotion capture visually clear and restores it on cancel.",
    () => {
        const board = create_board();
        board.set_position("1r5k/P7/8/8/8/8/8/K7 w - - 0 1",);

        for (const square of ["a7", "b8",]) {
            board.shadowRoot.querySelector(`[data-square="${square}"]`,).dispatchEvent(new window.KeyboardEvent(
                "keydown",
                {
                    key: "Enter",
                    bubbles: true,
                    composed: true,
                },
            ),);
        }

        assert.ok(board.shadowRoot.querySelector('[data-square="b8"] .promotion_capture',),);
        assert.match(
            board.shadowRoot.querySelector('[data-square="b8"]',).getAttribute("aria-label",),
            /white pawn/,
        );
        board.shadowRoot.querySelector('.promotion_panel',).dispatchEvent(new window.KeyboardEvent(
            "keydown",
            {
                key: "Escape",
                bubbles: true,
                composed: true,
            },
        ),);
        assert.equal(
            board.shadowRoot.querySelector('[data-square="b8"] .promotion_capture',),
            null,
        );
        assert.match(
            board.shadowRoot.querySelector('[data-square="b8"]',).getAttribute("aria-label",),
            /black rook/,
        );
        board.remove();
    },
);

test(
    "Keeps engine and user annotations separate.",
    () => {
        const board = create_board();
        board.set_marks([
            {
                from: "e2",
                to: "e4",
                color: "blue",
                source: "engine",
            },
            {
                from: "e2",
                to: "e4",
                color: "amber",
                source: "user",
            },
        ],);
        assert.equal(
            board.shadowRoot.querySelectorAll(".shapes .engine_mark",).length,
            1,
        );
        assert.equal(
            board.get_marks().length,
            2,
        );
        board.remove();
    },
);

test(
    "Exposes curated board themes without changing the position.",
    () => {
        const board = create_board();
        const position = board.get_position();
        assert.equal(
            board.get_options().theme,
            "brown",
        );
        board.set_options({ theme: "slate", },);
        assert.equal(
            board.getAttribute("theme",),
            "slate",
        );
        assert.equal(
            board.get_options().theme,
            "slate",
        );
        assert.equal(
            board.get_position(),
            position,
        );
        board.setAttribute(
            "theme",
            "linen",
        );
        assert.equal(
            board.get_options().theme,
            "linen",
        );
        board.set_options({ theme: "brown", },);
        assert.equal(
            board.getAttribute("theme",),
            "brown",
        );
        board.remove();
    },
);

test(
    "Reconnecting during promotion restores the unchanged position.",
    () => {
        const board = create_board();
        board.set_position("1r5k/P7/8/8/8/8/8/K7 w - - 0 1",);

        const original_position = board.get_position();

        for (const square of ["a7", "b8",]) {
            board.shadowRoot.querySelector(`[data-square="${square}"]`,).dispatchEvent(new window.KeyboardEvent(
                "keydown",
                {
                    key: "Enter",
                    bubbles: true,
                    composed: true,
                },
            ),);
        }

        board.remove();
        document.body.append(board,);

        assert.equal(
            board.get_position(),
            original_position,
        );
        assert.equal(
            board.shadowRoot.querySelector(".promotion_panel",),
            null,
        );
        assert.match(
            board.shadowRoot.querySelector('[data-square="a7"]',).getAttribute("aria-label",),
            /white pawn/,
        );
        assert.match(
            board.shadowRoot.querySelector('[data-square="b8"]',).getAttribute("aria-label",),
            /black rook/,
        );
        assert.ok(board.shadowRoot.querySelector('[data-square="a7"] .piece',),);
        assert.ok(board.shadowRoot.querySelector('[data-square="b8"] .piece',),);
    },
);

afterEach(() => {
    document.body.replaceChildren();
},);

after(async () => {
    await window.happyDOM.close();
},);

test(
    "Shows captures and material through moves, undo, redo, and orientation changes.",
    () => {
        const board = create_board();
        const white = board.shadowRoot.querySelector('.material_row[data-color="w"]',);
        const black = board.shadowRoot.querySelector('.material_row[data-color="b"]',);
        assert.equal(
            white.querySelector(".material_inventory",).textContent,
            "16 pieces · 39 pts",
        );
        assert.equal(
            white.querySelector(".material_advantage",).textContent,
            "=",
        );
        board.move("e4",);
        board.move("d5",);
        board.move("exd5",);
        assert.equal(
            black.querySelector(".material_inventory",).textContent,
            "15 pieces · 38 pts",
        );
        assert.equal(
            white.querySelector(".material_advantage",).textContent,
            "+1",
        );
        assert.equal(
            black.querySelector(".material_advantage",).textContent,
            "−1",
        );
        assert.ok(white.querySelector(".capture_group use",).getAttribute("href",).endsWith("#black-pawn",),);
        board.flip();
        assert.equal(
            board.shadowRoot.querySelector(".material_row",).dataset.color,
            "w",
        );
        board.undo();
        assert.equal(
            white.querySelectorAll(".capture_group",).length,
            0,
        );
        assert.equal(
            black.querySelector(".material_inventory",).textContent,
            "16 pieces · 39 pts",
        );
        board.redo();
        assert.equal(
            white.querySelectorAll(".capture_group",).length,
            1,
        );
        board.set_options({ show_captured_pieces: false, },);
        assert.ok(white.hidden && black.hidden,);
        board.set_options({ show_captured_pieces: true, },);
        assert.equal(
            white.hidden,
            false,
        );
    },
);

test(
    "Loads grouped captures from PGN and clears history when loading FEN.",
    () => {
        const board = create_board();
        board.set_options({ captured_piece_display: "counts", },);
        assert.ok(board.set_pgn("1. e4 d5 2. exd5 e6 3. dxe6",),);
        assert.equal(
            board.shadowRoot.querySelector('.material_row[data-color="w"] .capture_quantity',).textContent,
            "2",
        );
        assert.ok(board.set_pgn("1. e4 d5 2. exd5 Qxd5 3. Nc3 Qe5+ 4. Be2 Qxe2+ 5. Ngxe2",),);
        const white = board.shadowRoot.querySelector('.material_row[data-color="w"]',);
        const black = board.shadowRoot.querySelector('.material_row[data-color="b"]',);
        assert.equal(
            white.querySelectorAll(".capture_group",).length,
            2,
        );
        assert.equal(
            white.querySelector(".material_advantage",).textContent,
            "+6",
        );
        assert.equal(
            black.querySelector(".material_advantage",).textContent,
            "−6",
        );
        const fen = board.get_position();
        board.set_position(fen,);
        assert.equal(
            white.querySelectorAll(".capture_group",).length,
            0,
        );
        assert.equal(
            white.querySelector(".material_advantage",).textContent,
            "+6",
        );
        assert.match(
            white.textContent,
            /No captures/,
        );
    },
);

test(
    "Counts en passant captures and promoted material without inventing captures.",
    () => {
        const board = create_board();
        board.set_pgn("1. e4 a6 2. e5 d5 3. exd6",);
        const white = board.shadowRoot.querySelector('.material_row[data-color="w"]',);
        assert.equal(
            white.querySelector(".material_advantage",).textContent,
            "+1",
        );
        assert.ok(white.querySelector(".capture_group use",).getAttribute("href",).endsWith("#black-pawn",),);
        board.set_position("7k/P7/8/8/8/8/8/7K w - - 0 1",);
        board.move({
            from: "a7",
            to: "a8",
            promotion: "q",
        },);
        assert.equal(
            white.querySelector(".material_inventory",).textContent,
            "2 pieces · 9 pts",
        );
        assert.equal(
            white.querySelector(".material_advantage",).textContent,
            "+9",
        );
        assert.equal(
            white.querySelectorAll(".capture_group",).length,
            0,
        );
        board.undo();
        assert.equal(
            white.querySelector(".material_inventory",).textContent,
            "2 pieces · 1 pt",
        );
    },
);

test(
    "Arrow keys undo and redo while Shift arrows navigate squares in either orientation.",
    () => {
        for (const orientation of ["white", "black",]) {
            const board = create_board();
            board.set_options({ orientation, },);
            const initial_position = board.get_position();
            board.move({
                from: "e2",
                to: "e4",
            },);
            const moved_position = board.get_position();
            const square = board.shadowRoot.querySelector('[data-square="e2"]',);
            square.focus();

            for (const key of ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp",]) {
                const event = new window.KeyboardEvent(
                    "keydown",
                    {
                        key,
                        bubbles: true,
                        composed: true,
                        cancelable: true,
                    },
                );
                square.dispatchEvent(event,);
                const is_undo = key === "ArrowLeft" || key === "ArrowDown";
                assert.equal(
                    board.get_position(),
                    is_undo ? initial_position : moved_position,
                );
                assert.equal(
                    board.shadowRoot.activeElement,
                    square,
                );
                assert.ok(event.defaultPrevented,);
            }

            square.dispatchEvent(new window.KeyboardEvent(
                "keydown",
                {
                    key: "ArrowUp",
                    shiftKey: true,
                    bubbles: true,
                    composed: true,
                },
            ),);
            assert.equal(
                board.get_position(),
                moved_position,
            );
            assert.equal(
                board.shadowRoot.activeElement.dataset.square,
                orientation === "white" ? "e3" : "e1",
            );
            board.remove();
        }
    },
);

test(
    "History shortcuts ignore editable content and extra modifiers.",
    () => {
        const board = create_board();
        board.move({
            from: "e2",
            to: "e4",
        },);
        const position = board.get_position();
        const input = document.createElement("input",);
        board.shadowRoot.append(input,);
        input.dispatchEvent(new window.KeyboardEvent(
            "keydown",
            {
                key: "ArrowLeft",
                bubbles: true,
                composed: true,
            },
        ),);
        assert.equal(
            board.get_position(),
            position,
        );

        board.dispatchEvent(new window.KeyboardEvent(
            "keydown",
            {
                key: "ArrowLeft",
                ctrlKey: true,
                bubbles: true,
            },
        ),);
        assert.equal(
            board.get_position(),
            position,
        );
        board.dispatchEvent(new window.KeyboardEvent(
            "keydown",
            {
                key: "ArrowLeft",
                bubbles: true,
            },
        ),);
        assert.notEqual(
            board.get_position(),
            position,
        );
    },
);

test(
    "Pointer cancellation and capture loss with a pressed button restore the piece immediately.",
    () => {
        for (const event_type of ["pointercancel", "lostpointercapture",]) {
            const board = create_board();
            const grid = board.shadowRoot.querySelector(".board",);
            grid.setPointerCapture = () => undefined;
            grid.hasPointerCapture = () => false;
            const source = board.shadowRoot.querySelector('[data-square="e2"]',);
            const original_piece = source.querySelector(".piece",);
            original_piece.firstElementChild.getBoundingClientRect = () => new window.DOMRect(
                0,
                0,
                20,
                20,
            );
            source.dispatchEvent(new window.PointerEvent(
                "pointerdown",
                {
                    pointerId: 1,
                    button: 0,
                    clientX: 4,
                    clientY: 4,
                    bubbles: true,
                    composed: true,
                },
            ),);
            grid.dispatchEvent(new window.PointerEvent(
                "pointermove",
                {
                    pointerId: 1,
                    clientX: 24,
                    clientY: 24,
                    bubbles: true,
                    composed: true,
                },
            ),);
            assert.equal(
                board.shadowRoot.querySelector(".drag_ghost",),
                original_piece,
            );
            assert.equal(
                board.shadowRoot.querySelectorAll(".piece",).length,
                32,
            );

            grid.dispatchEvent(new window.PointerEvent(
                event_type,
                {
                    pointerId: 1,
                    buttons: event_type === "lostpointercapture" ? 1 : 0,
                    bubbles: true,
                    composed: true,
                },
            ),);
            assert.equal(
                board.shadowRoot.querySelector(".drag_source",),
                null,
            );
            assert.equal(
                board.shadowRoot.querySelector(".drag_ghost",),
                null,
            );
            assert.equal(
                source.querySelector(".piece",),
                original_piece,
            );
            board.remove();
        }
    },
);

test(
    "Replays PGN from the start while preserving captures and the original game.",
    async () => {
        const { PgnReplay, } = await import("../../dist/replay.js",);
        const board = create_board();
        const replay = new PgnReplay(
            board,
            '[White "Ada"]\n[Black "Alan"]\n\n1. e4 d5 2. exd5 Qxd5 *',
        );
        replay.load();
        assert.equal(
            replay.title,
            "Ada vs Alan",
        );
        assert.equal(
            replay.get_index(),
            0,
        );
        assert.equal(
            board.get_position(),
            replay.starting_position,
        );
        replay.seek(3,);
        assert.equal(
            board.get_position(),
            replay.moves[2].after,
        );
        assert.equal(
            board.shadowRoot.querySelector('.material_row[data-color="w"] .material_advantage',).textContent,
            "+1",
        );
        replay.seek(1,);
        assert.equal(
            board.get_position(),
            replay.moves[0].after,
        );
        replay.seek(4,);
        assert.equal(
            board.get_position(),
            replay.moves[3].after,
        );
        assert.match(
            replay.pgn,
            /Qxd5/,
        );
        assert.ok(replay.has_current_position(),);
        assert.throws(
            () => replay.seek(5,),
            RangeError,
        );
        board.set_position("7k/8/8/8/8/8/8/K7 w - - 0 1",);
        assert.equal(
            replay.has_current_position(),
            false,
        );
    },
);

test(
    "Replays custom FEN starts, black-to-move games, and underpromotion.",
    async () => {
        const { PgnReplay, } = await import("../../dist/replay.js",);
        const board = create_board();
        const replay = new PgnReplay(
            board,
            '[SetUp "1"]\n[FEN "7k/8/8/8/8/8/p7/7K b - - 0 12"]\n\n12... a1=N *',
        );
        replay.load();
        assert.equal(
            board.get_position(),
            "7k/8/8/8/8/8/p7/7K b - - 0 12",
        );
        replay.seek(1,);
        assert.ok(board.shadowRoot.querySelector('[data-square="a1"] use',).getAttribute("href",).endsWith("#black-knight",),);
        replay.seek(0,);
        assert.equal(
            board.get_position(),
            replay.starting_position,
        );
        const position = board.get_position();
        assert.throws(() => new PgnReplay(
            board,
            "1. e4 definitely_invalid",
        ),);
        assert.equal(
            board.get_position(),
            position,
        );
    },
);

test(
    "Plays UCI moves and exports history through undo and redo.",
    () => {
        const board = create_board();
        const moves = [];
        board.addEventListener(
            "chessboard:move",
            (event,) => moves.push(event.detail.move.san,),
        );
        assert.equal(
            board.get_uci_position(),
            "position startpos",
        );
        assert.equal(
            board.move_uci(" e2e4 ",)?.san,
            "e4",
        );
        assert.equal(
            board.move_uci("e7e5",)?.san,
            "e5",
        );
        assert.deepEqual(
            board.get_uci_moves(),
            ["e2e4", "e7e5",],
        );
        assert.deepEqual(
            moves,
            ["e4", "e5",],
        );
        assert.equal(
            board.get_uci_position(),
            "position startpos moves e2e4 e7e5",
        );
        board.undo();
        assert.equal(
            board.get_uci_position(),
            "position startpos moves e2e4",
        );
        board.redo();
        assert.equal(
            board.get_uci_position(),
            "position startpos moves e2e4 e7e5",
        );
    },
);

test(
    "Rejects invalid UCI input without changing history or consuming redo.",
    () => {
        const board = create_board();
        board.move_uci("e2e4",);
        board.undo();
        const position = board.get_position();
        const errors = [];
        board.addEventListener(
            "chessboard:error",
            (event,) => errors.push(event.detail,),
        );

        for (const text of ["e2e5", "e2e4q", "0000", "e2e2", "e9e4", "e2e4junk", "e4", "bestmove e2e4", "e2e4\ne7e5",]) {
            assert.equal(
                board.move_uci(text,),
                null,
            );
            assert.equal(
                board.get_position(),
                position,
            );
        }

        assert.equal(
            errors.length,
            9,
        );
        assert.ok(errors.every((error,) => error.reason === "illegal_move",),);
        assert.equal(
            board.redo()?.san,
            "e4",
        );
    },
);

test(
    "Supports UCI castling, en passant, and every promotion from custom positions.",
    () => {
        const board = create_board();
        const castling_position = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
        board.set_position(castling_position,);
        assert.equal(
            board.move_uci("e1g1",)?.san,
            "O-O",
        );
        assert.equal(
            board.get_uci_position(),
            `position fen ${castling_position} moves e1g1`,
        );
        board.set_position("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",);
        assert.ok(board.move_uci("e5d6",)?.isEnPassant(),);

        for (const promotion of ["q", "r", "b", "n",]) {
            board.set_position("7k/P7/8/8/8/8/8/7K w - - 0 1",);
            assert.equal(
                board.move_uci("a7a8",),
                null,
            );
            assert.equal(
                board.move_uci(`a7a8${promotion}`,)?.promotion,
                promotion,
            );
            assert.deepEqual(
                board.get_uci_moves(),
                [`a7a8${promotion}`,],
            );
        }

        board.set_pgn("1. e4 d5 2. exd5 Qxd5",);
        assert.deepEqual(
            board.get_uci_moves(),
            ["e2e4", "d7d5", "e4d5", "d8d5",],
        );
    },
);

test(
    "Batched drags flush the last hover position and cancel pending frames.",
    () => {
        const board = create_board();
        const grid = board.shadowRoot.querySelector(".board",);
        grid.setPointerCapture = () => undefined;
        grid.hasPointerCapture = () => false;
        grid.getBoundingClientRect = () => new window.DOMRect(
            0,
            0,
            800,
            800,
        );
        Object.defineProperty(
            grid,
            "clientWidth",
            { value: 800, },
        );
        Object.defineProperty(
            grid,
            "clientHeight",
            { value: 800, },
        );
        const source = board.shadowRoot.querySelector('[data-square="e2"]',);
        const piece = source.querySelector(".piece",);
        piece.getBoundingClientRect = () => new window.DOMRect(
            400,
            600,
            100,
            100,
        );
        piece.firstElementChild.getBoundingClientRect = piece.getBoundingClientRect;
        const original_frame = globalThis.requestAnimationFrame;
        const original_cancel = globalThis.cancelAnimationFrame;
        const callbacks = new Map();
        let frame_id = 0;
        globalThis.requestAnimationFrame = (callback,) => {
            callbacks.set(
                ++frame_id,
                callback,
            );

            return frame_id;
        };
        globalThis.cancelAnimationFrame = (identifier,) => callbacks.delete(identifier,);

        try {
            source.dispatchEvent(new window.PointerEvent(
                "pointerdown",
                {
                    pointerId: 1,
                    button: 0,
                    clientX: 450,
                    clientY: 650,
                    bubbles: true,
                    composed: true,
                },
            ),);

            for (const y of [610, 550, 510, 450,]) {
                grid.dispatchEvent(new window.PointerEvent(
                    "pointermove",
                    {
                        pointerId: 1,
                        clientX: 450,
                        clientY: y,
                        bubbles: true,
                        composed: true,
                    },
                ),);
            }

            assert.equal(
                callbacks.size,
                1,
            );
            grid.dispatchEvent(new window.PointerEvent(
                "pointerup",
                {
                    pointerId: 1,
                    button: 0,
                    clientX: 450,
                    clientY: 450,
                    bubbles: true,
                    composed: true,
                },
            ),);
            assert.equal(
                board.get_uci_moves().at(-1,),
                "e2e4",
            );
            assert.equal(
                callbacks.size,
                0,
            );
            assert.equal(
                board.shadowRoot.querySelector('[data-square="e4"] .piece',),
                piece,
            );
            assert.equal(
                piece.firstElementChild.style.transform,
                "",
            );
        } finally {
            globalThis.requestAnimationFrame = original_frame;
            globalThis.cancelAnimationFrame = original_cancel;
            board.remove();
        }
    },
);

test(
    "Keeps cached history and status coherent through mutation and branching.",
    () => {
        const board = create_board();
        const initial_status = board.get_status();
        initial_status.is_check = true;
        assert.equal(
            board.get_status().is_check,
            false,
        );
        board.move_uci("e2e4",);
        const first_pgn = board.get_pgn();
        assert.ok(first_pgn.includes("e4",),);
        board.move_uci("e7e5",);
        assert.ok(board.get_pgn().includes("e5",),);
        board.undo();
        assert.equal(
            board.get_pgn(),
            first_pgn,
        );
        assert.deepEqual(
            board.get_uci_moves(),
            ["e2e4",],
        );
        board.move_uci("c7c5",);
        assert.deepEqual(
            board.get_uci_moves(),
            ["e2e4", "c7c5",],
        );
        assert.equal(
            board.redo(),
            null,
        );
        board.set_pgn("1. d4 d5 2. c4",);
        assert.deepEqual(
            board.get_uci_moves(),
            ["d2d4", "d7d5", "c2c4",],
        );
        board.set_position("7k/8/8/8/8/8/8/K7 w - - 0 1",);
        assert.deepEqual(
            board.get_uci_moves(),
            [],
        );
        assert.equal(
            board.get_status().is_game_over,
            true,
        );
        board.remove();
    },
);

test(
    "Switches captured-piece display without changing material or game history.",
    () => {
        const board = create_board();
        board.set_pgn("1. e4 d5 2. exd5 e6 3. dxe6",);
        const position = board.get_position();
        const white = board.shadowRoot.querySelector('.material_row[data-color="w"]',);
        const inventory = white.querySelector(".material_inventory",).textContent;
        const advantage = white.querySelector(".material_advantage",).textContent;
        assert.equal(
            board.get_options().captured_piece_display,
            "stacked",
        );
        assert.equal(
            white.querySelectorAll(".capture_group svg",).length,
            2,
        );
        assert.equal(
            white.querySelectorAll(".capture_quantity",).length,
            0,
        );

        board.set_options({ captured_piece_display: "counts", },);
        assert.equal(
            white.querySelectorAll(".capture_group svg",).length,
            1,
        );
        assert.equal(
            white.querySelector(".capture_quantity",).textContent,
            "2",
        );
        board.set_options({ captured_piece_display: "stacked", },);
        assert.equal(
            white.querySelectorAll(".capture_group svg",).length,
            2,
        );
        assert.equal(
            white.querySelectorAll(".capture_quantity",).length,
            0,
        );
        assert.equal(
            white.querySelector(".material_inventory",).textContent,
            inventory,
        );
        assert.equal(
            white.querySelector(".material_advantage",).textContent,
            advantage,
        );
        assert.match(
            white.querySelector(".capture_group",).getAttribute("aria-label",),
            /2 captured black pawns/,
        );
        assert.equal(
            board.get_position(),
            position,
        );
        board.undo();
        assert.equal(
            white.querySelectorAll(".capture_group svg",).length,
            1,
        );
        board.redo();
        assert.equal(
            white.querySelectorAll(".capture_group svg",).length,
            2,
        );
        board.flip();
        assert.equal(
            board.shadowRoot.querySelector(".board_surface",).previousElementSibling,
            white,
        );
        board.set_options({ show_captured_pieces: false, },);
        assert.equal(
            white.hidden,
            true,
        );
        board.set_options({
            show_captured_pieces: true,
            captured_piece_display: "counts",
        },);
        assert.equal(
            white.querySelectorAll(".capture_group svg",).length,
            1,
        );
        assert.equal(
            white.querySelector(".capture_quantity",).textContent,
            "2",
        );
        board.set_position(position,);
        assert.equal(
            white.querySelector(".material_captures",).textContent,
            "No captures",
        );
        board.remove();
    },
);
