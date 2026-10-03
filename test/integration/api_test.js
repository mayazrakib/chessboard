import assert from "node:assert/strict";
import { after, afterEach, test, } from "node:test";

import { Window, } from "happy-dom";

const browser_window = new Window({ url: "http://localhost", },);

for (const name of ["window", "document", "HTMLElement", "HTMLButtonElement", "CustomEvent", "customElements",]) {
    globalThis[name] = name === "window" ? browser_window : browser_window[name];
}

globalThis.requestAnimationFrame = browser_window.requestAnimationFrame.bind(browser_window,);
globalThis.cancelAnimationFrame = browser_window.cancelAnimationFrame.bind(browser_window,);

const { configure_chessboard_assets, define_chessboard, PgnReplay, } = await import("../../dist/core.js",);
assert.equal(
    customElements.get("chess-board",),
    undefined,
);
configure_chessboard_assets({ stylesheet_url: null, },);
define_chessboard();

function create_board() {
    const board = document.createElement("chess-board",);
    document.body.append(board,);
    board.set_options({ animation_duration: 0, },);

    return board;
}

test(
    "Separates requests from commits, protects request input, and rejects stale approvals.",
    () => {
        const board = create_board();
        board.set_options({ move_mode: "controlled", },);
        const initial = board.get_position();
        const events = [];
        board.addEventListener(
            "chessboard:move_request",
            (event,) => {
                events.push("request",);
                event.detail.input.to = "e3";
            },
        );
        board.addEventListener(
            "chessboard:move",
            (event,) => events.push(event.detail.reason,),
        );
        const request = board.request_move({ from: "e2", to: "e4", },);
        assert.equal(
            board.get_position(),
            initial,
        );
        assert.equal(
            board.commit_move(request.id,).to,
            "e4",
        );
        assert.deepEqual(
            events,
            ["request", "move",],
        );
        assert.equal(
            board.commit_move(request.id,),
            null,
        );
        const stale = board.request_move({ from: "e7", to: "e5", },);
        board.undo();
        assert.equal(
            board.get_pending_move(),
            null,
        );
        assert.equal(
            board.commit_move(stale.id,),
            null,
        );
    },
);

test(
    "Allows cancellation in automatic mode and immediate acceptance by a request listener.",
    () => {
        const board = create_board();
        const prevent = (event,) => event.preventDefault();
        board.addEventListener(
            "chessboard:move_request",
            prevent,
        );
        const request = board.request_move({ from: "e2", to: "e4", },);
        assert.equal(
            board.get_turn(),
            "w",
        );
        assert.ok(board.reject_move(request.id,),);
        board.removeEventListener(
            "chessboard:move_request",
            prevent,
        );
        board.addEventListener(
            "chessboard:move_request",
            (event,) => board.commit_move(event.detail.id,),
        );
        board.request_move({ from: "e2", to: "e4", },);
        assert.equal(
            board.get_uci_moves().length,
            1,
        );
    },
);

test(
    "Routes keyboard moves and promotion choices through controlled requests.",
    () => {
        const board = create_board();
        board.set_options({ move_mode: "controlled", },);
        board.set_position("8/P7/8/8/8/8/7k/4K3 w - - 0 1",);

        for (const square of ["a7", "a8",]) {
            board.shadowRoot.querySelector(`[data-square="${square}"]`,).dispatchEvent(new browser_window.KeyboardEvent(
                "keydown",
                { key: "Enter", bubbles: true, composed: true, },
            ),);
        }

        board.shadowRoot.querySelector('[aria-label="Promote to knight"]',).click();
        const request = board.get_pending_move();
        assert.equal(
            request.source,
            "keyboard",
        );
        assert.equal(
            request.input.promotion,
            "n",
        );
        assert.ok(board.shadowRoot.querySelector('[data-square="a7"] .piece',),);
        assert.equal(
            board.commit_move(request.id,).promotion,
            "n",
        );
    },
);

test(
    "Includes reasons and revisions while compact events omit PGN serialization.",
    () => {
        const board = create_board();
        const positions = [];
        board.set_options({ event_detail: "compact", },);
        board.addEventListener(
            "chessboard:position",
            (event,) => positions.push(event.detail,),
        );
        board.get_pgn = () => {
            throw new Error("Compact events must not serialize PGN.",);
        };
        board.move({ from: "e2", to: "e4", },);
        board.undo();
        board.redo();
        assert.deepEqual(
            positions.map((position,) => position.reason,),
            ["move", "undo", "redo",],
        );
        assert.deepEqual(
            positions.map((position,) => position.revision,),
            [1, 2, 3,],
        );
        assert.ok(positions.every((position,) => !Object.hasOwn(
            position,
            "pgn",
        ),),);
    },
);

test(
    "Reuses annotation nodes and preserves other groups during replacement.",
    () => {
        const board = create_board();
        board.set_annotations(
            [{ id: "user_arrow", from: "e2", to: "e4", },],
            "user",
        );
        const node = board.shadowRoot.querySelector('[data-annotation-id="user_arrow"]',);
        board.set_annotations(
            [{ id: "engine_arrow", from: "d2", to: "d4", source: "engine", },],
            "engine",
        );
        assert.equal(
            board.shadowRoot.querySelector('[data-annotation-id="user_arrow"]',),
            node,
        );
        board.clear_annotations("engine",);
        assert.equal(
            board.get_annotations().length,
            1,
        );
        assert.throws(() => board.set_annotations([{ id: "bad", from: "z9", },],),);
        assert.equal(
            board.get_annotations().length,
            1,
        );
        assert.ok(board.remove_annotation("user_arrow",),);
    },
);

test(
    "Refreshes square-dependent custom artwork on moves, castling, and undo.",
    () => {
        const board = create_board();
        board.set_options({ piece_renderer: (
            piece,
            square,
        ) => `${piece.type}:${square}`, },);
        board.move({ from: "e2", to: "e4", },);
        assert.equal(
            board.shadowRoot.querySelector('[data-square="e4"] .piece',).textContent,
            "p:e4",
        );
        board.undo();
        assert.equal(
            board.shadowRoot.querySelector('[data-square="e2"] .piece',).textContent,
            "p:e2",
        );
        board.set_position("4k3/8/8/8/8/8/8/4K2R w K - 0 1",);
        board.move({ from: "e1", to: "g1", },);
        assert.equal(
            board.shadowRoot.querySelector('[data-square="f1"] .piece',).textContent,
            "r:f1",
        );
    },
);

test(
    "Skips piece and material rendering for motion-only option updates.",
    () => {
        const board = create_board();
        board.set_pgn("1. e4 d5 2. exd5",);
        const material = board.shadowRoot.querySelector(".material_inventory",);
        const piece = board.shadowRoot.querySelector('[data-square="d5"] .piece',);
        board.set_options({ animation_duration: 100, },);
        assert.equal(
            board.shadowRoot.querySelector(".material_inventory",),
            material,
        );
        assert.equal(
            board.shadowRoot.querySelector('[data-square="d5"] .piece',),
            piece,
        );
    },
);

test(
    "Batches replay navigation into one final position event and retains captures.",
    () => {
        const board = create_board();
        const replay = new PgnReplay(
            board,
            "1. e4 d5 2. exd5 e6 3. dxe6",
        );
        replay.load();
        const positions = [];
        const moves = [];
        board.addEventListener(
            "chessboard:position",
            (event,) => positions.push(event.detail,),
        );
        board.addEventListener(
            "chessboard:move",
            (event,) => moves.push(event.detail,),
        );
        replay.seek(5,);
        assert.equal(
            positions.length,
            1,
        );
        assert.equal(
            positions[0].reason,
            "replay seek",
        );
        assert.equal(
            moves.length,
            0,
        );
        assert.equal(
            board.shadowRoot.querySelectorAll('.material_row[data-color="w"] .capture_group svg',).length,
            2,
        );
        assert.ok(board.get_history_state().can_undo,);
        replay.seek(0,);
        assert.ok(board.get_history_state().can_redo,);
    },
);

test(
    "Resolves readiness without a stylesheet and animation completion without browser animation support.",
    async () => {
        const board = create_board();
        await board.when_ready();
        board.move({ from: "e2", to: "e4", },);
        await board.when_animation_complete();
        board.set_assets({ piece_sprite_url: "https://example.test/pieces.svg", },);
        assert.ok(board.shadowRoot.querySelector("use",).getAttribute("href",).startsWith("https://example.test/pieces.svg#",),);
        board.remove();
        document.body.append(board,);
        await board.when_ready();
    },
);

afterEach(() => document.body.replaceChildren(),);
after(() => browser_window.happyDOM.abort(),);

test(
    "Queues controlled premoves and commits them only after explicit approval.",
    () => {
        const board = create_board();
        board.set_options({ move_mode: "controlled", premove_color: "b", interaction: { can_premove: true, }, },);
        board.set_premove({ from: "e7", to: "e5", },);
        board.move({ from: "e2", to: "e4", },);
        const request = board.get_pending_move();
        assert.equal(
            request.source,
            "premove",
        );
        assert.deepEqual(
            board.get_uci_moves(),
            ["e2e4",],
        );
        board.commit_move(request.id,);
        assert.deepEqual(
            board.get_uci_moves(),
            ["e2e4", "e7e5",],
        );
    },
);

test(
    "Restores pending promotion artwork when changing motion options.",
    () => {
        const board = create_board();
        board.set_position("8/P7/8/8/8/8/7k/4K3 w - - 0 1",);

        for (const square of ["a7", "a8",]) {
            board.shadowRoot.querySelector(`[data-square="${square}"]`,).dispatchEvent(new browser_window.KeyboardEvent(
                "keydown",
                { key: "Enter", bubbles: true, composed: true, },
            ),);
        }

        board.set_options({ animation_duration: 100, },);
        assert.ok(board.shadowRoot.querySelector('[data-square="a7"] .piece',),);
        assert.equal(
            board.shadowRoot.querySelectorAll(".promotion_choice",).length,
            0,
        );
    },
);

test(
    "Falls back from invalid custom artwork while keeping committed move events coherent.",
    () => {
        const board = create_board();
        const errors = [];
        board.addEventListener(
            "chessboard:error",
            (event,) => errors.push(event.detail.reason,),
        );
        board.set_options({ piece_renderer: () => null, },);
        assert.ok(errors.every((reason,) => reason === "render_failed",),);
        const move = board.move({ from: "e2", to: "e4", },);
        assert.equal(
            move.to,
            "e4",
        );
        assert.ok(board.shadowRoot.querySelector('[data-square="e4"] use',),);
    },
);

test(
    "Prevents stale position events after a move listener commits a response synchronously.",
    () => {
        const board = create_board();
        const positions = [];
        board.addEventListener(
            "chessboard:move",
            (event,) => {
                if (event.detail.move.color === "w") {
                    board.move({ from: "e7", to: "e5", },);
                }
            },
        );
        board.addEventListener(
            "chessboard:position",
            (event,) => positions.push(event.detail,),
        );
        board.move({ from: "e2", to: "e4", },);
        assert.equal(
            positions.length,
            1,
        );
        assert.equal(
            positions[0].revision,
            board.get_revision(),
        );
        assert.equal(
            positions[0].fen,
            board.get_position(),
        );
    },
);

test(
    "Refreshes custom artwork when the same renderer is supplied after its external state changes.",
    () => {
        const board = create_board();
        let label = "First";
        const render_piece = () => label;
        board.set_options({ piece_renderer: render_piece, },);
        label = "Second";
        board.set_options({ piece_renderer: render_piece, },);
        assert.equal(
            board.shadowRoot.querySelector(".piece",).textContent,
            "Second",
        );
    },
);
