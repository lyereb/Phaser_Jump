/** Height of the first step up from the opening pace. */
const STEP_METERS = 50;
/** Level 11 is the -20% to +50% band, reached at 500m. */
const MAX_LEVEL = 11;
/** Each level above 1 raises the fastest roll by this much. */
const BONUS_PER_LEVEL = 0.05;
/** Each level above 1 lowers the slowest roll by this much. */
const SLOW_PER_LEVEL = 0.02;

/**
 * Opening pace is level 1. 50m reaches level 2, and every further 50m adds one, through level 11.
 */
export function difficultyForMeters (meters: number): number
{
    if (!Number.isFinite(meters) || meters < STEP_METERS) return 1;

    return Math.min(MAX_LEVEL, 1 + Math.floor(meters / STEP_METERS));
}

/**
 * Level 1 stays exactly the base speed.
 * Each further level rolls from (level - 1) × -2% up to (level - 1) × +5%.
 * `roll` is 0..1 so a caller can keep the draw stable.
 */
export function difficultySpeedScale (difficulty: number, roll: number = Math.random()): number
{
    const level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(difficulty)));
    const steps = level - 1;
    const slowest = -steps * SLOW_PER_LEVEL;
    const fastest = steps * BONUS_PER_LEVEL;
    const span = fastest - slowest;

    if (span <= 0) return 1;

    return 1 + slowest + Math.min(1, Math.max(0, roll)) * span;
}
