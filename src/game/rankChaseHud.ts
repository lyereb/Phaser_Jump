import { GameObjects, Geom, Scene } from 'phaser';
import { MeterDigits } from './letters';
import { OvertakeCelebration } from './overtakeCelebration';
import { rankAvatar } from './rankAvatar';
import { RankChaseProgress, type ChaseState } from './rankChaseProgress';
import type { RankedEntry, WeeklyLeaderboard } from './weeklyLeaderboard';

const W = 560;
const H = 84;
const FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';

/** No card or identity detail: only rider avatar, chase sentence, and original art digits. */
export class RankChaseHud
{
    private root: GameObjects.Container;
    private content: GameObjects.Container;
    private avatar: GameObjects.Container | null = null;
    private prefix: GameObjects.Text;
    private suffix: GameObjects.Text;
    private digits: MeterDigits;
    private blocker: GameObjects.Rectangle;
    private toastBlocker: GameObjects.Rectangle;
    private tracker: RankChaseProgress;
    private state: ChaseState;
    private celebration: OvertakeCelebration;
    private revision = '';
    private weekKey: string;
    private scale = 1;
    private queue: RankedEntry[] = [];
    private history: string[] = [];
    private activeMessage: string | null = null;
    private disposed = false;

    constructor (
        private scene: Scene,
        depth: number,
        private leaderboard: WeeklyLeaderboard,
        private currentMeters: () => number
    )
    {
        const snapshot = leaderboard.snapshot();
        this.weekKey = snapshot.weekKey;
        this.tracker = new RankChaseProgress(snapshot, currentMeters());
        this.state = this.tracker.update(snapshot, currentMeters()).state;
        this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth);
        this.content = scene.add.container(0, 0);
        this.root.add(this.content);
        const text = () =>
        {
            const node = scene.add.text(0, 0, '', {
                fontFamily: FONT, fontSize: 29, fontStyle: 'bold', color: '#fff9dd',
                stroke: '#814c60', strokeThickness: 5
            }).setOrigin(0, 0.5);
            this.content.add(node);
            return node;
        };
        this.prefix = text();
        this.suffix = text();
        this.digits = new MeterDigits(scene, depth, { parent: this.content, height: 48 });
        const blocker = () => scene.add.rectangle(0, 0, 1, 1, 0xffffff, 0.001)
            .setScrollFactor(0).setDepth(depth + 0.1).setInteractive().setData('ui', true);
        this.blocker = blocker();
        this.toastBlocker = blocker().setVisible(false).disableInteractive();
        this.celebration = new OvertakeCelebration(scene, depth + 12);
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
        const revision = target ? `${target.id}:${target.name}:${target.avatar}` : 'leading';
        if (revision !== this.revision)
        {
            this.revision = revision;
            if (this.avatar)
            {
                this.scene.tweens.killTweensOf(this.avatar);
                this.avatar.destroy();
            }
            this.avatar = rankAvatar(this.scene, target?.avatar ?? 5).setScale(0.72);
            this.content.add(this.avatar);
            this.scene.tweens.add({ targets: this.avatar, angle: -8, duration: 160, yoyo: true, ease: 'Sine.InOut' });
        }
        this.prefix.setText(target ? `距离超越${target.name}还剩` : '你已经是第一名了');
        this.suffix.setText(target ? '米' : '继续刷新记录吧');
        this.digits.setVisible(!!target);
        if (target)
        {
            this.digits.setValue(this.state.remaining);
            this.digits.fitToWidth(156);
        }
        this.arrangeLine();
        for (const entry of next.overtaken) this.queue.push({ ...entry });
        if (!this.activeMessage && this.queue.length) this.playNext();
    }

    private arrangeLine ()
    {
        const avatarW = 68;
        const numberW = this.state.target ? this.digits.status().width : 0;
        const textW = this.state.target ? this.prefix.width + 8 + numberW + 7 + this.suffix.width
            : Math.max(this.prefix.width, this.suffix.width);
        const width = avatarW + 18 + textW;
        const left = -width / 2;
        this.avatar?.setPosition(left + avatarW / 2, 0);
        const textX = left + avatarW + 18;
        if (this.state.target)
        {
            this.prefix.setPosition(textX, 0);
            this.digits.setPosition(textX + this.prefix.width + 8 + numberW / 2, 0);
            this.suffix.setPosition(textX + this.prefix.width + 8 + numberW + 7, 0);
        }
        else
        {
            this.prefix.setPosition(textX, -20);
            this.suffix.setPosition(textX, 20);
        }
        this.content.setScale(Math.min(1, W / width));
    }

    layout (width: number, height: number, cornerBottom: number, scoreBottom: number)
    {
        this.scale = Math.max(0.35, Math.min(1, (width - 40) / W, height * 0.13 / H));
        this.root.setPosition(width / 2, cornerBottom + 16 + H * this.scale / 2).setScale(this.scale);
        this.placeBlocker(this.blocker, this.bounds());
        this.celebration.layout(width, height, scoreBottom);
        this.placeBlocker(this.toastBlocker, this.celebrationTextBounds());
    }

    private placeBlocker (node: GameObjects.Rectangle, bounds: Geom.Rectangle)
    {
        node.setPosition(bounds.centerX, bounds.centerY).setSize(bounds.width, bounds.height);
        (node.input!.hitArea as Geom.Rectangle).setTo(0, 0, bounds.width, bounds.height);
    }

    private playNext ()
    {
        if (this.disposed || this.activeMessage || !this.queue.length) return;
        const target = this.queue.shift()!;
        this.activeMessage = `成功超越${target.name}`;
        this.history.push(this.activeMessage);
        this.celebration.play(target.name, () =>
        {
            if (this.disposed) return;
            this.activeMessage = null;
            this.toastBlocker.setVisible(false).disableInteractive();
            this.playNext();
        });
        this.toastBlocker.setVisible(true).setInteractive().setData('ui', true);
        this.placeBlocker(this.toastBlocker, this.celebrationTextBounds());
    }

    /** Confetti is decoration, not a control: keep normal jump taps working beneath the headline. */
    private celebrationTextBounds ()
    {
        const effect = this.celebration.status();
        if (!effect.active) return new Geom.Rectangle(this.scene.scale.width / 2, effect.y, 0, 0);
        const scale = effect.bounds.width / 748;
        return new Geom.Rectangle(this.scene.scale.width / 2 - 350 * scale,
            effect.bounds.top, 700 * scale, 142 * scale);
    }

    bounds ()
    {
        return new Geom.Rectangle(this.root.x - W * this.scale / 2, this.root.y - H * this.scale / 2,
            W * this.scale, (H + 6) * this.scale);
    }

    status ()
    {
        const effect = this.celebration.status();
        return {
            ...this.state, target: this.state.target ? { ...this.state.target } : null,
            identity: this.state.target ? '' : this.prefix.text,
            message: this.state.target ? `${this.prefix.text} ${this.state.remaining} 米` : this.suffix.text,
            bounds: this.bounds(), framed: false, digits: this.digits.status(),
            activeMessage: this.activeMessage, queue: this.queue.map(entry => entry.name), history: [ ...this.history ],
            toastBounds: effect.active ? this.celebrationTextBounds() : null, toastAlpha: effect.alpha, toastY: effect.y,
            avatar: this.state.target?.avatar ?? 5, effects: effect.effects, celebration: effect
        };
    }

    private stopEffects ()
    {
        this.celebration.stop();
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
