import { expect, test, } from "@playwright/test";

function calculate_luminance(rgb,) {
    const channels = rgb.match(/[\d.]+/g,).slice(0, 3,).map((channel,) => {
        const value = Number(channel,) / 255;

        return value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    },);

    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}

function calculate_contrast(
    foreground,
    background,
) {
    const light = Math.max(
        calculate_luminance(foreground,),
        calculate_luminance(background,),
    );
    const dark = Math.min(
        calculate_luminance(foreground,),
        calculate_luminance(background,),
    );

    return (light + .05) / (dark + .05);
}

test.beforeEach(async ({ page, },) => {
    await page.goto("/test/browser/drag.html",);
    await page.evaluate(async () => {
        const board = document.querySelector("chess-board",);
        await board.when_ready();
        board.set_options({ animation_duration: 0, is_muted: true, },);
    },);
},);

test(
    "Exposes a named grid, named squares, and one keyboard entry point.",
    async ({ page, },) => {
        const semantics = await page.evaluate(() => {
            const board = document.querySelector("chess-board",);
            const cells = [...board.shadowRoot.querySelectorAll('[role="gridcell"]',),];

            return {
                grid_label: board.shadowRoot.querySelector('[role="grid"]',).getAttribute("aria-label",),
                named_cells: cells.filter((cell,) => cell.getAttribute("aria-label",)?.length > 0,).length,
                tab_stops: cells.filter((cell,) => cell.tabIndex === 0,).length,
            };
        },);
        expect(semantics.grid_label,).toBe("Chessboard",);
        expect(semantics.named_cells,).toBe(64,);
        expect(semantics.tab_stops,).toBe(1,);
        const e2 = page.getByRole(
            "gridcell",
            { name: /^e2,/, },
        );
        await e2.focus();
        await page.keyboard.press("Shift+ArrowRight",);
        await expect(page.getByRole(
            "gridcell",
            { name: /^f2,/, },
        ),).toBeFocused();
    },
);

test(
    "Names and focuses promotion choices while keeping readonly navigation available.",
    async ({ page, },) => {
        await page.evaluate(() => {
            const board = document.querySelector("chess-board",);
            board.set_position("8/P7/8/8/8/8/7k/4K3 w - - 0 1",);
        },);
        await page.locator('[data-square="a7"]',).click();
        await page.locator('[data-square="a8"]',).click();
        const promotion = page.getByRole(
            "dialog",
            { name: "Choose promotion piece", },
        );
        await expect(promotion,).toBeVisible();
        await expect(page.getByRole(
            "button",
            { name: "Promote to queen", },
        ),).toBeFocused();
        await page.evaluate(() => document.querySelector("chess-board",).set_options({ interactive: false, },),);
        await page.getByRole(
            "gridcell",
            { name: /^a7,/, },
        ).focus();
        await page.keyboard.press("Shift+ArrowRight",);
        await expect(page.getByRole(
            "gridcell",
            { name: /^b7,/, },
        ),).toBeFocused();
    },
);

test(
    "Announces chess events and maintains readable playground text contrast.",
    async ({ page, },) => {
        const announcements = await page.evaluate(async () => {
            const board = document.querySelector("chess-board",);
            board.set_options({ accessibility: { announce_annotations: true, announce_moves: true, }, },);
            board.move_uci("e2e4",);
            await Promise.resolve();
            const move = board.shadowRoot.querySelector('[aria-live="polite"]',).textContent;
            board.set_annotations([{ from: "e4", to: "e5", },],);
            await Promise.resolve();

            return {
                annotations: board.shadowRoot.querySelector('[aria-live="polite"]',).textContent,
                move,
            };
        },);
        expect(announcements,).toEqual({ annotations: "1 annotation.", move: "Move e4.", },);
        await page.goto("/",);
        const colors = await page.locator("body",).evaluate((body,) => {
            const style = getComputedStyle(body,);

            function resolve_color(color,) {
                const canvas = document.createElement("canvas",);
                canvas.width = 1;
                canvas.height = 1;
                const context = canvas.getContext("2d",);
                context.fillStyle = color;
                context.fillRect(
                    0,
                    0,
                    1,
                    1,
                );
                const [red, green, blue,] = context.getImageData(
                    0,
                    0,
                    1,
                    1,
                ).data;

                return `rgb(${red}, ${green}, ${blue})`;
            }

            return {
                background: resolve_color(style.backgroundColor,),
                foreground: resolve_color(style.color,),
            };
        },);
        expect(calculate_contrast(
            colors.foreground,
            colors.background,
        ),).toBeGreaterThanOrEqual(4.5,);
    },
);
