import type { RankedEntry, WeeklySnapshot } from "./weeklyLeaderboard";

export type ChaseState = {
    target: RankedEntry | null;
    remaining: number;
    leading: boolean;
    best: number;
    meters: number;
};

export type ChaseUpdate = {
    state: ChaseState;
    overtaken: RankedEntry[];
};

/** Match the leaderboard's whole-meter, finite, non-negative score policy. */
function validScore (value: number): number | null
{
    if (!Number.isFinite(value) || value < 0) return null;
    const score = Math.floor(value);
    return Number.isSafeInteger(score) ? score : null;
}

function scoreOrZero (value: number): number
{
    return validScore(value) ?? 0;
}

function ascending (a: RankedEntry, b: RankedEntry): number
{
    return a.meters - b.meters || a.rank - b.rank || a.id.localeCompare(b.id);
}

function opponents (snapshot: WeeklySnapshot): Map<string, RankedEntry>
{
    const entries = new Map<string, RankedEntry>();
    for (const entry of snapshot.topFive)
    {
        const meters = validScore(entry.meters);
        if (entry.isSelf || meters === null) continue;
        const previous = entries.get(entry.id);
        // A duplicated identity is one opponent, with its highest valid score.
        if (!previous || meters > previous.meters)
        {
            entries.set(entry.id, { ...entry, meters });
        }
    }
    return entries;
}

/** Pure weekly chase model: no storage, rendering, timers, or Phaser dependency. */
export class RankChaseProgress
{
    private weekKey: string;
    private baseline: number;
    private knownOpponents: Map<string, RankedEntry>;
    private readonly passed = new Set<string>();
    private state: ChaseState;

    constructor (snapshot: WeeklySnapshot, meters = 0)
    {
        const current = scoreOrZero(meters);
        this.weekKey = snapshot.weekKey;
        this.baseline = Math.max(scoreOrZero(snapshot.selfBest), current);
        this.knownOpponents = opponents(snapshot);
        this.state = this.makeState(snapshot, current);
        this.rememberPassed();
    }

    update (snapshot: WeeklySnapshot, meters: number, celebrate = false): ChaseUpdate
    {
        const current = scoreOrZero(meters);
        if (snapshot.weekKey !== this.weekKey)
        {
            // Existing scores on a new week establish a silent starting point.
            this.weekKey = snapshot.weekKey;
            this.baseline = Math.max(scoreOrZero(snapshot.selfBest), current);
            this.passed.clear();
            this.knownOpponents = opponents(snapshot);
            this.state = this.makeState(snapshot, current);
            this.rememberPassed();
            return this.result([]);
        }

        const previousBaseline = this.baseline;
        const oldTarget = this.state.target;
        this.knownOpponents = opponents(snapshot);
        const candidates = new Map(this.knownOpponents);
        // Inserting self into the top five can evict the target in the same update
        // that beats it. Keep that one old target only for this crossing, never
        // as a future target or a permanent historical leaderboard member.
        if (oldTarget && !candidates.has(oldTarget.id))
        {
            candidates.set(oldTarget.id, oldTarget);
        }

        const crossed = current > previousBaseline
            ? [...candidates.values()].filter(entry =>
                !this.passed.has(entry.id)
                && entry.meters >= previousBaseline
                && current > entry.meters).sort(ascending)
            : [];

        // Silent progress consumes crossings too; a later opt-in must not replay.
        for (const entry of crossed) this.passed.add(entry.id);
        this.baseline = Math.max(previousBaseline, scoreOrZero(snapshot.selfBest), current);
        this.rememberPassed();
        this.state = this.makeState(snapshot, current);
        return this.result(celebrate ? crossed : []);
    }

    private rememberPassed (): void
    {
        for (const entry of this.knownOpponents.values())
        {
            if (entry.meters < this.baseline) this.passed.add(entry.id);
        }
    }

    private makeState (snapshot: WeeklySnapshot, meters: number): ChaseState
    {
        const best = Math.max(scoreOrZero(snapshot.selfBest), meters);
        const target = [...this.knownOpponents.values()]
            .filter(entry => entry.meters >= best)
            .sort(ascending)[0] ?? null;
        return {
            target,
            remaining: target ? Math.max(0, target.meters - meters + 1) : 0,
            leading: target === null,
            best,
            meters
        };
    }

    private result (overtaken: RankedEntry[]): ChaseUpdate
    {
        return {
            state: { ...this.state, target: this.state.target ? { ...this.state.target } : null },
            overtaken: overtaken.map(entry => ({ ...entry }))
        };
    }
}
