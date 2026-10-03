import { expect, test, } from "@playwright/test";

const CHECK_POSITION = "7k/8/5Q2/6K1/8/8/8/8 b - - 0 1";
const CHECKMATE_POSITION = "7k/6Q1/5K2/8/8/8/8/8 b - - 0 1";

for (const orientation of ["white", "black",]) {
    test(
        `The checked king retains a shadowless red outline and inward glow through checkmate in ${orientation} orientation.`,
        async ({ page, },) => {
            await page.goto("/test/browser/drag.html",);
            await page.evaluate(
                async ({ orientation, fen, },) => {
                    const board = document.querySelector("chess-board",);
                    await board.when_ready();
                    board.set_options({ orientation, is_muted: true, },);
                    board.set_position(fen,);
                },
                { orientation, fen: CHECK_POSITION, },
            );
            const king = page.getByRole(
                "gridcell",
                { name: /^h8,/, },
            );
            const outline = king.locator('[part="square-status"]',);
            await expect(outline,).toHaveCSS(
                "opacity",
                "1",
            );
            await expect(outline,).toHaveCSS(
                "border-top-width",
                "3px",
            );
            await expect(outline,).toHaveCSS(
                "border-top-color",
                "rgb(201, 44, 58)",
            );
            await expect(outline,).toHaveCSS(
                "animation-name",
                "none",
            );
            await expect(outline,).toHaveCSS(
                "box-shadow",
                "none",
            );
            expect(await outline.evaluate((node,) => getComputedStyle(node, "::before",).backgroundImage,),).toContain("radial-gradient",);
            await king.click();
            await expect(outline,).toHaveCSS(
                "border-top-color",
                "rgb(201, 44, 58)",
            );
            await page.evaluate(
                (fen,) => document.querySelector("chess-board",).set_position(fen,),
                CHECKMATE_POSITION,
            );
            await expect(outline,).toHaveCSS(
                "animation-name",
                "none",
            );
            expect(await outline.evaluate((node,) => getComputedStyle(node, "::before",).animationName,),).toBe("checkmate_glow",);
            await expect(outline,).toHaveCSS(
                "box-shadow",
                "none",
            );
            await page.evaluate(() => document.querySelector("chess-board",).set_options({ animation_duration: 0, },),);
            await expect(outline,).toHaveCSS(
                "animation-name",
                "none",
            );
            await expect(outline,).toHaveCSS(
                "box-shadow",
                "none",
            );
            await page.evaluate(() => document.querySelector("chess-board",).set_pgn("1. e4",),);
            await expect(outline,).toHaveCSS(
                "opacity",
                "0",
            );
            await expect(outline,).toHaveCSS(
                "box-shadow",
                "none",
            );
        },
    );
}

test(
    "Reduced motion keeps the shadowless checkmate glow, and its color can be themed.",
    async ({ page, },) => {
        await page.emulateMedia({ reducedMotion: "reduce", },);
        await page.goto("/test/browser/drag.html",);
        await page.evaluate(
            async (fen,) => {
                const board = document.querySelector("chess-board",);
                await board.when_ready();
                board.set_position(fen,);
                board.style.setProperty(
                    "--chessboard-check-outline",
                    "rgb(180, 20, 35)",
                );
            },
            CHECKMATE_POSITION,
        );
        const outline = page.locator(".checkmated > .square_status",);
        await expect(outline,).toHaveCSS(
            "opacity",
            "1",
        );
        await expect(outline,).toHaveCSS(
            "animation-name",
            "none",
        );
        await expect(outline,).toHaveCSS(
            "border-top-color",
            "rgb(180, 20, 35)",
        );
        await expect(outline,).toHaveCSS(
            "box-shadow",
            "none",
        );
        expect(await outline.evaluate((node,) => getComputedStyle(node, "::before",).animationName,),).toBe("none",);
        expect(await outline.evaluate((node,) => getComputedStyle(node, "::before",).backgroundImage,),).toContain("radial-gradient",);
    },
);
