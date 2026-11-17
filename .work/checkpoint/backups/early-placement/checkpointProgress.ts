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

    isApproaching (meters: number, possibleGain: number)
    {
        return meters < this.next && meters + possibleGain >= this.next;
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
