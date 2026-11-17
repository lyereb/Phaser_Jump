export const WEEKLY_LEADERBOARD_KEY = "phaser-jump-weekly-leaderboard";

export type RankedEntry = {
    id: string;
    name: string;
    meters: number;
    avatar: number;
    isSelf: boolean;
    rank: number;
};

export type WeeklySnapshot = {
    weekKey: string;
    start: number;
    end: number;
    dateLabel: string;
    topFive: RankedEntry[];
    selfBest: number;
    selfRank: number | null;
    gapToTopFive: number;
    gapToNext: number;
};

type StorageAdapter = {
    getItem(k: string): string | null;
    setItem(k: string, v: string): void;
};

type SavedBest = { weekKey: string; best: number };
type WeekWindow = Pick<WeeklySnapshot, "weekKey" | "start" | "end" | "dateLabel">;

// Share fallback scores by storage adapter and key, without mixing independent stores.
const memoryOnly = new Map<string, SavedBest>();
const storageMemory = new WeakMap<StorageAdapter, Map<string, SavedBest>>();

function defaultStorage (): StorageAdapter | undefined
{
    try
    {
        return globalThis.localStorage;
    }
    catch
    {
        return undefined;
    }
}

function localWeek (date: Date): WeekWindow
{
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + 7);
    const lastDay = new Date(end.getTime());
    lastDay.setDate(lastDay.getDate() - 1);
    const monthDay = (day: Date) => `${String(day.getMonth() + 1).padStart(2, "0")}.${String(day.getDate()).padStart(2, "0")}`;
    const weekKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

    return {
        weekKey,
        start: start.getTime(),
        end: end.getTime(),
        dateLabel: `${monthDay(start)} — ${monthDay(lastDay)}`
    };
}

function savedBest (raw: string | null, weekKey: string): number
{
    if (raw === null) return 0;
    try
    {
        const value: unknown = JSON.parse(raw);
        if (typeof value !== "object" || value === null || Array.isArray(value)) return 0;
        const record = value as Record<string, unknown>;
        return record.weekKey === weekKey
            && typeof record.best === "number"
            && Number.isSafeInteger(record.best)
            && record.best >= 0 ? record.best : 0;
    }
    catch
    {
        return 0;
    }
}

/** Local Monday-to-Monday leaderboard; timestamps are milliseconds, end is exclusive. */
export class WeeklyLeaderboard
{
    private readonly storage: StorageAdapter | undefined;
    private readonly memory: Map<string, SavedBest>;

    constructor (
        private readonly key = WEEKLY_LEADERBOARD_KEY,
        private readonly now: () => Date = () => new Date(),
        storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void }
    )
    {
        this.storage = storage ?? defaultStorage();
        if (this.storage)
        {
            let memory = storageMemory.get(this.storage);
            if (!memory)
            {
                memory = new Map<string, SavedBest>();
                storageMemory.set(this.storage, memory);
            }
            this.memory = memory;
        }
        else
        {
            this.memory = memoryOnly;
        }
    }

    /** Fractions are floored to whole meters; invalid/negative/unsafe scores are ignored. */
    record (meters: number): boolean
    {
        const week = localWeek(this.now());
        const best = this.currentBest(week.weekKey);
        if (!Number.isFinite(meters) || meters < 0) return false;
        const score = Math.floor(meters);
        if (!Number.isSafeInteger(score) || score <= best) return false;

        const progress: SavedBest = { weekKey: week.weekKey, best: score };
        this.memory.set(this.key, progress);
        try
        {
            this.storage?.setItem(this.key, JSON.stringify(progress));
        }
        catch
        {
            // Quota/security failures must not discard this session's new maximum.
        }
        return true;
    }

    snapshot (): WeeklySnapshot
    {
        const week = localWeek(this.now());
        const best = this.currentBest(week.weekKey);
        const names = ["小明", "小红", "小刚", "小李", "小夏"];
        const entries: RankedEntry[] = names.map((name, index) => ({
            id: `bot-${index}`,
            name,
            meters: 1000 - index * 200,
            avatar: index,
            isSelf: false,
            rank: 0
        }));
        if (best > 0)
        {
            entries.push({ id: "self", name: "我", meters: best, avatar: 5, isSelf: true, rank: 0 });
        }
        entries.sort((a, b) => b.meters - a.meters
            || Number(a.isSelf) - Number(b.isSelf)
            || a.avatar - b.avatar);
        entries.forEach((entry, index) => { entry.rank = index + 1; });
        const self = entries.find(entry => entry.isSelf);
        const selfRank = self?.rank ?? null;

        return {
            ...week,
            topFive: entries.slice(0, 5),
            selfBest: best,
            selfRank,
            gapToTopFive: selfRank !== null && selfRank <= 5 ? 0 : entries[4].meters - best + 1,
            gapToNext: selfRank === 1 ? 0 : selfRank === null ? 201 : entries[selfRank - 2].meters - best + 1
        };
    }

    private currentBest (weekKey: string): number
    {
        const cached = this.memory.get(this.key);
        let best = cached?.weekKey === weekKey ? cached.best : 0;
        try
        {
            best = Math.max(best, savedBest(this.storage?.getItem(this.key) ?? null, weekKey));
        }
        catch
        {
            // Retain the in-memory maximum when storage reads are blocked or corrupted.
        }
        this.memory.set(this.key, { weekKey, best });
        return best;
    }
}
