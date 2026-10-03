import { Badge, } from "../component/badge";
import { Button, } from "../component/button";
import { Card, CardContent, CardHeader, } from "../component/card";
import { Input, } from "../component/input";
import { Label, } from "../component/label";
import { NativeSelect, NativeSelectOption, } from "../component/native_select";
import { Separator, } from "../component/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger, } from "../component/tabs";
import { Textarea, } from "../component/textarea";
import {
    ErrorControls,
    EventInspector,
    InspectionPanel,
    LayoutControls,
    MarkEditor,
    PgnControls,
    PositionControls,
    StyleControls,
} from "../inspection/inspection_controls";
import { BoundButton, BoundSlider, BoundSwitch, } from "./control_bindings";

import { CustomizationControls, } from "./customization";
import { EffectsControls, } from "./effects";

export function PlaygroundControls() {
    return (
        <Card>
            <CardHeader>
                <p className="playground_kicker">Playground</p>
                <h1 className="playground_title">Chessboard</h1>
            </CardHeader>
            <CardContent className="space-y-4">
                <Tabs defaultValue="play" orientation="horizontal" className="flex-col gap-4">
                    <div className="flex items-center justify-start gap-2">
                        <Badge id="turn_indicator" role="status" aria-live="polite">
                            White to move
                        </Badge>
                        <Button type="button" id="restart_button" size="xs" hidden={true}>
                            Restart
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" id="undo_button" title="Undo move (Left or Down)" aria-keyshortcuts="ArrowLeft ArrowDown">
                            Undo
                        </Button>
                        <Button type="button" id="redo_button" title="Redo move (Up or Right)" aria-keyshortcuts="ArrowUp ArrowRight">
                            Redo
                        </Button>
                        <Button type="button" id="flip_button" title="Flip board">
                            Flip
                        </Button>
                        <Button type="button" id="reset_button" title="Start a new game">
                            Reset
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground" id="feedback" role="status" aria-live="polite">
                        Ready to play.
                    </p>
                    <Label className="flex items-center justify-between gap-4">
                        Mute sounds
                        <BoundSwitch id="mute_toggle" is_checked={false} />
                    </Label>
                    <TabsList className="control_tabs" aria-label="Control groups">
                        <TabsTrigger type="button" id="play_tab" value="play">Play</TabsTrigger>
                        <TabsTrigger type="button" id="setup_tab" value="setup">Position &amp; Replay</TabsTrigger>
                        <TabsTrigger type="button" id="customize_tab" value="customize">Customize</TabsTrigger>
                        <TabsTrigger type="button" value="effects">Effects</TabsTrigger>
                        <TabsTrigger type="button" id="marks_tab" value="marks">Annotations</TabsTrigger>
                        <TabsTrigger type="button" value="inspect">Inspect</TabsTrigger>
                        <TabsTrigger type="button" id="events_tab" value="events">Events</TabsTrigger>
                    </TabsList>
                    <div className="control_panels min-w-0 flex-1">
                        <InspectionPanel />
                        <EffectsControls />
                        <TabsContent className="space-y-4" id="play_panel" value="play" keepMounted={true}>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <h3 className="font-medium">
                                    Make a Move
                                </h3>
                            </div>
                            <form id="move_form" className="space-y-4">
                                <div className="grid min-w-0 gap-3 grid-cols-2 sm:grid-cols-3">
                                    <Label className="grid min-w-0 gap-2">
                                        From
                                        <Input id="move_from" name="from" maxLength={2} placeholder="e2" autoComplete="off" spellCheck="false" required={true} />
                                    </Label>
                                    <Label className="grid min-w-0 gap-2">
                                        To
                                        <Input id="move_to" name="to" maxLength={2} placeholder="e4" autoComplete="off" spellCheck="false" required={true} />
                                    </Label>
                                    <Label className="grid min-w-0 gap-2">
                                        Promote
                                        <NativeSelect className="w-full" id="move_promotion" name="promotion" defaultValue="q">
                                            <NativeSelectOption value="q">
                                                Queen
                                            </NativeSelectOption>
                                            <NativeSelectOption value="r">
                                                Rook
                                            </NativeSelectOption>
                                            <NativeSelectOption value="b">
                                                Bishop
                                            </NativeSelectOption>
                                            <NativeSelectOption value="n">
                                                Knight
                                            </NativeSelectOption>
                                        </NativeSelect>
                                    </Label>
                                </div>
                                <Button type="submit">
                                    Play move
                                </Button>
                            </form>
                            <form id="uci_form" className="space-y-4 mt-4">
                                <Label className="grid min-w-0 gap-2">
                                    UCI move
                                    <Input id="uci_input" placeholder="e2e4 or a7a8q" autoComplete="off" spellCheck="false" required={true} />
                                </Label>
                                <Button type="submit">
                                    Play UCI move
                                </Button>
                            </form>
                            <Label className="grid gap-2 mt-4">
                                UCI position command
                                <Textarea id="uci_position" rows={3} readOnly={true} spellCheck="false" />
                            </Label>
                            <Button type="button" id="copy_uci_button">
                                Copy UCI position
                            </Button>
                            <Separator />
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <h3 className="font-medium">
                                    Premoves
                                </h3>
                            </div>
                            <div className="grid gap-3 grid-cols-2">
                                <Label className="grid min-w-0 gap-2">
                                    Type
                                    <NativeSelect className="w-full" id="premove_type" defaultValue="disabled">
                                        <NativeSelectOption value="disabled">
                                            Disabled
                                        </NativeSelectOption>
                                        <NativeSelectOption value="">
                                            Either side
                                        </NativeSelectOption>
                                        <NativeSelectOption value="w">
                                            White
                                        </NativeSelectOption>
                                        <NativeSelectOption value="b">
                                            Black
                                        </NativeSelectOption>
                                    </NativeSelect>
                                </Label>
                                <Label className="grid min-w-0 gap-2">
                                    Queued moves
                                    <output id="premove_output">
                                        None
                                    </output>
                                </Label>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" id="queue_premove_button">
                                    Queue from fields
                                </Button>
                                <Button type="button" id="clear_premove_button">
                                    Clear
                                </Button>
                            </div>
                            <Separator />
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <h3 className="font-medium">
                                    Playback
                                </h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <BoundButton type="button" id="play_sample_button">
                                    Play sample
                                </BoundButton>
                                <BoundButton type="button" id="stop_sample_button" disabled={true}>
                                    Stop
                                </BoundButton>
                            </div>
                        </TabsContent>
                        <TabsContent className="space-y-4" id="customize_panel" value="customize" keepMounted={true}>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <h3 className="font-medium">
                                    Board
                                </h3>
                            </div>
                            <Label className="grid min-w-0 gap-2">
                                Board colors
                                <NativeSelect className="w-full" id="theme_select" defaultValue="brown">
                                    <NativeSelectOption value="brown">
                                        Brown
                                    </NativeSelectOption>
                                    <NativeSelectOption value="sage">
                                        Sage
                                    </NativeSelectOption>
                                    <NativeSelectOption value="slate">
                                        Slate
                                    </NativeSelectOption>
                                    <NativeSelectOption value="linen">
                                        Linen
                                    </NativeSelectOption>
                                </NativeSelect>
                            </Label>
                            <Label className="grid min-w-0 gap-2">
                                View from
                                <NativeSelect className="w-full" id="orientation_select" defaultValue="white">
                                    <NativeSelectOption value="white">
                                        White
                                    </NativeSelectOption>
                                    <NativeSelectOption value="black">
                                        Black
                                    </NativeSelectOption>
                                </NativeSelect>
                            </Label>
                            <Label className="grid min-w-0 gap-2">
                                Captured-piece display
                                <NativeSelect className="w-full" id="capture_display_select" defaultValue="stacked">
                                    <NativeSelectOption value="counts">Piece counts</NativeSelectOption>
                                    <NativeSelectOption value="stacked">Stacked pieces</NativeSelectOption>
                                </NativeSelect>
                            </Label>
                            <h3 className="font-medium">Animation</h3>
                            <Label className="grid min-w-0 gap-2">
                                Move animation
                                <output id="animation_output">
                                    260 ms
                                </output>
                                <BoundSlider id="animation_range" min={0} max={500} step={20} initial_value={260} aria-label="Move animation" />
                            </Label>
                            <Separator />
                            <Label className="flex flex-wrap items-center justify-between gap-4">
                                <span>
                                    Allow interaction
                                </span>
                                <BoundSwitch id="interactive_toggle" is_checked={true} />
                            </Label>
                            <Label className="flex flex-wrap items-center justify-between gap-4">
                                <span>
                                    Coordinates
                                </span>
                                <BoundSwitch id="coordinates_toggle" is_checked={true} />
                            </Label>
                            <Label className="flex flex-wrap items-center justify-between gap-4">
                                <span>
                                    Captured pieces
                                </span>
                                <BoundSwitch id="captures_toggle" is_checked={true} />
                            </Label>
                            <Label className="flex flex-wrap items-center justify-between gap-4">
                                <span>
                                    Legal move hints
                                </span>
                                <BoundSwitch id="legal_toggle" is_checked={true} />
                            </Label>
                            <Label className="flex flex-wrap items-center justify-between gap-4">
                                <span>
                                    Last move
                                </span>
                                <BoundSwitch id="last_move_toggle" is_checked={true} />
                            </Label>
                            <LayoutControls />
                            <StyleControls />
                            <Button id="test_reset_options">Reset options</Button>
                            <Separator />
                            <CustomizationControls />
                        </TabsContent>
                        <TabsContent className="space-y-4" id="setup_panel" value="setup" keepMounted={true}>
                            <Label className="grid min-w-0 gap-2">
                                FEN position
                                <Textarea id="fen_input" rows={3} spellCheck="false" aria-label="FEN position" />
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" id="load_fen_button">
                                    Load FEN
                                </Button>
                                <Button type="button" id="copy_fen_button">
                                    Copy FEN
                                </Button>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-sm text-muted-foreground">
                                <Button type="button" id="current_fen_button">
                                    Use current FEN
                                </Button>
                            </div>
                            <Label className="grid gap-2 mt-4">
                                PGN game
                                <Textarea id="pgn_input" rows={5} spellCheck="false" placeholder="Paste a PGN game, including optional headers." aria-label="PGN game" />
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" id="load_pgn_button">
                                    Load replay
                                </Button>
                                <Button type="button" id="copy_pgn_button">
                                    Copy PGN
                                </Button>
                            </div>
                            <section className="space-y-4" aria-label="Game Replay">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                    <h3 id="replay_title" className="font-medium">
                                        Game Replay
                                    </h3>
                                    <span id="replay_progress">
                                        No game loaded
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <BoundButton type="button" id="replay_start" aria-label="First position" title="First position" disabled={true}>
                                        ⏮
                                    </BoundButton>
                                    <BoundButton type="button" id="replay_previous" aria-label="Previous move" title="Previous move" disabled={true}>
                                        ‹
                                    </BoundButton>
                                    <BoundButton type="button" id="replay_play" disabled={true}>
                                        Play
                                    </BoundButton>
                                    <BoundButton type="button" id="replay_next" aria-label="Next move" title="Next move" disabled={true}>
                                        ›
                                    </BoundButton>
                                    <BoundButton type="button" id="replay_end" aria-label="Final position" title="Final position" disabled={true}>
                                        ⏭
                                    </BoundButton>
                                </div>
                                <BoundSlider id="replay_range" min={0} max={0} step={1} aria-label="Replay position" disabled={true} initial_value={0} />
                                <Label className="grid min-w-0 gap-2">
                                    Playback speed
                                    <NativeSelect className="w-full" id="replay_speed" defaultValue="800">
                                        <NativeSelectOption value="1600">
                                            Slow
                                        </NativeSelectOption>
                                        <NativeSelectOption value="800">
                                            Normal
                                        </NativeSelectOption>
                                        <NativeSelectOption value="400">
                                            Fast
                                        </NativeSelectOption>
                                    </NativeSelect>
                                </Label>
                                <div id="replay_moves" className="flex flex-wrap gap-2" aria-label="Game moves">
                                </div>
                            </section>
                            <Separator />
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <h3 className="font-medium">
                                    Positions
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button type="button" data-preset="start">
                                    Starting position
                                </Button>
                                <Button type="button" data-preset="castling">
                                    Castling
                                </Button>
                                <Button type="button" data-preset="en_passant">
                                    En passant
                                </Button>
                                <Button type="button" data-preset="promotion">
                                    Promotion
                                </Button>
                                <Button type="button" data-preset="checkmate">
                                    Checkmate
                                </Button>
                                <Button type="button" data-preset="stalemate">
                                    Stalemate
                                </Button>
                            </div>
                            <Separator />
                            <PositionControls />
                            <PgnControls />
                        </TabsContent>
                        <TabsContent className="space-y-4" id="marks_panel" value="marks" keepMounted={true}>
                            <MarkEditor />
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <h3 className="font-medium">
                                    Annotations
                                </h3>
                            </div>
                            <form id="mark_form" className="space-y-4">
                                <div className="grid gap-3 grid-cols-2">
                                    <Label className="grid min-w-0 gap-2">
                                        From
                                        <Input id="mark_from" maxLength={2} placeholder="e2" autoComplete="off" spellCheck="false" required={true} />
                                    </Label>
                                    <Label className="grid min-w-0 gap-2">
                                        To
                                        <span className="text-muted-foreground">
                                            optional
                                        </span>
                                        <Input id="mark_to" maxLength={2} placeholder="e4" autoComplete="off" spellCheck="false" />
                                    </Label>
                                </div>
                                <div className="grid gap-3 grid-cols-2">
                                    <Label className="grid min-w-0 gap-2">
                                        Color
                                        <NativeSelect className="w-full" id="mark_color" defaultValue="amber">
                                            <NativeSelectOption value="amber">
                                                Amber
                                            </NativeSelectOption>
                                            <NativeSelectOption value="blue">
                                                Blue
                                            </NativeSelectOption>
                                            <NativeSelectOption value="green">
                                                Green
                                            </NativeSelectOption>
                                            <NativeSelectOption value="red">
                                                Red
                                            </NativeSelectOption>
                                        </NativeSelect>
                                    </Label>
                                    <Label className="grid min-w-0 gap-2">
                                        Source
                                        <NativeSelect className="w-full" id="mark_source" defaultValue="user">
                                            <NativeSelectOption value="user">
                                                User
                                            </NativeSelectOption>
                                            <NativeSelectOption value="engine">
                                                Engine
                                            </NativeSelectOption>
                                        </NativeSelect>
                                    </Label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="submit">
                                        Add mark
                                    </Button>
                                    <Button type="button" id="clear_marks_button">
                                        Clear all
                                    </Button>
                                </div>
                            </form>
                            <p className="text-sm text-muted-foreground" id="marks_count">
                                No marks
                            </p>
                        </TabsContent>
                        <TabsContent className="space-y-4" id="events_panel" value="events" keepMounted={true}>
                            <EventInspector />
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <h3 className="font-medium">
                                    Board State
                                </h3>
                            </div>
                            <dl className="grid gap-3 text-sm [&>div]:flex [&>div]:justify-between [&>div]:gap-4 [&_dt]:text-muted-foreground [&_dd]:text-right">
                                <div>
                                    <dt>
                                        Turn
                                    </dt>
                                    <dd id="state_turn">
                                        White
                                    </dd>
                                </div>
                                <div>
                                    <dt>
                                        Status
                                    </dt>
                                    <dd id="state_status">
                                        In play
                                    </dd>
                                </div>
                                <div>
                                    <dt>
                                        Legal moves
                                    </dt>
                                    <dd id="state_legal">
                                        20
                                    </dd>
                                </div>
                                <div>
                                    <dt>
                                        Selected square
                                    </dt>
                                    <dd id="state_selected">
                                        None
                                    </dd>
                                </div>
                                <div>
                                    <dt>
                                        Moves from square
                                    </dt>
                                    <dd id="state_square_moves">
                                        Select a piece
                                    </dd>
                                </div>
                                <div>
                                    <dt>
                                        Marks
                                    </dt>
                                    <dd id="state_marks">
                                        0
                                    </dd>
                                </div>
                            </dl>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm mt-6">
                                <h3 className="font-medium">
                                    Event Log
                                </h3>
                                <Button type="button" id="clear_log_button">
                                    Clear
                                </Button>
                            </div>
                            <ol className="space-y-3 text-sm [&_li]:grid [&_li]:gap-1 [&_time]:text-xs [&_time]:text-muted-foreground [&_span]:break-all" id="event_log" tabIndex={0} aria-label="Recent board events" />
                            <ErrorControls />
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    );
}
