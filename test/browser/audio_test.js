import { expect, test, } from "@playwright/test";

test(
    "The playground plays packaged audio, mutes immediately, and follows API mute changes.",
    async ({ page, },) => {
        await page.addInitScript(() => {
            const play_audio = HTMLMediaElement.prototype.play;
            window.played_sounds = [];
            window.audio_errors = [];
            HTMLMediaElement.prototype.play = function() {
                window.last_audio = this;

                return play_audio.call(this,).then(() => {
                    window.played_sounds.push(this.src,);
                },);
            };
            document.addEventListener(
                "chessboard:error",
                (event,) => {
                    if (event.detail.reason === "audio_failed") {
                        window.audio_errors.push(event.detail.message,);
                    }
                },
            );
        },);
        await page.goto("/",);
        const mute = page.getByRole(
            "switch",
            { name: "Mute sounds", },
        );
        await expect(mute,).toHaveAttribute(
            "aria-checked",
            "false",
        );
        await page.locator("#uci_input",).fill("e2e4",);
        await page.getByRole(
            "button",
            { name: "Play UCI move", exact: true, },
        ).click();
        await expect.poll(() => page.evaluate(() => window.played_sounds.length,),).toBe(1,);
        expect(await page.evaluate(() => window.played_sounds[0],),).toMatch(/\/audio\/move\.mp3$/,);

        await mute.click();
        expect(await page.evaluate(() => document.querySelector("chess-board",).is_muted(),),).toBe(true,);
        expect(await page.evaluate(() => window.last_audio.paused,),).toBe(true,);
        await page.locator("#uci_input",).fill("d7d5",);
        await page.getByRole(
            "button",
            { name: "Play UCI move", exact: true, },
        ).click();
        expect(await page.evaluate(() => window.played_sounds.length,),).toBe(1,);

        await page.evaluate(() => document.querySelector("chess-board",).set_muted(false,),);
        await expect(mute,).toHaveAttribute(
            "aria-checked",
            "false",
        );
        await page.locator("#uci_input",).fill("e4d5",);
        await page.getByRole(
            "button",
            { name: "Play UCI move", exact: true, },
        ).click();
        await expect.poll(() => page.evaluate(() => window.played_sounds.length,),).toBe(2,);
        expect(await page.evaluate(() => window.played_sounds[1],),).toMatch(/\/audio\/capture\.mp3$/,);
        expect(await page.evaluate(() => window.audio_errors,),).toEqual([],);
    },
);

test(
    "Every packaged recording loads and decodes in the browser.",
    async ({ page, },) => {
        await page.goto("/test/browser/drag.html",);
        const recordings = await page.evaluate(async () => {
            const decoded_recordings = [];

            for (const name of ["move", "capture", "check", "checkmate", "draw", "win", "lose",]) {
                const audio = document.createElement("audio",);
                const loaded = new Promise((
                    resolve,
                    reject,
                ) => {
                    audio.addEventListener(
                        "loadeddata",
                        resolve,
                        { once: true, },
                    );
                    audio.addEventListener(
                        "error",
                        () => reject(new Error(`Failed to decode ${name}.`,),),
                        { once: true, },
                    );
                },);
                audio.src = `/asset/audio/${["move", "capture", "check", "checkmate",].includes(name,) ? name : "notification"}.mp3`;
                audio.load();
                await loaded;
                decoded_recordings.push({ name, duration_seconds: audio.duration, },);
                audio.removeAttribute("src",);
                audio.load();
            }

            return decoded_recordings;
        },);

        expect(recordings,).toHaveLength(7,);

        for (const recording of recordings) {
            expect(recording.duration_seconds,).toBeGreaterThan(0,);
            expect(Number.isFinite(recording.duration_seconds,),).toBe(true,);
        }
    },
);
