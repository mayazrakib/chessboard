import assert from "node:assert/strict";
import { test, } from "node:test";

import { create_piece_art, get_piece_name, get_promotion_name, is_point_over_piece, } from "../../dist/pieces.js";
import { create_dom_environment, } from "./dom.js";

create_dom_environment();

for (const [type, name,] of [["p", "pawn",], ["n", "knight",], ["b", "bishop",], ["r", "rook",], ["q", "queen",], ["k", "king",],]) {
    for (const [color, color_name,] of [["w", "white",], ["b", "black",],]) {
        test(
            `The ${color_name} ${name} has the correct name and SVG reference.`,
            () => {
                const piece = Object.freeze({ color, type, },);
                const artwork = create_piece_art(
                    piece,
                    "/pieces.svg",
                );
                const reference = `/pieces.svg#${color_name}-${name}`;

                assert.equal(
                    get_piece_name(piece,),
                    `${color_name} ${name}`,
                );
                assert.equal(
                    get_promotion_name(type,),
                    name,
                );
                assert.equal(
                    artwork.namespaceURI,
                    "http://www.w3.org/2000/svg",
                );
                assert.equal(
                    artwork.getAttribute("viewBox",),
                    "0 0 45 45",
                );
                assert.equal(
                    artwork.getAttribute("focusable",),
                    "false",
                );
                assert.equal(
                    artwork.firstElementChild.getAttribute("href",),
                    reference,
                );
                assert.equal(
                    artwork.firstElementChild.getAttributeNS(
                        "http://www.w3.org/1999/xlink",
                        "href",
                    ),
                    reference,
                );
                assert.equal(
                    artwork.parentNode,
                    null,
                );
            },
        );
    }
}

function create_artwork(bounds,) {
    return { getBoundingClientRect: () => bounds, };
}

test(
    "Piece pickup includes exactly four pixels of padding around artwork.",
    () => {
        const artwork = create_artwork(new DOMRect(
            10,
            20,
            30,
            40,
        ),);
        const piece = { firstElementChild: artwork, };
        const points = [
            [6, 16, true,],
            [44, 64, true,],
            [5.99, 30, false,],
            [44.01, 30, false,],
            [20, 15.99, false,],
            [20, 64.01, false,],
        ];

        for (const [x, y, is_inside,] of points) {
            assert.equal(
                is_point_over_piece(
                    piece,
                    x,
                    y,
                ),
                is_inside,
                `Unexpected pickup at (${x}, ${y}).`,
            );
        }
    },
);

test(
    "A custom piece without child artwork uses its own bounds.",
    () => {
        const piece = create_artwork(new DOMRect(
            10,
            20,
            30,
            40,
        ),);

        assert.equal(
            is_point_over_piece(
                piece,
                20,
                30,
            ),
            true,
        );
    },
);

for (const [width, height,] of [[0, 20,], [20, 0,], [-20, 20,], [20, -20,],]) {
    test(
        `Artwork with dimensions ${width} by ${height} cannot be picked up.`,
        () => {
            const piece = create_artwork(new DOMRect(
                0,
                0,
                width,
                height,
            ),);

            assert.equal(
                is_point_over_piece(
                    piece,
                    0,
                    0,
                ),
                false,
            );
        },
    );
}

for (const [description, matrix, expected_bounds,] of [
    ["translation and scaling", { a: 2, b: 0, c: 0, d: 3, e: 100, f: 200, }, [102, 206, 108, 218,],],
    ["rotation", { a: 0, b: 1, c: -1, d: 0, e: 100, f: 200, }, [94, 201, 98, 204,],],
    ["reflection", { a: -2, b: 0, c: 0, d: -3, e: 100, f: 200, }, [92, 182, 98, 194,],],
    ["shearing", { a: 1, b: 1, c: -1, d: 1, e: 100, f: 200, }, [95, 203, 102, 210,],],
]) {
    test(
        `SVG pickup transforms all four artwork corners under ${description}.`,
        () => {
            const artwork = {
                ...create_artwork(new DOMRect(),),
                getBBox: () => ({ x: 1, y: 2, width: 3, height: 4, }),
                getScreenCTM: () => matrix,
            };
            const [left, top, right, bottom,] = expected_bounds;

            assert.equal(
                is_point_over_piece(
                    artwork,
                    left - 4,
                    top - 4,
                ),
                true,
            );
            assert.equal(
                is_point_over_piece(
                    artwork,
                    right + 4,
                    bottom + 4,
                ),
                true,
            );
            assert.equal(
                is_point_over_piece(
                    artwork,
                    right + 4.01,
                    bottom,
                ),
                false,
            );
        },
    );
}

for (const [description, box, matrix,] of [
    ["a missing transform", { x: 0, y: 0, width: 10, height: 10, }, null,],
    ["an empty vector box", { x: 0, y: 0, width: 0, height: 10, }, { a: 1, b: 0, c: 0, d: 1, e: 100, f: 100, },],
]) {
    test(
        `SVG pickup falls back to the client rectangle with ${description}.`,
        () => {
            const artwork = {
                ...create_artwork(new DOMRect(
                    0,
                    0,
                    20,
                    20,
                ),),
                getBBox: () => box,
                getScreenCTM: () => matrix,
            };

            assert.equal(
                is_point_over_piece(
                    artwork,
                    10,
                    10,
                ),
                true,
            );
        },
    );
}
