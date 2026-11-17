import { GameObjects, Geom, Input, Scene } from 'phaser';
import { playSfx } from '../audio';
import { bindResize, coverImage } from '../layout';
import { bindPressBounce } from '../pressBounce';

export type RoundSummary = {
    meters: number;
    coinsEarned: number;
    totalCoins: number;
    boxes: number;
    perfectBoxes: number;
};

const CARD_W = 600;
const CARD_H = 920;
const INK = 0x673642;
const FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';
type PointerEvent = { stopPropagation: () => void };
const count = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : 0;

/** A terminal results scene: old gameplay is stopped, not left running behind the page. */
export class GameOver extends Scene
{
    private summary: RoundSummary;
    private chosen = false;
    private background: GameObjects.Image;
    private shade: GameObjects.Rectangle;
    private root: GameObjects.Container;
    private retryButton: GameObjects.Container;
    private menuButton: GameObjects.Container;

    constructor ()
    {
        super('GameOver');
    }

    init (data: Partial<RoundSummary> = {})
    {
        const totalCoins = count(data.totalCoins ?? 0);
        const boxes = count(data.boxes ?? 0);
        this.summary = {
            meters: count(data.meters ?? 0), boxes, totalCoins,
            coinsEarned: Math.min(totalCoins, count(data.coinsEarned ?? 0)),
            perfectBoxes: Math.min(boxes, count(data.perfectBoxes ?? 0))
        };
        this.chosen = false;
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0x6e5c93);
        this.background = this.add.image(0, 0, 'background');
        this.shade = this.add.rectangle(0, 0, 1, 1, 0x322546, 0.68).setOrigin(0).setInteractive();
        // Blank areas do not retry or navigate. Only the two buttons have actions.
        for (const name of [ 'pointerdown', 'pointerup' ])
        {
            this.shade.on(name, (_p: Input.Pointer, _x: number, _y: number, event: PointerEvent) => event.stopPropagation());
        }
        this.root = this.add.container(0, 0);
        const card = this.add.graphics();
        card.fillStyle(0x291e3e, 0.3).fillRoundedRect(-CARD_W / 2 + 9, -CARD_H / 2 + 12, CARD_W, CARD_H, 38);
        card.fillStyle(0xfff8e8).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 38);
        card.lineStyle(5, INK).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 38);
        card.lineStyle(2, 0xffffff).strokeRoundedRect(-CARD_W / 2 + 9, -CARD_H / 2 + 9, CARD_W - 18, CARD_H - 18, 30);
        this.root.add(card);

        const ribbon = this.add.graphics();
        ribbon.fillStyle(0xb36586).fillRoundedRect(-130, -434, 260, 42, 21);
        this.root.add(ribbon);
        this.text(0, -413, '本局挑战结束', 23, '#ffffff');
        this.text(0, -359, '挑战结算', 48, '#673642');
        this.text(0, -312, '歇一小会儿，再向上冲！', 24, '#947278', false);

        const heightPanel = this.add.graphics();
        heightPanel.fillStyle(0xffedb5).fillRoundedRect(-254, -280, 508, 172, 24);
        heightPanel.lineStyle(2, 0xe9bd67).strokeRoundedRect(-254, -280, 508, 172, 24);
        heightPanel.fillStyle(0xffffff, 0.5).fillRoundedRect(-244, -270, 488, 42, 18);
        this.root.add(heightPanel);
        this.text(0, -249, '本次高度', 24, '#a87536');
        const meters = this.text(0, -177, `${this.summary.meters} 米`, 79, '#774331');
        this.fit(meters, 440);

        const reward = this.add.graphics();
        reward.fillStyle(0xffffff).fillRoundedRect(-254, -91, 508, 104, 20);
        reward.lineStyle(2, 0xf0d7a5).strokeRoundedRect(-254, -91, 508, 104, 20);
        reward.fillStyle(0xffd23c).fillCircle(-206, -39, 26);
        reward.lineStyle(3, 0xb87929).strokeCircle(-206, -39, 26);
        reward.lineStyle(2, 0xfff298).strokeCircle(-206, -39, 19);
        this.root.add(reward);
        this.text(-206, -39, '$', 31, '#b87929');
        this.text(-110, -65, '本局获得', 23, '#a07c58', false);
        const coins = this.text(28, -24, `+${this.summary.coinsEarned} 金币`, 39, '#a56820');
        this.fit(coins, 372);

        this.statPanel(-132, 106, '堆叠盒数', this.summary.boxes);
        this.statPanel(132, 106, '完美叠放', this.summary.perfectBoxes);
        const saved = this.text(0, 199, `金币已保存 · 余额 ${this.summary.totalCoins} 枚`, 23, '#947278', false);
        this.fit(saved, 510);

        this.retryButton = this.makeButton(286, 88, '重新挑战', 0xffc43b, '#643b2c', () => this.choose('Game'));
        this.menuButton = this.makeButton(388, 74, '返回主菜单', 0xf2d8e3, '#7a4562', () => this.choose('MainMenu'), 29);
        this.layout();
        bindResize(this, () => this.layout());
    }

    private text (x: number, y: number, value: string, size: number, color: string, bold = true)
    {
        const label = this.add.text(x, y, value, {
            fontFamily: FONT, fontSize: size, color, fontStyle: bold ? 'bold' : 'normal', align: 'center'
        }).setOrigin(0.5);
        this.root.add(label);
        return label;
    }

    private fit (text: GameObjects.Text, width: number)
    {
        if (text.width > width) text.setScale(width / text.width);
    }

    private statPanel (x: number, y: number, label: string, value: number)
    {
        const panel = this.add.graphics();
        panel.fillStyle(0xffffff).fillRoundedRect(x - 122, y - 60, 244, 120, 20);
        panel.lineStyle(2, 0xe9d4d7).strokeRoundedRect(x - 122, y - 60, 244, 120, 20);
        this.root.add(panel);
        this.text(x, y - 28, label, 23, '#997681', false);
        const number = this.text(x, y + 20, String(value), 43, '#71495e');
        this.fit(number, 208);
    }

    private makeButton (y: number, height: number, label: string, fill: number, color: string, action: () => void, fontSize = 34)
    {
        const width = 508;
        const node = this.add.container(0, y).setSize(width, height)
            .setInteractive(new Geom.Rectangle(0, 0, width, height), Geom.Rectangle.Contains);
        const art = this.add.graphics();
        art.fillStyle(0x8b5263, 0.25).fillRoundedRect(-width / 2, -height / 2 + 6, width, height, 22);
        art.fillStyle(fill).fillRoundedRect(-width / 2, -height / 2, width, height, 22);
        art.lineStyle(3, INK).strokeRoundedRect(-width / 2, -height / 2, width, height, 22);
        art.lineStyle(2, 0xffffff, 0.7).strokeRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 17);
        const text = this.add.text(0, 0, label, { fontFamily: FONT, fontSize, color, fontStyle: 'bold' }).setOrigin(0.5);
        node.add([ art, text ]);
        this.root.add(node);
        bindPressBounce(node, action, () => !this.chosen);
        return node;
    }

    private choose (scene: 'Game' | 'MainMenu')
    {
        if (this.chosen) return;
        this.chosen = true;
        playSfx(this, 'ui');
        this.scene.start(scene);
    }

    /** Read-only result and geometry for QA. */
    status ()
    {
        const bounds = (node: GameObjects.Container) =>
        {
            const p = node.getWorldTransformMatrix().transformPoint(-node.width / 2, -node.height / 2);
            return new Geom.Rectangle(p.x, p.y, node.width * this.root.scaleX * node.scaleX, node.height * this.root.scaleY * node.scaleY);
        };
        return {
            ...this.summary, chosen: this.chosen,
            x: this.root.x, y: this.root.y, width: CARD_W * this.root.scaleX, height: CARD_H * this.root.scaleY,
            retryBounds: bounds(this.retryButton), menuBounds: bounds(this.menuButton)
        };
    }

    private layout ()
    {
        const { width, height } = this.scale;
        coverImage(this.background, width, height);
        this.shade.setSize(width, height);
        (this.shade.input!.hitArea as Geom.Rectangle).setTo(0, 0, width, height);
        const scale = Math.min(1.15, (width - 40) / CARD_W, (height - 40) / (CARD_H + 16));
        this.root.setPosition(width / 2, height / 2).setScale(Math.max(0.1, scale));
    }
}
