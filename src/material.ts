import type { Color, PieceSymbol, } from "chess.js";

import { type BoardLabels, DEFAULT_LABELS, type MaterialContext, } from "./configuration.js";
import { create_piece_art, get_promotion_name, } from "./pieces.js";
import type { RulesGame, } from "./rules.js";
import type { CapturedPieceDisplay, } from "./types.js";

const PIECE_POINTS: Record<
    PieceSymbol,
    number
> = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
};
const MATERIAL_SIGNATURES = new WeakMap<
    HTMLElement,
    string
>();
const CAPTURE_ORDER: PieceSymbol[] = ["p", "n", "b", "r", "q",];

type MaterialSummary = {
    piece_count: number;
    points: number;
    captures: PieceSymbol[];
};

export function render_material_rows(
    game: RulesGame,
    rows: Record<
        Color,
        HTMLElement
    >,
    captures: Record<
        Color,
        PieceSymbol[]
    >,
    display: CapturedPieceDisplay,
    sprite_url: string,
    presentation?: {
        labels: BoardLabels;
        render: ((context: MaterialContext,) => Node | string) | null;
        render_content: (
            render: () => Node | string,
            fallback: Node | string,
        ) => Node | string;
    },
): void {
    const summaries: Record<
        Color,
        MaterialSummary
    > = {
        w: {
            piece_count: 0,
            points: 0,
            captures: captures.w,
        },
        b: {
            piece_count: 0,
            points: 0,
            captures: captures.b,
        },
    };

    for (const rank of game.board()) {
        for (const piece of rank) {
            if (piece) {
                summaries[piece.color].piece_count += 1;
                summaries[piece.color].points += PIECE_POINTS[piece.type];
            }
        }
    }

    for (const color of ["w", "b",] as const) {
        const summary = summaries[color];
        const opponent = color === "w" ? "b" : "w";
        const difference = summary.points - summaries[opponent].points;
        const labels = presentation?.labels ?? DEFAULT_LABELS;
        const color_name = color === "w" ? labels.white : labels.black;
        const context = { ...summary, captures: [...summary.captures,], color, difference, };
        const point_unit = summary.points === 1 ? "point" : "points";
        const difference_unit = Math.abs(difference,) === 1 ? "point" : "points";
        const row = rows[color];
        const signature = `${sprite_url}:${display}:${summary.piece_count}:${summary.points}:${difference}:${summary.captures.join("",)}`;

        if (!presentation && MATERIAL_SIGNATURES.get(row,) === signature) {
            continue;
        }

        MATERIAL_SIGNATURES.set(
            row,
            signature,
        );
        row.className = "material_row";
        row.setAttribute(
            "part",
            "material",
        );
        row.dataset.color = color;
        row.dataset.capture_display = display;
        row.setAttribute(
            "role",
            "group",
        );
        row.setAttribute(
            "aria-label",
            labels.format_material_label(
                context,
                `${color_name}: ${summary.piece_count} pieces, ${summary.points} material ${point_unit}, ${difference === 0 ? "equal material" : `${Math.abs(difference,)} ${difference_unit} ${difference > 0 ? "ahead" : "behind"}`}. ${summary.captures.length} recorded ${summary.captures.length === 1 ? "capture" : "captures"}.`,
            ),
        );

        const identity = document.createElement("span",);
        identity.className = "material_identity";
        identity.textContent = color_name;

        const captures = document.createElement("span",);
        captures.className = "material_captures";
        captures.title = labels.captures_description;

        for (const type of CAPTURE_ORDER) {
            const count = summary.captures.filter((captured_type,) => captured_type === type,).length;

            if (count === 0) {
                continue;
            }

            const group = document.createElement("span",);
            group.className = "capture_group";
            const description = labels.format_capture(
                opponent,
                type,
                count,
                `${count} captured ${opponent === "w" ? "white" : "black"} ${get_promotion_name(type,)}${count === 1 ? "" : "s"}`,
            );
            group.setAttribute(
                "role",
                "img",
            );
            group.setAttribute(
                "aria-label",
                description,
            );
            group.title = description;
            const artwork_count = display === "stacked" ? count : 1;

            for (let index = 0; index < artwork_count; index += 1) {
                const artwork = create_piece_art(
                    {
                        color: opponent,
                        type,
                    },
                    sprite_url,
                );
                artwork.setAttribute(
                    "aria-hidden",
                    "true",
                );
                group.append(artwork,);
            }

            if (display === "counts" && count > 1) {
                const quantity = document.createElement("span",);
                quantity.className = "capture_quantity";
                quantity.textContent = String(count,);
                quantity.setAttribute(
                    "aria-hidden",
                    "true",
                );
                group.append(quantity,);
            }

            captures.append(group,);
        }

        if (summary.captures.length === 0) {
            captures.textContent = labels.no_captures;
        }

        const inventory = document.createElement("span",);
        inventory.className = "material_inventory";
        inventory.textContent = labels.format_material(context,);
        inventory.title = labels.material_description;

        const advantage = document.createElement("span",);
        advantage.className = "material_advantage";
        advantage.dataset.state = difference > 0 ? "ahead" : difference < 0 ? "behind" : "equal";
        advantage.textContent = difference > 0 ? `+${difference}` : difference < 0 ? `−${Math.abs(difference,)}` : "=";
        advantage.title = labels.format_advantage(
            difference,
            difference === 0 ? "Equal material." : `${Math.abs(difference,)} material ${difference_unit} ${difference > 0 ? "ahead" : "behind"}.`,
        );

        if (presentation?.render) {
            const rendered = presentation.render_content(
                () => presentation.render!(context,),
                inventory,
            );
            row.replaceChildren(rendered,);
            continue;
        }

        row.replaceChildren(
            identity,
            captures,
            inventory,
            advantage,
        );
    }
}
