import { GameObjects, Geom, Scene } from 'phaser';
import { CoinHud } from './coinHud';
import { levelProgress, LEVEL_GOAL_METERS, type LevelProgress } from './levelProgress';
import { ReturnButton } from './returnButton';

const TRACK_X = 30;
const TRACK_W = 22;
const COLUMN_W = 152;
const FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';
const INK = 0x673642;

/** Corner controls and a minimal, screen-fixed vertical goal indicator. */
export class GameHud
{
    readonly coinHud: CoinHud;
    readonly returnButton: ReturnButton;
    private root: GameObjects.Container;
    private coinBlocker: GameObjects.Rectangle;
    private railBlocker: GameObjects.Rectangle;
    private track: GameObjects.Graphics;
    private fill: GameObjects.Graphics;
    private marker: GameObjects.Container;
    private bob: GameObjects.Container;
    private tickArt: GameObjects.Graphics;
    private ticks: GameObjects.Text[] = [];
    private goalText: GameObjects.Text;
    private state: LevelProgress;
    private visual = { ratio: 0 };
    private uiScale = 1;
    private trackHeight = 520;

    constructor (private scene: Scene, depth: number, onMenu: () => void, goal = LEVEL_GOAL_METERS)
    {
        this.state = levelProgress(0, goal);
        this.root = scene.add.container(16, 0).setScrollFactor(0).setDepth(depth + 0.1);
        const blocker = () => scene.add.rectangle(0, 0, 1, 1, 0xffffff, 0.001)
            .setScrollFactor(0).setDepth(depth).setInteractive().setData('ui', true);
        this.coinBlocker = blocker();
        this.railBlocker = blocker();
        // No shared header or independent coin panel: the coin is a flat corner counter.
        this.coinHud = new CoinHud(scene, depth + 0.1);
        this.returnButton = new ReturnButton(scene, depth + 0.2, onMenu);
        this.track = scene.add.graphics();
        this.fill = scene.add.graphics();
        this.tickArt = scene.add.graphics();
        this.root.add([ this.track, this.fill, this.tickArt ]);

        for (let n = 1; n <= 3; n++)
        {
            const label = this.label(66, 0, String(Math.round(this.state.goal * n / 4)), 23);
            this.ticks.push(label);
        }
        this.goalText = this.label(66, -40, `终点\n${this.state.goal}米`, 23);
        const flag = scene.add.graphics();
        flag.lineStyle(3, INK).lineBetween(0, 0, 0, 31);
        for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++)
        {
            flag.fillStyle((row + col) % 2 ? 0xfff8e8 : INK).fillRect(3 + col * 6, row * 6, 6, 6);
        }
        flag.lineStyle(2, INK).strokeRect(3, 0, 18, 18);
        flag.setPosition(TRACK_X - 8, -56);
        this.root.add(flag);

        this.marker = scene.add.container(TRACK_X, this.trackHeight);
        this.bob = scene.add.container(0, 0);
        const rim = scene.add.circle(0, 0, 25, 0xffd34b).setStrokeStyle(3, INK);
        const paper = scene.add.circle(0, 0, 20, 0xfff9e6);
        const rider = scene.add.image(0, 0, 'player-idle-0').setScale(45 / 256);
        this.bob.add([ rim, paper, rider ]);
        this.marker.add(this.bob);
        this.root.add(this.marker);
        scene.tweens.add({ targets: this.bob, angle: 3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        this.setMeters(0, true);
        this.layout(scene.scale.width, scene.scale.height);
        scene.events.once('shutdown', () => scene.tweens.killTweensOf(this.visual));
    }

    private label (x: number, y: number, value: string, fontSize: number)
    {
        const label = this.scene.add.text(x, y, value, {
            fontFamily: FONT, fontSize, fontStyle: 'bold', color: '#fff5db',
            stroke: '#704735', strokeThickness: 4, lineSpacing: 2
        }).setOrigin(0, 0.5);
        this.root.add(label);
        return label;
    }

    setMeters (meters: number, snap = false)
    {
        const next = levelProgress(meters, this.state.goal);
        const ratioChanged = next.ratio !== this.state.ratio;
        this.state = next;
        if (snap)
        {
            this.scene.tweens.killTweensOf(this.visual);
            this.visual.ratio = next.ratio;
            this.drawProgress();
        }
        else if (ratioChanged)
        {
            this.scene.tweens.killTweensOf(this.visual);
            this.scene.tweens.add({
                targets: this.visual, ratio: next.ratio, duration: 360, ease: 'Sine.Out',
                onUpdate: () => this.drawProgress()
            });
        }
        // Past the goal, the ratio stays one: no new movement tween is created.
    }

    private drawProgress ()
    {
        const ratio = Math.max(0, Math.min(1, this.visual.ratio));
        const height = this.trackHeight * ratio;
        const top = this.trackHeight - height;
        const x = TRACK_X - TRACK_W / 2;
        const graphics = this.fill;
        graphics.clear();
        if (height > 0)
        {
            graphics.fillStyle(0x77c259).fillRoundedRect(x, top, TRACK_W, height, Math.min(TRACK_W / 2, height / 2));
            if (height > 4) graphics.fillStyle(0xc0ed8a, 0.8).fillRoundedRect(x + 3, top + 2, 6, height - 4, Math.min(3, (height - 4) / 2));
            for (let y = top + 20; y < this.trackHeight - 18; y += 36)
            {
                graphics.lineStyle(4, 0xecf9b5, 0.45).lineBetween(x + 10, y, x + 17, y - 6);
            }
        }
        this.marker.y = top;
    }

    layout (width: number, height: number)
    {
        this.uiScale = Math.max(0.35, Math.min(1, (width - 32) / 480, height / 840));
        this.trackHeight = Math.min(560, height * 0.42) / this.uiScale;
        this.root.setPosition(16, height * 0.35).setScale(this.uiScale);
        const x = TRACK_X - TRACK_W / 2;
        this.track.clear();
        this.track.fillStyle(0x4f3447, 0.25).fillRoundedRect(x + 3, 3, TRACK_W, this.trackHeight, 11);
        this.track.fillStyle(0xfff0d0).fillRoundedRect(x, 0, TRACK_W, this.trackHeight, 11);
        this.track.lineStyle(3, INK).strokeRoundedRect(x, 0, TRACK_W, this.trackHeight, 11);
        this.tickArt.clear();
        this.ticks.forEach((label, index) =>
        {
            const y = this.trackHeight * (1 - (index + 1) / 4);
            label.y = y;
            this.tickArt.lineStyle(2, 0xfff2ce).lineBetween(44, y, 57, y);
        });
        this.drawProgress();
        this.coinHud.placeWithin(16, 28);
        this.coinHud.setScale(this.uiScale);
        this.returnButton.placeCorner(width, this.uiScale);
        const coins = this.coinBounds();
        this.coinBlocker.setPosition(coins.centerX, coins.centerY).setSize(coins.width, coins.height);
        (this.coinBlocker.input!.hitArea as Geom.Rectangle).setTo(0, 0, coins.width, coins.height);
        const rail = this.bounds();
        this.railBlocker.setPosition(rail.centerX, rail.centerY).setSize(rail.width, rail.height);
        (this.railBlocker.input!.hitArea as Geom.Rectangle).setTo(0, 0, rail.width, rail.height);
    }

    private coinBounds ()
    {
        return new Geom.Rectangle(16, 16, 220 * this.uiScale, 88 * this.uiScale);
    }

    bounds ()
    {
        return new Geom.Rectangle(this.root.x, this.root.y - 70 * this.uiScale,
            COLUMN_W * this.uiScale, (this.trackHeight + 98) * this.uiScale);
    }

    status ()
    {
        return {
            ...this.state, displayedRatio: this.visual.ratio, orientation: 'vertical',
            bounds: this.bounds(), blockerBounds: this.railBlocker.getBounds(),
            coinBounds: this.coinBounds(), menuBounds: this.returnButton.bounds(),
            cornerBottom: Math.max(this.coinBounds().bottom, this.returnButton.bounds().bottom),
            markerY: this.root.y + this.marker.y * this.uiScale,
            trackTop: this.root.y, trackBottom: this.root.y + this.trackHeight * this.uiScale,
            labels: [ ...this.ticks.map(label => label.text), this.goalText.text ]
        };
    }
}
