import { expect, test, } from "@playwright/test";

test(
    "Independent pointer settings preserve click input when dragging is disabled.",
    async ({ page, },) => {
        await page.goto("/test/browser/drag.html",);
        await page.evaluate(async () => {
            const board = document.querySelector("chess-board",);
            await board.when_ready();
            board.set_options({ animation_duration: 0, is_muted: true, interaction: { can_drag: false, }, },);
        },);
        const origin = page.getByRole(
            "gridcell",
            { name: /^e2,/, },
        );
        const destination = page.getByRole(
            "gridcell",
            { name: /^e4,/, },
        );
        await origin.click();
        await destination.click();
        expect(await page.evaluate(() => document.querySelector("chess-board",).get_uci_moves(),),).toEqual(["e2e4",],);
        await page.evaluate(() => {
            const board = document.querySelector("chess-board",);
            board.undo();
            board.set_options({ interaction: { can_click_move: false, }, },);
        },);
        await origin.click();
        await destination.click();
        expect(await page.evaluate(() => document.querySelector("chess-board",).get_uci_moves(),),).toEqual([],);
    },
);

test(
    "The customization panel changes options, previews results, and validates JSON without losing state.",
    async ({ page, },) => {
        await page.addInitScript(() => {
            window.played_sounds = [];
            window.played_volumes = [];
            HTMLMediaElement.prototype.play = function() {
                window.played_sounds.push(this.src,);
                window.played_volumes.push(this.volume,);

                return Promise.resolve();
            };
        },);
        await page.goto("/",);
        await page.getByRole(
            "tab",
            { name: "Customize", },
        ).click();
        await page.getByLabel(
            "Sound volume",
            { exact: true, },
        ).fill("0.3",);
        await page.getByLabel("Result sound perspective",).selectOption("w",);
        await page.getByRole(
            "tab",
            { name: "Effects", },
        ).click();
        await page.getByRole(
            "button",
            { name: "Play win", exact: true, },
        ).click();
        expect(await page.evaluate(() => window.played_sounds.at(-1,),),).toMatch(/notification\.mp3$/,);
        expect(await page.evaluate(() => window.played_volumes.at(-1,),),).toBe(0.3,);
        await page.getByRole(
            "tab",
            { name: "Customize", },
        ).click();
        await page.getByLabel("Partial options as JSON",).fill('{"pieces":{"scale":0.8},"sound":{"should_play_on_history":false}}',);
        await page.getByRole(
            "button",
            { name: "Apply configuration", },
        ).click();
        expect(await page.evaluate(() => document.querySelector("chess-board",).get_options().pieces.scale,),).toBe(0.8,);
        await page.getByLabel("Partial options as JSON",).fill('{"pieces":{"scale":-1}}',);
        await page.getByRole(
            "button",
            { name: "Apply configuration", },
        ).click();
        await expect(page.getByRole("status",).filter({ hasText: "outside its supported range", },),).toBeVisible();
        expect(await page.evaluate(() => document.querySelector("chess-board",).get_options().pieces.scale,),).toBe(0.8,);
    },
);

test(
    "The playground controls quality, touch annotations, and screen-reader announcements.",
    async ({ page, },) => {
        await page.goto("/",);
        await page.getByRole(
            "tab",
            { name: "Customize", },
        ).click();
        await page.getByLabel("Visual quality",).selectOption("minimal",);
        await page.getByLabel("Touch interaction",).selectOption("annotate",);
        await page.getByLabel("Announce moves",).check();
        await page.getByLabel("Announce annotations",).check();
        const options = await page.evaluate(() => {
            const board = document.querySelector("chess-board",);

            return {
                announce_annotations: board.get_options().accessibility.announce_annotations,
                announce_moves: board.get_options().accessibility.announce_moves,
                profile: board.dataset.qualityProfile,
                touch_mode: board.get_options().interaction.touch_mode,
            };
        },);
        expect(options,).toEqual({
            announce_annotations: true,
            announce_moves: true,
            profile: "minimal",
            touch_mode: "annotate",
        },);
        const annotation = await page.evaluate(async () => {
            const board = document.querySelector("chess-board",);
            const square = board.shadowRoot.querySelector('[data-square="a4"]',);
            const bounds = square.getBoundingClientRect();
            const parameters = {
                bubbles: true,
                button: 0,
                clientX: bounds.left + bounds.width / 2,
                clientY: bounds.top + bounds.height / 2,
                composed: true,
                pointerId: 7,
                pointerType: "touch",
            };
            square.dispatchEvent(new PointerEvent(
                "pointerdown",
                parameters,
            ),);
            square.dispatchEvent(new PointerEvent(
                "pointerup",
                parameters,
            ),);
            await Promise.resolve();

            return {
                announcement: board.shadowRoot.querySelector('[aria-live="polite"]',).textContent,
                marks: board.get_marks(),
            };
        },);
        expect(annotation.announcement,).toBe("1 annotation.",);
        expect(annotation.marks,).toEqual([{ from: "a4", },],);
        const move_announcement = await page.evaluate(async () => {
            const board = document.querySelector("chess-board",);
            board.move_uci("e2e4",);
            await Promise.resolve();

            return board.shadowRoot.querySelector('[aria-live="polite"]',).textContent;
        },);
        expect(move_announcement,).toBe("Move e4.",);
    },
);

test(
    "Sound effects decode as short recordings and playback uses configured volume.",
    async ({ page, },) => {
        await page.goto("/test/browser/drag.html",);
        const effects = await page.evaluate(async () => {
            const context = new AudioContext();

            try {
                const effects = [];

                for (const name of ["move", "capture", "check", "checkmate", "draw", "win", "lose",]) {
                    const response = await fetch(`/asset/audio/${["move", "capture", "check", "checkmate",].includes(name,) ? name : "notification"}.mp3`,);
                    const recording = await context.decodeAudioData(await response.arrayBuffer(),);
                    let peak = 0;

                    for (const sample of recording.getChannelData(0,)) {
                        peak = Math.max(
                            peak,
                            Math.abs(sample,),
                        );
                    }

                    effects.push({ name, duration_seconds: recording.duration, peak, },);
                }

                return effects;
            } finally {
                await context.close();
            }
        },);
        expect(effects,).toHaveLength(7,);

        for (const effect of effects) {
            expect(effect.duration_seconds,).toBeLessThan(0.7,);
            expect(effect.peak,).toBeGreaterThan(0,);
            expect(effect.peak,).toBeLessThanOrEqual(1.1,);
        }
    },
);
