import assert from "node:assert/strict";
import { test, } from "node:test";

import {
    advance_drag_spring,
    create_move_keyframes,
    DRAG_SCALE_THRESHOLD,
    get_drag_tilt_degrees,
} from "../../dist/motion.js";

test(
    "Motion starts at the release position and ends without a transform offset.",
    () => {
        const keyframes = create_move_keyframes(
            24,
            -48,
            1.055,
        );

        assert.equal(
            keyframes[0].transform,
            "translate3d(24px, -48px, 0) scale(1.055)",
        );
        assert.equal(
            keyframes.at(-1,).transform,
            "translate3d(0px, 0px, 0) scale(1)",
        );
        assert.equal(
            keyframes.at(-1,).offset,
            1,
        );
    },
);

for (const [scale, frame_count,] of [[1, 3,], [DRAG_SCALE_THRESHOLD, 3,], [DRAG_SCALE_THRESHOLD + 0.0001, 4,],]) {
    test(
        `Motion at scale ${scale} uses ${frame_count} frames and preserves fractional offsets.`,
        () => {
            const frames = create_move_keyframes(
                -2.5,
                7.25,
                scale,
            );

            assert.equal(
                frames.length,
                frame_count,
            );
            assert.equal(
                frames[0].transform,
                `translate3d(-2.5px, 7.25px, 0) scale(${scale})`,
            );
            assert.deepEqual(
                frames.map((frame,) => frame.offset,),
                frame_count === 4 ? [0, .7, .86, 1,] : [0, .82, 1,],
            );

            frames[0].transform = "changed";

            assert.notEqual(
                create_move_keyframes(
                    -2.5,
                    7.25,
                    scale,
                )[0].transform,
                "changed",
            );
        },
    );
}

for (const [distance_px, elapsed_ms, expected_degrees,] of [
    [0, 0, 0,],
    [0.5, 1, 3.5,],
    [-0.5, 1, -3.5,],
    [5, 20, 1.75,],
    [100, 1, 7,],
    [-100, 1, -7,],
    [0.5, 0, 3.5,],
    [0.5, -10, 3.5,],
]) {
    test(
        `Drag tilt for ${distance_px} pixels over ${elapsed_ms} milliseconds is ${expected_degrees} degrees.`,
        () => {
            assert.equal(
                get_drag_tilt_degrees(
                    distance_px,
                    elapsed_ms,
                ),
                expected_degrees,
            );
        },
    );
}

test(
    "A centered drop stays still without bouncing or distorting.",
    () => {
        const keyframes = create_move_keyframes(
            0,
            0,
            1,
        );

        assert.equal(
            keyframes.length,
            2,
        );
        assert.equal(
            keyframes[0].transform,
            keyframes[1].transform,
        );
        assert.ok(keyframes.every((frame,) => !frame.transform.includes("NaN",),),);
    },
);

test(
    "Drag spring settles lag smoothly without overshooting after one frame.",
    () => {
        const motion = advance_drag_spring(
            -12,
            0,
            16,
        );

        assert.ok(motion.offset_px > -12,);
        assert.ok(motion.offset_px < 0,);
        assert.ok(motion.velocity_px_per_second > 0,);
    },
);

test(
    "Drag spring remains stable after a delayed frame.",
    () => {
        let offset_px = 12;
        let velocity_px_per_second = 0;

        for (let index = 0; index < 120; index += 1) {
            const motion = advance_drag_spring(
                offset_px,
                velocity_px_per_second,
                index === 0 ? 500 : 16,
            );
            offset_px = motion.offset_px;
            velocity_px_per_second = motion.velocity_px_per_second;
        }

        assert.ok(Math.abs(offset_px,) < .001,);
        assert.ok(Math.abs(velocity_px_per_second,) < .01,);
    },
);

test(
    "Lifted drags and ordinary moves use distinct proportional landing settles.",
    () => {
        const drag_frames = create_move_keyframes(
            24,
            -48,
            1.055,
        );
        const move_frames = create_move_keyframes(
            24,
            -48,
            1,
        );
        assert.deepEqual(
            drag_frames.map((frame,) => frame.offset,),
            [0, .7, .86, 1,],
        );
        assert.deepEqual(
            move_frames.map((frame,) => frame.offset,),
            [0, .82, 1,],
        );
        assert.ok(drag_frames.every((frame,) => !frame.transform.includes(",", frame.transform.indexOf("scale",),),),);
        assert.equal(
            drag_frames.at(-1,).transform,
            move_frames.at(-1,).transform,
        );

        for (const elapsed_ms of [0, 1, 16, 100,]) {
            const tilt_degrees = get_drag_tilt_degrees(
                1000,
                elapsed_ms,
            );
            assert.ok(Number.isFinite(tilt_degrees,),);
            assert.ok(Math.abs(tilt_degrees,) <= 7,);
            assert.equal(
                get_drag_tilt_degrees(
                    -1000,
                    elapsed_ms,
                ),
                -tilt_degrees,
            );
        }
    },
);
