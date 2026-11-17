export const CHECKPOINT_INTERVAL = 50;

/** Labels advance once per actual target contact, independently of the player's score. */
export class CheckpointProgress
{
    private next = CHECKPOINT_INTERVAL;

    get nextMeters ()
    {
        return this.next;
    }

    touch (targetLabel: number): number | null
    {
        if (targetLabel !== this.next) return null;
        const completed = this.next;
        this.next += CHECKPOINT_INTERVAL;
        return completed;
    }
}

export type CheckpointBounds = { left: number; right: number; top: number; bottom: number };

/** Inclusive edges count as contact; rope and bag are independent contact surfaces. */
export function checkpointTouchesPlayer (player: CheckpointBounds, bag: CheckpointBounds, rope: CheckpointBounds | null)
{
    const touches = (target: CheckpointBounds) => target.left <= target.right && target.top <= target.bottom
        && player.left <= target.right && player.right >= target.left
        && player.top <= target.bottom && player.bottom >= target.top;
    return touches(bag) || (rope !== null && touches(rope));
}

/** Continuous visual projection only: score affects approach distance, never reward eligibility. */
export function checkpointDistance (remainingMeters: number, jumpHeight: number, boxHeight: number)
{
    const remaining = Math.max(0, remainingMeters);
    const near = Math.min(5, remaining);
    const far = Math.max(0, remaining - 5);
    return jumpHeight * (0.65 + near * 0.06) + far * boxHeight * 0.25;
}
