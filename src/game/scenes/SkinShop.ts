import { GameObjects, Geom, Input, Scene } from 'phaser';
import { playSfx } from '../audio';
import { BOX_SKINS, BoxSkinCollection, type BoxSkin, type SkinId } from '../boxSkins';
import { CoinWallet } from '../coinHud';
import { bindResize } from '../layout';
import { PLAYER_ART_FEET, PLAYER_ART_HEIGHT, PLAYER_ART_TOP } from '../player';
import { showToast } from '../toast';
import { bindPressBounce } from '../pressBounce';

export const SKIN_SHOP_SCENE = 'SkinShop';
type ShopData = { onClose: () => void };
type PointerEvent = { stopPropagation: () => void };
const W = 760;
const H = 1280;
/**
 * Center of the shared tray's top face, in the 256×192 skin art.
 * The face runs from the back edge (y 29) to the front lip (y 50); this is its centroid.
 */
const LID_PLANE_X = 128.75;
const LID_PLANE_Y = 40;
const INK = 0x19291c;
const FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';

/** Green awning + six color cards + rider preview, with the game's original tray shape. */
export class SkinShop extends Scene
{
    private options: ShopData;
    private closed = false;
    private busy = false;
    private focused: SkinId = 'sunny';
    private wallet: CoinWallet;
    private collection: BoxSkinCollection;
    private shade: GameObjects.Rectangle;
    private root: GameObjects.Container;
    private cards: GameObjects.Container;
    private balanceLabel: GameObjects.Text;
    private previewImage: GameObjects.Image;
    private previewRider: GameObjects.Sprite;
    private previewName: GameObjects.Text;
    private previewState: GameObjects.Text;
    private action: GameObjects.Container;
    private actionArt: GameObjects.Graphics;
    private actionLabel: GameObjects.Text;
    private cardNodes = new Map<SkinId, GameObjects.Container>();
    private closeNode: GameObjects.Container;

    constructor () { super(SKIN_SHOP_SCENE); }

    init (data: ShopData)
    {
        this.options = data;
        this.closed = false;
        this.busy = false;
        this.focused = 'sunny';
    }

    create ()
    {
        this.wallet = new CoinWallet(import.meta.env.DEV ? this.registry.get('coinStorageKey') : undefined);
        this.collection = new BoxSkinCollection(import.meta.env.DEV ? this.registry.get('skinStorageKey') : undefined);
        this.shade = this.add.rectangle(0, 0, 1, 1, 0x18492d, 0.8)
            .setOrigin(0).setInteractive().setData('ui', true);
        for (const event of ['pointerdown', 'pointerup'])
        {
            this.shade.on(event, (_p: Input.Pointer, _x: number, _y: number, e: PointerEvent) => e.stopPropagation());
        }
        this.root = this.add.container(0, 0);
        this.buildStorefront();
        this.cards = this.add.container(0, 0);
        this.root.add(this.cards);
        this.buildPreview();
        this.action = this.add.container(0, 469).setSize(440, 88)
            .setInteractive(new Geom.Rectangle(0, 0, 440, 88), Geom.Rectangle.Contains).setData('ui', true);
        this.actionArt = this.add.graphics();
        this.action.add(this.actionArt);
        this.actionLabel = this.text(0, 0, '', 36, '#ffffff', this.action, 5);
        this.root.add(this.action);
        bindPressBounce(this.action, () => this.applyFocused(), () => !this.closed && !this.busy);
        this.refresh();
        this.layout();
        bindResize(this, () => this.layout());
        this.input.keyboard?.on('keydown-ESC', this.onEscape, this);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', this.onEscape, this));
    }

    private buildStorefront ()
    {
        const art = this.add.graphics();
        art.fillStyle(0x13261a, 0.25).fillRoundedRect(-W / 2 + 6, -554, W, 1160, 42);
        art.fillStyle(0x52bc5a).fillRoundedRect(-W / 2, -564, W, 1160, 42);
        art.lineStyle(7, INK).strokeRoundedRect(-W / 2, -564, W, 1160, 42);
        art.fillStyle(0xfff2d2).fillRoundedRect(-350, -418, 700, 990, 31);
        art.lineStyle(5, INK).strokeRoundedRect(-350, -418, 700, 990, 31);
        art.lineStyle(2, 0xffffff, 0.75).strokeRoundedRect(-341, -408, 682, 970, 25);
        // Alternating green/cream awning scallops: UI decoration only, not box geometry.
        for (let i = 0; i < 8; i++)
        {
            const x = -368 + i * 92;
            art.fillStyle(i % 2 === 0 ? 0x50be59 : 0xfff0cb).fillRoundedRect(x, -548, 92, 110, 22);
            art.lineStyle(4, INK).strokeRoundedRect(x, -548, 92, 110, 22);
            art.fillStyle(i % 2 === 0 ? 0x309b43 : 0xe9dab1).fillRoundedRect(x + 3, -479, 86, 39, 19);
        }
        art.lineStyle(6, INK).strokeRoundedRect(-368, -548, 736, 112, 27);
        art.fillStyle(0x46a748).fillRoundedRect(-255, -483, 510, 104, 41);
        art.lineStyle(7, INK).strokeRoundedRect(-255, -483, 510, 104, 41);
        art.lineStyle(3, 0xadd988).strokeRoundedRect(-246, -474, 492, 86, 33);
        this.root.add(art);
        this.text(0, -430, '外卖盒商店', 55, '#fff2a2', this.root, 7);
        for (const x of [-305, 305])
        {
            const star = this.add.star(x, -421, 4, 11, 24, 0xffdb35).setStrokeStyle(4, INK);
            this.root.add(star);
        }
        const money = this.add.container(195, -603);
        const badge = this.add.graphics();
        badge.fillStyle(0xfff1cd).fillRoundedRect(-158, -34, 316, 68, 33);
        badge.lineStyle(5, INK).strokeRoundedRect(-158, -34, 316, 68, 33);
        money.add(badge);
        money.add(this.coin(-119, 0, 27));
        this.balanceLabel = this.text(22, 0, '0', 42, '#ffffff', money, 5);
        this.root.add(money);
        this.closeNode = this.add.container(-323, -603).setSize(66, 66)
            .setInteractive(new Geom.Rectangle(0, 0, 66, 66), Geom.Rectangle.Contains).setData('ui', true);
        const close = this.add.graphics();
        close.fillStyle(0xfff4da).fillCircle(0, 0, 30);
        close.lineStyle(5, INK).strokeCircle(0, 0, 30).lineBetween(-10, -10, 10, 10).lineBetween(10, -10, -10, 10);
        this.closeNode.add(close);
        this.root.add(this.closeNode);
        bindPressBounce(this.closeNode, () => this.close(), () => !this.closed && !this.busy);
    }

    private buildPreview ()
    {
        const frame = this.add.graphics();
        frame.fillStyle(0xffe8bc).fillRoundedRect(-330, 183, 660, 226, 25);
        // Soft dashed border in the reference's preview area.
        frame.lineStyle(3, 0xd3ab70);
        for (let x = -309; x < 310; x += 26)
        {
            frame.lineBetween(x, 190, Math.min(x + 14, 310), 190);
            frame.lineBetween(x, 402, Math.min(x + 14, 310), 402);
        }
        for (let y = 211; y < 383; y += 26)
        {
            frame.lineBetween(-323, y, -323, y + 14).lineBetween(323, y, 323, y + 14);
        }
        frame.fillStyle(0x379c4b).fillRoundedRect(-322, 200, 200, 48, 10);
        frame.lineStyle(3, INK).strokeRoundedRect(-322, 200, 200, 48, 10);
        frame.fillStyle(0x8f733e, 0.14).fillEllipse(104, 389, 260, 24);
        this.root.add(frame);
        this.text(-222, 224, '皮肤预览', 29, '#ffffff', this.root, 3);
        this.previewName = this.text(-214, 281, '', 27, '#704524');
        this.previewState = this.text(-214, 329, '', 22, '#4f7840');
        this.previewImage = this.add.image(100, 337, BOX_SKINS[0].texture).setScale(234 / 256);
        this.root.add(this.previewImage);
        this.previewRider = this.add.sprite(100, 278, 'player-idle-0')
            .setOrigin(0.5, PLAYER_ART_FEET / PLAYER_ART_HEIGHT)
            .setScale(92 / (PLAYER_ART_FEET - PLAYER_ART_TOP));
        this.root.add(this.previewRider);
        this.placePreviewRider();
    }

    private text (x: number, y: number, value: string, size: number, color: string, parent = this.root, outline = 0)
    {
        const label = this.add.text(x, y, value, {
            fontFamily: FONT, fontSize: size, fontStyle: 'bold', color, align: 'center',
            stroke: '#19291c', strokeThickness: outline
        }).setOrigin(0.5);
        parent.add(label);
        return label;
    }

    private coin (x: number, y: number, radius: number)
    {
        const root = this.add.container(x, y);
        const art = this.add.graphics();
        art.fillStyle(0xffc815).fillCircle(0, 0, radius);
        art.lineStyle(3, INK).strokeCircle(0, 0, radius);
        art.lineStyle(2, 0xfff498).strokeCircle(0, 0, radius * 0.74);
        root.add(art);
        root.add(this.add.star(0, 0, 5, radius * 0.3, radius * 0.57, 0xffe76d).setStrokeStyle(1.5, 0xc98b13));
        return root;
    }

    private buildCard (skin: BoxSkin, index: number)
    {
        const node = this.add.container((index % 3 - 1) * 230, index < 3 ? -235 : 38).setSize(216, 252)
            .setInteractive(new Geom.Rectangle(0, 0, 216, 252), Geom.Rectangle.Contains).setData('ui', true);
        const unlocked = this.collection.isUnlocked(skin.id);
        const selected = this.collection.isSelected(skin.id);
        const art = this.add.graphics();
        art.fillStyle(0x674e33, 0.15).fillRoundedRect(-106, -122, 216, 252, 25);
        art.fillStyle(skin.color).fillRoundedRect(-108, -126, 216, 252, 25);
        art.lineStyle(this.focused === skin.id ? 6 : 4, this.focused === skin.id ? 0xe8891d : INK)
            .strokeRoundedRect(-108, -126, 216, 252, 25);
        art.lineStyle(2, 0xffffff, 0.75).strokeRoundedRect(-100, -118, 200, 236, 19);
        art.fillStyle(0xfff7da, 0.4).fillRoundedRect(-98, -49, 196, 118, 17);
        node.add(art);
        this.text(0, -89, skin.name, 29, '#ffffff', node, 4);
        node.add(this.add.image(0, 8, skin.texture).setScale(195 / 256));
        if (!unlocked)
        {
            node.add(this.coin(-78, 92, 19));
            this.text(2, 92, String(skin.price), 31, '#ffffff', node, 4);
            const lock = this.add.graphics();
            lock.lineStyle(5, INK).beginPath().arc(72, 76, 12, Math.PI, Math.PI * 2).strokePath();
            lock.fillStyle(0xd3d6ca).fillRoundedRect(53, 76, 38, 38, 7);
            lock.lineStyle(3, INK).strokeRoundedRect(53, 76, 38, 38, 7);
            lock.fillStyle(INK).fillCircle(72, 91, 4).fillRect(70, 92, 4, 10);
            node.add(lock);
        }
        else
        {
            this.text(-27, 92, selected ? '已装备' : '未装备', 24, selected ? '#236c2c' : '#6e7567', node);
            const checkbox = this.add.container(72, 91).setSize(48, 48)
                .setInteractive(new Geom.Rectangle(0, 0, 48, 48), Geom.Rectangle.Contains).setData('ui', true);
            const check = this.add.graphics();
            check.fillStyle(selected ? 0x48b653 : 0xfff9df).fillRoundedRect(-22, -22, 44, 44, 9);
            check.lineStyle(3, INK).strokeRoundedRect(-22, -22, 44, 44, 9);
            if (selected) check.lineStyle(5, 0xffffff).lineBetween(-12, 0, -3, 10).lineBetween(-3, 10, 13, -11);
            checkbox.add(check);
            node.add(checkbox);
            bindPressBounce(checkbox, () => { this.focused = skin.id; this.toggleFocused(); }, () => !this.closed && !this.busy);
        }
        this.cards.add(node);
        this.cardNodes.set(skin.id, node);
        bindPressBounce(node, () => { this.focused = skin.id; this.refresh(); }, () => !this.closed && !this.busy);
    }

    private refresh ()
    {
        this.cards.removeAll(true);
        this.cardNodes.clear();
        BOX_SKINS.forEach((skin, index) => this.buildCard(skin, index));
        const skin = BOX_SKINS.find(value => value.id === this.focused)!;
        const unlocked = this.collection.isUnlocked(this.focused);
        const selected = this.collection.isSelected(this.focused);
        this.balanceLabel.setText(String(this.wallet.total)).setScale(1);
        if (this.balanceLabel.width > 211) this.balanceLabel.setScale(211 / this.balanceLabel.width);
        this.previewImage.setTexture(skin.texture);
        this.placePreviewRider();
        this.previewName.setText(skin.name);
        this.previewState.setText(!unlocked ? '尚未解锁' : selected ? '' : '已解锁 · 未装备');
        const price = skin.price;
        const enough = this.wallet.total >= price;
        const color = unlocked ? selected ? 0x56b85b : 0xffac25 : enough ? 0xff9328 : 0xc9bea5;
        this.actionArt.clear();
        this.actionArt.fillStyle(0x624326, 0.23).fillRoundedRect(-218, -39, 440, 88, 31);
        this.actionArt.fillStyle(color).fillRoundedRect(-220, -44, 440, 88, 31);
        this.actionArt.lineStyle(6, INK).strokeRoundedRect(-220, -44, 440, 88, 31);
        this.actionArt.lineStyle(3, 0xffecc0, 0.8).strokeRoundedRect(-211, -35, 422, 70, 25);
        this.actionLabel.setText(unlocked ? selected ? '取消装备' : '装备' : `${price} 金币解锁`);
    }

    private applyFocused ()
    {
        if (this.closed || this.busy) return;
        if (this.collection.isUnlocked(this.focused)) { this.toggleFocused(); return; }
        this.busy = true;
        try
        {
            const result = this.collection.unlock(this.focused, this.wallet);
            if (result === 'insufficient-coins')
            {
                const price = BOX_SKINS.find(skin => skin.id === this.focused)!.price;
                showToast(this, `金币不足，还差 ${Math.max(0, price - this.wallet.total)} 金币`);
            }
            else
            {
                playSfx(this, result === 'unlocked' ? 'confirm' : 'ui');
            }
            this.refresh();
        }
        finally { this.busy = false; }
    }

    private toggleFocused ()
    {
        if (this.closed || this.busy || !this.collection.toggle(this.focused)) return;
        playSfx(this, 'ui');
        this.refresh();
    }

    /** Put the rider's soles on the middle of the tray's top face. */
    private placePreviewRider ()
    {
        const frame = this.previewImage.frame;
        const scale = this.previewImage.scaleX;
        this.previewRider.setPosition(
            this.previewImage.x + (LID_PLANE_X - frame.width / 2) * scale,
            this.previewImage.y + (LID_PLANE_Y - frame.height / 2) * scale
        );
    }

    private onEscape () { this.close(); }
    private close ()
    {
        if (this.closed) return;
        this.closed = true;
        playSfx(this, 'ui');
        this.scene.stop();
        this.options.onClose();
    }

    private layout ()
    {
        const {width, height} = this.scale;
        this.shade.setSize(width, height);
        (this.shade.input!.hitArea as Geom.Rectangle).setTo(0, 0, width, height);
        this.root.setPosition(width / 2, height / 2).setScale(Math.max(0.1, Math.min(1.1, (width - 24) / W, (height - 24) / H)));
    }

    status ()
    {
        return { ...this.collection.snapshot(), balance: this.wallet.total, focused: this.focused,
            closed: this.closed, layout: 'green-awning-six-cards-rider-preview',
            bounds: this.root.getBounds(), cards: Array.from(this.cardNodes, ([id, node]) => ({id, bounds: node.getBounds()})),
            actionBounds: this.action.getBounds(), closeBounds: this.closeNode.getBounds() };
    }
}
