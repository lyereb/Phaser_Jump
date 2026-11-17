import { GameObjects, Geom, Scene, type Time, type Tweens, type Types } from 'phaser';
import { playSfx } from './audio';

const FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';
const COLORS = [ 0xffd447, 0xff5599, 0x43cfff, 0xffef91, 0xff8ebd, 0x91eaff ];
const DURATION = 1880;
const CONFETTI_COUNT = 60;
// Includes the maximum 1.15 punch, glyph jump, and the whole ballistic trail.
const HALF_WIDTH = 374;
const ABOVE = 68;
const BELOW = 246;
const MAX_TEXT_OBJECTS = 60;

/** A screen-fixed celebration. Only this scene's Clock/TweenManager advances it. */
export class OvertakeCelebration
{
    private root: GameObjects.Container | null = null;
    private stage: GameObjects.Container | null = null;
    private objects = new Set<GameObjects.GameObject>();
    private tweens = new Set<Tweens.Tween>();
    private timers = new Set<Time.TimerEvent>();
    private active = false;
    private disposed = false;
    private epoch = 0;
    private message: string | null = null;
    private complete: (() => void) | null = null;
    private centerX = 0;
    private anchorY = 74;
    private screenScale = 1;
    private confettiCount = 0;
    private burstCount = 0;

    constructor (private scene: Scene, private depth: number)
    {
        this.layout(scene.scale.width, scene.scale.height, 0);
        scene.events.once('shutdown', this.onShutdown, this);
        scene.events.once('destroy', this.onShutdown, this);
    }

    play (name: string, onComplete: () => void): void
    {
        this.stop();
        if (this.disposed) return;

        this.active = true;
        this.message = `成功超越${name}`;
        this.complete = onComplete;
        const epoch = this.epoch;
        const root = this.scene.add.container(this.centerX, this.anchorY)
            .setScrollFactor(0).setDepth(this.depth).setScale(this.screenScale);
        this.root = this.keep(root);
        const stage = this.keep(this.scene.add.container(0, 0).setScrollFactor(0));
        root.add(stage);
        this.stage = stage;
        stage.setScale(0.62);

        this.makeBackdrop(stage, epoch);
        this.makeRing(stage, 75, 0xffd447, epoch);
        this.makeRing(stage, 625, 0x43cfff, epoch);
        this.makeBurst(stage, -206, 18, 185, 0xffd447, epoch);
        this.makeBurst(stage, 206, 22, 645, 0xff5599, epoch);
        this.makeConfetti(stage, epoch);
        this.makeLetters(stage, this.message, epoch);

        // Two deliberate squash-free overshoots, not camera shake. Sine/Bounce
        // never exceed the explicit 1.15 peak, even if layout changes mid-punch.
        this.tween({
            targets: stage, scaleX: 1.15, scaleY: 1.15, duration: 150, ease: 'Sine.Out',
            onComplete: () =>
            {
                if (!this.live(epoch)) return;
                this.tween({ targets: stage, scaleX: 1, scaleY: 1, duration: 190, ease: 'Bounce.Out' });
            }
        });
        this.after(600, epoch, () =>
        {
            this.tween({
                targets: stage, scaleX: 1.15, scaleY: 1.15, duration: 100, ease: 'Sine.Out',
                onComplete: () =>
                {
                    if (!this.live(epoch)) return;
                    this.tween({ targets: stage, scaleX: 1, scaleY: 1, duration: 225, ease: 'Bounce.Out' });
                }
            });
        });
        this.tween({
            targets: stage, alpha: 0, y: 10, delay: DURATION - 400, duration: 400, ease: 'Sine.In',
            onComplete: () =>
            {
                if (!this.live(epoch)) return;
                // Bind cleanup to visible completion, not a separate clock under frame drops.
                // Clear before notifying: the parent may immediately play the next rival.
                const complete = this.complete;
                this.complete = null;
                this.stop();
                complete?.();
            }
        });
        playSfx(this.scene, 'overtake');
    }

    /** top is the already laid-out artistic-meter bottom, in screen pixels. */
    layout (width: number, height: number, top: number): void
    {
        width = Math.max(1, Number.isFinite(width) ? width : this.scene.scale.width);
        height = Math.max(1, Number.isFinite(height) ? height : this.scene.scale.height);
        top = Math.max(0, Number.isFinite(top) ? top : 0);
        this.centerX = width / 2;
        // This offset intentionally is NOT scaled: even landscape leaves HUD clearance.
        this.anchorY = top + 74;
        this.screenScale = Math.max(0.01, Math.min(1,
            Math.max(1, width - 24) / (HALF_WIDTH * 2), height / 560,
            Math.max(1, height - this.anchorY - 12) / BELOW));
        if (this.root?.scene)
        {
            this.root.setPosition(this.centerX, this.anchorY).setScale(this.screenScale);
        }
        // Do not seek, restart, or alter any tween/timer here (also safe when paused).
    }

    /** Silent cancellation; never notifies the parent or starts a queued play. */
    stop (): void
    {
        this.active = false;
        ++this.epoch;
        this.complete = null;
        this.message = null;
        // Invalidate callbacks first. remove/destroy do not emit tween onStop callbacks.
        for (const timer of this.timers)
        {
            timer.remove(false);
            this.scene.time.removeEvent(timer);
            timer.destroy();
        }
        this.timers.clear();
        for (const tween of this.tweens)
        {
            if (tween.isDestroyed()) continue;
            tween.remove();
            tween.destroy();
        }
        this.tweens.clear();
        // Container destruction recursively owns its children. Reverse traversal also
        // covers an independently destroyed root, without touching dead scene objects.
        for (const object of Array.from(this.objects).reverse())
        {
            if (object.scene) object.destroy();
        }
        this.objects.clear();
        this.root = null;
        this.stage = null;
        this.confettiCount = 0;
        this.burstCount = 0;
    }

    status (): {
        active: boolean; message: string | null; effects: number; alpha: number;
        y: number; scale: number; bounds: Geom.Rectangle; confettiCount: number;
        burstCount: number; duration: number;
    }
    {
        const active = this.active && !!this.root?.scene && !!this.stage?.scene;
        const effects = active ? Array.from(this.objects).filter(object => !!object.scene).length : 0;
        return {
            active, message: active ? this.message : null, effects,
            alpha: active ? this.stage!.alpha * this.root!.alpha : 0,
            y: this.anchorY + (active ? this.stage!.y * this.screenScale : 0),
            scale: this.screenScale * (active ? this.stage!.scaleX : 1),
            // Conservative whole-effect screen bounds for the parent's UI blocker.
            // Inactive bounds are empty; returned rectangles are independent snapshots.
            bounds: active ? new Geom.Rectangle(
                this.centerX - HALF_WIDTH * this.screenScale,
                this.anchorY - ABOVE * this.screenScale,
                HALF_WIDTH * 2 * this.screenScale, (ABOVE + BELOW) * this.screenScale
            ) : new Geom.Rectangle(this.centerX, this.anchorY, 0, 0),
            confettiCount: active ? this.confettiCount : 0,
            burstCount: active ? this.burstCount : 0,
            duration: DURATION
        };
    }

    private keep<T extends GameObjects.GameObject> (object: T): T
    {
        this.objects.add(object);
        return object;
    }

    private graphic (parent: GameObjects.Container): GameObjects.Graphics
    {
        const graphics = this.keep(this.scene.add.graphics().setScrollFactor(0));
        parent.add(graphics);
        return graphics;
    }

    private live (epoch: number): boolean
    {
        return this.active && !this.disposed && this.epoch === epoch && !!this.root?.scene;
    }

    private tween (config: Types.Tweens.TweenBuilderConfig): void
    {
        // Keep completed handles too; some may already be destroyed at scene shutdown.
        this.tweens.add(this.scene.tweens.add(config));
    }

    private after (delay: number, epoch: number, callback: () => void): void
    {
        const timer = this.scene.time.delayedCall(delay, () =>
        {
            this.timers.delete(timer);
            if (this.live(epoch)) callback();
        });
        this.timers.add(timer);
    }

    private makeBackdrop (parent: GameObjects.Container, epoch: number): void
    {
        const rays = this.graphic(parent);
        // Shallow elliptical comic rays cannot spill into the meters or menu above.
        for (let i = 0; i < 16; i++)
        {
            const angle = i * Math.PI * 2 / 16;
            const spread = 0.057;
            rays.fillStyle(COLORS[i % COLORS.length], i % 2 ? 0.2 : 0.27);
            rays.fillTriangle(
                Math.cos(angle) * 88, 18 + Math.sin(angle) * 18,
                Math.cos(angle - spread) * 323, 18 + Math.sin(angle - spread) * 62,
                Math.cos(angle + spread) * 323, 18 + Math.sin(angle + spread) * 62);
        }
        rays.setAlpha(0).setScale(0.8);
        this.tween({ targets: rays, alpha: 1, scaleX: 1, scaleY: 1, duration: 220, ease: 'Cubic.Out' });
        this.after(850, epoch, () =>
        {
            this.tween({ targets: rays, alpha: 0.35, duration: 520, ease: 'Sine.InOut' });
        });

        const glow = this.graphic(parent);
        glow.fillStyle(0xff5599, 0.08).fillEllipse(0, 8, 594, 110);
        glow.fillStyle(0xffd447, 0.13).fillEllipse(0, 8, 558, 96);
        glow.fillStyle(0xffefb0, 0.2).fillEllipse(0, 8, 506, 82);
        glow.setAlpha(0);
        this.tween({ targets: glow, alpha: 1, duration: 170, ease: 'Sine.Out' });
    }

    private makeLetters (parent: GameObjects.Container, message: string, epoch: number): void
    {
        const letters = this.keep(this.scene.add.container(0, 0).setScrollFactor(0));
        parent.add(letters);
        const chars = Array.from(message);
        // Usually one object per Unicode glyph. Pathologically long names are grouped
        // without dropping any text: 60 paper + 60 text + 9 structural objects = 129.
        const chunkSize = Math.max(1, Math.ceil(chars.length / MAX_TEXT_OBJECTS));
        const nodes: GameObjects.Text[] = [];
        for (let i = 0; i < chars.length; i += chunkSize)
        {
            const node = this.keep(this.scene.add.text(0, 16, chars.slice(i, i + chunkSize).join(''), {
                fontFamily: FONT, fontSize: 70, fontStyle: 'bold', color: '#ffe66b',
                stroke: '#aa315f', strokeThickness: 8,
                shadow: { offsetX: 0, offsetY: 4, color: '#713758', blur: 0, fill: true, stroke: true }
            }).setOrigin(0.5).setScrollFactor(0).setAlpha(0));
            nodes.push(node);
            letters.add(node);
        }
        // Stroke and shadow are already present in measured Text dimensions.
        const width = nodes.reduce((total, node) => total + node.width, 0) + (nodes.length - 1) * 2;
        const fit = Math.min(1, 630 / Math.max(1, width));
        let cursor = -width / 2;
        const stagger = Math.min(27, 330 / Math.max(1, nodes.length - 1));
        nodes.forEach((node, i) =>
        {
            node.x = (cursor + node.width / 2) * fit;
            cursor += node.width + 2;
            node.setScale(fit * 0.16);
            this.tween({
                targets: node, alpha: 1, scaleX: fit, scaleY: fit, y: -8,
                delay: 25 + i * stagger, duration: 135, ease: 'Cubic.Out',
                onComplete: () =>
                {
                    if (!this.live(epoch) || !node.scene) return;
                    this.tween({ targets: node, y: 0, duration: 170, ease: 'Bounce.Out' });
                }
            });
        });
    }

    private makeConfetti (parent: GameObjects.Container, epoch: number): void
    {
        for (let i = 0; i < CONFETTI_COUNT; i++)
        {
            const side = i % 2 === 0 ? -1 : 1;
            const batch = Math.floor(i / 20);
            const index = Math.floor(i / 2) % 10;
            const paper = this.graphic(parent);
            const color = COLORS[(i + batch) % COLORS.length];
            const length = 12 + i % 5;
            const thickness = 7 + i % 3;
            paper.fillStyle(color).fillRoundedRect(-length / 2, -thickness / 2, length, thickness, 1);
            paper.lineStyle(1, 0xffffff, 0.7).strokeRoundedRect(-length / 2, -thickness / 2, length, thickness, 1);
            const startX = side * (265 + index * 1.1);
            const startY = 110 + index % 3 * 5;
            const velocityX = -side * (115 + index * 10 + batch * 12);
            const velocityY = 490 + index * 3;
            paper.setPosition(startX, startY).setAngle(i * 47).setVisible(false);
            this.tween({
                targets: paper, angle: paper.angle + side * (480 + index * 43),
                delay: 90 + batch * 145 + index * 9, duration: 1180, ease: 'Linear',
                onStart: () =>
                {
                    if (this.live(epoch) && paper.scene) paper.setVisible(true);
                },
                onUpdate: (tween: Tweens.Tween) =>
                {
                    if (!this.live(epoch) || !paper.scene) return;
                    const p = tween.data[0].progress;
                    const seconds = p * 1.18;
                    // Analytical ballistic motion, no Arcade bodies or global frame loop.
                    paper.x = startX + velocityX * seconds + Math.sin(p * 16 + i) * 9;
                    paper.y = startY - velocityY * seconds + 430 * seconds * seconds;
                    paper.alpha = p < 0.68 ? 1 : Math.max(0, (1 - p) / 0.32);
                    paper.setScale(0.28 + Math.abs(Math.cos(p * 14 + i)) * 0.72, 1);
                },
                onComplete: () =>
                {
                    if (!this.live(epoch)) return;
                    this.objects.delete(paper);
                    if (paper.scene) paper.destroy();
                }
            });
        }
        this.confettiCount = CONFETTI_COUNT;
    }

    private makeRing (parent: GameObjects.Container, delay: number, color: number, epoch: number): void
    {
        const ring = this.graphic(parent);
        ring.lineStyle(5, color, 0.9).strokeEllipse(0, 18, 484, 88);
        ring.lineStyle(2, 0xffffff, 0.85).strokeEllipse(0, 18, 470, 80);
        ring.setVisible(false).setScale(0.24);
        this.tween({
            targets: ring, scaleX: 1.2, scaleY: 1.2, alpha: 0,
            delay, duration: 510, ease: 'Cubic.Out',
            onStart: () =>
            {
                if (this.live(epoch) && ring.scene) ring.setVisible(true);
            }
        });
    }

    private makeBurst (
        parent: GameObjects.Container, x: number, y: number, delay: number, color: number, epoch: number
    ): void
    {
        const burst = this.graphic(parent).setPosition(x, y).setVisible(false);
        // One Graphics per firework, with 12 expanding stars and 12 luminous streaks.
        // Tweening its angle supplies progress without extra clock/update listeners.
        this.tween({
            targets: burst, angle: 12, delay, duration: 690, ease: 'Linear',
            onStart: () =>
            {
                if (this.live(epoch) && burst.scene) burst.setVisible(true);
            },
            onUpdate: (tween: Tweens.Tween) =>
            {
                if (!this.live(epoch) || !burst.scene) return;
                const p = tween.data[0].progress;
                const spread = 1 - Math.pow(1 - p, 3);
                burst.clear().setAngle(0).setAlpha(Math.min(1, (1 - p) * 2.4));
                burst.lineStyle(3 * (1 - p) + 1, color, 0.85);
                for (let i = 0; i < 12; i++)
                {
                    const angle = i * Math.PI * 2 / 12 + (x < 0 ? 0.14 : 0.4);
                    const radiusX = 14 + spread * 76;
                    const radiusY = 8 + spread * 36;
                    const sx = Math.cos(angle) * radiusX;
                    const sy = Math.sin(angle) * radiusY;
                    burst.lineBetween(sx * 0.57, sy * 0.57, sx * 0.88, sy * 0.88);
                    this.star(burst, sx, sy, (5 + (i % 3) * 2) * (1 - p * 0.55),
                        i % 2 ? color : 0xffffff);
                }
                burst.lineStyle(2, 0xffffff, 0.8).strokeEllipse(0, 0, 18 + spread * 55, 12 + spread * 30);
            }
        });
        ++this.burstCount;
    }

    private star (graphics: GameObjects.Graphics, x: number, y: number, radius: number, color: number): void
    {
        graphics.fillStyle(color).beginPath();
        for (let i = 0; i < 10; i++)
        {
            const angle = -Math.PI / 2 + i * Math.PI / 5;
            const r = i % 2 ? radius * 0.44 : radius;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            if (i === 0) graphics.moveTo(px, py);
            else graphics.lineTo(px, py);
        }
        graphics.closePath().fillPath();
    }

    private onShutdown (): void
    {
        this.disposed = true;
        this.stop();
        this.scene.events.off('shutdown', this.onShutdown, this);
        this.scene.events.off('destroy', this.onShutdown, this);
    }
}
