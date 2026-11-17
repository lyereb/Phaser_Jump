export const ACCENT_LIMITS = { sparks: 64, waves: 8, maxBurst: 20 } as const;
export type AccentStyle = 'gold' | 'blue' | 'spring' | 'checkpoint' | 'speed';
export type AccentSpark = { x: number; y: number; vx: number; vy: number; gravity: number;
    age: number; life: number; size: number; color: number; phase: number; streak: boolean };
export type AccentWave = { x: number; y: number; age: number; life: number; radius: number;
    axis: number; color: number; phase: number };

export const ACCENT_PALETTES: Record<AccentStyle, number[]> = {
    gold: [0xffdc67, 0xfff2b7, 0xffc57a], blue: [0x8bdfff, 0xd9fbff, 0xa3e9ed],
    spring: [0xffd660, 0xfff1ae, 0xffc684], checkpoint: [0xffe087, 0xfff2c8, 0xffbd7c],
    speed: [0xff9674, 0xffd48d, 0xffe4be]
};

export function accentSample (spark: AccentSpark)
{
    const t = spark.age, p = Math.min(1, t / spark.life);
    // Early impulse settles quickly; gravity produces a soft falling finish.
    const distance = (1 - Math.exp(-2.1 * t)) / 2.1;
    return { x: spark.x + spark.vx * distance,
        y: spark.y + spark.vy * distance + spark.gravity * t * t / 2,
        alpha: Math.min(1, p / 0.07) * Math.pow(1 - p, 1.35) *
            (0.78 + 0.22 * Math.sin(t * 16 + spark.phase)),
        size: spark.size * (0.85 + 0.15 * Math.sin(t * 10 + spark.phase)) };
}

/** No per-frame objects or scene tweens: bounded particles are recycled by expiry. */
export class AccentPool
{
    readonly sparks: AccentSpark[] = [];
    readonly waves: AccentWave[] = [];
    elapsed = 0;
    constructor (private random = Math.random) {}

    burst (x: number, y: number, style: AccentStyle, count: number)
    {
        const n = Math.min(ACCENT_LIMITS.maxBurst, Math.max(0, Math.floor(count)));
        for (let i = 0; i < n; i++)
        {
            const upward = style === 'spring';
            const angle = upward ? -Math.PI / 2 + (this.random() - 0.5) * 1.15
                : Math.PI * 2 * (i + this.random() * 0.35) / Math.max(1, n);
            const speed = upward ? 190 + this.random() * 130 : 70 + this.random() * 120;
            const colors = ACCENT_PALETTES[style];
            this.add({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                gravity: upward ? 180 : style === 'checkpoint' ? 210 : 90,
                age: 0, life: 0.48 + this.random() * 0.38, size: 1.8 + this.random() * 2.4,
                color: colors[i % colors.length], phase: this.random() * Math.PI * 2,
                streak: upward || style === 'speed' });
        }
    }

    mote (x: number, y: number, color: number)
    {
        this.add({ x, y, vx: (this.random() - 0.5) * 20, vy: 12,
            gravity: 0, age: 0, life: 0.24, size: 1.9, color, phase: 0, streak: false });
    }

    wave (x: number, y: number, color: number, radius = 68, axis = 0.52, life = 0.5)
    {
        if (this.waves.length >= ACCENT_LIMITS.waves) this.waves.shift();
        this.waves.push({ x, y, color, radius: Math.min(100, Math.max(24, radius)),
            axis, life, age: 0, phase: this.random() * Math.PI });
    }

    private add (spark: AccentSpark)
    {
        if (this.sparks.length >= ACCENT_LIMITS.sparks) this.sparks.shift();
        this.sparks.push(spark);
    }

    update (delta: number)
    {
        if (!Number.isFinite(delta) || delta <= 0) return;
        const dt = Math.min(delta, 50) / 1000;
        this.elapsed += dt;
        for (let i = this.sparks.length - 1; i >= 0; i--)
        {
            this.sparks[i].age += dt;
            if (this.sparks[i].age >= this.sparks[i].life) this.sparks.splice(i, 1);
        }
        for (let i = this.waves.length - 1; i >= 0; i--)
        {
            this.waves[i].age += dt;
            if (this.waves[i].age >= this.waves[i].life) this.waves.splice(i, 1);
        }
    }
    clear () { this.sparks.length = 0; this.waves.length = 0; }
}
