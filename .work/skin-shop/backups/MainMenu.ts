import { GameObjects, Input, Scene } from 'phaser';
import { playSfx } from '../audio';
import { bindResize, coverImage } from '../layout';
import { menuButtonFrame, MenuButtonId } from '../menu';
import { getWeeklyLeaderboard } from '../leaderboardContext';
import { WEEKLY_RANK_SCENE } from './WeeklyRanking';

type ButtonNode = {
    id: MenuButtonId;
    image: GameObjects.Image;
};

/** Measured on the cropped rider sheet. The box center is what sits on the screen midline. */
const HERO_FRAME_H = 1332;
const BOX_CENTER_Y = 1064;
const BOX_WIDTH = 735;

export class MainMenu extends Scene
{
    private background: GameObjects.Image;
    private logo: GameObjects.Image;
    private hero: GameObjects.Image;
    private buttons: ButtonNode[] = [];
    private started = false;
    private rankingOpen = false;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.started = false;
        this.rankingOpen = false;
        this.buttons = [];

        this.background = this.add.image(0, 0, 'menu-bg').setDepth(0);
        this.logo = this.add.image(0, 0, 'menu-logo').setDepth(2);
        this.hero = this.add.image(0, 0, 'menu-hero', 'hero').setOrigin(0.5).setDepth(1);

        ([ 'start', 'friend', 'rank', 'skin', 'settings' ] as MenuButtonId[]).forEach(id =>
        {
            const art = menuButtonFrame(id);
            const image = this.add.image(0, 0, art.key, art.frame)
                .setOrigin(0.5)
                .setDepth(3)
                .setInteractive({ useHandCursor: true });

            this.buttons.push({ id, image });
        });

        this.input.on('pointerdown', (pointer: Input.Pointer) =>
        {
            if (pointer.button !== undefined && pointer.button !== 0)
            {
                return;
            }

            const hit = this.buttons.find(button => this.overButton(button.image, pointer));

            if (hit)
            {
                this.onButton(hit.id, hit.image);
            }
        });

        this.layout();
        bindResize(this, () => this.layout());
        this.events.once('shutdown', () =>
        {
            if (this.rankingOpen)
            {
                this.rankingOpen = false;
                this.scene.stop(WEEKLY_RANK_SCENE);
            }
        });
    }

    private onButton (id: MenuButtonId, image: GameObjects.Image)
    {
        if (this.started || this.rankingOpen)
        {
            return;
        }

        try
        {
            playSfx(this, 'ui');
        }
        catch
        {
            // Audio must not block the menu.
        }

        if (id === 'rank')
        {
            this.rankingOpen = true;
            this.pop(image);
            // Resize may replace the visual tween; it must not cancel the requested action.
            this.time.delayedCall(360, () => this.openRanking());
            return;
        }

        const openGame = id === 'start';

        if (openGame)
        {
            this.started = true;
        }

        this.pop(image);
        if (openGame)
        {
            this.time.delayedCall(360, () =>
            {
                if (this.started && this.scene.isActive()) this.scene.start('Game');
            });
        }
    }

    private openRanking ()
    {
        if (!this.scene.isActive()) return;
        this.scene.launch(WEEKLY_RANK_SCENE, {
            leaderboard: getWeeklyLeaderboard(this),
            onClose: () =>
            {
                this.rankingOpen = false;
                this.scene.resume();
            },
            onChallenge: () =>
            {
                this.rankingOpen = false;
                this.started = true;
                this.scene.start('Game');
            }
        });
        this.scene.pause();
    }

    /** Shrink on press, then spring back past the resting size. */
    private pop (image: GameObjects.Image)
    {
        const restX = image.getData('sx') as number;
        const restY = image.getData('sy') as number;

        this.tweens.killTweensOf(image);
        image.setScale(restX, restY);

        this.tweens.add({
            targets: image,
            scaleX: restX * 0.86,
            scaleY: restY * 0.86,
            duration: 80,
            ease: 'Quad.In',
            onComplete: () =>
            {
                this.tweens.add({
                    targets: image,
                    scaleX: restX,
                    scaleY: restY,
                    duration: 280,
                    ease: 'Back.Out'
                });
            }
        });
    }

    private overButton (image: GameObjects.Image, pointer: Input.Pointer)
    {
        const halfW = (image.getData('dw') as number) / 2;
        const halfH = (image.getData('dh') as number) / 2;

        return Math.abs(pointer.x - image.x) <= halfW && Math.abs(pointer.y - image.y) <= halfH;
    }

    private place (image: GameObjects.Image, x: number, y: number, displayWidth: number, displayHeight: number)
    {
        this.tweens.killTweensOf(image);
        image.setDisplaySize(displayWidth, displayHeight);
        image.setPosition(x, y);
        image.setData('sx', image.scaleX);
        image.setData('sy', image.scaleY);
        image.setData('dw', displayWidth);
        image.setData('dh', displayHeight);
    }

    private layout ()
    {
        const width = this.scale.width;
        const height = this.scale.height;

        coverImage(this.background, width, height);

        const gap = Math.max(8, height * 0.011);
        const bottom = height * 0.012;
        const buttonWidth = width * 0.52 * 0.7;
        const sizeOf = (id: MenuButtonId, targetWidth: number) =>
        {
            const art = menuButtonFrame(id);

            return targetWidth * art.h / art.w;
        };
        const heights = {
            start: sizeOf('start', buttonWidth),
            friend: sizeOf('friend', buttonWidth),
            rank: sizeOf('rank', buttonWidth)
        };
        const square = buttonWidth * 0.32;
        const skinH = sizeOf('skin', square);
        const settingsH = sizeOf('settings', square);
        const rowH = Math.max(skinH, settingsH);
        let y = height - bottom;

        const placeWide = (id: 'start' | 'friend' | 'rank') =>
        {
            const image = this.buttons.find(button => button.id === id)!.image;
            const displayHeight = heights[id];

            y -= displayHeight / 2;
            this.place(image, width / 2, y, buttonWidth, displayHeight);
            y -= displayHeight / 2 + gap;
        };

        const skin = this.buttons.find(button => button.id === 'skin')!.image;
        const settings = this.buttons.find(button => button.id === 'settings')!.image;
        const pairGap = gap * 1.6;
        const pairWidth = square * 2 + pairGap;

        y -= rowH / 2;
        this.place(skin, width / 2 - pairWidth / 2 + square / 2, y, square, skinH);
        this.place(settings, width / 2 + pairWidth / 2 - square / 2, y, square, settingsH);
        y -= rowH / 2 + gap;

        placeWide('rank');
        placeWide('friend');
        placeWide('start');

        const buttonTop = y;

        const logoWidth = width * 0.92;
        const logoHeight = logoWidth * (this.logo.height / this.logo.width);
        const logoTop = height * 0.13;

        this.logo.setDisplaySize(logoWidth, logoHeight);
        this.logo.setPosition(width / 2, logoTop + logoHeight / 2);

        const logoBottom = logoTop + logoHeight;
        const roomTop = logoBottom + gap;
        const roomBottom = buttonTop - gap;
        let heroScale = (width * 0.34 * 1.5) / BOX_WIDTH;

        const heroYFor = (scale: number) =>
        {
            const displayHeight = HERO_FRAME_H * scale;
            let heroY = height / 2 - (BOX_CENTER_Y / HERO_FRAME_H - 0.5) * displayHeight;
            const minY = roomTop + displayHeight / 2;

            if (heroY < minY)
            {
                heroY = minY;
            }

            return heroY;
        };

        while (heroScale > 0.08 && heroYFor(heroScale) + HERO_FRAME_H * heroScale / 2 > roomBottom)
        {
            heroScale -= 0.004;
        }

        this.hero.setScale(heroScale);
        this.hero.setPosition(width / 2, heroYFor(heroScale));
    }
}
