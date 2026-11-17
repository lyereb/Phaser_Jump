import { GameObjects, Geom, Scene } from 'phaser';
import { playSfx } from './audio';
import { rankAvatar } from './rankAvatar';
import { RankChaseProgress, type ChaseState } from './rankChaseProgress';
import type { RankedEntry, WeeklyLeaderboard } from './weeklyLeaderboard';

const W = 560;
const H = 108;
const FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';
const INK = 0x673642;

/** Fixed-screen weekly rival display and queued, scene-clock-driven celebration glyphs. */
export class RankChaseHud
{
    private root: GameObjects.Container;
    private content: GameObjects.Container;
    private avatar: GameObjects.Container | null = null;
    private identity: GameObjects.Text;
    private distance: GameObjects.Text;
    private blocker: GameObjects.Rectangle;
    private toastBlocker: GameObjects.Rectangle;
    private tracker: RankChaseProgress;
    private state: ChaseState;
    private revision = '';
    private weekKey: string;
    private scale = 1;
    private toastY = 0;
    private toast: GameObjects.Container | null = null;
    private queue: RankedEntry[] = [];
    private effects = new Set<GameObjects.GameObject>();
    private history: string[] = [];
    private activeMessage: string | null = null;
    private disposed = false;

    constructor (
        private scene: Scene,
        private depth: number,
        private leaderboard: WeeklyLeaderboard,
        private currentMeters: () => number
    )
    {
        const snapshot = leaderboard.snapshot();
        this.weekKey = snapshot.weekKey;
        this.tracker = new RankChaseProgress(snapshot, currentMeters());
        this.state = this.tracker.update(snapshot, currentMeters()).state;
        this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth);
        const card = scene.add.graphics();
        card.fillStyle(0x5a3140, 0.2).fillRoundedRect(-W / 2 + 3, -H / 2 + 5, W, H, 22);
        card.fillStyle(0xfff4cf).fillRoundedRect(-W / 2, -H / 2, W, H, 22);
        card.lineStyle(4, INK).strokeRoundedRect(-W / 2, -H / 2, W, H, 22);
        card.lineStyle(2, 0xffffff, 0.8).strokeRoundedRect(-W / 2 + 6, -H / 2 + 6, W - 12, H - 12, 17);
        this.root.add(card);
        this.content = scene.add.container(0, 0);
        this.root.add(this.content);
        const text = (y: number, size: number, color: string, outline = 0) =>
        {
            const node = scene.add.text(-174, y, '', {
                fontFamily: FONT, fontSize: size, fontStyle: 'bold', color,
                stroke: '#67432d', strokeThickness: outline
            }).setOrigin(0, 0.5);
            this.content.add(node);
            return node;
        };
        this.identity = text(-26, 22, '#795342');
        this.distance = text(20, 33, '#ffda46', 3);
        const blocker = () => scene.add.rectangle(0, 0, 1, 1, 0xffffff, 0.001)
            .setScrollFactor(0).setDepth(depth + 0.1).setInteractive().setData('ui', true);
        this.blocker = blocker();
        this.toastBlocker = blocker().setVisible(false).disableInteractive();
        this.setMeters(currentMeters(), false);
        this.layout(scene.scale.width, scene.scale.height, 104, 350);
        scene.time.addEvent({ delay: 1000, loop: true, callback: () => this.setMeters(this.currentMeters(), false) });
        scene.events.once('shutdown', () => this.destroy());
    }

    setMeters (meters: number, announce = true)
    {
        if (this.disposed) return;
        const snapshot = this.leaderboard.snapshot();
        if (snapshot.weekKey !== this.weekKey)
        {
            this.weekKey = snapshot.weekKey;
            this.queue = [];
            this.history = [];
            this.stopEffects();
        }
        const next = this.tracker.update(snapshot, meters, announce);
        this.state = next.state;
        const target = this.state.target;
        const revision = target ? `${target.id}:${target.name}:${target.avatar}:${target.meters}` : 'leading';
        if (revision !== this.revision)
        {
            this.revision = revision;
            if (this.avatar)
            {
                this.scene.tweens.killTweensOf(this.avatar);
                this.avatar.destroy();
            }
            this.avatar = rankAvatar(this.scene, target?.avatar ?? 5).setPosition(-229, 0).setScale(0.77);
            this.content.add(this.avatar);
            this.scene.tweens.add({ targets: this.avatar, angle: -8, duration: 160, yoyo: true, ease: 'Sine.InOut' });
        }
        this.identity.setFontSize(target ? 22 : 30);
        this.identity.setText(target ? `${target.name}  ·  ID ${target.id}  ·  ${target.meters}米` : '你已经是第一名了');
        this.distance.setText(target ? `离超越${target.name}还剩 ${this.state.remaining} 米` : '继续刷新记录吧');
        this.fit(this.identity, 422);
        this.fit(this.distance, 430);
        for (const entry of next.overtaken) this.queue.push({ ...entry });
        if (!this.toast && this.queue.length) this.playNext();
    }

    private fit (text: GameObjects.Text, width: number)
    {
        text.setScale(text.width > width ? width / text.width : 1);
    }

    /** Layout runs separately from data updates; it never cancels an outstanding celebration. */
    layout (width: number, height: number, cornerBottom: number, scoreBottom: number)
    {
        this.scale = Math.max(0.35, Math.min(1, (width - 40) / W, height * 0.13 / H));
        this.root.setPosition(width / 2, cornerBottom + 16 + H * this.scale / 2).setScale(this.scale);
        this.toastY = scoreBottom + 74 * this.scale;
        const b = this.bounds();
        this.placeBlocker(this.blocker, b);
        if (this.toast) this.toast.setPosition(width / 2, this.toastY).setScale(this.scale);
        this.placeBlocker(this.toastBlocker, this.toastBounds());
    }

    private placeBlocker (node: GameObjects.Rectangle, bounds: Geom.Rectangle)
    {
        node.setPosition(bounds.centerX, bounds.centerY).setSize(bounds.width, bounds.height);
        (node.input!.hitArea as Geom.Rectangle).setTo(0, 0, bounds.width, bounds.height);
    }

    private playNext ()
    {
        if (this.disposed || this.toast || !this.queue.length) return;
        const target = this.queue.shift()!;
        const message = `成功超越${target.name}`;
        this.activeMessage = message;
        this.history.push(message);
        const root = this.scene.add.container(this.scene.scale.width / 2, this.toastY)
            .setScrollFactor(0).setDepth(this.depth + 12).setScale(this.scale);
        this.toast = root;
        this.effects.add(root);
        const chars = Array.from(message).map(char => this.scene.add.text(0, 0, char, {
            fontFamily: FONT, fontSize: 43, fontStyle: 'bold', color: '#fff2a5',
            stroke: '#aa3b55', strokeThickness: 7
        }).setOrigin(0.5));
        const width = chars.reduce((sum, node) => sum + node.width, 0) + (chars.length - 1) * 1;
        let cursor = -width / 2;
        const textScale = Math.min(1, 478 / width);
        chars.forEach((node, i) =>
        {
            node.x = (cursor + node.width / 2) * textScale;
            cursor += node.width + 1;
            node.setScale(textScale * 0.2);
            root.add(node);
            this.scene.tweens.add({
                targets: node, scaleX: textScale, scaleY: textScale, y: -14,
                duration: 170, delay: i * 32, ease: 'Back.Out',
                onComplete: () =>
                {
                    if (node.scene && !this.disposed) this.scene.tweens.add({ targets: node, y: 0, duration: 170, ease: 'Bounce.Out' });
                }
            });
        });
        this.toastBlocker.setVisible(true).setInteractive().setData('ui', true);
        this.placeBlocker(this.toastBlocker, this.toastBounds());
        playSfx(this.scene, 'checkpoint');
        for (let i = 0; i < 12; i++)
        {
            const angle = Math.PI * 2 * i / 12;
            const star = this.scene.add.star(root.x, root.y, 5, 4, 10, i % 3 === 0 ? 0x78d8ff : 0xffe578)
                .setStrokeStyle(2, 0xbe8252).setScrollFactor(0).setDepth(this.depth + 11).setScale(this.scale * 0.4);
            this.effects.add(star);
            this.scene.tweens.add({
                targets: star, x: root.x + Math.cos(angle) * 180 * this.scale,
                y: root.y + Math.sin(angle) * 66 * this.scale - 18 * this.scale,
                alpha: 0, angle: 150, scaleX: this.scale, scaleY: this.scale,
                duration: 750, delay: i * 12, ease: 'Quad.Out',
                onComplete: () => { this.effects.delete(star); star.destroy(); }
            });
        }
        this.scene.tweens.add({
            targets: root, alpha: 0, delay: 1100, duration: 380, ease: 'Sine.In',
            onUpdate: () => root.setPosition(this.scene.scale.width / 2, this.toastY - (1 - root.alpha) * 20 * this.scale),
            onComplete: () =>
            {
                this.effects.delete(root);
                root.destroy();
                if (this.disposed) return;
                this.toast = null;
                this.activeMessage = null;
                this.toastBlocker.setVisible(false).disableInteractive();
                this.playNext();
            }
        });
    }

    bounds ()
    {
        return new Geom.Rectangle(this.root.x - W * this.scale / 2, this.root.y - H * this.scale / 2,
            W * this.scale, (H + 6) * this.scale);
    }

    private toastBounds ()
    {
        return new Geom.Rectangle(this.scene.scale.width / 2 - 260 * this.scale,
            this.toastY - 76 * this.scale, 520 * this.scale, 128 * this.scale);
    }

    status ()
    {
        return {
            ...this.state, target: this.state.target ? { ...this.state.target } : null,
            identity: this.identity.text, message: this.distance.text, bounds: this.bounds(),
            activeMessage: this.activeMessage, queue: this.queue.map(entry => entry.name),
            history: [ ...this.history ], toastBounds: this.toast ? this.toastBounds() : null,
            toastAlpha: this.toast?.alpha ?? 0, toastY: this.toast?.y ?? this.toastY,
            avatar: this.state.target?.avatar ?? 5, effects: this.effects.size
        };
    }

    private stopEffects ()
    {
        for (const effect of this.effects)
        {
            if (!effect.scene) continue;
            if (effect instanceof GameObjects.Container) this.scene.tweens.killTweensOf(effect.getAll());
            this.scene.tweens.killTweensOf(effect);
            effect.destroy();
        }
        this.effects.clear();
        this.toast = null;
        this.activeMessage = null;
        if (this.toastBlocker.scene) this.toastBlocker.setVisible(false).disableInteractive();
    }

    destroy ()
    {
        if (this.disposed) return;
        this.disposed = true;
        this.queue = [];
        this.stopEffects();
    }
}
