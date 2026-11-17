/** Fixed camera, world-space travel: never scroll the sky or the UI camera. */
export const STREET = {
    horizon: 0.59,
    focal: 0.80,
    cameraHeight: 2.4,
    speed: 0.8,
    near: 1.0,
    spacing: 7.8,
    housesPerSide: 24,
    roadHalfWidth: 3.6,
    sidewalkOuter: 5.0,
    houseInner: 5.1,
    houseWidth: 5.5,
    dashSpacing: 7.8,
    dashLength: 2.4
} as const;

export const STREET_PERIOD = STREET.spacing * STREET.housesPerSide;
export const STREET_RECYCLE = STREET.near - STREET.spacing;
export const STREET_FAR = STREET_RECYCLE + STREET_PERIOD;
/** Original three storefronts plus the six added shop facades. */
export const FACADE_COUNT = 9;
const HOUSE_HEIGHTS = [6.8, 7.8, 5.8];

export type StreetView = { width: number; height: number; cx: number; horizon: number; focal: number };
export type StreetPoint = { x: number; y: number };
export type StreetHouse = { side: -1 | 1; slot: number; height: number; length: number; variant: number };

export function streetView (width: number, height: number): StreetView
{
    // Keep the road's vanishing point visible even in a very wide window.
    return { width, height, cx: width / 2, horizon: height * STREET.horizon, focal: height * STREET.focal };
}

export function projectStreet (view: StreetView, x: number, y: number, z: number): StreetPoint
{
    const scale = view.focal / Math.max(STREET.near, z);
    return { x: view.cx + x * scale, y: view.horizon + (STREET.cameraHeight - y) * scale };
}

export function positiveModulo (value: number, period: number)
{
    return ((value % period) + period) % period;
}

/** Recycle only after the far end has passed the camera, including in wide windows. */
export function houseDepth (house: StreetHouse, travel: number)
{
    const stagger = house.side === 1 ? STREET.spacing * 0.42 : 0;
    return STREET_RECYCLE + positiveModulo((house.slot + 1) * STREET.spacing + stagger - travel, STREET_PERIOD);
}

/** Preserve texture coordinates when clipping the near portion of a wall. */
export function visibleWallStart (house: StreetHouse, z: number)
{
    return Math.min(1, Math.max(0, (STREET.near - z) / house.length));
}

function pickFacade (random: () => number, forbidden: readonly number[]): number
{
    const blocked = new Set(forbidden);
    const choices: number[] = [];
    for (let variant = 0; variant < FACADE_COUNT; variant++)
    {
        if (!blocked.has(variant)) choices.push(variant);
    }
    const pool = choices.length > 0 ? choices : [ 0 ];
    return pool[Math.floor(random() * pool.length)];
}

/** Same slot and both staggered neighbors, so the two rows cannot line up. */
function facingFacades (opposite: readonly number[], slot: number): number[]
{
    const count = opposite.length;
    return [
        opposite[slot],
        opposite[(slot + 1) % count],
        opposite[(slot + count - 1) % count]
    ];
}

/** Circular row: every facade appears, and neighbors never repeat. */
function arrangeFacades (opposite: readonly number[] | null, random: () => number): number[]
{
    const count = STREET.housesPerSide;
    const order: number[] = [];
    for (let slot = 0; slot < count; slot++)
    {
        const forbidden = slot === 0 ? [] : [ order[slot - 1] ];
        if (slot === count - 1) forbidden.push(order[0]);
        if (opposite) forbidden.push(...facingFacades(opposite, slot));
        order.push(pickFacade(random, forbidden));
    }
    const missing: number[] = [];
    for (let variant = 0; variant < FACADE_COUNT; variant++)
    {
        if (!order.includes(variant)) missing.push(variant);
    }
    for (const variant of missing)
    {
        const index = order.findIndex((current, slot) =>
        {
            if (order.filter(value => value === current).length < 2) return false;
            const prev = order[(slot + count - 1) % count];
            const next = order[(slot + 1) % count];
            const facing = opposite ? facingFacades(opposite, slot) : [];
            return variant !== prev && variant !== next && !facing.includes(variant);
        });
        if (index >= 0) order[index] = variant;
    }
    return order;
}

function isMirror (left: readonly number[], right: readonly number[]): boolean
{
    return left.every((variant, slot) => variant === right[right.length - 1 - slot]);
}

export function makeStreetHouses (random: () => number = Math.random): StreetHouse[]
{
    const left = arrangeFacades(null, random);
    const right = arrangeFacades(left, random);
    if (isMirror(left, right))
    {
        const count = right.length;
        for (let slot = 2; slot < count - 1; slot++)
        {
            const moved = right[slot];
            const displaced = right[0];
            const keepsRow = moved !== right[count - 1] && moved !== right[1]
                && displaced !== right[slot - 1] && displaced !== right[slot + 1];
            const keepsSides = !facingFacades(left, 0).includes(moved)
                && !facingFacades(left, slot).includes(displaced)
                && moved !== left[count - 1];
            if (!keepsRow || !keepsSides) continue;
            right[0] = moved;
            right[slot] = displaced;
            break;
        }
    }
    const houses: StreetHouse[] = [];
    for (const side of [-1, 1] as const)
    {
        const variants = side === -1 ? left : right;
        for (let slot = 0; slot < STREET.housesPerSide; slot++)
        {
            const variant = variants[slot];
            houses.push({
                side, slot, variant,
                height: HOUSE_HEIGHTS[variant % HOUSE_HEIGHTS.length],
                length: STREET.spacing - 0.35
            });
        }
    }
    return houses;
}

export function distanceFog (z: number)
{
    // New houses enter in a haze, with no visible pop at the pool boundary.
    return Math.min(1, Math.max(0, (STREET_FAR - z) / 95));
}

export function advanceStreet (travel: number, delta: number)
{
    if (!Number.isFinite(delta) || delta <= 0) return travel;
    // Cap resume/background-tab deltas, and bound the accumulator for long-running menus.
    return positiveModulo(travel + Math.min(delta, 50) * STREET.speed / 1000,
        STREET_PERIOD);
}
