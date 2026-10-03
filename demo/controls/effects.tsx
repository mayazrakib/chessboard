import type { BoardSound, } from "../../src/core";
import { Button, } from "../component/button";
import { TabsContent, } from "../component/tabs";

const SOUNDS: BoardSound[] = ["move", "capture", "check", "checkmate", "draw", "win", "lose",];

export function EffectsControls() {
    return (
        <TabsContent value="effects" className="space-y-4" keepMounted={true}>
            <h3 className="font-medium">Sounds</h3>
            <div className="flex flex-wrap gap-2" aria-label="Sound previews">
                {SOUNDS.map((sound,) => (
                    <Button type="button" key={sound} variant="outline" onClick={() => document.querySelector("meson-chessboard",)!.play_sound(sound,)}>
                        Play {sound}
                    </Button>
                ),)}
            </div>
            <h3 className="font-medium">Board effects</h3>
            <div className="flex flex-wrap gap-2" aria-label="Visual effect previews">
                <Button type="button" variant="outline" data-preset="check" data-replay-effect="true">Preview check</Button>
                <Button type="button" variant="outline" data-preset="checkmate" data-replay-effect="true">Preview White wins</Button>
                <Button type="button" variant="outline" data-preset="black_checkmate" data-replay-effect="true">Preview Black wins</Button>
            </div>
        </TabsContent>
    );
}
