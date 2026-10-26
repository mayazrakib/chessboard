import { flushSync, } from "react-dom";
import { createRoot, } from "react-dom/client";

import { PlaygroundControls, } from "../controls/controls";
import "../style.css";

const container = document.getElementById("controls",);

if (!container) {
    throw new Error("Failed to find the playground controls container.",);
}

container.replaceChildren();
flushSync(() => createRoot(container,).render(<PlaygroundControls />,),);
container.removeAttribute("aria-busy",);
await import("../main",);
