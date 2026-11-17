import type { Scene } from 'phaser';
import { WeeklyLeaderboard, WEEKLY_LEADERBOARD_KEY } from './weeklyLeaderboard';

/** The normal profile is shared across scenes; existing QA coin keys also isolate ranking data. */
export function getWeeklyLeaderboard (scene: Scene): WeeklyLeaderboard
{
    const qaKey: unknown = import.meta.env.DEV ? scene.registry.get('coinStorageKey') : undefined;
    const key = typeof qaKey === 'string' ? `${WEEKLY_LEADERBOARD_KEY}:qa:${qaKey}` : WEEKLY_LEADERBOARD_KEY;
    const cached = scene.registry.get('weeklyLeaderboardContext') as { key: string; service: WeeklyLeaderboard } | undefined;
    if (cached?.key === key) return cached.service;
    const service = new WeeklyLeaderboard(key);
    scene.registry.set('weeklyLeaderboardContext', { key, service });
    return service;
}
