import { Button, } from "../component/button";
import { Input, } from "../component/input";
import { Label, } from "../component/label";
import { NativeSelect, NativeSelectOption, } from "../component/native_select";
import { TabsContent, } from "../component/tabs";
import { Textarea, } from "../component/textarea";
import { BOARD_EVENTS, STYLE_PROPERTIES, TEST_POSITIONS, } from "./inspection_catalog";

export function InspectionPanel() {
    return (
        <>
            <TabsContent value="inspect" keepMounted={true} className="space-y-4">
                <h3 className="font-medium">State Inspector</h3>
                <Label className="grid gap-2">
                    Legal moves from square
                    <Input id="inspect_square" placeholder="All squares, or e2" maxLength={2} />
                </Label>
                <div className="flex flex-wrap gap-2">
                    <Button id="inspect_refresh">Refresh snapshot</Button>
                    <Button id="inspect_download">Download snapshot</Button>
                    <Button id="inspect_focus">Focus square</Button>
                </div>
                <p id="inspect_feedback" role="status" className="text-sm text-muted-foreground" />
                {[
                    ["status", "Status and Options",],
                    ["moves", "Legal Moves and History",],
                    ["position", "FEN, PGN, and UCI",],
                    ["marks", "Marks and Premove",],
                    ["rendered", "Geometry, Material, and Accessibility",],
                    ["styles", "Computed CSS Properties",],
                ].map(([key, label,],) => (
                    <details key={key} className="inspection_details" open={key === "status"}>
                        <summary>{label}</summary>
                        <pre id={`inspect_${key}`} className="inspection_json" />
                    </details>
                ),)}
                <Label className="flex items-center gap-2">
                    <input id="inspect_pointer_enabled" type="checkbox" />
                    Record pointer diagnostics
                </Label>
                <pre id="inspect_pointer" className="inspection_json">
                    Pointer recording is off.
                </pre>
                <AttributeControls />
                <LifecycleControls />
                <IndependentBoardControls />
            </TabsContent>
        </>
    );
}

export function EventInspector() {
    return (
        <details className="inspection_details">
            <summary>Full Event Payloads</summary>
            <Label className="grid gap-2">
                Event filter
                <NativeSelect id="inspect_event_filter">
                    <NativeSelectOption value="all">All board events</NativeSelectOption>
                    {BOARD_EVENTS.map((name,) => (
                        <NativeSelectOption key={name} value={name}>
                            {name}
                        </NativeSelectOption>
                    ),)}
                </NativeSelect>
            </Label>
            <Label className="flex items-center gap-2">
                <input id="inspect_events_paused" type="checkbox" />
                Pause event recording
            </Label>
            <div className="flex flex-wrap gap-2">
                <Button id="inspect_events_clear">Clear payloads</Button>
                <Button id="inspect_events_download">Download events</Button>
            </div>
            <pre id="inspect_events" className="inspection_json" />
        </details>
    );
}

export function MarkEditor() {
    return (
        <details className="inspection_details">
            <summary>Replace or Remove Annotations</summary>
            <Label className="grid gap-2">
                Marks JSON
                <Textarea
                    id="inspect_marks_input"
                    rows={5}
                    defaultValue={'[{"from":"e2","to":"e4","color":"blue","source":"engine"}]'}
                />
            </Label>
            <div className="flex flex-wrap gap-2">
                <Button id="inspect_marks_current">Use current marks</Button>
                <Button id="inspect_marks_apply">Replace marks</Button>
                <Button id="inspect_marks_user">Clear user marks</Button>
                <Button id="inspect_marks_engine">Clear engine marks</Button>
            </div>
        </details>
    );
}

export function PositionControls() {
    return (
        <div className="space-y-4">
            <h3 className="font-medium">Position Scenarios</h3>
            <Label className="grid gap-2">
                Position scenario
                <NativeSelect id="test_position">
                    {TEST_POSITIONS.map((position,) => (
                        <NativeSelectOption key={position.key} value={position.key}>
                            {position.label}
                        </NativeSelectOption>
                    ),)}
                </NativeSelect>
            </Label>
            <div className="flex flex-wrap gap-2">
                <Button id="test_load">Load position</Button>
            </div>
        </div>
    );
}

export function LayoutControls() {
    return (
        <details className="inspection_details">
            <summary>Board Layout</summary>
            <Label className="grid gap-2">
                Board width in pixels
                <input
                    className="inspection_input"
                    id="test_width"
                    type="number"
                    min="160"
                    max="1200"
                    step="0.25"
                    placeholder="Responsive"
                />
            </Label>
            <Label className="grid gap-2">
                CSS zoom
                <input
                    className="inspection_input"
                    id="test_zoom"
                    type="number"
                    min="0.25"
                    max="2"
                    step="0.05"
                    defaultValue="1"
                />
            </Label>
            <div className="flex flex-wrap gap-2">
                <Button id="test_layout">Apply layout</Button>
                <Button id="test_layout_reset">Reset layout</Button>
            </div>
        </details>
    );
}

export function LifecycleControls() {
    return (
        <details className="inspection_details">
            <summary>Board Lifecycle</summary>
            <div className="flex flex-wrap gap-2">
                <Button id="test_reconnect">Reconnect board</Button>
                <Button id="test_hidden">Toggle hidden</Button>
            </div>
        </details>
    );
}

export function IndependentBoardControls() {
    return (
        <details className="inspection_details">
            <summary>Independent Board Instance</summary>
            <div className="flex flex-wrap gap-2">
                <Button id="test_second_create">Create second board</Button>
                <Button id="test_second_remove">Remove second board</Button>
            </div>
            <div id="test_second_board" />
        </details>
    );
}

export function AttributeControls() {
    return (
        <details className="inspection_details">
            <summary>Attributes</summary>
            <Label className="grid gap-2">
                Attribute
                <NativeSelect id="test_attribute">
                    {["orientation", "theme", "readonly", "coordinates", "fen",].map(
                        (name,) => (
                            <NativeSelectOption key={name} value={name}>
                                {name}
                            </NativeSelectOption>
                        ),
                    )}
                </NativeSelect>
            </Label>
            <Label className="grid gap-2">
                Attribute value
                <Input id="test_attribute_value" placeholder="For example: black" />
            </Label>
            <div className="flex flex-wrap gap-2">
                <Button id="test_attribute_apply">Set attribute</Button>
                <Button id="test_attribute_remove">Remove attribute</Button>
            </div>
        </details>
    );
}

export function StyleControls() {
    return (
        <details className="inspection_details">
            <summary>CSS Customization</summary>
            <Label className="grid gap-2">
                CSS property
                <NativeSelect id="test_style">
                    {STYLE_PROPERTIES.map((name,) => (
                        <NativeSelectOption key={name} value={name}>
                            --chessboard-{name}
                        </NativeSelectOption>
                    ),)}
                </NativeSelect>
            </Label>
            <Label className="grid gap-2">
                CSS value
                <Input id="test_style_value" placeholder="#b58863, 4px, or 150ms" />
            </Label>
            <div className="flex flex-wrap gap-2">
                <Button id="test_style_apply">Apply CSS</Button>
                <Button id="test_style_remove">Remove override</Button>
                <Button id="test_style_reset">Reset CSS overrides</Button>
            </div>
        </details>
    );
}

export function PgnControls() {
    return (
        <details className="inspection_details">
            <summary>Direct PGN Loading</summary>
            <Label className="grid gap-2">
                Direct PGN input
                <Textarea id="test_pgn" defaultValue="1. e4 e5 2. Nf3 Nc6" rows={3} />
            </Label>
            <Button id="test_pgn_load">Load final PGN position</Button>
        </details>
    );
}

export function ErrorControls() {
    return (
        <details className="inspection_details">
            <summary>Error Handling</summary>
            <div className="flex flex-wrap gap-2">
                <Button id="test_invalid_fen">Invalid FEN</Button>
                <Button id="test_invalid_pgn">Invalid PGN</Button>
                <Button id="test_invalid_uci">Invalid UCI</Button>
                <Button id="test_illegal_move">Illegal move</Button>
                <Button id="test_invalid_premove">Rejected premove</Button>
            </div>
        </details>
    );
}
