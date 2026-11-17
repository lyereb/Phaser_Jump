import { GameObjects, Scene } from 'phaser';

/** Portrait design size. FIT scales this canvas uniformly when the browser size changes. */
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export function coverImage (image: GameObjects.Image, width: number, height: number)
{
    const scale = Math.max(width / image.width, height / image.height);

    image.setScale(scale);
    image.setPosition(width / 2, height / 2);

    return image;
}

export function bindResize (scene: Scene, layout: () => void)
{
    scene.scale.on('resize', layout);
    scene.events.once('shutdown', () =>
    {
        scene.scale.off('resize', layout);
    });
}
