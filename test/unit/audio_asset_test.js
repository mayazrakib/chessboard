import assert from "node:assert/strict";
import { createHash, } from "node:crypto";
import { readFile, } from "node:fs/promises";
import { test, } from "node:test";

const RECORDINGS = {
    checkmate: "8d6336f47c2aacd0ac5878b55366959c857e693aeb6113f967ca36e5368b9b73",
    check: "8d6336f47c2aacd0ac5878b55366959c857e693aeb6113f967ca36e5368b9b73",
    move: "3dd52fa3657d876cf40194d2005eddef3364e3b65bc0c508288529ae7bde8485",
    capture: "60c4c6066989a85089c68d8ea43a084044e2a2fa9b20ab786690b8e1f9e9205b",
    notification: "8d6336f47c2aacd0ac5878b55366959c857e693aeb6113f967ca36e5368b9b73",
};

test(
    "Bundled audio matches the selected source recordings.",
    async () => {
        for (const [name, expected_hash,] of Object.entries(RECORDINGS,)) {
            const recording = await readFile(new URL(
                `../../asset/audio/${name}.mp3`,
                import.meta.url,
            ),);
            const actual_hash = createHash("sha256",).update(recording,).digest("hex",);
            assert.equal(
                actual_hash,
                expected_hash,
                `The ${name} recording differs from the selected asset.`,
            );
        }
    },
);
