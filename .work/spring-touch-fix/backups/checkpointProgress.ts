export const CHECKPOINT_INTERVAL = 50;

/** Score metres are not world pixels: perfect lands can skip over a milestone. */
export class CheckpointProgress
{
    private next = CHECKPOINT_INTERVAL;
    private crossedThisJump = false;

    get nextMeters ()
    {
        return this.next;
    }

    beginJump ()
    {
        this.crossedThisJump = false;
    }

    cross ()
    {
        this.crossedThisJump = true;
    }

    /** Call only for a successful land on a NEW box, never for score display changes. */
    land (meters: number): number | null
    {
        if (!this.crossedThisJump || meters < this.next)
        {
            return null;
        }

        const completed = this.next;
        this.next += CHECKPOINT_INTERVAL;
        this.crossedThisJump = false;
        return completed;
    }
}

/** Project a fixed score-space milestone into the game's world-space stack.
 * Far targets start above the viewport; the final five metres fit one full hop.
 * This is continuous at the boundary, even though perfect lands award 1–5m.
 */
export function checkpointDistance (remainingMeters: number, jumpHeight: number, boxHeight: number)
{
    const remaining = Math.max(0, remainingMeters);
    const near = Math.min(5, remaining);
    const far = Math.max(0, remaining - 5);

    return jumpHeight * (0.65 + near * 0.06) + far * boxHeight * 0.25;
}
