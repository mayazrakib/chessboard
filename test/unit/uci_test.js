import assert from "node:assert/strict";
import { test, } from "node:test";

import { format_uci_move, parse_uci_move, } from "../../dist/uci.js";

for (const notation of ["e2e4", "e1g1", "e8c8", "a7a8q", "a7a8r", "h2h1b", "h2h1n",]) {
    test(
        `UCI parsing and formatting preserve ${notation}.`,
        () => {
            const move = parse_uci_move(` \t${notation}\n`,);

            assert.equal(
                move.from,
                notation.slice(
                    0,
                    2,
                ),
            );
            assert.equal(
                move.to,
                notation.slice(
                    2,
                    4,
                ),
            );
            assert.equal(
                Object.hasOwn(
                    move,
                    "promotion",
                ),
                notation.length === 5,
            );
            assert.equal(
                format_uci_move(move,),
                notation,
            );
        },
    );
}

for (const notation of ["", " ", "0000", "e2e2", "a7a7q", "e2", "e2e4qz", "i2e4", "a0a1", "a8a9", "E2E4", "e2 e4", "e2-e4", "e2e4\ne7e5", "a7a8k", "a7a8p", "a7a8Q",]) {
    test(
        `UCI parsing rejects malformed notation ${JSON.stringify(notation,)}.`,
        () => {
            assert.throws(
                () => parse_uci_move(notation,),
                { message: "Invalid UCI move. Use a move such as e2e4 or a7a8q.", },
            );
        },
    );
}

test(
    "UCI parsing validates notation independently of position legality.",
    () => {
        assert.deepEqual(
            parse_uci_move("e2e5",),
            { from: "e2", to: "e5", },
        );
        const move = Object.freeze({ from: "b1", to: "c3", promotion: undefined, },);

        assert.equal(
            format_uci_move(move,),
            "b1c3",
        );
    },
);
