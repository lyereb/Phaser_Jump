import { GameObjects, Math as PMath, Scene } from 'phaser';

const SHEET = 'stars-sheet';

/** Each star in Obj/stars.png, measured from the sheet. They are not on a regular grid. */
const REGIONS = [
    { x: 155, y: 16, w: 35, h: 35 },
    { x: 47, y: 32, w: 63, h: 63 },
    { x: 211, y: 51, w: 66, h: 70 },
    { x: 108, y: 78, w: 92, h: 91 },
    { x: 13, y: 102, w: 47, h: 45 },
    { x: 210, y: 152, w: 65, h: 64 },
    { x: 42, y: 160, w: 73, h: 76 },
    { x: 150, y: 193, w: 41, h: 42 }
];

const FRAMES = REGIONS.map((_region, index) => `star-${index}`);
const BURST_COUNT = 12;
/** Share of a particle's life spent popping from nothing to full size. */
const POP_T = 0.12;

type Spin = { base: number; start: number; turn: number };

export function loadStarAssets (scene: Scene)
{
    scene.load.image(SHEET, 'Obj/stars.png');
}

export function createStarFrames (scene: Scene)
{
    const texture = scene.textures.get(SHEET);

    REGIONS.forEach((region, index) =>
    {
        if (!texture.has(FRAMES[index]))
        {
            texture.add(FRAMES[index], 0, region.x, region.y, region.w, region.h);
        }
    });
}

/** One emitter per scene; call `burst` on each landing. */
export class StarBurst
{
    private emitter: GameObjects.Particles.ParticleEmitter;

    constructor (scene: Scene, depth: number)
    {
        const spins = new WeakMap<GameObjects.Particles.Particle, Spin>();
        const spinOf = (particle: GameObjects.Particles.Particle) =>
        {
            let spin = spins.get(particle);

            if (!spin)
            {
                spin = {
                    base: PMath.FloatBetween(0.22, 0.42),
                    start: PMath.Between(0, 359),
                    turn: PMath.Between(-540, 540)
                };
                spins.set(particle, spin);
            }

            return spin;
        };

        this.emitter = scene.add.particles(0, 0, SHEET, {
            frame: FRAMES,
            emitting: false,
            lifespan: { min: 480, max: 760 },
            speedX: {
                onEmit: () => (Math.random() < 0.5 ? -1 : 1) * PMath.Between(140, 440)
            },
            speedY: { min: -720, max: -380 },
            gravityY: 1900,
            rotate: {
                onEmit: (particle) =>
                {
                    spins.delete(particle!);

                    return spinOf(particle!).start;
                },
                onUpdate: (particle, _key, t) =>
                {
                    const spin = spinOf(particle);

                    return spin.start + spin.turn * t;
                }
            },
            scale: {
                onEmit: () => 0,
                onUpdate: (particle, _key, t) =>
                {
                    const { base } = spinOf(particle);

                    if (t < POP_T)
                    {
                        return base * 1.25 * (t / POP_T);
                    }

                    return base * (1.25 - 0.95 * (t - POP_T) / (1 - POP_T));
                }
            },
            alpha: { start: 1, end: 0, ease: 'Quad.In' }
        }).setDepth(depth);
    }

    burst (x: number, y: number, count = BURST_COUNT)
    {
        this.emitter.explode(count, x, y);
    }
}
