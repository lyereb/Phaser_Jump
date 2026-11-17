export const LEVEL_GOAL_METERS = 500;

export type LevelProgress = {
    meters: number;
    goal: number;
    remaining: number;
    ratio: number;
    percent: number;
    reached: boolean;
};

const whole = (value: number) => Number.isFinite(value)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : 0;

/** Presentation-only goal: never changes score or ends the gameplay scene. */
export function levelProgress (meters: number, goal = LEVEL_GOAL_METERS): LevelProgress
{
    const target = whole(goal) || LEVEL_GOAL_METERS;
    const current = whole(meters);
    const ratio = Math.min(1, current / target);
    const reached = current >= target;
    return {
        meters: current, goal: target, remaining: Math.max(0, target - current), ratio,
        percent: reached ? 100 : Math.min(99.9, Math.floor(ratio * 1000 + 1e-8) / 10), reached
    };
}
