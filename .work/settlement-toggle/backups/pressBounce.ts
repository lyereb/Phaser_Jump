import { GameObjects, Input, Math as PhaserMath } from 'phaser';

const SHRINK_MS = 80;
const SPRING_MS = 280;
/** Shrink, then spring past the resting size. Same length as the main-menu button. */
export const PRESS_BOUNCE_MS = SHRINK_MS + SPRING_MS;
const TOKEN = 'pressBounceToken';
const REST_X = 'pressBounceRestX';
const REST_Y = 'pressBounceRestY';

type PressTarget = GameObjects.GameObject & {
    scaleX: number;
    scaleY: number;
    setScale(x: number, y?: number): unknown;
};

type PointerEvent = { stopPropagation: () => void };

/**
 * One press animation for every button: snap to the resting scale, shrink, then spring back.
 * Uses the display clock so a paused gameplay scene can still show the return button bounce.
 * `rest` is read each frame when layout can change the resting scale during the animation.
 */
export function playPressBounce (target: PressTarget, rest?: () => { x: number; y: number })
{
    const token = Number(target.getData(TOKEN) ?? 0) + 1;
    target.setData(TOKEN, token);
    if (!rest && target.getData(REST_X) === undefined)
    {
        target.setData(REST_X, target.scaleX);
        target.setData(REST_Y, target.scaleY);
    }

    const base = () =>
    {
        const next = rest?.();
        if (next && Number.isFinite(next.x) && Number.isFinite(next.y)) return next;
        return { x: Number(target.getData(REST_X)), y: Number(target.getData(REST_Y)) };
    };
    const started = performance.now();
    const initial = base();
    if (Number.isFinite(initial.x) && Number.isFinite(initial.y)) target.setScale(initial.x, initial.y);

    const step = () =>
    {
        if (target.getData(TOKEN) !== token || !target.scene) return;
        const elapsed = performance.now() - started;
        const size = base();
        if (!Number.isFinite(size.x) || !Number.isFinite(size.y)) return;

        let amount = 1;
        if (elapsed < SHRINK_MS)
        {
            amount = 1 - 0.14 * PhaserMath.Easing.Quadratic.In(elapsed / SHRINK_MS);
        }
        else if (elapsed < PRESS_BOUNCE_MS)
        {
            amount = 0.86 + 0.14 * PhaserMath.Easing.Back.Out((elapsed - SHRINK_MS) / SPRING_MS);
        }
        else
        {
            target.setScale(size.x, size.y);
            if (!rest)
            {
                target.setData(REST_X, undefined);
                target.setData(REST_Y, undefined);
            }
            return;
        }

        target.setScale(size.x * amount, size.y * amount);
        requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
}

/**
 * Press feedback plus the button action. The action waits until the spring finishes,
 * so a scene change does not cut the animation off. Releasing outside still counts:
 * the shrink itself would otherwise look like the pointer left the button.
 */
export function bindPressBounce (node: GameObjects.Container, action: () => void, enabled: () => boolean = () => true)
{
    let pointerId: number | null = null;
    let started = 0;
    let waiting = false;
    node.input!.cursor = 'pointer';

    const down = (pointer: Input.Pointer, _x: number, _y: number, event: PointerEvent) =>
    {
        event.stopPropagation();
        if (waiting || !enabled() || (pointer.button !== undefined && pointer.button !== 0)) return;
        pointerId = pointer.id;
        started = performance.now();
        playPressBounce(node);
    };
    const up = (pointer: Input.Pointer, _x: number, _y: number, event: PointerEvent) =>
    {
        event.stopPropagation();
        const activate = pointerId === pointer.id;
        pointerId = null;
        if (!activate || waiting || !enabled()) return;
        waiting = true;
        const wait = Math.max(0, PRESS_BOUNCE_MS - (performance.now() - started));
        const run = () =>
        {
            waiting = false;
            action();
        };
        if (wait === 0 || !node.scene) run();
        else node.scene.time.delayedCall(wait, run);
    };

    node.on('pointerdown', down);
    node.on('pointerup', up);
    node.on('pointerupoutside', up);
}
