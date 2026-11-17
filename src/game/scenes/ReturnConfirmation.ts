import { GameObjects, Geom, Input, Scene } from 'phaser';
import { playSfx } from '../audio';
import { bindResize } from '../layout';
import { bindPressBounce } from '../pressBounce';

export const RETURN_CONFIRM_SCENE = 'ReturnConfirmation';

export type ReturnConfirmationData = {
    meters: number;
    onContinue: () => void;
    onReturn: () => void;
};

const CARD_W = 568;
const CARD_H = 624;
const INK = 0x673642;
const FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';
type PointerEvent = { stopPropagation: () => void };

/** A separate live UI scene over the paused Game scene; never advances gameplay. */
export class ReturnConfirmation extends Scene
{
    private options: ReturnConfirmationData;
    private settled = false;
    private shade: GameObjects.Rectangle;
    private root: GameObjects.Container;
    private continueButton: GameObjects.Container;
    private returnButton: GameObjects.Container;
    private closeButton: GameObjects.Container;

    constructor ()
    {
        super(RETURN_CONFIRM_SCENE);
    }

    init (data: ReturnConfirmationData)
    {
        this.options = data;
        this.settled = false;
    }

    create ()
    {
        this.shade = this.add.rectangle(0, 0, 1, 1, 0x19263c, 0.65)
            .setOrigin(0).setInteractive().setData('ui', true);
        // Clicking outside the card deliberately does nothing: a choice must be explicit.
        for (const eventName of [ 'pointerdown', 'pointerup' ])
        {
            this.shade.on(eventName, (_pointer: Input.Pointer, _x: number, _y: number, event: PointerEvent) => event.stopPropagation());
        }

        this.root = this.add.container(0, 0);
        const card = this.add.graphics();
        card.fillStyle(0x39213e, 0.35).fillRoundedRect(-CARD_W / 2 + 8, -CARD_H / 2 + 12, CARD_W, CARD_H, 38);
        card.fillStyle(0xfff8e8).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 38);
        card.lineStyle(5, INK).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 38);
        card.lineStyle(2, 0xffffff).strokeRoundedRect(-CARD_W / 2 + 9, -CARD_H / 2 + 9, CARD_W - 18, CARD_H - 18, 30);
        this.root.add(card);

        const badge = this.add.graphics();
        badge.fillStyle(0xb36586).fillRoundedRect(-108, -280, 216, 42, 21);
        this.root.add(badge);
        this.text(0, -259, '游戏已暂停', 23, '#ffffff');

        const icon = this.add.graphics();
        icon.fillStyle(0xffd667).fillCircle(0, -183, 44);
        icon.lineStyle(3, 0xe8a338).strokeCircle(0, -183, 44);
        icon.fillStyle(INK).fillRoundedRect(-16, -204, 11, 42, 4).fillRoundedRect(5, -204, 11, 42, 4);
        this.root.add(icon);

        this.text(0, -111, '返回主菜单？', 44, '#673642');
        this.text(0, -31, '返回后，本局挑战将结束\n已获得的金币会保留', 26, '#88646d', false);

        const progress = this.add.graphics();
        progress.fillStyle(0xffffff).fillRoundedRect(-222, 37, 444, 70, 18);
        progress.lineStyle(2, 0xf1d49b).strokeRoundedRect(-222, 37, 444, 70, 18);
        this.root.add(progress);
        this.text(-107, 72, '本次高度', 23, '#997848', false);
        const height = this.text(94, 72, `${this.options.meters} 米`, 32, '#805327');
        if (height.width > 192) height.setScale(192 / height.width);

        // Keep the safer action primary, with a generous touch target.
        this.continueButton = this.makeButton(177, 444, 76, '继续游戏', 0xffc43b, '#643b2c', () => this.choose('continue'));
        this.returnButton = this.makeButton(267, 444, 64, '返回主菜单', 0xf2d8e3, '#7a4562', () => this.choose('return'), 28);
        this.closeButton = this.makeCloseButton();

        this.layout();
        bindResize(this, () => this.layout());
        this.input.keyboard?.on('keydown-ESC', this.onEscape, this);
        this.events.once('shutdown', () =>
        {
            this.input.keyboard?.off('keydown-ESC', this.onEscape, this);
        });
    }

    private text (x: number, y: number, value: string, size: number, color: string, bold = true)
    {
        const text = this.add.text(x, y, value, {
            fontFamily: FONT, fontSize: size, color, fontStyle: bold ? 'bold' : 'normal',
            align: 'center', lineSpacing: 12
        }).setOrigin(0.5);
        this.root.add(text);
        return text;
    }

    private makeButton (y: number, width: number, height: number, label: string, fill: number, color: string, action: () => void, fontSize = 32)
    {
        const node = this.add.container(0, y).setSize(width, height)
            .setInteractive(new Geom.Rectangle(0, 0, width, height), Geom.Rectangle.Contains)
            .setData('ui', true);
        const art = this.add.graphics();
        art.fillStyle(0x8b5263, 0.25).fillRoundedRect(-width / 2, -height / 2 + 6, width, height, 20);
        art.fillStyle(fill).fillRoundedRect(-width / 2, -height / 2, width, height, 20);
        art.lineStyle(3, INK).strokeRoundedRect(-width / 2, -height / 2, width, height, 20);
        art.lineStyle(2, 0xffffff, 0.7).strokeRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 15);
        const text = this.add.text(0, 0, label, { fontFamily: FONT, fontSize, color, fontStyle: 'bold' }).setOrigin(0.5);
        node.add([ art, text ]);
        this.root.add(node);
        bindPressBounce(node, action, () => !this.settled);
        return node;
    }

    private makeCloseButton ()
    {
        const node = this.add.container(242, -272).setSize(48, 48)
            .setInteractive(new Geom.Circle(24, 24, 24), Geom.Circle.Contains).setData('ui', true);
        const art = this.add.graphics();
        art.fillStyle(0xf7e6dc).fillCircle(0, 0, 20);
        art.lineStyle(3, 0xa5797b).beginPath().moveTo(-6, -6).lineTo(6, 6).moveTo(6, -6).lineTo(-6, 6).strokePath();
        node.add(art);
        this.root.add(node);
        bindPressBounce(node, () => this.choose('continue'), () => !this.settled);
        return node;
    }

    private onEscape ()
    {
        this.choose('continue');
    }

    private choose (choice: 'continue' | 'return')
    {
        if (this.settled) return;
        this.settled = true;
        playSfx(this, 'ui');
        const callback = choice === 'continue' ? this.options.onContinue : this.options.onReturn;
        this.scene.stop();
        callback();
    }

    /** Read-only geometry for QA; no controller or callbacks are exposed. */
    status ()
    {
        return {
            active: this.scene.isActive(), settled: this.settled,
            x: this.root.x, y: this.root.y, scale: this.root.scaleX,
            width: CARD_W * this.root.scaleX, height: CARD_H * this.root.scaleY,
            meters: this.options.meters,
            continueBounds: this.buttonBounds(this.continueButton),
            returnBounds: this.buttonBounds(this.returnButton),
            closeBounds: this.buttonBounds(this.closeButton)
        };
    }

    private buttonBounds (node: GameObjects.Container)
    {
        const point = node.getWorldTransformMatrix().transformPoint(-node.width / 2, -node.height / 2);
        return new Geom.Rectangle(point.x, point.y, node.width * this.root.scaleX * node.scaleX, node.height * this.root.scaleY * node.scaleY);
    }

    private layout ()
    {
        const { width, height } = this.scale;
        this.shade.setSize(width, height);
        // Rectangle.setSize does not resize a previously-created input hit area.
        (this.shade.input!.hitArea as Geom.Rectangle).setTo(0, 0, width, height);
        const scale = Math.min(1.25, (width - 36) / CARD_W, (height - 36) / (CARD_H + 16));
        this.root.setPosition(width / 2, height / 2).setScale(Math.max(0.1, scale));
    }
}
