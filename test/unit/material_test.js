import assert from "node:assert/strict";
import { test, } from "node:test";

import { Chess, } from "chess.js";

import { render_material_rows, } from "../../dist/material.js";
import { create_dom_environment, } from "./dom.js";

create_dom_environment();

function create_rows() {
    return { w: document.createElement("div",), b: document.createElement("div",), };
}

test(
    "Starting material counts both armies, including kings, without invented captures.",
    () => {
        const rows = create_rows();
        render_material_rows(
            new Chess(),
            rows,
            { w: [], b: [], },
            "counts",
            "/pieces.svg",
        );

        for (const [color, name,] of [["w", "White",], ["b", "Black",],]) {
            const row = rows[color];
            assert.equal(
                row.getAttribute("aria-label",),
                `${name}: 16 pieces, 39 material points, equal material. 0 recorded captures.`,
            );
            assert.equal(
                row.querySelector(".material_inventory",).textContent,
                "16 pieces · 39 pts",
            );
            assert.equal(
                row.querySelector(".material_advantage",).dataset.state,
                "equal",
            );
            assert.equal(
                row.querySelector(".material_captures",).textContent,
                "No captures",
            );
        }
    },
);

for (const [type, points,] of [["p", 1,], ["n", 3,], ["b", 3,], ["r", 5,], ["q", 9,],]) {
    test(
        `Material values a ${type} at ${points} points and reports the opponent's deficit.`,
        () => {
            const game = new Chess("4k3/8/8/8/8/8/8/4K3 w - - 0 1",);
            game.put(
                { type, color: "w", },
                "d4",
            );
            const rows = create_rows();
            render_material_rows(
                game,
                rows,
                { w: [], b: [], },
                "counts",
                "/pieces.svg",
            );

            assert.equal(
                rows.w.querySelector(".material_inventory",).textContent,
                `2 pieces · ${points} ${points === 1 ? "pt" : "pts"}`,
            );
            assert.equal(
                rows.w.querySelector(".material_advantage",).textContent,
                `+${points}`,
            );
            assert.equal(
                rows.b.querySelector(".material_advantage",).textContent,
                `−${points}`,
            );
            assert.equal(
                rows.b.querySelector(".material_advantage",).title,
                `${points} material ${points === 1 ? "point" : "points"} behind.`,
            );
        },
    );
}

for (const display of ["counts", "stacked",]) {
    test(
        `Captured pieces use ${display} display, canonical order, and the opponent's artwork.`,
        () => {
            const captures = Object.freeze({
                w: Object.freeze(["q", "p", "r", "p", "b", "n",],),
                b: Object.freeze(["n",],),
            },);
            const rows = create_rows();
            render_material_rows(
                new Chess(),
                rows,
                captures,
                display,
                "/custom.svg",
            );
            const groups = [...rows.w.querySelectorAll(".capture_group",),];

            assert.deepEqual(
                groups.map((group,) => group.getAttribute("aria-label",),),
                ["2 captured black pawns", "1 captured black knight", "1 captured black bishop", "1 captured black rook", "1 captured black queen",],
            );
            assert.equal(
                groups[0].querySelectorAll("svg",).length,
                display === "counts" ? 1 : 2,
            );
            assert.equal(
                groups[0].querySelector(".capture_quantity",)?.textContent ?? null,
                display === "counts" ? "2" : null,
            );
            assert.equal(
                rows.b.querySelector("use",).getAttribute("href",),
                "/custom.svg#white-knight",
            );
            assert.ok([...rows.w.querySelectorAll("svg",),].every((artwork,) => artwork.getAttribute("aria-hidden",) === "true",),);
            assert.match(
                rows.b.getAttribute("aria-label",),
                /1 recorded capture\.$/,
            );
        },
    );
}

test(
    "Material rendering preserves nodes until the displayed state changes.",
    () => {
        const game = new Chess();
        const rows = create_rows();
        const captures = { w: ["p",], b: [], };
        const render_rows = () => render_material_rows(
            game,
            rows,
            captures,
            "counts",
            "/pieces.svg",
        );
        render_rows();
        const white_identity = rows.w.firstChild;
        const black_identity = rows.b.firstChild;
        render_rows();

        assert.equal(
            rows.w.firstChild,
            white_identity,
        );

        captures.w.push("p",);
        render_rows();

        assert.notEqual(
            rows.w.firstChild,
            white_identity,
        );
        assert.equal(
            rows.b.firstChild,
            black_identity,
        );

        game.remove("a7",);
        render_rows();

        assert.notEqual(
            rows.b.firstChild,
            black_identity,
        );
        assert.equal(
            rows.w.querySelector(".material_advantage",).textContent,
            "+1",
        );

        render_material_rows(
            game,
            rows,
            captures,
            "stacked",
            "/replacement.svg",
        );

        assert.equal(
            rows.w.querySelectorAll("svg",).length,
            2,
        );
        assert.equal(
            rows.w.querySelector("use",).getAttribute("href",),
            "/replacement.svg#black-pawn",
        );
    },
);
