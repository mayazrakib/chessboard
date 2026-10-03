import type { Move, } from "chess.js";
import { flushSync, } from "react-dom";
import { createRoot, type Root, } from "react-dom/client";

import { Button, } from "../component/button";

export { PgnReplay, } from "../../src/replay.js";

const REPLAY_ROOTS = new WeakMap<
    HTMLElement,
    Root
>();

export function render_replay_buttons(
    container: HTMLElement,
    moves: readonly Move[],
    seek_replay: (index: number,) => void,
    empty_message: string,
): void {
    let root = REPLAY_ROOTS.get(container,);

    if (!root) {
        root = createRoot(container,);
        REPLAY_ROOTS.set(
            container,
            root,
        );
    }

    const controls = moves.length ? moves.map((
        move,
        index,
    ) => (
        <Button key={index} type="button" data-replay_index={index + 1} onClick={() => seek_replay(index + 1,)}>
            {move.before.split(" ",)[5]}{move.color === "w" ? "." : "…"} {move.san}
        </Button>
    ),) : <p className="text-sm text-muted-foreground">{empty_message}</p>;
    flushSync(() => root.render(controls,),);
}
