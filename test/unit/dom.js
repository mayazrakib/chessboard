import { after, } from "node:test";

import { Window, } from "happy-dom";

export function create_dom_environment() {
    const browser_window = new Window({ url: "http://localhost", },);
    const original_properties = new Map();
    const names = [
        "CustomEvent",
        "DOMRect",
        "HTMLButtonElement",
        "HTMLElement",
        "cancelAnimationFrame",
        "customElements",
        "document",
        "requestAnimationFrame",
        "window",
    ];

    for (const name of names) {
        original_properties.set(
            name,
            Object.getOwnPropertyDescriptor(
                globalThis,
                name,
            ),
        );
        const browser_member = name === "window" ? browser_window : browser_window[name];
        Object.defineProperty(
            globalThis,
            name,
            {
                configurable: true,
                writable: true,
                value: name.endsWith("AnimationFrame",) ? browser_member.bind(browser_window,) : browser_member,
            },
        );
    }

    after(async () => {
        await browser_window.happyDOM.abort();
        browser_window.close();

        for (const [name, descriptor,] of original_properties) {
            if (descriptor) {
                Object.defineProperty(
                    globalThis,
                    name,
                    descriptor,
                );
            } else {
                delete globalThis[name];
            }
        }
    },);

    return browser_window;
}
