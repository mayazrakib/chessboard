import assert from "node:assert/strict";
import { test, } from "node:test";

import { BoardAudio, } from "../../dist/audio.js";

function create_player() {
    const calls = [];
    const errors = [];
    const media = {
        currentTime: 10,
        src: "",
        pause: () => calls.push("pause",),
        play: () => {
            calls.push("play",);

            return Promise.resolve();
        },
    };
    const owner_document = {
        createElement: (tag,) => {
            calls.push(tag,);

            return media;
        },
    };
    const player = new BoardAudio(
        owner_document,
        (error,) => errors.push(error,),
    );

    return { calls, errors, media, player, };
}

test(
    "Audio creation is lazy and a later sound reuses the media element from its beginning.",
    () => {
        const { calls, media, player, } = create_player();
        player.stop();

        assert.deepEqual(
            calls,
            [],
        );

        for (const sound of ["move", "capture", "check", "checkmate", "draw", "win", "lose",]) {
            media.currentTime = 10;
            player.play(sound,);

            assert.equal(
                media.src,
                new URL(
                    `../../asset/audio/${["move", "capture", "check", "checkmate",].includes(sound,) ? sound : "notification"}.mp3`,
                    import.meta.url,
                ).href,
            );
            assert.equal(
                media.currentTime,
                0,
            );
        }

        player.stop();

        assert.equal(
            calls.filter((operation,) => operation === "audio",).length,
            1,
        );
        assert.equal(
            calls.filter((operation,) => operation === "play",).length,
            7,
        );
        assert.equal(
            calls.at(-1,),
            "pause",
        );
    },
);

for (const name of ["NotAllowedError", "AbortError", "NotSupportedError", "Error",]) {
    for (const is_synchronous of [false, true,]) {
        test(
            `Audio handles ${name} from ${is_synchronous ? "synchronous" : "asynchronous"} playback.`,
            async () => {
                const { errors, media, player, } = create_player();
                const playback_error = Object.assign(
                    new Error("Playback failed.",),
                    { name, },
                );
                media.play = () => {
                    if (is_synchronous) {
                        throw playback_error;
                    }

                    return Promise.reject(playback_error,);
                };
                player.play("move",);
                await Promise.resolve();

                assert.deepEqual(
                    errors,
                    ["NotAllowedError", "AbortError",].includes(name,) ? [] : [playback_error,],
                );
            },
        );
    }
}

test(
    "Audio reports nonexception rejection values without losing the original cause.",
    async () => {
        const { errors, media, player, } = create_player();
        media.play = () => Promise.reject("Unavailable recording.",);
        player.play("move",);
        await Promise.resolve();

        assert.deepEqual(
            errors,
            ["Unavailable recording.",],
        );
    },
);
