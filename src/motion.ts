const MAXIMUM_TILT_DEGREES = 7;
const DRAG_SPRING_DAMPING = 24;
const DRAG_SPRING_STIFFNESS = 220;
const MAXIMUM_SPRING_FRAME_MS = 32;
export const DRAG_SCALE_THRESHOLD = 1.01;
export const DRAG_SCALE = 1.055;
export const DRAG_RESPONSE_MS = 180;
export const MOVE_EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";

export function advance_drag_spring(
    offset_px: number,
    velocity_px_per_second: number,
    elapsed_ms: number,
): {
    offset_px: number;
    velocity_px_per_second: number;
} {
    const elapsed_seconds = Math.min(
        Math.max(
            elapsed_ms,
            0,
        ),
        MAXIMUM_SPRING_FRAME_MS,
    ) / 1000;
    const acceleration_px_per_second_squared = (
        -DRAG_SPRING_STIFFNESS * offset_px
        - DRAG_SPRING_DAMPING * velocity_px_per_second
    );
    const next_velocity_px_per_second = velocity_px_per_second
        + acceleration_px_per_second_squared * elapsed_seconds;

    return {
        offset_px: offset_px + next_velocity_px_per_second * elapsed_seconds,
        velocity_px_per_second: next_velocity_px_per_second,
    };
}

export function create_move_keyframes(
    offset_x_px: number,
    offset_y_px: number,
    initial_scale: number,
): Keyframe[] {
    if (offset_x_px === 0 && offset_y_px === 0 && initial_scale === 1) {
        return [
            {
                transform: "translate3d(0px, 0px, 0) scale(1)",
                offset: 0,
            },
            {
                transform: "translate3d(0px, 0px, 0) scale(1)",
                offset: 1,
            },
        ];
    }

    if (initial_scale > DRAG_SCALE_THRESHOLD) {
        return [
            {
                transform: `translate3d(${offset_x_px}px, ${offset_y_px}px, 0) scale(${initial_scale})`,
                offset: 0,
                easing: MOVE_EASING,
            },
            {
                transform: "translate3d(0px, 0px, 0) scale(.975)",
                offset: .7,
                easing: "cubic-bezier(.22, .8, .36, 1)",
            },
            {
                transform: "translate3d(0px, 0px, 0) scale(1.012)",
                offset: .86,
                easing: MOVE_EASING,
            },
            {
                transform: "translate3d(0px, 0px, 0) scale(1)",
                offset: 1,
            },
        ];
    }

    return [
        {
            transform: `translate3d(${offset_x_px}px, ${offset_y_px}px, 0) scale(${initial_scale})`,
            offset: 0,
            easing: MOVE_EASING,
        },
        {
            transform: "translate3d(0px, 0px, 0) scale(.988)",
            offset: .82,
            easing: MOVE_EASING,
        },
        {
            transform: "translate3d(0px, 0px, 0) scale(1)",
            offset: 1,
        },
    ];
}

export function get_drag_tilt_degrees(
    distance_x_px: number,
    elapsed_ms: number,
): number {
    const velocity_px_per_ms = distance_x_px / Math.max(
        elapsed_ms,
        1,
    );

    return Math.max(
        -MAXIMUM_TILT_DEGREES,
        Math.min(
            MAXIMUM_TILT_DEGREES,
            velocity_px_per_ms * MAXIMUM_TILT_DEGREES,
        ),
    );
}
