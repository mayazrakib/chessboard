import assert from "node:assert/strict";
import { test, } from "node:test";

import { Chess, } from "chess.js";

import { PgnReplay, } from "../../dist/replay.js";

const SAMPLE_PGN = '[White "Ada"]\n[Black "Grace"]\n\n1. e4 e5 2. Nf3 Nc6 *';

function create_replay(pgn = SAMPLE_PGN,) {
    const game = new Chess();
    const calls = [];
    const state = { revision: 0, should_accept_pgn: true, seek_error: null, on_seek: null, };
    const board = {
        create_game: () => new Chess(),
        get_position: () => game.fen(),
        get_revision: () => state.revision,
        set_premove: (input,) => calls.push({ operation: "premove", input, },),
        set_pgn: (notation,) => {
            calls.push({ operation: "load", notation, },);

            if (!state.should_accept_pgn) {
                return false;
            }

            game.loadPgn(notation,);
            state.revision += 1;

            return true;
        },
        seek_history: (index,) => {
            calls.push({ operation: "seek", index, },);
            state.on_seek?.();

            if (state.seek_error) {
                throw state.seek_error;
            }

            game.load(index === 0 ? replay.starting_position : replay.moves[index - 1].after,);
            state.revision += 1;
        },
    };
    const replay = new PgnReplay(
        board,
        pgn,
    );

    return { board, calls, game, replay, state, };
}

test(
    "Replay construction parses metadata and moves without changing the board.",
    () => {
        const { calls, replay, } = create_replay();

        assert.equal(
            replay.title,
            "Ada vs Grace",
        );
        assert.deepEqual(
            replay.moves.map((move,) => move.san,),
            ["e4", "e5", "Nf3", "Nc6",],
        );
        assert.equal(
            replay.starting_position,
            new Chess().fen(),
        );
        assert.equal(
            replay.get_index(),
            0,
        );
        assert.equal(
            replay.has_current_position(),
            false,
        );
        assert.deepEqual(
            calls,
            [],
        );
    },
);

for (const pgn of ["", '[White "?"]\n[Black "?"]\n\n*',]) {
    test(
        `An empty replay with headers ${JSON.stringify(pgn,)} loads its starting position.`,
        () => {
            const { replay, } = create_replay(pgn,);
            replay.load();

            assert.equal(
                replay.title,
                "White vs Black",
            );
            assert.equal(
                replay.moves.length,
                0,
            );
            assert.equal(
                replay.has_current_position(),
                true,
            );
            assert.doesNotThrow(() => replay.seek(0,),);
        },
    );
}

test(
    "Replay preserves a custom starting position from PGN headers.",
    () => {
        const starting_position = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";
        const { board, replay, } = create_replay(`[SetUp "1"]\n[FEN "${starting_position}"]\n\n1. e4 *`,);
        replay.load();

        assert.equal(
            board.get_position(),
            starting_position,
        );

        replay.seek(1,);

        assert.equal(
            board.get_position(),
            replay.moves[0].after,
        );
    },
);

test(
    "Loading clears premoves, loads normalized PGN, and rewinds before seeking in either direction.",
    () => {
        const { board, calls, replay, } = create_replay();
        replay.load();

        assert.deepEqual(
            calls,
            [
                { operation: "premove", input: null, },
                { operation: "load", notation: replay.pgn, },
                { operation: "seek", index: 0, },
            ],
        );

        for (const index of [4, 2, 2, 0, 1,]) {
            replay.seek(index,);

            assert.equal(
                replay.get_index(),
                index,
            );
            assert.equal(
                board.get_position(),
                index === 0 ? replay.starting_position : replay.moves[index - 1].after,
            );
            assert.equal(
                replay.has_current_position(),
                true,
            );
        }

        replay.load();

        assert.equal(
            replay.get_index(),
            0,
        );
    },
);

for (const index of [-1, 5, 0.5, NaN, Infinity, "1", null,]) {
    test(
        `Replay rejects out-of-range or noninteger index ${String(index,)} without changing state.`,
        () => {
            const { calls, replay, } = create_replay();
            replay.load();
            const call_count = calls.length;

            assert.throws(
                () => replay.seek(index,),
                RangeError,
            );
            assert.equal(
                calls.length,
                call_count,
            );
            assert.equal(
                replay.get_index(),
                0,
            );
            assert.equal(
                replay.has_current_position(),
                true,
            );
        },
    );
}

for (const change of ["revision", "position",]) {
    test(
        `Replay rejects a board whose ${change} changed externally and can reload afterward.`,
        () => {
            const { game, replay, state, } = create_replay();
            replay.load();

            if (change === "revision") {
                state.revision += 1;
            } else {
                game.move("d4",);
            }

            assert.equal(
                replay.has_current_position(),
                false,
            );
            assert.throws(
                () => replay.seek(1,),
                /changed outside the replay/,
            );

            replay.load();

            assert.equal(
                replay.has_current_position(),
                true,
            );
        },
    );
}

test(
    "Failed board seeks preserve the replay index and restore external-change detection.",
    () => {
        const { replay, state, } = create_replay();
        replay.load();
        const seek_error = new Error("The board rejected the seek.",);
        state.seek_error = seek_error;
        state.on_seek = () => assert.equal(
            replay.has_current_position(),
            true,
        );

        assert.throws(
            () => replay.seek(2,),
            (error,) => error === seek_error,
        );
        assert.equal(
            replay.get_index(),
            0,
        );

        state.revision += 1;

        assert.equal(
            replay.has_current_position(),
            false,
        );

        state.seek_error = null;
        replay.load();
        replay.seek(2,);

        assert.equal(
            replay.get_index(),
            2,
        );
    },
);

test(
    "Rejected PGN loading reports failure and can be retried.",
    () => {
        const { replay, state, } = create_replay();
        state.should_accept_pgn = false;

        assert.throws(
            () => replay.load(),
            { message: "Failed to load the replay game.", },
        );

        state.revision += 1;

        assert.equal(
            replay.has_current_position(),
            false,
        );

        state.should_accept_pgn = true;
        replay.load();

        assert.equal(
            replay.has_current_position(),
            true,
        );
    },
);

test(
    "Malformed PGN fails before the board receives any operations.",
    () => {
        assert.throws(() => create_replay("1. e5",),);
    },
);
