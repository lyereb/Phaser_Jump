import { GameObjects, Math as PMath, Scene } from 'phaser';
import { AccentEffects } from './accentEffects';

const FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';

type Point = { x: number; y: number };
type SpeedMover = { x: number; y: number; width: number; height: number; vx: number; depth: number };

/** World-space effects owned by the scene. Pickup coins are drawn in screen space. */
export class ItemEffects
{
    private bubble: GameObjects.Container;
    private glow: GameObjects.Container;
    private sweep: GameObjects.Ellipse;
    private sparks: GameObjects.Arc[] = [];
    private effects = new Set<GameObjects.GameObject>();
    private shieldRx: number;
    private shieldRy: number;
    private spin = 0;
    private speedTrail: GameObjects.Graphics | null = null;
    private speedShine: GameObjects.Graphics | null = null;
    private speedTime = 0;
    private accents: AccentEffects;
    private springRibbon: GameObjects.Graphics | null = null;
    private springPoints: Point[] = [];

    constructor (
        private scene: Scene,
        private depth: number,
        width: number,
        height: number,
        private overlayDepth = depth + 40
    )
    {
        this.shieldRx = width * 1.05;
        this.shieldRy = height * 0.62;
        this.accents = new AccentEffects(scene, depth - 8, overlayDepth - 1);
        this.bubble = this.track(scene.add.container(0, 0).setDepth(depth).setVisible(false));
        this.glow = scene.add.container(0, 0);
        const shell = scene.add.graphics();
        const rx = this.shieldRx;
        const ry = this.shieldRy;

        shell.fillStyle(0x7ecfff, 0.055).fillEllipse(0, 6, rx * 2.45, ry * 2.45);
        shell.fillStyle(0xe7fbff, 0.065).fillEllipse(0, -ry * 0.05, rx * 1.7, ry * 1.55);
        shell.lineStyle(9, 0x49bfff, 0.09).strokeEllipse(0, 4, rx * 2.2, ry * 2.25);
        shell.lineStyle(2.3, 0xe7fbff, 0.78).strokeEllipse(0, 0, rx * 1.92, ry * 1.96);
        shell.lineStyle(1.2, 0x9aebff, 0.55).strokeEllipse(0, 0, rx * 1.5, ry * 1.52);
        shell.lineStyle(3, 0xffffff, 0.68);
        shell.beginPath();
        shell.arc(-rx * 0.08, -ry * 0.16, Math.min(rx, ry) * 0.78, Math.PI * 1.2, Math.PI * 1.9, false);
        shell.strokePath();
        shell.lineStyle(1.5, 0x9ee8ff, 0.5).beginPath();
        shell.arc(rx * 0.12, ry * 0.2, Math.min(rx, ry) * 0.86, Math.PI * 0.05, Math.PI * 0.55, false);
        shell.strokePath();
        this.glow.add(shell);
        this.bubble.add(this.glow);

        this.sweep = scene.add.ellipse(0, -ry * 0.28, rx * 0.62, ry * 0.24, 0xffffff, 0.42);
        this.bubble.add(this.sweep);

        for (let i = 0; i < 7; i++)
        {
            const spark = scene.add.circle(0, 0, i % 2 === 0 ? 3.5 : 2.4, 0xffffff, 0.95)
                .setStrokeStyle(2, 0x7adfff, 0.9);

            this.bubble.add(spark);
            this.sparks.push(spark);
        }

        scene.tweens.add({
            targets: this.glow,
            scaleX: 1.07,
            scaleY: 1.07,
            duration: 720,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
        });
        scene.events.once('shutdown', () => this.destroy());
    }

    update (x: number, y: number, shield: boolean)
    {
        this.bubble.setPosition(x, y).setVisible(shield);

        if (!shield)
        {
            return;
        }

        this.spin = this.accents.elapsed() * 1.8;
        this.sparks.forEach((spark, index) =>
        {
            const angle = this.spin + (Math.PI * 2 * index) / this.sparks.length;
            const breathe = 1 + Math.sin(this.spin * 2 + index) * 0.06;

            spark.setPosition(Math.cos(angle) * this.shieldRx * breathe, Math.sin(angle) * this.shieldRy * breathe);
            spark.setAlpha(0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.spin * 5 + index)));
        });
        this.sweep.setPosition(
            Math.cos(this.spin * 1.6) * this.shieldRx * 0.22,
            -this.shieldRy * 0.3 + Math.sin(this.spin * 2.4) * 5
        );
        this.sweep.setAlpha(0.18 + 0.34 * (0.5 + 0.5 * Math.sin(this.spin * 3)));
    }

    /** Pooled world-space graphics. Advance only with simulation time, never wall-clock tweens. */
    moverSpeed (mover: SpeedMover | null, dt = 0)
    {
        if (!mover || mover.vx === 0)
        {
            this.speedTrail?.clear().setVisible(false);
            this.speedShine?.clear().setVisible(false);
            this.speedTime = 0;
            return;
        }

        this.speedTrail ??= this.track(this.scene.add.graphics());
        this.speedShine ??= this.track(this.scene.add.graphics());
        const trail = this.speedTrail.clear().setVisible(true).setDepth(mover.depth - 0.2);
        const shine = this.speedShine.clear().setVisible(true).setDepth(mover.depth + 0.05);
        this.speedTime += Math.max(0, dt);
        const time = this.speedTime;
        const sign = Math.sign(mover.vx);
        const rear = mover.x - sign * mover.width / 2;
        const top = mover.y - mover.height / 2;
        const left = mover.x - mover.width / 2;
        const pulse = 0.5 + 0.5 * Math.sin(time * 8);

        // Soft red-orange exhaust behind the box, never tinting or replacing its item artwork.
        trail.fillStyle(0xff5c47, 0.08 + pulse * 0.03)
            .fillEllipse(rear - sign * 30, mover.y, 118, mover.height * 0.88);
        trail.fillStyle(0xffb75f, 0.11)
            .fillEllipse(rear - sign * 18, mover.y, 76, mover.height * 0.65);

        for (let i = 0; i < 6; i++)
        {
            const cycle = (time * 2.8 + i * 0.17) % 1;
            const offset = 8 + cycle * 46;
            const length = 28 + (i % 3) * 15 + cycle * 18;
            const y = top + mover.height * (0.16 + i * 0.135) + Math.sin(time * 8 + i) * 2;
            const startX = rear - sign * offset;
            const endX = startX - sign * length;
            const alpha = (1 - cycle) * 0.65 + 0.1;

            trail.lineStyle(8, 0xff6548, alpha * 0.25).lineBetween(startX, y, endX, y);
            trail.lineStyle(3, 0xffc16a, alpha).lineBetween(startX, y, endX, y);
            trail.lineStyle(1.2, 0xfff5cc, alpha * 0.85).lineBetween(startX, y, endX, y);
        }

        // Four recycled sparks drift away from the trailing edge; no new particles per frame.
        for (let i = 0; i < 4; i++)
        {
            const cycle = (time * 2.1 + i * 0.25) % 1;
            const x = rear - sign * (12 + cycle * 112);
            const spread = (i % 2 === 0 ? -1 : 1) * (0.25 + cycle * 0.22) * mover.height;
            const y = mover.y + spread;
            const alpha = (1 - cycle) * 0.85;

            trail.fillStyle(0xff984e, alpha * 0.3).fillCircle(x, y, 5);
            trail.lineStyle(1.6, 0xfff3b0, alpha).lineBetween(x - 3, y, x + 3, y);
            trail.lineBetween(x, y - 3, x, y + 3);
        }

        shine.lineStyle(7, 0xff784c, 0.14 + pulse * 0.08)
            .strokeRoundedRect(left - 4, top - 4, mover.width + 8, mover.height + 8, 12);
        shine.lineStyle(2, 0xffdc8d, 0.6 + pulse * 0.2)
            .strokeRoundedRect(left - 2, top - 2, mover.width + 4, mover.height + 4, 10);
        const glint = (time * 1.8) % 1;
        const glintX = left + 8 + (mover.width - 40) * (sign > 0 ? glint : 1 - glint);
        shine.lineStyle(4, 0xfff7d7, 0.85).lineBetween(glintX, top - 1, glintX + 24, top - 1);
        shine.lineStyle(2, 0xffffff, 0.32).lineBetween(glintX + 8, top + 4, glintX + 24, top + 4);
    }

    speedGranted (x: number, y: number)
    {
        this.toast(x, y, '后续 5 盒加速 +30%', '#ffc0b8');
        this.accents.wave(x, y + 30, 0xffbc8e, 62, 0.36, 0.42);
        this.accents.burst(x, y + 25, 'speed', 9);
    }

    /** A short, tapered ribbon stays below the feet instead of flooding the flight path. */
    springTrail (x: number, feetY: number, active: boolean)
    {
        if (!active)
        {
            this.springRibbon?.clear().setVisible(false);
            this.springPoints = [];
            return;
        }
        this.springRibbon ??= this.track(this.scene.add.graphics().setDepth(this.depth - 8));
        const g = this.springRibbon.clear().setVisible(true);
        this.springPoints.unshift({x, y: feetY});
        this.springPoints = this.springPoints.filter(p => Math.abs(p.y - feetY) < 155).slice(0, 12);
        for (let i = 1; i < this.springPoints.length; i++)
        {
            const a = this.springPoints[i - 1], b = this.springPoints[i];
            const fade = 1 - i / this.springPoints.length;
            g.lineStyle(12 * fade + 1, 0xffc260, fade * 0.08).lineBetween(a.x, a.y + 4, b.x, b.y + 4);
            for (const offset of [-8, 0, 8])
            {
                g.lineStyle(offset === 0 ? 2 : 1, offset === 0 ? 0xffefb2 : 0xffd570, fade * 0.5)
                    .lineBetween(a.x + offset, a.y + 5, b.x + offset * fade, b.y + 5);
            }
        }
    }

    status ()
    {
        return { tracked: this.effects.size, accents: this.accents.status(),
            speedVisible: this.speedTrail?.visible ?? false, springVisible: this.springRibbon?.visible ?? false };
    }

    toast (x: number, y: number, message: string, color = '#ffed67')
    {
        const text = this.track(this.scene.add.text(x, y, message, {
            fontFamily: FONT, fontSize: 31, fontStyle: 'bold', color,
            stroke: '#44526e', strokeThickness: 5, align: 'center'
        }).setOrigin(0.5).setDepth(this.depth + 2));

        this.scene.tweens.add({
            targets: text, y: y - 90, alpha: 0, duration: 1050, ease: 'Quad.Out',
            onComplete: () => text.destroy()
        });
    }

    /**
     * A handful of coins hop out of the box, then fly to the top-left counter.
     * `target` is read again when each coin begins its flight, so a resize still homes correctly.
     */
    coins (
        worldX: number,
        worldY: number,
        amount: number,
        perfect: boolean,
        target: () => Point,
        onArrive?: () => void
    )
    {
        this.toast(worldX, worldY - 28, perfect ? `完美 ×2\n+${amount} 金币` : `+${amount} 金币`);

        const start = this.toScreen(worldX, worldY);
        this.accents.wave(worldX, worldY + 18, 0xffe69a, 64, 0.45, 0.45);
        this.accents.burst(worldX, worldY, 'gold', perfect ? 12 : 8);
        const count = Math.min(14, Math.max(8, Math.round(8 + amount / 18)));
        let finished = 0;

        for (let i = 0; i < count; i++)
        {
            const radius = PMath.Between(8, 12) * 1.5;
            const coin = this.coinToken(start.x, start.y, radius).setScale(0.3).setAngle(PMath.Between(-30, 30));
            const spread = PMath.FloatBetween(-Math.PI * 0.85, -Math.PI * 0.15);
            const dist = PMath.Between(48, 128);
            const hopX = start.x + Math.cos(spread) * dist;
            const hopY = start.y + Math.sin(spread) * dist - PMath.Between(16, 54);

            this.scene.tweens.add({
                targets: coin,
                x: hopX,
                y: hopY,
                scale: 1,
                duration: 240,
                delay: i * 32,
                ease: 'Back.Out',
                onComplete: () =>
                {
                    if (!coin.scene)
                    {
                        return;
                    }

                    let goal = target();
                    const from = {x: coin.x, y: coin.y};
                    const control = { x: from.x + (goal.x - from.x) * 0.2 + (i % 2 ? 18 : -18),
                        y: from.y - Math.min(90, Math.abs(goal.y - from.y) * 0.32) };
                    const flight = coin as GameObjects.Container & { flightProgress: number };
                    flight.flightProgress = 0;
                    const angle = coin.angle;
                    let lastMote = -0.1;

                    this.scene.tweens.add({
                        targets: flight,
                        flightProgress: 1,
                        duration: PMath.Between(380, 520),
                        ease: 'Cubic.InOut',
                        onUpdate: () =>
                        {
                            if (!coin.scene) return;
                            goal = target();
                            const t = flight.flightProgress, u = 1 - t;
                            coin.setPosition(u * u * from.x + 2 * u * t * control.x + t * t * goal.x,
                                u * u * from.y + 2 * u * t * control.y + t * t * goal.y)
                                .setScale(1 - t * 0.6).setAngle(angle + t * (i % 2 ? 140 : -140));
                            if (t - lastMote > 0.18)
                            {
                                this.accents.screenMote(coin.x, coin.y);
                                lastMote = t;
                            }
                        },
                        onComplete: () =>
                        {
                            coin.destroy();
                            finished++;

                            if ((finished === 1 || finished === count) && this.scene.sys.isActive())
                            {
                                const arrival = target();
                                this.accents.arrival(arrival.x, arrival.y);
                                onArrive?.();
                            }
                        }
                    });
                }
            });
        }
    }

    /** Floating +N above a landing. `perfect` adds the small caption. */
    popScore (x: number, y: number, meters: number, perfect: boolean)
    {
        const score = this.floatingText(x, y, `+${meters}`, 58, '#fff3a4', '#c24b22');

        this.rise(score, y - 108);

        if (perfect)
        {
            const tag = this.floatingText(x, y - 52, '完美', 28, '#ffffff', '#d4556a');

            this.rise(tag, y - 156);
        }

        this.ring(x, y + 18, 0xffe08a, 320);
    }

    shieldGranted (x: number, y: number)
    {
        this.toast(x, y - 40, '护盾 +1', '#b4f2ff');
        this.ring(x, y, 0x8ad8ff, 420);
        this.accents.wave(x, y + 15, 0xc1f4ff, 78, 0.72, 0.52);
        this.accents.burst(x, y, 'blue', 10);
        this.bubble.setScale(0.15).setAlpha(0);
        this.scene.tweens.killTweensOf(this.bubble);
        this.scene.tweens.add({
            targets: this.bubble,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 340,
            ease: 'Back.Out'
        });
    }

    shieldBroken (x: number, y: number)
    {
        this.bubble.setVisible(false).setScale(1).setAlpha(1);
        this.toast(x, y - 60, '护盾抵挡', '#c2f6ff');
        this.ring(x, y, 0xffffff, 220);
        this.ring(x, y, 0x8ae9ff, 420);

        this.accents.burst(x, y, 'blue', 12);
        this.accents.wave(x, y, 0x9eeeff, 92, 0.8, 0.48);
        const flash = this.track(this.scene.add.circle(x, y, 16, 0xf4fcff, 0.16).setDepth(this.depth - 8));

        this.scene.tweens.add({
            targets: flash, scale: 3.4, alpha: 0, duration: 260, ease: 'Cubic.Out',
            onComplete: () => flash.destroy()
        });

        for (let i = 0; i < 10; i++)
        {
            const angle = Math.PI * 2 * i / 10;
            const shard = this.track(this.scene.add.triangle(x, y, 0, -8, 5, 5, -5, 5, i % 2 ? 0xe8fbff : 0x7ad8ff, 0.72)
                .setStrokeStyle(1, 0xffffff).setAngle(i * 26).setDepth(this.depth + 1));

            this.scene.tweens.add({
                targets: shard,
                x: x + Math.cos(angle) * PMath.Between(70, 130),
                y: y + Math.sin(angle) * PMath.Between(70, 130),
                angle: shard.angle + PMath.Between(80, 200),
                scale: 0.15,
                alpha: 0,
                duration: PMath.Between(380, 520),
                ease: 'Quad.Out',
                onComplete: () => shard.destroy()
            });
        }
    }

    spring (x: number, y: number)
    {
        this.toast(x, y - 60, '弹簧冲刺！', '#fff19b');
        this.ring(x, y, 0xfff6c2, 280);
        this.accents.wave(x, y + 22, 0xffd575, 86, 0.34, 0.52);
        this.accents.burst(x, y, 'spring', 12);
    }

    private coinToken (x: number, y: number, radius: number)
    {
        const coin = this.track(this.scene.add.container(x, y).setScrollFactor(0).setDepth(this.overlayDepth));
        const disc = this.scene.add.circle(0, 0, radius, 0xffd84a).setStrokeStyle(Math.max(2, radius * 0.22), 0x9a5712);
        const shine = this.scene.add.ellipse(-radius * 0.28, -radius * 0.32, radius * 0.72, radius * 0.42, 0xfff7b8, 0.9);
        const mark = this.scene.add.text(0, 1, '$', {
            fontFamily: 'Arial', fontSize: Math.round(radius * 1.35), fontStyle: 'bold', color: '#a56b16'
        }).setOrigin(0.5);

        coin.add([ disc, shine, mark ]);

        return coin;
    }

    private floatingText (x: number, y: number, message: string, fontSize: number, color: string, stroke: string)
    {
        return this.track(this.scene.add.text(x, y, message, {
            fontFamily: FONT, fontSize, fontStyle: 'bold', color,
            stroke, strokeThickness: 8
        }).setOrigin(0.5).setDepth(this.depth + 4).setScale(0.35));
    }

    private rise (text: GameObjects.Text, y: number)
    {
        this.scene.tweens.add({
            targets: text,
            scale: 1,
            duration: 170,
            ease: 'Back.Out',
            onComplete: () =>
            {
                if (!text.scene)
                {
                    return;
                }

                this.scene.tweens.add({
                    targets: text,
                    y,
                    alpha: 0,
                    duration: 680,
                    ease: 'Quad.Out',
                    onComplete: () => text.destroy()
                });
            }
        });
    }

    private toScreen (worldX: number, worldY: number): Point
    {
        const camera = this.scene.cameras.main;

        return {
            x: (worldX - camera.scrollX) * camera.zoom,
            y: (worldY - camera.scrollY) * camera.zoom
        };
    }

    private ring (x: number, y: number, color: number, duration: number)
    {
        const ring = this.track(this.scene.add.circle(x, y, 26).setStrokeStyle(2.2, color, 0.58).setDepth(this.depth - 8));

        this.scene.tweens.add({
            targets: ring, scale: 3, alpha: 0, duration, ease: 'Quad.Out',
            onComplete: () => ring.destroy()
        });
    }

    private track<T extends GameObjects.GameObject> (object: T): T
    {
        this.effects.add(object);
        object.once('destroy', () => this.effects.delete(object));

        return object;
    }

    private destroy ()
    {
        this.accents.destroy();
        this.scene.tweens.killTweensOf(this.glow);
        this.scene.tweens.killTweensOf(this.bubble);

        for (const object of Array.from(this.effects))
        {
            this.scene.tweens.killTweensOf(object);
            object.destroy();
        }

        this.effects.clear();
        this.speedTrail = null;
        this.speedShine = null;
        this.speedTime = 0;
        this.springRibbon = null;
        this.springPoints = [];
    }
}
