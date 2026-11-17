import { GameObjects, Math as PMath, Scene } from 'phaser';
import { playSfx } from '/src/game/audio.ts';
import { CheckpointProgress, checkpointDistance, checkpointTouchesPlayer, type CheckpointBounds } from '/src/game/checkpointProgress.ts';

const BAG = 'checkpoint-bag';
const BAG_HEIGHT = 96;
const BAG_TOP = -6;
const LABEL_Y = 56;

export function loadCheckpointAssets (scene: Scene)
{
    scene.load.image(BAG, 'Checkpoint/checkpoint_bag.png');
}

export function createCheckpointFrames (scene: Scene)
{
    const texture = scene.textures.get(BAG);
    const frame = texture.get('__BASE');
    const half = Math.floor(frame.width / 2);

    if (!texture.has('left'))
    {
        texture.add('left', 0, 0, 0, half, frame.height);
        texture.add('right', 0, half, 0, frame.width - half, frame.height);
    }
}

type Gate = {
    root: GameObjects.Container;
    rope: GameObjects.Graphics;
    bag: GameObjects.Container;
    image: GameObjects.Image;
    meters: number;
    viewportKey: string;
    targetY: number;
};

/** A visual goal, not a solid obstacle or a respawn/save point. */
export class Checkpoints
{
    private progress = new CheckpointProgress();
    private gate: Gate | null = null;
    private effects = new Set<GameObjects.GameObject>();
    private burstCount = 0;
    private lastCompleted: number | null = null;

    constructor (private scene: Scene, private depth: number)
    {
        scene.events.once('shutdown', () => this.destroy());
    }

    /** Always place the next fixed metre milestone, including at the start of a run. */
    prepare (meters: number, x: number, surfaceY: number, playerHeight: number, jumpHeight: number, boxHeight: number)
    {
        const distance = checkpointDistance(this.progress.nextMeters - meters, jumpHeight, boxHeight);
        this.placeGoal(x, surfaceY - playerHeight - distance);
    }

    /** Project a milestone crossed by an automatic ten-box leap into that actual flight. */
    prepareLeap (meters: number, bonus: number, x: number, surfaceY: number, playerHeight: number, boostHeight: number)
    {
        const remaining = this.progress.nextMeters - meters;
        if (remaining > bonus) return;
        const fraction = Math.min(1, Math.max(0, remaining / bonus));
        const distance = Math.max(boostHeight * 0.12, boostHeight * 0.85 * fraction);
        this.placeGoal(x, surfaceY - playerHeight - distance);
    }

    private placeGoal (x: number, y: number)
    {
        if (!this.gate)
        {
            this.gate = this.createGate(this.progress.nextMeters);
            this.gate.root.setPosition(x, y);
            this.gate.targetY = y;
        }
        else
        {
            this.gate.root.x = x;
            if (Math.abs(this.gate.targetY - y) > 0.01)
            {
                this.gate.targetY = y;
                this.scene.tweens.killTweensOf(this.gate.root);
                this.scene.tweens.add({ targets: this.gate.root, y, duration: 260, ease: 'Sine.Out' });
            }
        }
        this.layout();
    }

    /** Contact is immediate in either direction; no score or landing condition. */
    observePlayer (playerX: number, playerY: number, playerWidth: number, playerHeight: number): boolean
    {
        const gate = this.gate;
        if (!gate?.root.visible) return false;
        const player: CheckpointBounds = {
            left: playerX - playerWidth / 2, right: playerX + playerWidth / 2,
            top: playerY - playerHeight / 2, bottom: playerY + playerHeight / 2
        };
        const bag = gate.image.getBounds();
        const camera = this.scene.cameras.main;
        const left = camera.scrollX - 32;
        const right = camera.scrollX + this.scene.scale.width + 32;
        const span = Math.max(Math.abs(left - gate.root.x), Math.abs(right - gate.root.x), 1);
        const overlapLeft = Math.max(player.left, left) - gate.root.x;
        const overlapRight = Math.min(player.right, right) - gate.root.x;
        let rope: CheckpointBounds | null = null;
        if (overlapLeft <= overlapRight)
        {
            const furthest = Math.max(Math.abs(overlapLeft), Math.abs(overlapRight));
            const nearest = overlapLeft <= 0 && overlapRight >= 0 ? 0 : Math.min(Math.abs(overlapLeft), Math.abs(overlapRight));
            rope = {
                left, right,
                top: gate.root.y - 32 * (furthest / span) ** 2 - 5,
                bottom: gate.root.y - 32 * (nearest / span) ** 2 + 5
            };
        }
        if (!checkpointTouchesPlayer(player, bag, rope)) return false;
        const completed = this.progress.touch(gate.meters);
        if (completed === null) return false;
        this.gate = null;
        this.burstCount++;
        this.lastCompleted = completed;
        this.pop(gate);
        playSfx(this.scene, 'checkpoint');
        return true;
    }

    layout ()
    {
        if (this.gate)
        {
            this.drawRope(this.gate);
        }
    }

    /** Visual-only debug preview: does not alter score, next milestone or player state. */
    preview (x: number, y: number, meters = this.progress.nextMeters)
    {
        const gate = this.createGate(meters);
        gate.root.setPosition(x, y);
        this.drawRope(gate);
        this.scene.tweens.add({
            targets: gate.bag,
            scaleX: 1.16,
            scaleY: 0.84,
            delay: 650,
            duration: 130,
            yoyo: true,
            onComplete: () => this.pop(gate)
        });
        playSfx(this.scene, 'checkpoint');
    }

    /** Readable diagnostics for local QA, without exposing mutable game controls. */
    status ()
    {
        return {
            nextMeters: this.progress.nextMeters,
            visible: this.gate?.root.visible ?? false,
            label: this.gate?.meters ?? null,
            worldY: this.gate?.root.y ?? null,
            targetWorldY: this.gate?.targetY ?? null,
            screenY: this.gate ? this.gate.root.y - this.scene.cameras.main.scrollY : null,
            onScreen: this.gate ? this.gate.root.y + BAG_HEIGHT > this.scene.cameras.main.scrollY
                && this.gate.root.y - 32 < this.scene.cameras.main.scrollY + this.scene.scale.height : false,
            bursts: this.burstCount,
            lastCompleted: this.lastCompleted,
            activeEffects: this.effects.size
        };
    }

    private track<T extends GameObjects.GameObject> (object: T): T
    {
        this.effects.add(object);
        object.once('destroy', () => this.effects.delete(object));
        return object;
    }

    private createGate (meters: number): Gate
    {
        const scene = this.scene;
        const root = this.track(scene.add.container(0, 0).setDepth(this.depth));
        const rope = scene.add.graphics();
        const bag = scene.add.container(0, 0);
        const image = scene.add.image(0, BAG_TOP, BAG, '__BASE').setOrigin(0.5, 0);
        image.setScale(BAG_HEIGHT / image.height);

        const text = String(meters);
        const fontSize = Math.min(33, 105 / Math.max(3, text.length));
        const label = scene.add.text(0, LABEL_Y, text, {
            fontFamily: 'Arial, sans-serif',
            fontSize,
            color: '#ffffff',
            stroke: '#a77821',
            strokeThickness: 2,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        if (label.width > image.displayWidth * 0.75)
        {
            label.setScale(image.displayWidth * 0.75 / label.width);
        }

        bag.add([ image, label ]);
        root.add([ rope, bag ]);
        const gate = { root, rope, bag, image, meters, viewportKey: '', targetY: 0 };

        scene.tweens.add({ targets: bag, angle: { from: -3, to: 3 }, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        return gate;
    }

    private drawRope (gate: Gate)
    {
        const graphics = gate.rope;
        const camera = this.scene.cameras.main;
        const viewportKey = `${camera.scrollX}:${this.scene.scale.width}:${gate.root.x}`;
        if (gate.viewportKey === viewportKey)
        {
            return;
        }
        gate.viewportKey = viewportKey;
        const left = camera.scrollX - gate.root.x - 32;
        const right = camera.scrollX + this.scene.scale.width - gate.root.x + 32;
        const span = Math.max(Math.abs(left), Math.abs(right), 1);
        graphics.clear();

        const stroke = (width: number, color: number, offset = 0) =>
        {
            graphics.lineStyle(width, color, 1);
            graphics.beginPath();
            for (let i = 0; i <= 48; i++)
            {
                const x = left + (right - left) * i / 48;
                const y = -32 * (x / span) ** 2 + offset;
                if (i === 0) graphics.moveTo(x, y);
                else graphics.lineTo(x, y);
            }
            graphics.strokePath();
        };

        stroke(10, 0x61352d);
        stroke(6, 0xe34d3e);
        stroke(1.5, 0xff9270, -1.5);
    }

    private pop (gate: Gate)
    {
        const { scene } = this;
        scene.tweens.killTweensOf(gate.bag);
        gate.bag.setAngle(0).setScale(1);
        scene.tweens.add({
            targets: gate.bag,
            scaleX: 1.24,
            scaleY: 0.8,
            duration: 110,
            ease: 'Quad.In',
            onComplete: () =>
            {
                const { x, y } = gate.root;
                gate.bag.setVisible(false);
                this.fragments(x, y, gate.image.scale);
                scene.tweens.add({
                    targets: gate.root,
                    alpha: 0,
                    duration: 280,
                    onComplete: () => gate.root.destroy()
                });
            }
        });
    }

    private fragments (x: number, y: number, scale: number)
    {
        const { scene } = this;
        const frame = scene.textures.get(BAG).get('__BASE');
        const halfWidth = frame.width * scale / 4;

        for (const sign of [ -1, 1 ])
        {
            const half = this.track(scene.add.image(x + sign * halfWidth, y + BAG_TOP + BAG_HEIGHT / 2, BAG, sign < 0 ? 'left' : 'right')
                .setScale(scale).setDepth(this.depth + 1));
            scene.tweens.add({ targets: half, x: half.x + sign * 76, y: half.y - 50, angle: sign * 45, duration: 180, ease: 'Quad.Out', onComplete: () =>
            {
                scene.tweens.add({ targets: half, x: half.x + sign * 60, y: half.y + 145, angle: sign * 135, alpha: 0, duration: 650, ease: 'Quad.In', onComplete: () => half.destroy() });
            } });
        }

        const flash = this.track(scene.add.circle(x, y + 38, 18, 0xfff8c8, 0.85).setDepth(this.depth - 1));
        scene.tweens.add({ targets: flash, scale: 6, alpha: 0, duration: 330, ease: 'Quad.Out', onComplete: () => flash.destroy() });

        const colors = [ 0xffdc24, 0xffec72, 0xf05a49, 0xffa840 ];
        for (let i = 0; i < 26; i++)
        {
            const color = colors[i % colors.length];
            const piece = this.track(scene.add.rectangle(x, y + 38, PMath.Between(5, 10), PMath.Between(8, 15), color)
                .setStrokeStyle(1, 0x9c602a).setAngle(PMath.Between(0, 180)).setDepth(this.depth + 2));
            const dx = PMath.Between(-165, 165);
            const up = PMath.Between(45, 130);
            scene.tweens.add({ targets: piece, x: x + dx * 0.55, y: y + 38 - up, angle: piece.angle + PMath.Between(-160, 160), duration: 220, ease: 'Quad.Out', onComplete: () =>
            {
                scene.tweens.add({ targets: piece, x: x + dx, y: y + 180, angle: piece.angle + PMath.Between(-220, 220), alpha: 0, scale: 0.4, duration: PMath.Between(500, 800), ease: 'Quad.In', onComplete: () => piece.destroy() });
            } });
        }
    }

    private destroy ()
    {
        this.gate = null;
        for (const object of Array.from(this.effects))
        {
            this.scene.tweens.killTweensOf(object);
            if (object instanceof GameObjects.Container)
            {
                this.scene.tweens.killTweensOf(object.list);
            }
            object.destroy();
        }
        this.effects.clear();
    }
}
