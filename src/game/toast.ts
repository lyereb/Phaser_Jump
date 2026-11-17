import { GameObjects, Scene } from 'phaser';
import { playSfx } from './audio';

const NAME = 'ui-toast';
const FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';

/** Short screen-fixed notice. A newer toast replaces the one still on screen. */
export function showToast (scene: Scene, message: string)
{
    playSfx(scene, 'deny');
    const previous = scene.children.getByName(NAME) as GameObjects.Container | null;

    if (previous)
    {
        scene.tweens.killTweensOf(previous);
        previous.destroy();
    }

    const width = scene.scale.width;
    const height = scene.scale.height;
    // Landscape buttons sit in the middle, so the notice stays in the top sky. Portrait keeps it over the hero.
    const y = width > height ? Math.max(78, height * 0.09) : height * 0.34;
    const root = scene.add.container(width / 2, y).setName(NAME).setDepth(100).setScrollFactor(0);
    const label = scene.add.text(0, 0, message, {
        fontFamily: FONT, fontSize: 34, fontStyle: 'bold', color: '#fff8e6', align: 'center',
        stroke: '#5a3418', strokeThickness: 6
    }).setOrigin(0.5);
    const maxWidth = Math.max(160, Math.min(width - 48, 640));

    if (label.width > maxWidth)
    {
        label.setScale(maxWidth / label.width);
    }

    const boxW = label.displayWidth + 72;
    const boxH = label.displayHeight + 36;
    const plate = scene.add.graphics();
    plate.fillStyle(0x8a4b22, 0.28).fillRoundedRect(-boxW / 2, -boxH / 2 + 7, boxW, boxH, 28);
    plate.fillStyle(0xff8a3d).fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 28);
    plate.lineStyle(4, 0x5a3418).strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 28);
    plate.lineStyle(2, 0xffe0a8, 0.9).strokeRoundedRect(-boxW / 2 + 6, -boxH / 2 + 6, boxW - 12, boxH - 12, 22);
    root.add([ plate, label ]);

    const fit = Math.max(1, Math.min(1.75, width / 1200));
    root.setScale(fit * 0.86).setAlpha(1);
    scene.tweens.add({
        targets: root, scaleX: fit, scaleY: fit, duration: 180, ease: 'Back.Out',
        onComplete: () =>
        {
            if (!root.scene) return;
            scene.tweens.add({
                targets: root, alpha: 0, y: root.y - 28, delay: 1400, duration: 260, ease: 'Quad.In',
                onComplete: () => { if (root.scene) root.destroy(); }
            });
        }
    });
}
