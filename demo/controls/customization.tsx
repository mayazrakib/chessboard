import { useEffect, useState, } from "react";

import type { ChessboardOptions, ResolvedChessboardOptions, } from "../../src/core";
import { Button, } from "../component/button";
import { Label, } from "../component/label";
import { Textarea, } from "../component/textarea";

const INPUT_CONTROLS = [
    ["can_drag", "Drag pieces",],
    ["can_click_move", "Click to move",],
    ["can_use_keyboard", "Keyboard controls",],
    ["can_draw_annotations", "Draw annotations",],
    ["can_premove", "Queue premoves",],
] as const;

export function CustomizationControls() {
    const [options, set_options,] = useState<ResolvedChessboardOptions | null>(null,);
    const [configuration_text, set_configuration_text,] = useState('{\n    "annotations": {\n        "clear_on_left_click": "user"\n    }\n}',);
    const [message, set_message,] = useState("",);
    const [message_tone, set_message_tone,] = useState("neutral",);

    function show_message(
        text: string,
        tone = "neutral",
    ): void {
        set_message(text,);
        set_message_tone(tone,);
    }

    useEffect(
        () => {
            let is_active = true;
            const board = document.querySelector("meson-chessboard",);
            const update = () => set_options(board!.get_options(),);
            void customElements.whenDefined("meson-chessboard",).then(() => {
                if (is_active && board) {
                    update();
                    board.addEventListener(
                        "chessboard:change",
                        update,
                    );
                }
            },);

            return () => {
                is_active = false;
                board?.removeEventListener(
                    "chessboard:change",
                    update,
                );
            };
        },
        [],
    );

    function update_options(changes: ChessboardOptions,) {
        try {
            document.querySelector("meson-chessboard",)!.set_options(changes,);
            show_message("Settings updated.",);
        } catch (error) {
            show_message(
                error instanceof Error ? error.message : String(error,),
                "error",
            );
        }
    }

    return (
        <div className="space-y-4">
            <h3 className="font-medium">Input</h3>
            {options && <>
                {INPUT_CONTROLS.map(([key, label,],) => (
                    <Label key={key} className="flex justify-between gap-3">
                        {label}
                        <input type="checkbox" checked={options.interaction[key]} onChange={(event,) => update_options({ interaction: { [key]: event.target.checked, }, },)} />
                    </Label>
                ),)}
                <Label className="grid gap-2">
                    Visual quality
                    <select aria-label="Visual quality" value={options.quality_profile} onChange={(event,) => update_options({ quality_profile: event.target.value as "full" | "balanced" | "minimal", },)}>
                        <option value="full">Full</option>
                        <option value="balanced">Balanced</option>
                        <option value="minimal">Minimal</option>
                    </select>
                </Label>
                <Label className="grid gap-2">
                    Touch interaction
                    <select aria-label="Touch interaction" value={options.interaction.touch_mode} onChange={(event,) => update_options({ interaction: { touch_mode: event.target.value as "move" | "annotate", }, },)}>
                        <option value="move">Move pieces</option>
                        <option value="annotate">Draw annotations</option>
                    </select>
                </Label>
                <h3 className="font-medium">Accessibility</h3>
                <Label className="flex justify-between gap-3">
                    Announce moves
                    <input type="checkbox" checked={options.accessibility.announce_moves} onChange={(event,) => update_options({ accessibility: { announce_moves: event.target.checked, }, },)} />
                </Label>
                <Label className="flex justify-between gap-3">
                    Announce annotations
                    <input type="checkbox" checked={options.accessibility.announce_annotations} onChange={(event,) => update_options({ accessibility: { announce_annotations: event.target.checked, }, },)} />
                </Label>
                <h3 className="font-medium">Sound</h3>
                <Label className="grid gap-2">
                    Sound volume
                    <input aria-label="Sound volume" type="range" min="0" max="1" step="0.05" value={options.sound.volume} onChange={(event,) => update_options({ sound: { volume: Number(event.target.value,), }, },)} />
                </Label>
                <Label className="grid gap-2">
                    Result sound perspective
                    <select aria-label="Result sound perspective" value={options.sound.player_color ?? "neutral"} onChange={(event,) => update_options({ sound: { player_color: event.target.value === "neutral" ? null : event.target.value as "w" | "b", }, },)}>
                        <option value="neutral">Neutral checkmate</option>
                        <option value="w">White player</option>
                        <option value="b">Black player</option>
                    </select>
                </Label>
                <Label className="grid gap-2">
                    Left-click annotation clearing
                    <select value={options.annotations.clear_on_left_click} onChange={(event,) => update_options({ annotations: { clear_on_left_click: event.target.value as "all" | "user" | "groups" | "none", }, },)}>
                        <option value="all">All annotations</option>
                        <option value="user">User annotations</option>
                        <option value="groups">Configured groups</option>
                        <option value="none">Keep annotations</option>
                    </select>
                </Label>
                <h3 className="font-medium">Pieces</h3>
                <Label className="grid gap-2">
                    Piece scale
                    <input aria-label="Piece scale" type="range" min="0.5" max="1.2" step="0.05" value={options.pieces.scale} onChange={(event,) => update_options({ pieces: { scale: Number(event.target.value,), }, },)} />
                </Label>
            </>}
            <h3 className="font-medium">Configuration examples</h3>
            <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => update_options({ renderers: { square_overlay: (context,) => context.square === "e4" ? "Target" : null, }, },)}>Show square overlay</Button>
                <Button type="button" variant="outline" onClick={() => update_options({ promotion: { mode: "automatic", default_piece: "n", }, },)}>Promote to knight</Button>
                <Button type="button" variant="outline" onClick={() => {
                    document.querySelector("meson-chessboard",)!.reset_options();
                    show_message("Settings restored to defaults.",);
                }}>Reset settings</Button>
            </div>
            <Label className="grid gap-2">
                Partial options as JSON
                <Textarea aria-label="Partial options as JSON" rows={10} value={configuration_text} onChange={(event,) => set_configuration_text(event.target.value,)} />
            </Label>
            <Button type="button" onClick={() => {
                try {
                    const changes: unknown = JSON.parse(configuration_text,);

                    if (!changes || typeof changes !== "object" || Array.isArray(changes,)) {
                        throw new TypeError("The configuration must be a JSON object.",);
                    }

                    update_options(changes as ChessboardOptions,);
                } catch (error) {
                    show_message(
                        error instanceof Error ? error.message : String(error,),
                        "error",
                    );
                }
            }}>Apply configuration</Button>
            <p id="customization_feedback" role="status" className="text-sm" data-tone={message_tone}>{message}</p>
        </div>
    );
}
