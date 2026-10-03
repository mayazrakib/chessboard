import { expect, test, } from "@playwright/test";

async function prepare_marks(
    page,
    orientation,
) {
    await page.goto("/test/browser/drag.html",);
    await page.locator(".board.ready",).waitFor();
    await page.evaluate(
        (orientation,) => {
            const board = document.querySelector("meson-chessboard",);
            board.set_options({ orientation, },);
            board.set_marks([
                { from: "e2", color: "green", },
                { from: "e4", color: "blue", source: "engine", },
                { from: "e2", to: "e4", color: "blue", source: "engine", },
                { from: "d4", to: "f4", color: "red", },
            ],);
        },
        orientation,
    );
}

async function get_square_center(
    page,
    square,
) {
    const bounds = await page.locator(`[data-square="${square}"]`,).boundingBox();
    expect(bounds,).not.toBeNull();

    return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
    };
}

async function expect_marks_above_piece(
    page,
    selector,
) {
    const layers = await page.evaluate(
        (selector,) => {
            const shadow = document.querySelector("meson-chessboard",).shadowRoot;
            const piece = shadow.querySelector(selector,);
            const bounds = piece.getBoundingClientRect();
            const probe_style = document.createElement("style",);
            probe_style.textContent = ".shapes *, .piece, .piece * { pointer-events: all !important; }";
            shadow.append(probe_style,);

            try {
                const elements = shadow.elementsFromPoint(
                    bounds.left + bounds.width / 2,
                    bounds.top + bounds.height / 2,
                );

                return {
                    is_mark_above: Boolean(elements[0]?.closest(".shapes",),),
                    has_piece_below: elements.some((element,) => element === piece || piece.contains(element,),),
                };
            } finally {
                probe_style.remove();
            }
        },
        selector,
    );
    expect(layers,).toEqual({ is_mark_above: true, has_piece_below: true, },);
}

for (const orientation of ["white", "black",]) {
    test(
        `Keeps marks above resting and animated pieces in ${orientation} orientation.`,
        async ({ page, },) => {
            await prepare_marks(
                page,
                orientation,
            );
            await expect_marks_above_piece(
                page,
                '[data-square="e2"] .piece',
            );
            await page.evaluate(() => {
                const board = document.querySelector("meson-chessboard",);
                board.move_uci("e2e4",);
                const animation = board.shadowRoot.querySelector('[data-square="e4"] .piece',).getAnimations()[0];
                animation.pause();
                animation.currentTime = animation.effect.getTiming().duration / 2;
            },);
            await expect(page.locator('[data-square="e4"] .piece',),).toHaveClass(/moving/,);
            await expect_marks_above_piece(
                page,
                '[data-square="e4"] .piece',
            );
        },
    );

    test(
        `Keeps marks above dragged and returning pieces without blocking drops in ${orientation} orientation.`,
        async ({ page, },) => {
            await prepare_marks(
                page,
                orientation,
            );
            const source = await get_square_center(
                page,
                "e2",
            );
            const target = await get_square_center(
                page,
                "e4",
            );
            await page.mouse.move(
                source.x,
                source.y,
            );
            await page.mouse.down();
            await page.evaluate(() => {
                document.querySelector("meson-chessboard",).set_marks([{ from: "e4", source: "engine", },],);
            },);
            await page.mouse.move(
                target.x,
                target.y,
            );
            await expect(page.locator('[data-square="e4"]',),).toHaveClass(/drag_target/,);
            await expect_marks_above_piece(
                page,
                ".drag_ghost",
            );
            await page.mouse.up();
            expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_uci_moves(),),).toEqual(["e2e4",],);

            await page.evaluate(() => {
                const board = document.querySelector("meson-chessboard",);
                board.set_position("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",);
                board.set_marks([{ from: "e5", color: "amber", },],);
                board.addEventListener(
                    "pointerup",
                    () => {
                        const animation = board.shadowRoot.querySelector(".drag_ghost",).getAnimations()[0];
                        animation.pause();
                        animation.currentTime = 0;
                    },
                    { once: true, },
                );
            },);
            const invalid_target = await get_square_center(
                page,
                "e5",
            );
            await page.mouse.move(
                source.x,
                source.y,
            );
            await page.mouse.down();
            await page.evaluate(() => {
                document.querySelector("meson-chessboard",).set_marks([{ from: "e5", color: "amber", },],);
            },);
            await page.mouse.move(
                invalid_target.x,
                invalid_target.y,
            );
            await page.mouse.up();
            await expect_marks_above_piece(
                page,
                ".drag_ghost",
            );
            expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_uci_moves(),),).toEqual([],);
        },
    );

    test(
        `Keeps annotations above immediate capture replacements in ${orientation} orientation.`,
        async ({ page, },) => {
            await prepare_marks(
                page,
                orientation,
            );
            await page.evaluate(() => {
                const board = document.querySelector("meson-chessboard",);
                board.set_position("4k3/8/8/8/4p3/8/4R3/4K3 w - - 0 1",);
                board.move_uci("e2e4",);

                for (const animation of board.shadowRoot.getAnimations()) {
                    animation.pause();
                    animation.currentTime = 0;
                }
            },);
            await expect_marks_above_piece(
                page,
                '[data-square="e4"] .piece',
            );
        },
    );
}

for (const square of ["d4", "e2",]) {
    test(
        `Left clicking ${square} clears every annotation group and preserves normal move entry.`,
        async ({ page, },) => {
            await prepare_marks(
                page,
                "white",
            );
            await page.evaluate(() => {
                window.annotation_changes = [];
                document.querySelector("meson-chessboard",).addEventListener(
                    "chessboard:annotations",
                    (event,) => window.annotation_changes.push(event.detail,),
                );
            },);
            await page.locator(`[data-square="${square}"]`,).click();
            const cleared = await page.evaluate(() => {
                const board = document.querySelector("meson-chessboard",);

                return {
                    marks: board.get_marks(),
                    annotations: board.get_annotations(),
                    change_count: window.annotation_changes.length,
                    source: window.annotation_changes[0].source,
                };
            },);
            expect(cleared,).toEqual({ marks: [], annotations: [], change_count: 1, source: "pointer", },);
            await expect(page.locator(".shapes > g",),).toHaveCount(0,);

            if (square !== "e2") {
                await page.locator('[data-square="e2"]',).click();
            }

            await page.locator('[data-square="e4"]',).click();
            expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_uci_moves(),),).toEqual(["e2e4",],);
            expect(await page.evaluate(() => window.annotation_changes.length,),).toBe(1,);
        },
    );
}

test(
    "Native secondary clicking preserves other marks and a readonly board ignores left clicks.",
    async ({ page, },) => {
        await prepare_marks(
            page,
            "white",
        );
        await page.locator('[data-square="a4"]',).click({ button: "right", },);
        expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_marks().length,),).toBe(5,);
        await page.evaluate(() => document.querySelector("meson-chessboard",).set_options({ interactive: false, },),);
        await page.locator('[data-square="e2"]',).click();
        expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_marks().length,),).toBe(5,);
    },
);

test(
    "A macOS Control-click creates square marks without clearing annotations or moving pieces.",
    async ({ page, },) => {
        await prepare_marks(
            page,
            "white",
        );
        await page.locator('[data-square="a4"]',).click({ modifiers: ["Control",], },);
        const state = await page.evaluate(() => {
            const board = document.querySelector("meson-chessboard",);

            return {
                marks: board.get_marks(),
                moves: board.get_uci_moves(),
            };
        },);
        expect(state.marks,).toHaveLength(5,);
        expect(state.marks.at(-1,),).toMatchObject({ from: "a4", },);
        expect(state.moves,).toEqual([],);
    },
);

for (const orientation of ["white", "black",]) {
    test(
        `A macOS Control-drag creates an arrow in ${orientation} orientation.`,
        async ({ page, },) => {
            await prepare_marks(
                page,
                orientation,
            );
            await page.evaluate(() => document.querySelector("meson-chessboard",).clear_marks(),);
            const origin = await get_square_center(
                page,
                "d4",
            );
            const target = await get_square_center(
                page,
                "f4",
            );
            await page.keyboard.down("Control",);
            await page.mouse.move(
                origin.x,
                origin.y,
            );
            await page.mouse.down();
            await page.mouse.move(
                target.x,
                target.y,
                { steps: 4, },
            );
            await page.mouse.up();
            await page.keyboard.up("Control",);
            expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_marks(),),).toEqual([
                { from: "d4", to: "f4", },
            ],);
            expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_uci_moves(),),).toEqual([],);
        },
    );
}

for (const orientation of ["white", "black",]) {
    test(
        `Right-drag knight arrows bend toward every destination in ${orientation} orientation.`,
        async ({ page, },) => {
            await prepare_marks(
                page,
                orientation,
            );
            await page.evaluate(() => document.querySelector("meson-chessboard",).clear_marks(),);
            const origin = await get_square_center(
                page,
                "d4",
            );

            for (const destination of ["b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5",]) {
                const target = await get_square_center(
                    page,
                    destination,
                );
                await page.mouse.move(
                    origin.x,
                    origin.y,
                );
                await page.mouse.down({ button: "right", },);
                await page.mouse.move(
                    target.x,
                    target.y,
                    { steps: 4, },
                );
                await page.mouse.up({ button: "right", },);
                const arrow = page.locator(".arrow_mark path",);
                await expect(arrow,).toHaveCount(1,);
                const geometry = await arrow.evaluate((path,) => {
                    const transform = path.getScreenCTM();
                    const origin = new DOMPoint(
                        0,
                        0,
                    ).matrixTransform(transform,);
                    const bend = new DOMPoint(
                        2,
                        0,
                    ).matrixTransform(transform,);
                    const tip = new DOMPoint(
                        2,
                        1,
                    ).matrixTransform(transform,);

                    return {
                        origin: { x: origin.x, y: origin.y, },
                        bend: { x: bend.x, y: bend.y, },
                        tip: { x: tip.x, y: tip.y, },
                        path: path.getAttribute("d",),
                    };
                },);
                expect(geometry.path,).toContain("L 2 1",);
                expect(geometry.origin.x,).toBeCloseTo(
                    origin.x,
                    1,
                );
                expect(geometry.origin.y,).toBeCloseTo(
                    origin.y,
                    1,
                );
                expect(geometry.tip.x,).toBeCloseTo(
                    target.x,
                    1,
                );
                expect(geometry.tip.y,).toBeCloseTo(
                    target.y,
                    1,
                );
                const is_horizontal_first = Math.abs(target.x - origin.x) > Math.abs(target.y - origin.y);
                expect(geometry.bend.x,).toBeCloseTo(
                    is_horizontal_first ? target.x : origin.x,
                    1,
                );
                expect(geometry.bend.y,).toBeCloseTo(
                    is_horizontal_first ? origin.y : target.y,
                    1,
                );
                await page.mouse.move(
                    origin.x,
                    origin.y,
                );
                await page.mouse.down({ button: "right", },);
                await page.mouse.move(
                    target.x,
                    target.y,
                );
                await page.mouse.up({ button: "right", },);
                await expect(arrow,).toHaveCount(0,);
            }
        },
    );
}
