import type { ChessboardOptions, } from "../api/types.js";
import { resolve_assets, } from "../infrastructure/assets.js";
import { QUALITY_PROFILES, THEMES, } from "../element/constants.js";

const BOOLEAN_OPTION_NAMES: (keyof ChessboardOptions)[] = [
    "interactive",
    "show_coordinates",
    "show_captured_pieces",
    "show_legal_moves",
    "show_last_move",
    "is_muted",
];
const ENUM_VALUES_BY_OPTION: Partial<Record<
    keyof ChessboardOptions,
    readonly string[]
>> = {
    orientation: ["white", "black",],
    theme: THEMES,
    quality_profile: QUALITY_PROFILES,
    captured_piece_display: ["counts", "stacked",],
    move_mode: ["automatic", "controlled",],
    event_detail: ["full", "compact",],
    playable_color: ["w", "b", "both",],
    premove_color: ["w", "b",],
};

export function validate_options(options: ChessboardOptions,): void {
    for (const key of Object.keys(options,) as (keyof ChessboardOptions)[]) {
        const option = options[key];

        if (option === undefined) {
            continue;
        }

        const allowed_values = ENUM_VALUES_BY_OPTION[key];

        if (allowed_values && !allowed_values.includes(String(option,),)) {
            throw new TypeError(`Failed to set options: ${key} is invalid.`,);
        }

        if (BOOLEAN_OPTION_NAMES.includes(key,) && typeof option !== "boolean") {
            throw new TypeError(`Failed to set options: ${key} must be a boolean.`,);
        }
    }

    if (options.piece_renderer !== undefined && typeof options.piece_renderer !== "function") {
        throw new TypeError("Failed to set options: piece_renderer must be a function.",);
    }

    if (options.assets) {
        resolve_assets(options.assets,);
    }
}
