import { Scene } from 'phaser';

const HERO = 'menu-hero';

/** Opaque bounds measured from each imported button. */
const BUTTONS = {
    start: { file: 'UI/button_start.png', x: 18, y: 12, w: 222, h: 60 },
    friend: { file: 'UI/button_friend.png', x: 12, y: 8, w: 234, h: 67 },
    rank: { file: 'UI/button_ranking.png', x: 19, y: 8, w: 218, h: 63 },
    skin: { file: 'UI/button_skin.png', x: 0, y: 1, w: 128, h: 126 },
    settings: { file: 'UI/button_setting.png', x: 0, y: 4, w: 128, h: 121 }
};

const HERO_REGION = { x: 190, y: 351, w: 771, h: 1332 };

export const MENU_BUTTONS = [ 'start', 'friend', 'rank', 'skin', 'settings' ] as const;
export type MenuButtonId = typeof MENU_BUTTONS[number];

export function menuButtonKey (id: MenuButtonId)
{
    return `menu-btn-${id}`;
}

export function loadMenuAssets (scene: Scene)
{
    scene.load.image('menu-bg', 'UI/menu.png');
    scene.load.image('menu-logo', 'UI/logo_1.png');
    scene.load.image(HERO, 'UI/logo_2.png');

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

    const hero = scene.textures.get(HERO);

    if (!hero.has('hero'))
    {
        hero.add('hero', 0, HERO_REGION.x, HERO_REGION.y, HERO_REGION.w, HERO_REGION.h);
    }
}

export function menuButtonFrame (id: MenuButtonId)
{
    return { key: menuButtonKey(id), frame: 'art', ...BUTTONS[id] };
}
