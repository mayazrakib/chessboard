import type { Piece, PieceSymbol, } from "chess.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const PIECE_NAMES: Record<
    PieceSymbol,
    string
> = {
    k: "king",
    q: "queen",
    r: "rook",
    b: "bishop",
    n: "knight",
    p: "pawn",
};

export function create_piece_art(
    piece: Piece,
    sprite_url: string,
): SVGSVGElement {
    const svg = document.createElementNS(
        SVG_NAMESPACE,
        "svg",
    );
    const sprite_reference = document.createElementNS(
        SVG_NAMESPACE,
        "use",
    );
    const color = piece.color === "w" ? "white" : "black";
    svg.setAttribute(
        "viewBox",
        "0 0 45 45",
    );
    svg.setAttribute(
        "focusable",
        "false",
    );
    const reference = `${sprite_url}#${color}-${PIECE_NAMES[piece.type]}`;
    sprite_reference.setAttribute(
        "href",
        reference,
    );
    sprite_reference.setAttributeNS(
        "http://www.w3.org/1999/xlink",
        "xlink:href",
        reference,
    );
    svg.append(sprite_reference,);

    return svg;
}

export function get_piece_name(piece: Piece,): string {
    return `${piece.color === "w" ? "white" : "black"} ${PIECE_NAMES[piece.type]}`;
}

export function get_promotion_name(piece: PieceSymbol,): string {
    return PIECE_NAMES[piece];
}

const PICKUP_PADDING_PX = 4;

export function is_point_over_piece(
    piece: HTMLElement,
    x: number,
    y: number,
): boolean {
    const artwork = piece.firstElementChild ?? piece;
    let bounds = artwork.getBoundingClientRect();
    const vector = artwork as SVGGraphicsElement;

    if (typeof vector.getBBox === "function" && typeof vector.getScreenCTM === "function") {
        const box = vector.getBBox();
        const matrix = vector.getScreenCTM();

        if (matrix && box.width > 0 && box.height > 0) {
            const corners = [
                [box.x, box.y,],
                [box.x + box.width, box.y,],
                [box.x, box.y + box.height,],
                [box.x + box.width, box.y + box.height,],
            ] as const;
            const horizontal = corners.map(([x, y,],) => matrix.a * x + matrix.c * y + matrix.e,);
            const vertical = corners.map(([x, y,],) => matrix.b * x + matrix.d * y + matrix.f,);
            const left = Math.min(...horizontal,);
            const top = Math.min(...vertical,);
            bounds = new DOMRect(
                left,
                top,
                Math.max(...horizontal,) - left,
                Math.max(...vertical,) - top,
            );
        }
    }

    return bounds.width > 0 && bounds.height > 0
        && x >= bounds.left - PICKUP_PADDING_PX && x <= bounds.right + PICKUP_PADDING_PX
        && y >= bounds.top - PICKUP_PADDING_PX && y <= bounds.bottom + PICKUP_PADDING_PX;
}
