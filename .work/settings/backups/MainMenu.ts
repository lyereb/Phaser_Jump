import { GameObjects, Input, Scene } from 'phaser';
import { playSfx } from '../audio';
import { DEFAULT_BOX_TEXTURE } from '../boxSkins';
import { bindResize, coverImage } from '../layout';
import { menuButtonFrame, MenuButtonId } from '../menu';
import { getWeeklyLeaderboard } from '../leaderboardContext';
import { PLAYER_ART_FEET, PLAYER_ART_HEIGHT, PLAYER_ART_TOP, PLAYER_IDLE_ANIM, PLAYER_JUMP_ANIM } from '../player';
import { StarBurst } from '../stars';
import { WEEKLY_RANK_SCENE } from './WeeklyRanking';
import { SKIN_SHOP_SCENE } from './SkinShop';
import { showToast } from '../toast';
import { playPressBounce, PRESS_BOUNCE_MS } from '../pressBounce';

type ButtonNode = {
    id: MenuButtonId;
    image: GameObjects.Image;
};

/** Same lid measurements as the in-game mover, in source pixels. The stand point is the middle of the lid. */
const LID_CENTER_X = 128;
const LID_CENTER_Y = 50;
const BOX_VISUAL_TOP = 29;
const BOX_VISUAL_BOTTOM = 167;
const BOX_VISUAL_LEFT = 5;
const BOX_VISUAL_RIGHT = 252;
const PLAYER_TO_BOX = 1.33;
/** Same landing squash as a box caught in game. */
const SQUASH_X = 1.14;
const SQUASH_Y = 0.72;
const SQUASH_IN_MS = 70;
const SQUASH_OUT_MS = 260;

export class MainMenu extends Scene
{
    private background: GameObjects.Image;
    private logo: GameObjects.Image;
    private box: GameObjects.Image;
    private rider: GameObjects.Sprite;
    private stars: StarBurst;
    private buttons: ButtonNode[] = [];
    private started = false;
    private rankingOpen = false;
    private shopOpen = false;
    private surfaceY = 0;
    private roomTop = 0;
    private boxScale = 1;
    private airborne = false;
    private vy = 0;
    private gravityUp = 1;
    private gravityDown = 1;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.started = false;
        this.rankingOpen = false;
        this.shopOpen = false;
        this.buttons = [];

        this.background = this.add.image(0, 0, 'menu-bg').setDepth(0);
        this.logo = this.add.image(0, 0, 'menu-logo').setDepth(2);
        this.box = this.add.image(0, 0, DEFAULT_BOX_TEXTURE).setDepth(1);
        this.rider = this.add.sprite(0, 0, 'player-idle-0')
            .setOrigin(0.5, PLAYER_ART_FEET / PLAYER_ART_HEIGHT)
            .setDepth(2.4);
        this.rider.play(PLAYER_IDLE_ANIM);
        this.stars = new StarBurst(this, 2.8);

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
                return;
            }

            if (this.overImage(this.logo, pointer)) return;
            this.hop();
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
            if (this.shopOpen)
            {
                this.shopOpen = false;
                this.scene.stop(SKIN_SHOP_SCENE);
            }
        });
    }

    private onButton (id: MenuButtonId, image: GameObjects.Image)
    {
        if (this.started || this.rankingOpen || this.shopOpen)
        {
            return;
        }

        if (id === 'friend')
        {
            this.pop(image);
            showToast(this, '功能还未开放');
            return;
        }

        playSfx(this, 'ui');

        if (id === 'rank')
        {
            this.rankingOpen = true;
            this.pop(image);
            // Resize may replace the visual tween; it must not cancel the requested action.
            this.time.delayedCall(PRESS_BOUNCE_MS, () => this.openRanking());
            return;
        }

        if (id === 'skin')
        {
            this.shopOpen = true;
            this.pop(image);
            this.time.delayedCall(PRESS_BOUNCE_MS, () => this.openShop());
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
            this.time.delayedCall(PRESS_BOUNCE_MS, () =>
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

    private openShop ()
    {
        if (!this.scene.isActive()) return;
        this.scene.launch(SKIN_SHOP_SCENE, {
            onClose: () =>
            {
                this.shopOpen = false;
                this.layout();
                this.scene.resume();
            }
        });
        this.scene.pause();
    }

    /** Same shrink-and-spring as every other button. Layout owns the resting scale. */
    private pop (image: GameObjects.Image)
    {
        playPressBounce(image, () => ({ x: image.getData('sx') as number, y: image.getData('sy') as number }));
    }

    update (_time: number, delta: number)
    {
        if (!this.airborne || this.started) return;
        const dt = Math.min(0.05, Math.max(0, delta) / 1000);
        this.vy += (this.vy < 0 ? this.gravityUp : this.gravityDown) * dt;
        this.rider.y += this.vy * dt;
        if (this.vy < 0 || this.rider.y < this.surfaceY) return;
        this.rider.y = this.surfaceY;
        this.airborne = false;
        this.vy = 0;
        this.rider.play(PLAYER_IDLE_ANIM);
        this.squashBox();
        this.stars.burst(this.rider.x, this.surfaceY);
        playSfx(this, 'land');
    }

    /** One hop on the menu box. Another click does nothing until the feet are back down. */
    private hop ()
    {
        if (this.airborne || this.started || this.rankingOpen || this.shopOpen) return;
        const boxHeight = (BOX_VISUAL_BOTTOM - BOX_VISUAL_TOP) * this.boxScale;
        const playerHeight = boxHeight * PLAYER_TO_BOX;
        const headroom = this.surfaceY - playerHeight - this.roomTop;
        const hop = Math.min(boxHeight * 1.15, Math.max(boxHeight * 0.45, headroom * 0.92));
        const rise = hop / 0.34;

        this.gravityUp = (2 * rise * rise) / hop;
        this.gravityDown = this.gravityUp * 1.15;
        this.vy = -2 * rise;
        this.airborne = true;
        this.rider.play(PLAYER_JUMP_ANIM);
        playSfx(this, 'jump');
    }

    /** Pin the box bottom, squash it, then spring back to the laid-out size. */
    private squashBox ()
    {
        const node = this.box;
        const frame = node.frame;
        const rest = this.boxScale;
        const bottom = node.y + frame.height * node.scaleY / 2;
        const restY = bottom - frame.height * rest / 2;

        this.tweens.killTweensOf(node);
        this.tweens.add({
            targets: node,
            scaleX: rest * SQUASH_X,
            scaleY: rest * SQUASH_Y,
            y: bottom - frame.height * rest * SQUASH_Y / 2,
            duration: SQUASH_IN_MS,
            ease: 'Quad.Out',
            onComplete: () =>
            {
                this.tweens.add({
                    targets: node,
                    scaleX: rest,
                    scaleY: rest,
                    y: restY,
                    duration: SQUASH_OUT_MS,
                    ease: 'Back.Out',
                    onComplete: () =>
                    {
                        node.setScale(rest);
                        node.y = restY;
                    }
                });
            }
        });
    }

    private overImage (image: GameObjects.Image, pointer: Input.Pointer)
    {
        return Math.abs(pointer.x - image.x) <= image.displayWidth / 2
            && Math.abs(pointer.y - image.y) <= image.displayHeight / 2;
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
        const room = Math.max(1, roomBottom - roomTop);
        const visualW = BOX_VISUAL_RIGHT - BOX_VISUAL_LEFT;
        const visualH = BOX_VISUAL_BOTTOM - BOX_VISUAL_TOP;
        const stackPerScale = visualH * PLAYER_TO_BOX + (BOX_VISUAL_BOTTOM - LID_CENTER_Y);
        const fitted = Math.max(0.05, Math.min((width * 0.42) / visualW, room / stackPerScale));
        const boxScale = fitted * 0.7;
        const playerHeight = visualH * boxScale * PLAYER_TO_BOX;
        const frame = this.box.frame;
        const feetY = buttonTop - gap - (BOX_VISUAL_BOTTOM - LID_CENTER_Y) * boxScale;
        const lifted = this.airborne ? Math.max(0, this.surfaceY - this.rider.y) : 0;

        this.tweens.killTweensOf(this.box);
        this.roomTop = roomTop;
        this.boxScale = boxScale;
        this.surfaceY = feetY;
        this.box.setScale(boxScale);
        this.box.setPosition(
            width / 2 - (LID_CENTER_X - frame.width / 2) * boxScale,
            feetY - (LID_CENTER_Y - frame.height / 2) * boxScale
        );
        this.rider.setScale(playerHeight / (PLAYER_ART_FEET - PLAYER_ART_TOP));
        this.rider.setPosition(width / 2, feetY - lifted);
    }
}
