import { Scene } from 'phaser';
import { loadMenuStreetAssets } from './menuStreet';

/** Opaque bounds measured from each imported button. */
const BUTTONS = {
    start: { file: 'UI/button_start.png', x: 18, y: 12, w: 222, h: 60 },
    friend: { file: 'UI/button_friend.png', x: 12, y: 8, w: 234, h: 67 },
    rank: { file: 'UI/button_ranking.png', x: 19, y: 8, w: 218, h: 63 },
    skin: { file: 'UI/button_skin.png', x: 0, y: 1, w: 128, h: 126 },
    settings: { file: 'UI/button_setting.png', x: 0, y: 4, w: 128, h: 121 }
};

export const MENU_BUTTONS = [ 'start', 'friend', 'rank', 'skin', 'settings' ] as const;
export type MenuButtonId = typeof MENU_BUTTONS[number];

export function menuButtonKey (id: MenuButtonId)
{
    return `menu-btn-${id}`;
}

export function loadMenuAssets (scene: Scene)
{
    scene.load.image('menu-logo', 'UI/logo_1.png');
    loadMenuStreetAssets(scene);

    MENU_BUTTONS.forEach(id =>
    {
        scene.load.image(menuButtonKey(id), BUTTONS[id].file);
    });
}

export function createMenuFrames (scene: Scene)
{
    MENU_BUTTONS.forEach(id =>
    {
        const texture = scene.textures.get(menuButtonKey(id));
        const region = BUTTONS[id];

        if (!texture.has('art'))
        {
            texture.add('art', 0, region.x, region.y, region.w, region.h);
        }
    });
}

export function menuButtonFrame (id: MenuButtonId)
{
    return { key: menuButtonKey(id), frame: 'art', ...BUTTONS[id] };
}
