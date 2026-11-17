import { GameObjects, Geom, Input, Scene } from 'phaser';
import { RETURN_FRAME } from './letters';
import { playPressBounce } from './pressBounce';

const MARGIN = 16;
const DRAW_H = 88;
const SHEET = 'letters';

/**
 * Top-right return to the main menu. Marked `ui` so it does not jump or restart.
 */
export class ReturnButton
{
    private button: GameObjects.Image;
    private pressed = false;

    constructor (
        scene: Scene,
        depth: number,
        private onReturn: () => void
    )
    {
        this.button = scene.add.image(0, 0, SHEET, RETURN_FRAME)
            .setScrollFactor(0)
            .setDepth(depth)
            .setInteractive({ useHandCursor: true })
            .setData('ui', true);

        const begin = (pointer: Input.Pointer) =>
        {
            if (!this.button.scene?.sys.isActive() || (pointer.button !== undefined && pointer.button !== 0)) return;
            this.pressed = true;
            playPressBounce(this.button);
        };
        this.button.on('pointerdown', begin);
        this.button.on('pointerup', () => this.press());
        this.button.on('pointerupoutside', () => this.press());
    }

    layout (width: number, _height: number)
    {
        const frame = this.button.frame;
        const drawW = DRAW_H * frame.width / frame.height;

        this.button.setDisplaySize(drawW, DRAW_H);
        this.button.setPosition(width - MARGIN - drawW / 2, MARGIN + DRAW_H / 2);
    }

    placeCorner (width: number, scale = 1)
    {
        const frame = this.button.frame;
        const height = DRAW_H * scale;
        const drawW = height * frame.width / frame.height;
        this.button.setDisplaySize(drawW, height).setPosition(width - MARGIN - drawW / 2, MARGIN + height / 2);
        (this.button.input!.hitArea as Geom.Rectangle).setTo(0, 0, this.button.width, this.button.height);
    }

    bounds ()
    {
        return this.button.getBounds();
    }

    /** Flat icon within the shared HUD; generous hit area also includes its menu caption. */
    placeWithin (x: number, y: number, scale: number)
    {
        const frame = this.button.frame;
        const height = 56 * scale;
        this.button.setDisplaySize(height * frame.width / frame.height, height).setPosition(x, y);
        const hitW = 92 * scale / this.button.scaleX;
        const hitH = 88 * scale / this.button.scaleY;
        (this.button.input!.hitArea as Geom.Rectangle).setTo(
            this.button.width / 2 - hitW / 2,
            this.button.height / 2 - hitH / 2 + 8 * scale / this.button.scaleY, hitW, hitH
        );
    }

    private press ()
    {
        if (!this.button.scene?.sys.isActive())
        {
            return;
        }

        if (!this.pressed) playPressBounce(this.button);
        this.pressed = false;
        // The Game scene owns the confirmation state; cancelling must allow another press.
        this.onReturn();
    }
}
