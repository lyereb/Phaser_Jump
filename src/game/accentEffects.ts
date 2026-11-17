import { GameObjects, Scene } from 'phaser';
import { AccentPool, accentSample, type AccentStyle } from './accentEffectsModel';

/** Small highlights add polish; no large opaque flash or continually emitting emitter. */
export class AccentEffects
{
    private world: GameObjects.Graphics;
    private overlay: GameObjects.Graphics | null = null;
    private worldPool = new AccentPool();
    private screenPool = new AccentPool();
    private destroyed = false;

    constructor (private scene: Scene, depth: number, private overlayDepth = depth)
    {
        this.world = scene.add.graphics().setDepth(depth);
        scene.events.on('update', this.update, this);
        scene.events.once('shutdown', this.destroy, this);
    }

    burst (x: number, y: number, style: AccentStyle, count = 10)
    {
        if (!this.destroyed) this.worldPool.burst(x, y, style, count);
    }
    wave (x: number, y: number, color: number, radius = 68, axis = 0.52, life = 0.5)
    {
        if (!this.destroyed) this.worldPool.wave(x, y, color, radius, axis, life);
    }
    screenMote (x: number, y: number, color = 0xffe69c)
    {
        if (this.destroyed) return;
        this.overlay ??= this.scene.add.graphics().setDepth(this.overlayDepth).setScrollFactor(0);
        this.screenPool.mote(x, y, color);
    }
    arrival (x: number, y: number)
    {
        if (this.destroyed) return;
        this.overlay ??= this.scene.add.graphics().setDepth(this.overlayDepth).setScrollFactor(0);
        this.screenPool.burst(x, y, 'gold', 5);
    }
    elapsed () { return this.worldPool.elapsed; }
    status () { return { sparks: this.worldPool.sparks.length + this.screenPool.sparks.length,
        waves: this.worldPool.waves.length, layers: 1 + Number(!!this.overlay), destroyed: this.destroyed }; }

    private update (_time: number, delta: number)
    {
        if (this.destroyed) return;
        this.worldPool.update(delta); this.screenPool.update(delta);
        this.paint(this.world, this.worldPool);
        if (this.overlay) this.paint(this.overlay, this.screenPool);
    }

    private paint (g: GameObjects.Graphics, pool: AccentPool)
    {
        g.clear();
        for (const wave of pool.waves)
        {
            const p = wave.age / wave.life, ease = 1 - (1 - p) ** 3;
            const radius = wave.radius * (0.25 + ease * 0.75);
            const alpha = Math.sin(Math.PI * Math.min(1, p / 0.2) / 2) * (1 - p) * 0.48;
            for (const [width, a, color] of [[7, alpha * 0.09, wave.color], [1.8, alpha, wave.color], [0.8, alpha * 0.6, 0xffffff]])
            {
                g.lineStyle(width, color, a).beginPath();
                for (let i = 0; i <= 32; i++)
                {
                    const angle = wave.phase + p * 0.32 + i / 32 * Math.PI * 1.7;
                    const x = wave.x + Math.cos(angle) * radius;
                    const y = wave.y + Math.sin(angle) * radius * wave.axis;
                    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
                }
                g.strokePath();
            }
        }
        for (const spark of pool.sparks)
        {
            const s = accentSample(spark), size = s.size, alpha = s.alpha * 0.78;
            g.fillStyle(spark.color, alpha * 0.09).fillCircle(s.x, s.y, size * 2.8);
            if (spark.streak)
            {
                const len = Math.min(10, size * 2.2);
                const angle = Math.atan2(spark.vy, spark.vx);
                g.lineStyle(1.4, spark.color, alpha * 0.55).lineBetween(s.x, s.y,
                    s.x - Math.cos(angle) * len, s.y - Math.sin(angle) * len);
            }
            const rotation = spark.phase + spark.age * 0.9;
            const dx = Math.cos(rotation) * size, dy = Math.sin(rotation) * size;
            g.lineStyle(1.35, spark.color, alpha).lineBetween(s.x - dx, s.y - dy, s.x + dx, s.y + dy);
            g.lineBetween(s.x + dy * 0.72, s.y - dx * 0.72, s.x - dy * 0.72, s.y + dx * 0.72);
            g.fillStyle(0xfffcf0, alpha * 0.8).fillCircle(s.x, s.y, Math.max(0.65, size * 0.22));
        }
    }

    destroy ()
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events.off('update', this.update, this);
        this.scene.events.off('shutdown', this.destroy, this);
        this.worldPool.clear(); this.screenPool.clear();
        this.world.destroy(); this.overlay?.destroy();
    }
}
