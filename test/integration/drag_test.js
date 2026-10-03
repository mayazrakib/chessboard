import assert from "node:assert/strict";
import { after, test, } from "node:test";

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
await import("../../dist/index.js",);

const START_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function create_drag_board(options = {},) {
    const board = document.createElement("chess-board",);
    document.body.append(board,);
    board.set_options({
        animation_duration: 0,
        orientation: options.orientation ?? "white",
    },);
    board.set_position(options.fen ?? START_POSITION,);
    const grid = board.shadowRoot.querySelector(".board",);
    let bounds = new window.DOMRect(
        30,
        50,
        options.width ?? 537.5,
        options.width ?? 537.5,
    );
    let captured_pointer = null;
    grid.setPointerCapture = (pointer_id,) => {
        captured_pointer = pointer_id;
    };
    grid.hasPointerCapture = (pointer_id,) => captured_pointer === pointer_id;
    grid.releasePointerCapture = () => {
        captured_pointer = null;
    };
    grid.getBoundingClientRect = () => bounds;
    Object.defineProperty(
        grid,
        "clientWidth",
        { get: () => 800, },
    );
    Object.defineProperty(
        grid,
        "clientHeight",
        { get: () => 800, },
    );
    const get_point = (
        square,
        fraction = .5,
    ) => {
        const file = square.charCodeAt(0,) - 97;
        const rank = Number(square[1],);
        const is_black = board.get_options().orientation === "black";

        return {
            x: bounds.x + ((is_black ? 7 - file : file) + fraction) * bounds.width / 8,
            y: bounds.y + ((is_black ? rank - 1 : 8 - rank) + fraction) * bounds.height / 8,
        };
    };

    for (const square of board.shadowRoot.querySelectorAll(".square",)) {
        const get_rect = () => {
            const point = get_point(
                square.dataset.square,
                0,
            );

            return new window.DOMRect(
                point.x,
                point.y,
                bounds.width / 8,
                bounds.height / 8,
            );
        };
        square.getBoundingClientRect = get_rect;
        const piece = square.querySelector(".piece",);

        if (piece) {
            piece.getBoundingClientRect = get_rect;
            piece.firstElementChild.getBoundingClientRect = get_rect;
        }
    }

    const dispatch = (
        type,
        square,
        parameters = {},
    ) => {
        const point = get_point(
            square,
            parameters.fraction ?? .5,
        );

        if (parameters.fraction_y !== undefined) {
            point.y = get_point(
                square,
                parameters.fraction_y,
            ).y;
        }

        const target = type === "pointerdown" ? board.shadowRoot.querySelector(`[data-square="${square}"]`,) : grid;
        target.dispatchEvent(new window.PointerEvent(
            type,
            {
                pointerId: parameters.pointer_id ?? 1,
                pointerType: parameters.pointer_type ?? "mouse",
                button: 0,
                buttons: type === "pointerup" ? 0 : 1,
                clientX: point.x,
                clientY: point.y,
                bubbles: true,
                composed: true,
            },
        ),);
    };
    const move_bounds = () => {
        bounds = new window.DOMRect(
            100,
            200,
            420.25,
            420.25,
        );
    };

    return {
        board,
        grid,
        dispatch,
        move_bounds,
    };
}

for (const orientation of ["white", "black",]) {
    for (const pointer_type of ["mouse", "touch", "pen",]) {
        test(
            `Accepts a fast ${pointer_type} release without an intervening move in ${orientation} orientation.`,
            () => {
                const { board, dispatch, } = create_drag_board({ orientation, },);
                dispatch(
                    "pointerdown",
                    "e2",
                    { pointer_type, },
                );
                dispatch(
                    "pointerup",
                    "e4",
                    { pointer_type, },
                );
                assert.deepEqual(
                    board.get_uci_moves(),
                    ["e2e4",],
                );
                assert.equal(
                    board.shadowRoot.querySelectorAll(".piece",).length,
                    32,
                );
                board.remove();
            },
        );
    }
}

for (const scenario of [
    {
        name: "ordinary move",
        fen: START_POSITION,
        from: "e2",
        to: "e4",
    },
    {
        name: "capture",
        fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1",
        from: "e4",
        to: "d5",
    },
    {
        name: "en passant",
        fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
        from: "e5",
        to: "d6",
    },
    {
        name: "castling",
        fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
        from: "e1",
        to: "g1",
    },
]) {
    test(
        `Drops a ${scenario.name} at square edges, with scaled geometry and either orientation.`,
        () => {
            for (const orientation of ["white", "black",]) {
                for (const fraction of [.001, .25, .5, .75, .999,]) {
                    const { board, dispatch, } = create_drag_board({
                        fen: scenario.fen,
                        orientation,
                    },);
                    dispatch(
                        "pointerdown",
                        scenario.from,
                        { fraction, },
                    );
                    dispatch(
                        "pointermove",
                        scenario.to,
                        { fraction, },
                    );
                    dispatch(
                        "pointerup",
                        scenario.to,
                        { fraction, },
                    );
                    assert.equal(
                        board.get_uci_moves().at(-1,),
                        scenario.from + scenario.to,
                    );
                    assert.equal(
                        board.shadowRoot.querySelectorAll(".drag_ghost",).length,
                        0,
                    );
                    board.remove();
                }
            }
        },
    );
}

test(
    "Uses the latest pointer movement after layout movement and a different previous target.",
    () => {
        const { board, dispatch, move_bounds, } = create_drag_board();
        dispatch(
            "pointerdown",
            "e2",
        );
        dispatch(
            "pointermove",
            "d4",
        );
        move_bounds();
        dispatch(
            "pointermove",
            "e4",
        );
        dispatch(
            "pointerup",
            "e4",
        );
        assert.deepEqual(
            board.get_uci_moves(),
            ["e2e4",],
        );
        board.remove();
    },
);

test(
    "Rejects illegal drops and ignores another pointer without losing the active drag.",
    () => {
        const { board, dispatch, } = create_drag_board();
        dispatch(
            "pointerdown",
            "e2",
        );
        dispatch(
            "pointermove",
            "e4",
        );
        dispatch(
            "pointerup",
            "e4",
            { pointer_id: 2, },
        );
        assert.deepEqual(
            board.get_uci_moves(),
            [],
        );
        dispatch(
            "pointermove",
            "e5",
        );
        dispatch(
            "pointerup",
            "e5",
        );
        assert.deepEqual(
            board.get_uci_moves(),
            [],
        );
        assert.ok(board.shadowRoot.querySelector('[data-square="e2"] .piece',),);
        assert.equal(
            board.shadowRoot.querySelectorAll(".piece",).length,
            32,
        );
        board.remove();
    },
);

test(
    "Keeps promotion pending until a piece is chosen after dragging.",
    () => {
        const { board, dispatch, } = create_drag_board({ fen: "7k/P7/8/8/8/8/8/7K w - - 0 1", },);
        dispatch(
            "pointerdown",
            "a7",
        );
        dispatch(
            "pointermove",
            "a8",
        );
        dispatch(
            "pointerup",
            "a8",
        );
        assert.equal(
            board.shadowRoot.querySelectorAll(".promotion_choice",).length,
            4,
        );
        board.shadowRoot.querySelector(".promotion_choice",).click();
        assert.equal(
            board.get_uci_moves().length,
            1,
        );
        board.remove();
    },
);

after(() => window.happyDOM.abort(),);

test(
    "Drops on every highlighted edge and corner after a rendered animation frame.",
    async () => {
        for (const orientation of ["white", "black",]) {
            for (const fraction of [.0001, .5, .9999,]) {
                for (const fraction_y of [.0001, .5, .9999,]) {
                    const { board, dispatch, } = create_drag_board({ orientation, },);
                    dispatch(
                        "pointerdown",
                        "e2",
                        { fraction: .05, },
                    );
                    dispatch(
                        "pointermove",
                        "e4",
                        {
                            fraction,
                            fraction_y,
                        },
                    );
                    await new Promise((resolve,) => requestAnimationFrame(resolve,),);
                    assert.equal(
                        board.shadowRoot.querySelector(".drag_target",)?.dataset.square,
                        "e4",
                    );
                    dispatch(
                        "pointerup",
                        "e4",
                        {
                            fraction,
                            fraction_y,
                        },
                    );
                    assert.deepEqual(
                        board.get_uci_moves(),
                        ["e2e4",],
                    );
                    board.remove();
                }
            }
        }
    },
);

test(
    "Flushes the latest hover target when the next animation frame has not rendered.",
    async () => {
        const { board, dispatch, } = create_drag_board();
        dispatch(
            "pointerdown",
            "e2",
        );
        dispatch(
            "pointermove",
            "e3",
        );
        await new Promise((resolve,) => requestAnimationFrame(resolve,),);
        assert.equal(
            board.shadowRoot.querySelector(".drag_target",)?.dataset.square,
            "e3",
        );
        dispatch(
            "pointermove",
            "e4",
            { fraction: .001, },
        );
        dispatch(
            "pointerup",
            "e4",
            { fraction: .001, },
        );
        assert.deepEqual(
            board.get_uci_moves(),
            ["e2e4",],
        );
        board.remove();
    },
);

test(
    "Cancels a highlighted drag without making a move or losing the piece.",
    async () => {
        const { board, dispatch, } = create_drag_board();
        dispatch(
            "pointerdown",
            "e2",
        );
        dispatch(
            "pointermove",
            "e4",
        );
        await new Promise((resolve,) => requestAnimationFrame(resolve,),);
        dispatch(
            "pointercancel",
            "e4",
        );
        dispatch(
            "pointerup",
            "e4",
        );
        assert.deepEqual(
            board.get_uci_moves(),
            [],
        );
        assert.equal(
            board.shadowRoot.querySelectorAll(".drag_target",).length,
            0,
        );
        assert.ok(board.shadowRoot.querySelector('[data-square="e2"] .piece',),);
        board.remove();
    },
);

for (const orientation of ["white", "black",]) {
    for (const pointer_type of ["mouse", "touch", "pen",]) {
        test(
            `Resolves the final ${pointer_type} release after a different movement in ${orientation} orientation.`,
            async () => {
                for (const previous_square of ["d4", "e3",]) {
                    for (const fraction of [.0001, .5, .9999,]) {
                        for (const fraction_y of [.0001, .5, .9999,]) {
                            const { board, dispatch, } = create_drag_board({ orientation, },);
                            dispatch(
                                "pointerdown",
                                "e2",
                                { pointer_type, },
                            );
                            dispatch(
                                "pointermove",
                                previous_square,
                                { pointer_type, },
                            );
                            await new Promise((resolve,) => requestAnimationFrame(resolve,),);
                            dispatch(
                                "pointerup",
                                "e4",
                                {
                                    pointer_type,
                                    fraction,
                                    fraction_y,
                                },
                            );
                            assert.deepEqual(
                                board.get_uci_moves(),
                                ["e2e4",],
                            );
                            assert.equal(
                                board.shadowRoot.querySelector(".board",).classList.contains("dragging",),
                                false,
                            );
                            board.remove();
                        }
                    }
                }
            },
        );
    }
}

test(
    "Clears a highlighted target when the pointer moves clearly outside it before release.",
    async () => {
        const { board, dispatch, } = create_drag_board();
        dispatch(
            "pointerdown",
            "e2",
        );
        dispatch(
            "pointermove",
            "e4",
            { fraction: .0001, },
        );
        await new Promise((resolve,) => requestAnimationFrame(resolve,),);
        assert.equal(
            board.shadowRoot.querySelector(".drag_target",)?.dataset.square,
            "e4",
        );
        dispatch(
            "pointermove",
            "e4",
            { fraction: -.05, },
        );
        dispatch(
            "pointerup",
            "e4",
            { fraction: -.05, },
        );
        assert.deepEqual(
            board.get_uci_moves(),
            [],
        );
        assert.equal(
            board.shadowRoot.querySelector(".board",).classList.contains("dragging",),
            false,
        );
        board.remove();
    },
);

test(
    "Starts dragging only inside the artwork bounds or its four-pixel pickup buffer.",
    () => {
        for (const orientation of ["white", "black",]) {
            for (const offset_px of [-5, -3, 0, 10,]) {
                const { board, dispatch, } = create_drag_board({ orientation, },);
                const artwork = board.shadowRoot.querySelector('[data-square="e2"] svg',);
                const square_bounds = artwork.getBoundingClientRect();
                artwork.getBoundingClientRect = () => new window.DOMRect(
                    square_bounds.left + square_bounds.width / 4,
                    square_bounds.top + square_bounds.height / 4,
                    square_bounds.width / 2,
                    square_bounds.height / 2,
                );
                dispatch(
                    "pointerdown",
                    "e2",
                    {
                        fraction: .25 + offset_px / square_bounds.width,
                        fraction_y: .5,
                    },
                );
                dispatch(
                    "pointermove",
                    "e4",
                );
                dispatch(
                    "pointerup",
                    "e4",
                );
                assert.deepEqual(
                    board.get_uci_moves(),
                    offset_px >= -4 ? ["e2e4",] : [],
                );
                board.remove();
            }
        }
    },
);

test(
    "Preserves click selection outside the piece artwork without enabling drag pickup.",
    () => {
        const { board, dispatch, } = create_drag_board();
        const artwork = board.shadowRoot.querySelector('[data-square="e2"] svg',);
        const square_bounds = artwork.getBoundingClientRect();
        artwork.getBoundingClientRect = () => new window.DOMRect(
            square_bounds.left + square_bounds.width / 4,
            square_bounds.top + square_bounds.height / 4,
            square_bounds.width / 2,
            square_bounds.height / 2,
        );
        dispatch(
            "pointerdown",
            "e2",
            { fraction: .01, },
        );
        dispatch(
            "pointerup",
            "e2",
            { fraction: .01, },
        );
        assert.ok(board.shadowRoot.querySelector('[data-square="e2"]',).classList.contains("selected",),);
        dispatch(
            "pointerdown",
            "e2",
            { fraction: .01, },
        );
        dispatch(
            "pointermove",
            "e4",
        );
        dispatch(
            "pointerup",
            "e4",
        );
        assert.deepEqual(
            board.get_uci_moves(),
            [],
        );
        board.remove();
    },
);

test(
    "Resolves the full rendered square even when browser hit testing rounds to its neighbor.",
    () => {
        for (const orientation of ["white", "black",]) {
            for (const fraction of [.0001, .9999,]) {
                const { board, dispatch, } = create_drag_board({ orientation, },);
                board.shadowRoot.elementFromPoint = () => board.shadowRoot.querySelector('[data-square="f4"]',);
                dispatch(
                    "pointerdown",
                    "e2",
                );
                dispatch(
                    "pointermove",
                    "e4",
                    { fraction, },
                );
                dispatch(
                    "pointerup",
                    "e4",
                    { fraction, },
                );
                assert.deepEqual(
                    board.get_uci_moves(),
                    ["e2e4",],
                );
                board.remove();
            }
        }
    },
);

test(
    "Rejects a release in an illegal square after highlighting a different legal square.",
    async () => {
        const { board, dispatch, } = create_drag_board();
        dispatch(
            "pointerdown",
            "e2",
        );
        dispatch(
            "pointermove",
            "e4",
            { fraction: .01, },
        );
        await new Promise((resolve,) => requestAnimationFrame(resolve,),);
        assert.equal(
            board.shadowRoot.querySelector(".drag_target",)?.dataset.square,
            "e4",
        );
        dispatch(
            "pointerup",
            "d4",
        );
        assert.deepEqual(
            board.get_uci_moves(),
            [],
        );
        assert.equal(
            board.shadowRoot.querySelector(".drag_target",),
            null,
        );
        assert.ok(board.shadowRoot.querySelector('[data-square="e2"] .piece',),);
        board.remove();
    },
);

for (const orientation of ["white", "black",]) {
    for (const pointer_type of ["mouse", "touch", "pen",]) {
        test(
            `Updates the highlighted ${pointer_type} target before motion frames in ${orientation} orientation.`,
            async (context,) => {
                const { board, dispatch, } = create_drag_board({ orientation, },);
                context.after(() => board.remove(),);
                dispatch(
                    "pointerdown",
                    "e2",
                    { pointer_type, },
                );
                dispatch(
                    "pointermove",
                    "e3",
                    { pointer_type, },
                );
                await new Promise((resolve,) => requestAnimationFrame(resolve,),);

                for (const fraction of [.0001, .5, .9999,]) {
                    for (const fraction_y of [.0001, .5, .9999,]) {
                        const parameters = {
                            fraction,
                            fraction_y,
                            pointer_type,
                        };
                        dispatch(
                            "pointermove",
                            "e4",
                            parameters,
                        );
                        assert.equal(
                            board.shadowRoot.querySelector(".drag_target",)?.dataset.square,
                            "e4",
                            "The full destination square must be highlighted before the next motion frame.",
                        );
                        dispatch(
                            "pointermove",
                            "d4",
                            parameters,
                        );
                        assert.equal(
                            board.shadowRoot.querySelector(".drag_target",),
                            null,
                            "Leaving a legal target must clear its highlight before release can reject the drop.",
                        );
                    }
                }

                dispatch(
                    "pointermove",
                    "e4",
                    { pointer_type, fraction: .0001, fraction_y: .9999, },
                );
                assert.equal(
                    board.shadowRoot.querySelector(".drag_target",)?.dataset.square,
                    "e4",
                );
                dispatch(
                    "pointerup",
                    "e4",
                    { pointer_type, fraction: .0001, fraction_y: .9999, },
                );
                await new Promise((resolve,) => requestAnimationFrame(resolve,),);
                assert.deepEqual(
                    board.get_uci_moves(),
                    ["e2e4",],
                );
                assert.equal(
                    board.shadowRoot.querySelector(".drag_target",),
                    null,
                );
            },
        );
    }
}
