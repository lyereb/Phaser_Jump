export type ItemKind = 'normal' | 'coin' | 'shield' | 'spring';

export const SPECIAL_PROBABILITY = 0.1;
export const SPRING_STACK_COUNT = 10;

/** Random sources must return values in [0, 1), like Math.random. */
export function rollItemKind (random: () => number = Math.random): ItemKind
{
    if (random() >= SPECIAL_PROBABILITY)
    {
        return 'normal';
    }

    // Only special boxes need a second draw to select their kind uniformly.
    const specialRoll = random();

    if (specialRoll < 1 / 3)
    {
        return 'coin';
    }

    if (specialRoll < 2 / 3)
    {
        return 'shield';
    }

    return 'spring';
}

export function rollCoinReward (perfect: boolean, random: () => number = Math.random): number
{
    const baseReward = 20 + Math.floor(random() * 31);

    return perfect ? baseReward * 2 : baseReward;
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
