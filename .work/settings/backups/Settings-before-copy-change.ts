import { GameObjects, Geom, Input, Scene } from 'phaser';
import { applyAudioSettings, isAudioEnabled, playSfx, setAudioEnabled } from '../audio';
import { bindResize } from '../layout';
import { bindPressBounce } from '../pressBounce';

export const SETTINGS_SCENE = 'Settings';
type SettingsData = { onClose?: () => void };
type PointerEvent = { stopPropagation: () => void };
const CARD_W = 568;
const CARD_H = 520;
const INK = 0x673642;
const FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';

/** Live settings UI over the paused main menu; only the shared sound preference is editable. */
export class Settings extends Scene
{
    private options: SettingsData;
    private closed = false;
    private shade: GameObjects.Rectangle;
    private root: GameObjects.Container;
    private toggleButton: GameObjects.Container;
    private toggleArt: GameObjects.Graphics;
    private toggleLabel: GameObjects.Text;
    private speakerArt: GameObjects.Graphics;
    private closeButton: GameObjects.Container;
    private doneButton: GameObjects.Container;
    private cancelPresses: Array<() => void> = [];

    constructor () { super(SETTINGS_SCENE); }

    init (data: SettingsData = {})
    {
        this.options = data;
        this.closed = false;
        this.cancelPresses = [];
    }

    create ()
    {
        applyAudioSettings(this);
        this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
        this.shade = this.add.rectangle(0, 0, 1, 1, 0x19263c, 0.65)
            .setOrigin(0).setInteractive().setData('ui', true);
        for (const event of ['pointerdown', 'pointerup'])
        {
            this.shade.on(event, (_p: Input.Pointer, _x: number, _y: number, e: PointerEvent) => e.stopPropagation());
        }
        this.root = this.add.container(0, 0);
        const card = this.add.graphics();
        card.fillStyle(0x39213e, 0.35).fillRoundedRect(-CARD_W / 2 + 8, -CARD_H / 2 + 12, CARD_W, CARD_H, 38);
        card.fillStyle(0xfff8e8).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 38);
        card.lineStyle(5, INK).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 38);
        card.lineStyle(2, 0xffffff).strokeRoundedRect(-CARD_W / 2 + 9, -CARD_H / 2 + 9, CARD_W - 18, CARD_H - 18, 30);
        card.fillStyle(0xb36586).fillRoundedRect(-108, -238, 216, 42, 21);
        this.root.add(card);
        this.text(0, -217, '游戏设置', 23, '#ffffff');
        this.text(0, -150, '设置', 46, '#673642');
        this.text(0, -101, '按你的喜好，轻松开关声音', 23, '#947278', false);

        const row = this.add.graphics();
        row.fillStyle(0xffffff).fillRoundedRect(-238, -66, 476, 156, 24);
        row.lineStyle(2, 0xf1d49b).strokeRoundedRect(-238, -66, 476, 156, 24);
        this.root.add(row);
        this.speakerArt = this.add.graphics();
        this.root.add(this.speakerArt);
        this.text(-72, -8, '音量', 31, '#774331');
        this.text(-68, 36, '背景音乐与音效', 20, '#a07c58', false);

        this.toggleButton = this.add.container(143, 12).setSize(148, 76)
            .setInteractive(new Geom.Rectangle(0, 0, 148, 76), Geom.Rectangle.Contains).setData('ui', true);
        this.toggleArt = this.add.graphics();
        this.toggleLabel = this.add.text(0, 0, '', {fontFamily: FONT, fontSize: 29, fontStyle: 'bold', color: '#ffffff'}).setOrigin(0.5);
        this.toggleButton.add([this.toggleArt, this.toggleLabel]);
        this.root.add(this.toggleButton);
        this.cancelPresses.push(bindPressBounce(this.toggleButton, () => this.toggleSound(), () => !this.closed));

        this.text(0, 127, '设置会自动保存', 22, '#947278', false);
        this.doneButton = this.add.container(0, 196).setSize(444, 72)
            .setInteractive(new Geom.Rectangle(0, 0, 444, 72), Geom.Rectangle.Contains).setData('ui', true);
        const done = this.add.graphics();
        done.fillStyle(0x8b5263, 0.25).fillRoundedRect(-222, -30, 444, 72, 20);
        done.fillStyle(0xffc43b).fillRoundedRect(-222, -36, 444, 72, 20);
        done.lineStyle(3, INK).strokeRoundedRect(-222, -36, 444, 72, 20);
        done.lineStyle(2, 0xffffff, 0.7).strokeRoundedRect(-216, -30, 432, 60, 15);
        this.doneButton.add(done);
        this.doneButton.add(this.add.text(0, 0, '完成', {fontFamily: FONT, fontSize: 33, fontStyle: 'bold', color: '#643b2c'}).setOrigin(0.5));
        this.root.add(this.doneButton);
        this.cancelPresses.push(bindPressBounce(this.doneButton, () => this.close(), () => !this.closed));

        this.closeButton = this.add.container(242, -220).setSize(48, 48)
            .setInteractive(new Geom.Circle(24, 24, 24), Geom.Circle.Contains).setData('ui', true);
        const close = this.add.graphics();
        close.fillStyle(0xf7e6dc).fillCircle(0, 0, 20);
        close.lineStyle(3, 0xa5797b).beginPath().moveTo(-6, -6).lineTo(6, 6).moveTo(6, -6).lineTo(-6, 6).strokePath();
        this.closeButton.add(close);
        this.root.add(this.closeButton);
        this.cancelPresses.push(bindPressBounce(this.closeButton, () => this.close(), () => !this.closed));

        this.refreshSound();
        this.layout();
        bindResize(this, () => this.layout());
        this.input.keyboard?.on('keydown-ESC', this.onEscape, this);
        this.events.once('shutdown', () =>
        {
            this.input.keyboard?.off('keydown-ESC', this.onEscape, this);
            for (const cancel of this.cancelPresses) cancel();
            if (!this.closed)
            {
                this.closed = true;
                this.options.onClose?.();
            }
        });
    }

    private text (x: number, y: number, value: string, size: number, color: string, bold = true)
    {
        const text = this.add.text(x, y, value, {fontFamily: FONT, fontSize: size, color, fontStyle: bold ? 'bold' : 'normal'}).setOrigin(0.5);
        this.root.add(text);
        return text;
    }

    private refreshSound ()
    {
        const enabled = isAudioEnabled();
        this.toggleArt.clear();
        this.toggleArt.fillStyle(enabled ? 0x65b768 : 0xb7a3af).fillRoundedRect(-74, -38, 148, 76, 38);
        this.toggleArt.lineStyle(3, enabled ? 0x43894a : 0x987e90).strokeRoundedRect(-74, -38, 148, 76, 38);
        const thumb = enabled ? 35 : -35;
        this.toggleArt.fillStyle(0x684051, 0.16).fillCircle(thumb, 3, 30);
        this.toggleArt.fillStyle(0xfff8e8).fillCircle(thumb, 0, 30);
        this.toggleArt.lineStyle(2, 0xffffff).strokeCircle(thumb, 0, 28);
        this.toggleLabel.setText(enabled ? '开' : '关').setPosition(enabled ? -29 : 29, 0);

        this.speakerArt.clear();
        this.speakerArt.fillStyle(enabled ? 0xffd667 : 0xe8dce2).fillCircle(-183, 12, 35);
        this.speakerArt.lineStyle(2, enabled ? 0xe8a338 : 0xc6aebb).strokeCircle(-183, 12, 35);
        this.speakerArt.fillStyle(INK).fillRoundedRect(-202, 3, 12, 18, 3);
        this.speakerArt.fillTriangle(-193, 3, -181, -7, -181, 31);
        this.speakerArt.lineStyle(3, INK);
        if (enabled)
        {
            this.speakerArt.beginPath().arc(-181, 12, 12, -0.65, 0.65).strokePath();
            this.speakerArt.beginPath().arc(-181, 12, 21, -0.65, 0.65).strokePath();
        }
        else this.speakerArt.lineBetween(-171, 5, -159, 19).lineBetween(-159, 5, -171, 19);
    }

    private toggleSound ()
    {
        if (this.closed) return;
        setAudioEnabled(this, !isAudioEnabled());
        this.refreshSound();
        // Turning off is silent; turning on offers the normal UI cue at its original volume.
        playSfx(this, 'ui');
    }

    private onEscape () { this.close(); }
    private close ()
    {
        if (this.closed) return;
        this.closed = true;
        for (const cancel of this.cancelPresses) cancel();
        playSfx(this, 'ui');
        this.scene.stop();
        this.options.onClose?.();
    }

    private layout ()
    {
        const {width, height} = this.scale;
        this.shade.setSize(width, height);
        (this.shade.input!.hitArea as Geom.Rectangle).setTo(0, 0, width, height);
        this.root.setPosition(width / 2, height / 2).setScale(Math.max(0.1, Math.min(1.25, (width - 36) / CARD_W, (height - 36) / (CARD_H + 16))));
    }

    status ()
    {
        const bounds = (node: GameObjects.Container) =>
        {
            const p = node.getWorldTransformMatrix().transformPoint(-node.width / 2, -node.height / 2);
            return new Geom.Rectangle(p.x, p.y, node.width * this.root.scaleX * node.scaleX, node.height * this.root.scaleY * node.scaleY);
        };
        return {enabled: isAudioEnabled(), muted: this.sound.mute, closed: this.closed,
            width: CARD_W * this.root.scaleX, height: CARD_H * this.root.scaleY,
            toggleBounds: bounds(this.toggleButton), doneBounds: bounds(this.doneButton), closeBounds: bounds(this.closeButton)};
    }
}
