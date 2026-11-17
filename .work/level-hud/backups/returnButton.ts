import { GameObjects, Scene } from 'phaser';
import { RETURN_FRAME } from './letters';

const MARGIN = 16;
const DRAW_H = 88;
const SHEET = 'letters';

/**
 * Top-right return to the main menu. Marked `ui` so it does not jump or restart.
 */
export class ReturnButton
{
    private button: GameObjects.Image;

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

        this.button.on('pointerup', () => this.press());
    }

    layout (width: number, _height: number)
    {
        const frame = this.button.frame;
        const drawW = DRAW_H * frame.width / frame.height;

        this.button.setDisplaySize(drawW, DRAW_H);
        this.button.setPosition(width - MARGIN - drawW / 2, MARGIN + DRAW_H / 2);
    }

    private press ()
    {
        if (!this.button.scene.sys.isActive())
        {
            return;
        }

        // The Game scene owns the confirmation state; cancelling must allow another press.
        this.onReturn();
    }
}
