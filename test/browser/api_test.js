import { expect, test, } from "@playwright/test";

test.beforeEach(async ({ page, },) => {
    await page.goto("/test/browser/drag.html",);
    await page.evaluate(async () => {
        await customElements.whenDefined("chess-board",);
        await document.querySelector("chess-board",).when_ready();
    },);
},);

test(
    "Waits for movement to settle and keeps controlled requests uncommitted until accepted.",
    async ({ page, },) => {
        const snapshot = await page.evaluate(async () => {
            const board = document.querySelector("chess-board",);
            board.set_options({ move_mode: "controlled", animation_duration: 40, },);
            const position = board.get_position();
            const request = board.request_move({ from: "e2", to: "e4", },);
            const is_unchanged = board.get_position() === position;
            board.commit_move(request.id,);
            await board.when_animation_complete();

            return {
                is_unchanged,
                moves: board.get_uci_moves(),
                animations: board.shadowRoot.getAnimations?.().filter((animation,) => animation.playState === "running",).length ?? 0,
                moving: board.shadowRoot.querySelectorAll(".moving",).length,
            };
        },);
        expect(snapshot,).toEqual({ is_unchanged: true, moves: ["e2e4",], animations: 0, moving: 0, },);
    },
);

test(
    "Uses grayscale promotion highlights and restores a rejected promotion request.",
    async ({ page, },) => {
        await page.evaluate(() => {
            const board = document.querySelector("chess-board",);
            board.set_options({ move_mode: "controlled", animation_duration: 0, },);
            board.set_position("8/P7/8/8/8/8/7k/4K3 w - - 0 1",);
        },);
        await page.locator('[data-square="a7"]',).click();
        await page.locator('[data-square="a8"]',).click();
        const choice = page.getByRole(
            "button",
            { name: "Promote to knight", },
        );
        await choice.hover();
        const colors = await choice.evaluate((button,) => {
            const style = getComputedStyle(button,);

            return { background: style.backgroundColor, outline: style.outlineColor, };
        },);
        expect(colors.background,).toBe("rgb(222, 222, 222)",);
        expect(colors.outline,).toBe("rgba(55, 55, 55, 0.65)",);
        await choice.click();
        await expect(page.locator('[data-square="a7"] .piece',),).toHaveCount(1,);
        const rejected = await page.evaluate(() => {
            const board = document.querySelector("chess-board",);

            return board.reject_move(board.get_pending_move().id,);
        },);
        expect(rejected,).toBe(true,);
    },
);

test(
    "Loads configured assets and reports stylesheet failure through readiness.",
    async ({ page, },) => {
        await page.route(
            "**/missing-chessboard.css",
            (route,) => route.fulfill({ status: 404, body: "", },),
        );
        const failed = await page.evaluate(async () => {
            const board = document.querySelector("chess-board",);
            board.set_assets({ stylesheet_url: "/missing-chessboard.css", },);

            try {
                await board.when_ready();

                return false;
            } catch {
                return true;
            }
        },);
        expect(failed,).toBe(true,);
        const recovered = await page.evaluate(async () => {
            const board = document.querySelector("chess-board",);
            board.set_assets({ stylesheet_url: "/src/style.css", piece_sprite_url: "/asset/pieces/pieces.svg", },);
            await board.when_ready();

            return board.shadowRoot.querySelector("use",).getAttribute("href",);
        },);
        expect(recovered,).toMatch(/^\/asset\/pieces\/pieces\.svg#/,);
    },
);

test(
    "Keeps moves functional without Web Animations or pointer capture.",
    async ({ page, },) => {
        const snapshot = await page.evaluate(async () => {
            const board = document.querySelector("chess-board",);
            board.shadowRoot.querySelector(".board",).animate = undefined;
            board.shadowRoot.querySelector(".board",).setPointerCapture = undefined;
            board.shadowRoot.querySelector(".board",).hasPointerCapture = undefined;
            board.shadowRoot.querySelector(".board",).releasePointerCapture = undefined;
            board.move({ from: "e2", to: "e4", },);
            await board.when_animation_complete();

            return board.get_uci_moves();
        },);
        expect(snapshot,).toEqual(["e2e4",],);
        await page.locator('[data-square="e7"]',).click();
        await page.locator('[data-square="e5"]',).click();
        expect(await page.evaluate(() => document.querySelector("chess-board",).get_uci_moves(),),).toEqual(["e2e4", "e7e5",],);
    },
);
