export type ItemKind = 'normal' | 'coin' | 'shield' | 'spring' | 'speed';

export const SPECIAL_PROBABILITY = 0.1;
export const SPRING_STACK_COUNT = 10;
export const SPEED_BOX_COUNT = 5;
export const SPEED_MULTIPLIER = 1.3;

/** Random sources must return values in [0, 1), like Math.random. */
export function rollItemKind (random: () => number = Math.random): ItemKind
{
    if (random() >= SPECIAL_PROBABILITY)
    {
        return 'normal';
    }

    // Only special boxes need a second draw to select their kind uniformly.
    const specialRoll = random();

    if (specialRoll < 1 / 4)
    {
        return 'coin';
    }

    if (specialRoll < 2 / 4)
    {
        return 'shield';
    }

    return specialRoll < 3 / 4 ? 'spring' : 'speed';
}

export function rollCoinReward (perfect: boolean, random: () => number = Math.random): number
{
    const baseReward = 20 + Math.floor(random() * 31);

    return perfect ? baseReward * 2 : baseReward;
}

/** Assign a multiplier once per incoming mover, not per landing or simulation step. */
export class SpeedBoost
{
    private remainingBoxes = 0;

    get remaining (): number
    {
        return this.remainingBoxes;
    }

    /** Another red pickup refreshes five boxes; it never compounds the multiplier. */
    grant (): void
    {
        this.remainingBoxes = SPEED_BOX_COUNT;
    }

    consumeMover (): number
    {
        if (this.remainingBoxes === 0) return 1;

        this.remainingBoxes--;
        return SPEED_MULTIPLIER;
    }

    reset (): void
    {
        this.remainingBoxes = 0;
    }
}

export class ShieldCharge
{
    private charged = false;

    get active (): boolean
    {
        return this.charged;
    }

    grant (): void
    {
        this.charged = true;
    }

    consume (): boolean
    {
        if (!this.charged)
        {
            return false;
        }

        this.charged = false;
        return true;
    }

    reset (): void
    {
        this.charged = false;
    }
}
