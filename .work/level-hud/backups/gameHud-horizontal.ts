import { GameObjects, Geom, Scene } from 'phaser';
import { CoinHud } from './coinHud';
import { levelProgress, LEVEL_GOAL_METERS, type LevelProgress } from './levelProgress';
import { ReturnButton } from './returnButton';

const WIDTH = 688;
const HEIGHT = 214;
const TRACK_X = 40;
const TRACK_Y = 123;
const TRACK_W = WIDTH - TRACK_X * 2;
const TRACK_H = 30;
const FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';
const INK = 0x673642;

/** One screen-fixed header, not three unrelated floating panels. */
export class GameHud
{
    readonly coinHud: CoinHud;
    readonly returnButton: ReturnButton;
    private root: GameObjects.Container;
    private blocker: GameObjects.Rectangle;
    private fill: GameObjects.Graphics;
    private marker: GameObjects.Container;
    private bob: GameObjects.Container;
    private metersText: GameObjects.Text;
    private remainingText: GameObjects.Text;
    private goalText: GameObjects.Text;
    private percentText: GameObjects.Text;
    private flag: GameObjects.Graphics;
    private state: LevelProgress;
    private visual = { ratio: 0 };
    private uiScale = 1;

    constructor (private scene: Scene, depth: number, onMenu: () => void, goal = LEVEL_GOAL_METERS)
    {
        this.state = levelProgress(0, goal);
        // Render alpha stays one: even the empty parts of the header are reliable UI hit targets.
        this.blocker = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0xffffff, 0.001)
            .setScrollFactor(0).setDepth(depth).setInteractive().setData('ui', true);
        this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth + 0.1);
        const art = scene.add.graphics();
        art.fillStyle(0x4f3447, 0.2).fillRoundedRect(3, 6, WIDTH, HEIGHT, 26);
        art.fillStyle(0xfff8e8, 0.98).fillRoundedRect(0, 0, WIDTH, HEIGHT, 26);
        art.lineStyle(4, INK).strokeRoundedRect(0, 0, WIDTH, HEIGHT, 26);
        art.lineStyle(2, 0xffffff).strokeRoundedRect(7, 7, WIDTH - 14, HEIGHT - 14, 20);
        art.fillStyle(0xf5dce6).fillRoundedRect(WIDTH - 118, 12, 96, 90, 19);
        art.lineStyle(2, 0xd0a5b4).strokeRoundedRect(WIDTH - 118, 12, 96, 90, 19);
        this.root.add(art);

        this.coinHud = new CoinHud(scene, depth, this.root);
        this.coinHud.placeWithin(24, 20);
        this.label(WIDTH / 2, 29, '千米冲刺', 24, '#947278');
        this.metersText = this.label(WIDTH / 2, 73, '已走 0 米', 34, '#794731', true);
        this.label(WIDTH - 70, 88, '菜单', 19, '#875269', true);
        this.returnButton = new ReturnButton(scene, depth + 0.2, onMenu);

        const track = scene.add.graphics();
        track.fillStyle(0xb9987b, 0.22).fillRoundedRect(TRACK_X, TRACK_Y + 4, TRACK_W, TRACK_H, 15);
        track.fillStyle(0xf2dfbd).fillRoundedRect(TRACK_X, TRACK_Y, TRACK_W, TRACK_H, 15);
        track.lineStyle(3, 0x966d49).strokeRoundedRect(TRACK_X, TRACK_Y, TRACK_W, TRACK_H, 15);
        this.root.add(track);
        this.fill = scene.add.graphics();
        this.root.add(this.fill);
        const ticks = scene.add.graphics();
        for (let n = 1; n <= 3; n++)
        {
            const x = TRACK_X + TRACK_W * n / 4;
            ticks.lineStyle(2, 0x866f4d, 0.4).lineBetween(x, TRACK_Y + 8, x, TRACK_Y + TRACK_H - 8);
            this.label(x, 170, String(Math.round(this.state.goal * n / 4)), 16, '#ae9270');
        }
        this.root.add(ticks);

        this.marker = scene.add.container(TRACK_X, TRACK_Y + TRACK_H / 2);
        this.bob = scene.add.container(0, 0);
        const rim = scene.add.circle(0, 0, 26, 0xffd34b).setStrokeStyle(3, INK);
        const paper = scene.add.circle(0, 0, 21, 0xfff9e6).setStrokeStyle(2, 0xfff2a2);
        const rider = scene.add.image(0, 0, 'player-idle-0').setScale(47 / 256);
        this.bob.add([ rim, paper, rider ]);
        this.marker.add(this.bob);
        this.root.add(this.marker);
        scene.tweens.add({ targets: this.bob, y: -2, angle: 3, duration: 760, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

        this.remainingText = this.label(TRACK_X, 195, '', 21, '#9a7859').setOrigin(0, 0.5);
        this.percentText = this.label(WIDTH / 2, 195, '', 21, '#4c8848', true);
        this.goalText = this.label(WIDTH - TRACK_X, 195, '', 23, '#794d51', true).setOrigin(1, 0.5);
        this.flag = scene.add.graphics();
        this.flag.lineStyle(3, INK).lineBetween(0, -16, 0, 13);
        for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++)
        {
            this.flag.fillStyle((row + col) % 2 ? 0xfff8e8 : 0x79535f).fillRect(3 + col * 6, -16 + row * 6, 6, 6);
        }
        this.flag.lineStyle(2, INK).strokeRect(3, -16, 18, 18);
        this.root.add(this.flag);
        this.setMeters(0, true);
        this.layout(scene.scale.width, scene.scale.height);
        scene.events.once('shutdown', () => scene.tweens.killTweensOf(this.visual));
    }

    private label (x: number, y: number, text: string, size: number, color: string, bold = false)
    {
        const value = this.scene.add.text(x, y, text, {
            fontFamily: FONT, fontSize: size, fontStyle: bold ? 'bold' : 'normal', color
        }).setOrigin(0.5);
        this.root.add(value);
        return value;
    }

    private fit (text: GameObjects.Text, width: number)
    {
        text.setScale(1);
        if (text.width > width) text.setScale(width / text.width);
    }

    setMeters (meters: number, snap = false)
    {
        const next = levelProgress(meters, this.state.goal);
        const changed = next.meters !== this.state.meters;
        this.state = next;
        this.metersText.setText(`已走 ${next.meters} 米`);
        this.remainingText.setText(next.reached ? '目标达成！' : `还差 ${next.remaining} 米`);
        this.remainingText.setColor(next.reached ? '#4c8848' : '#9a7859');
        this.percentText.setText(`${next.percent}% 完成`);
        this.goalText.setText(`终点 ${next.goal} 米`);
        this.fit(this.metersText, 190);
        this.fit(this.remainingText, 200);
        this.fit(this.goalText, 230);
        this.flag.setPosition(this.goalText.x - this.goalText.displayWidth - 32, 195);
        if (snap)
        {
            this.scene.tweens.killTweensOf(this.visual);
            this.visual.ratio = next.ratio;
            this.drawProgress();
        }
        else if (changed)
        {
            this.scene.tweens.killTweensOf(this.visual);
            this.scene.tweens.add({
                targets: this.visual, ratio: next.ratio, duration: 360, ease: 'Sine.Out',
                onUpdate: () => this.drawProgress()
            });
        }
    }

    private drawProgress ()
    {
        const ratio = Math.max(0, Math.min(1, this.visual.ratio));
        const width = TRACK_W * ratio;
        const graphics = this.fill;
        graphics.clear();
        if (width > 0)
        {
            const radius = Math.min(TRACK_H / 2, width / 2);
            graphics.fillStyle(0x72bd58).fillRoundedRect(TRACK_X, TRACK_Y, width, TRACK_H, radius);
            graphics.fillStyle(0xb5e781, 0.9).fillRoundedRect(TRACK_X + 2, TRACK_Y + 2, Math.max(0, width - 4), 10, Math.min(5, Math.max(0, width - 4) / 2));
            for (let x = TRACK_X + 20; x < TRACK_X + width - 16; x += 38)
            {
                graphics.lineStyle(6, 0xdef4a1, 0.5).lineBetween(x, TRACK_Y + 23, x + 9, TRACK_Y + 15);
            }
        }
        this.marker.x = TRACK_X + width;
    }

    layout (width: number, height: number)
    {
        this.uiScale = Math.max(0.1, Math.min(1.2, (width - 32) / WIDTH, height * 0.25 / HEIGHT));
        this.root.setScale(this.uiScale).setPosition((width - WIDTH * this.uiScale) / 2, 16);
        const box = this.bounds();
        this.blocker.setPosition(box.centerX, box.centerY).setSize(box.width, box.height);
        (this.blocker.input!.hitArea as Geom.Rectangle).setTo(0, 0, box.width, box.height);
        this.returnButton.placeWithin(this.root.x + (WIDTH - 70) * this.uiScale, this.root.y + 47 * this.uiScale, this.uiScale);
    }

    bounds ()
    {
        return new Geom.Rectangle(this.root.x, this.root.y, WIDTH * this.uiScale, HEIGHT * this.uiScale);
    }

    /** Immutable scalar diagnostics for integration tests; no wallet or scene controls. */
    status ()
    {
        const box = this.bounds();
        return {
            ...this.state, displayedRatio: this.visual.ratio,
            bounds: box, blockerBounds: this.blocker.getBounds(),
            menuBounds: new Geom.Rectangle(this.root.x + (WIDTH - 116) * this.uiScale, this.root.y + 11 * this.uiScale, 92 * this.uiScale, 88 * this.uiScale),
            coinBounds: new Geom.Rectangle(this.root.x + 24 * this.uiScale, this.root.y + 20 * this.uiScale, 214 * this.uiScale, 64 * this.uiScale),
            markerX: this.root.x + this.marker.x * this.uiScale,
            trackLeft: this.root.x + TRACK_X * this.uiScale,
            trackRight: this.root.x + (TRACK_X + TRACK_W) * this.uiScale,
            goalText: this.goalText.text, remainingText: this.remainingText.text, currentText: this.metersText.text
        };
    }
}
