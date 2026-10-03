import { type ComponentProps, useEffect, useRef, useState, useSyncExternalStore, } from "react";

import { Button, } from "../component/button";
import { Slider, } from "../component/slider";
import { Switch, } from "../component/switch";

type ControlState = {
    is_checked?: boolean;
    value?: number;
    maximum?: number;
    is_disabled?: boolean;
    value_text?: string;
    label?: string;
};

const CONTROL_STATES = new Map<
    string,
    ControlState
>();
const CONTROL_LISTENERS = new Map<
    string,
    Set<() => void>
>();

export function update_control(
    identifier: string,
    changes: ControlState,
): void {
    const previous = CONTROL_STATES.get(identifier,) ?? {};

    if (Object.entries(changes,).every(([key, value,],) => previous[key as keyof ControlState] === value,)) {
        return;
    }

    CONTROL_STATES.set(
        identifier,
        {
            ...previous,
            ...changes,
        },
    );
    CONTROL_LISTENERS.get(identifier,)?.forEach((listener,) => listener(),);
}

function use_control(
    identifier: string,
    initial_state: ControlState,
): ControlState {
    if (!CONTROL_STATES.has(identifier,)) {
        CONTROL_STATES.set(
            identifier,
            initial_state,
        );
    }

    return useSyncExternalStore(
        (listener,) => {
            const listeners = CONTROL_LISTENERS.get(identifier,) ?? new Set<() => void>();
            CONTROL_LISTENERS.set(
                identifier,
                listeners,
            );
            listeners.add(listener,);

            return () => listeners.delete(listener,);
        },
        () => CONTROL_STATES.get(identifier,)!,
    );
}

function emit_control_change(
    identifier: string,
    changes: ControlState,
): void {
    update_control(
        identifier,
        changes,
    );
    document.getElementById(identifier,)?.dispatchEvent(new CustomEvent(
        "controlchange",
        { detail: changes, },
    ),);
}

export function BoundSwitch({ id, is_checked, }: {
    id: string;
    is_checked: boolean
},) {
    const state = use_control(
        id,
        { is_checked, },
    );

    return <Switch id={id} checked={state.is_checked} onCheckedChange={(is_checked,) => emit_control_change(
        id,
        { is_checked, },
    )} />;
}

export function BoundSlider({ id, initial_value, min, max, step, disabled, "aria-label": label, }: {
    id: string;
    initial_value: number;
    min: number;
    max: number;
    step: number;
    disabled?: boolean;
    "aria-label": string;
},) {
    const state = use_control(
        id,
        {
            value: initial_value,
            maximum: max,
            is_disabled: disabled,
        },
    );
    const container = useRef<HTMLDivElement>(null,);
    const [mount_revision, set_mount_revision,] = useState(0,);
    useEffect(
        () => {
            const element = container.current;

            if (!element) {
                return;
            }

            let was_visible = false;
            const observer = new ResizeObserver(([entry,],) => {
                const is_visible = (entry?.contentRect.width ?? 0) > 0;

                if (is_visible && !was_visible) {
                    set_mount_revision((revision,) => revision + 1,);
                }

                was_visible = is_visible;
            },);
            observer.observe(element,);

            return () => observer.disconnect();
        },
        [],
    );

    return (
        <div id={id} ref={container} className="min-w-0 py-2">
            <Slider
                key={mount_revision}
                value={[state.value ?? initial_value,]}
                min={min}
                max={Math.max(
                    min + step,
                    state.maximum ?? max,
                )}
                step={step}
                disabled={state.is_disabled}
                aria-label={label}
                aria-valuetext={state.value_text}
                onValueChange={(values,) => emit_control_change(
                    id,
                    { value: Array.isArray(values,) ? values[0] : values, },
                )}
            />
        </div>
    );
}

export function BoundButton({ id, disabled, children, ...props }: ComponentProps<typeof Button> & { id: string },) {
    const state = use_control(
        id,
        { is_disabled: disabled, },
    );

    return <Button {...props} id={id} disabled={state.is_disabled}>{state.label ?? children}</Button>;
}
