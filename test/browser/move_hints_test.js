import { expect, test, } from "@playwright/test";

for (const orientation of ["white", "black",]) {
    test(
        `Click and drag show legal destinations and clear drag hints in ${orientation} orientation.`,
        async ({ page, },) => {
            await page.goto("/test/browser/drag.html",);
            await page.locator(".board.ready",).waitFor();
            await page.evaluate(
                (orientation,) => {
                    document.querySelector("chess-board",).set_options({ orientation, is_muted: true, },);
                },
                orientation,
            );
            const origin = page.locator('[data-square="e2"]',);
            const hints = page.locator(".square.legal",);
            await origin.click();
            const selection = origin.locator(".square_focus",);
            await expect(selection,).toHaveCSS(
                "border-top-width",
                "3px",
            );
            await expect(selection,).not.toHaveCSS(
                "box-shadow",
                "none",
            );
            await expect(hints,).toHaveCount(2,);
            await expect(page.locator('[data-square="e4"] .hint',),).toHaveCSS(
                "opacity",
                "1",
            );
            await page.keyboard.press("Escape",);
            await expect(hints,).toHaveCount(0,);

            const bounds = await origin.boundingBox();
            await page.mouse.move(
                bounds.x + bounds.width / 2,
                bounds.y + bounds.height / 2,
            );
            await page.mouse.down();
            await page.mouse.move(
                bounds.x + bounds.width / 2 + 15,
                bounds.y + bounds.height / 2,
            );
            await expect(hints,).toHaveCount(2,);
            await expect(page.locator('[data-square="e3"] .hint',),).toHaveCSS(
                "opacity",
                "1",
            );
            await expect(page.locator('[data-square="e4"] .hint',),).toHaveCSS(
                "opacity",
                "1",
            );
            await page.mouse.up();
            await expect(hints,).toHaveCount(0,);

            await page.evaluate(() => document.querySelector("chess-board",).set_options({ show_legal_moves: false, },),);
            await origin.click();
            await expect(hints,).toHaveCount(0,);
            await page.mouse.move(
                bounds.x + bounds.width / 2,
                bounds.y + bounds.height / 2,
            );
            await page.mouse.down();
            await page.mouse.move(
                bounds.x + bounds.width / 2 + 15,
                bounds.y + bounds.height / 2,
            );
            await expect(hints,).toHaveCount(0,);
            await page.mouse.up();
        },
    );
}

test(
    "Drag hints show captures, clear on cancellation, and disappear after a legal drop.",
    async ({ page, },) => {
        await page.goto("/test/browser/drag.html",);
        await page.locator(".board.ready",).waitFor();
        await page.evaluate(() => {
            const board = document.querySelector("chess-board",);
            board.set_options({ is_muted: true, interaction: { can_click_move: false, }, },);
            board.set_pgn("1. e4 d5",);
            board.addEventListener(
                "pointerdown",
                (event,) => { window.active_pointer_id = event.pointerId; },
            );
        },);
        const origin = await page.locator('[data-square="e4"]',).boundingBox();
        const destination = await page.locator('[data-square="d5"]',).boundingBox();
        await page.mouse.move(
            origin.x + origin.width / 2,
            origin.y + origin.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
            origin.x + origin.width / 2 + 15,
            origin.y + origin.height / 2,
        );
        await expect(page.locator('[data-square="d5"]',),).toHaveClass(/legal_capture/,);
        await expect(page.locator('[data-square="d5"] .hint',),).toHaveCSS(
            "opacity",
            "1",
        );
        await page.evaluate(() => {
            const board = document.querySelector("chess-board",);
            board.dispatchEvent(new PointerEvent(
                "pointercancel",
                { pointerId: window.active_pointer_id, bubbles: true, },
            ),);
        },);
        await page.mouse.up();
        await expect(page.locator(".legal, .legal_capture",),).toHaveCount(0,);
        await page.mouse.move(
            origin.x + origin.width / 2,
            origin.y + origin.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
            destination.x + destination.width / 2,
            destination.y + destination.height / 2,
        );
        await expect(page.locator('[data-square="d5"]',),).toHaveClass(/legal_capture/,);
        await page.mouse.up();
        await expect(page.locator(".legal, .legal_capture",),).toHaveCount(0,);
        expect(await page.evaluate(() => document.querySelector("chess-board",).get_uci_moves().at(-1,),),).toBe("e4d5",);
    },
);
