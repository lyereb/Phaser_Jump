import { Scene, TintModes } from 'phaser';
import { pauseBgm, playSfx, resumeBgm, startBgm } from '../audio';
import { Checkpoints } from '../checkpoints';
import { DebugPanel } from '../debugPanel';
import { MeterDigits } from '../letters';
import { PauseButton } from '../pauseButton';
import { Scenery } from '../scenery';
import { StarBurst } from '../stars';
import { bindResize, coverImage } from '../layout';
import { PLAYER_ART_FEET, PLAYER_ART_HEIGHT, PLAYER_ART_TOP, PLAYER_HIT_ANIM, PLAYER_IDLE_ANIM, PLAYER_JUMP_ANIM } from '../player';

const STEP_MS = 8;
/** Landing squash: a little wider and shorter, then spring back past rest. */
const SQUASH_X = 1.14;
const SQUASH_Y = 0.72;
const SQUASH_IN_MS = 70;
const SQUASH_OUT_MS = 260;
/** Camera starts following once the character reaches this screen position. */
const CAMERA_FOLLOW_SCREEN_Y = 0.5;

const COLOR_BG = 0xf7d5e4;

type Phase = 'play' | 'dead' | 'over';

/** `node` is the invisible hitbox; `sprite` is drawn with its feet on the hitbox bottom. */
type Actor = {
    node: Phaser.GameObjects.Rectangle;
    sprite: Phaser.GameObjects.Sprite;
    vx: number;
    vy: number;
};

type Box = {
    x: number;
    y: number;
    displayWidth: number;
    displayHeight: number;
};

/**
 * Collision area inside a block texture, in source pixels.
 * `surface` is the line on the top face where feet stand.
 * The next box covers the top of that lid and leaves the lower rim showing.
 * Jump height must stay above the scaled `bottom - surface`, otherwise the character cannot clear a sliding block.
 */
type BlockArt = {
    key: string;
    scaleX: number;
    scaleY: number;
    left: number;
    right: number;
    surface: number;
    bottom: number;
};

/** Grass strip. Collision is only the top skin; the drawing continues down to fill the screen. */
const BASE_FRAME_W = 1024;
const BASE_SURFACE_PX = 14;
/** Last dirt pixel in base.png. The strip from the grass to here sits on the bottom of the screen. */
const BASE_DIRT_BOTTOM_PX = 243;
/** Share of the screen used by that strip, measured from the reference frame. */
const BASE_SCREEN_FRACTION = 0.136;
const BASE_ART: BlockArt = {
    key: 'block-base',
    scaleX: 1,
    scaleY: 1,
    left: 16,
    right: BASE_FRAME_W - 16,
    surface: BASE_SURFACE_PX,
    bottom: BASE_SURFACE_PX + 32
};
/** Lid and body measured on mover_normal.png. Scale stays under the jump so a block can be cleared. */
const MOVER_ART: BlockArt = {
    key: 'block-mover',
    scaleX: 0.64,
    scaleY: 0.64,
    left: 8,
    right: 248,
    surface: 32,
    bottom: 166
};
/**
 * Source row on the lower box where the next box's bottom sits.
 * That covers the lid's top outline and leaves the lower rim and its side edges showing.
 */
const MOVER_LID_BOTTOM_PX = 50;
/** Opaque span of mover_normal.png. */
const BOX_VISUAL_TOP = 29;
const BOX_VISUAL_BOTTOM = 167;
const BOX_VISUAL_LEFT = 5;
const BOX_VISUAL_RIGHT = 252;
const BOX_VISUAL_H = (BOX_VISUAL_BOTTOM - BOX_VISUAL_TOP) * MOVER_ART.scaleY;
/** Opaque bar inside mover_pallet.png (2048×154). Thin enough to sit under a box. */
const PALLET_FRAME_W = 2048;
const PALLET_FRAME_H = 154;
const PALLET_LEFT = 73;
const PALLET_RIGHT = 1974;
const PALLET_TOP = 35;
const PALLET_SCALE = (BOX_VISUAL_H * 0.14) / 86;
/**
 * Starting feel. The debug panel can still change these during a round.
 * Height is in box heights. Speeds are world pixels per second.
 */
const PLAYER_TO_BOX = 1.33;
const JUMP_BOXES = 1.5;
const RISE_SPEED = 500;
const FALL_SPEED = 420;
const BOARD_SPEED = 398;
/** A box counts as centred when its collision centre is this close to the stack column. */
const CENTER_TOLERANCE = 8;
const PLAYER_H = BOX_VISUAL_H * PLAYER_TO_BOX;
const PLAYER_W = PLAYER_H * 0.45;
const PLAYER_SCALE = PLAYER_H / (PLAYER_ART_FEET - PLAYER_ART_TOP);
const BASE_SURFACE_Y = 1000;
const DEPTH_BACKGROUND = -1;
const DEPTH_PLAYER = 1000;
const DEPTH_UI = 2000;
/** An ordinary land. A perfect land starts at 2 and climbs by 1 while the streak holds, up to 5. */
const NORMAL_METERS = 1;
const PERFECT_METERS_MAX = 5;
/** Plain height readout, kept in the upper half of the screen. */
const HEIGHT_TEXT_Y = 0.3;
const RESUME_COUNT = [ 2, 1 ];
const RESUME_STEP_MS = 900;
const RESUME_DIGIT_SCALE = 2.8;

type Block = {
    node: Phaser.GameObjects.Image;
    art: BlockArt;
    vx: number;
    vy: number;
    moving: boolean;
};

export class Game extends Scene
{
    private background: Phaser.GameObjects.Image;
    private player: Actor;
    private stack: Block[] = [];
    private mover: Block | null = null;
    /** Board under the box that is being delivered. Null once that board slides back out. */
    private pallet: Phaser.GameObjects.Image | null = null;
    /** +1 when the board trails to the left, -1 when it trails to the right. */
    private palletSign = 1;
    private support: Block;
    private grounded = true;
    private prevBottom = 0;
    private phase: Phase = 'play';
    private accumulator = 0;
    private hint: Phaser.GameObjects.Text;
    private overText: Phaser.GameObjects.Text | null = null;
    private heightText: MeterDigits;
    private starBurst: StarBurst;
    private scenery: Scenery;
    private checkpoints: Checkpoints;
    private debugPanel: DebugPanel;
    private pauseButton: PauseButton;
    private resumeDigit: Phaser.GameObjects.Image | null = null;
    private resumeTimer: Phaser.Time.TimerEvent | null = null;
    private anchorX = 0;
    private cameraFocusY = 0;
    private cameraLocked = true;
    private lockedScrollY = 0;
    /** Box heights of the hop. The debug panel changes this live. */
    private jumpBoxes = JUMP_BOXES;
    /** Average upward speed, in world pixels per second. */
    private risePx = RISE_SPEED;
    /** Average downward speed over the same height, in world pixels per second. */
    private fallPx = FALL_SPEED;
    /** Box slide speed, in world pixels per second. */
    private boardPx = BOARD_SPEED;
    /** Height shown on the score. Ordinary lands add 1. Perfect streaks add 2, then 3, 4 and 5. */
    private heightMeters = 0;
    /** How many perfect lands are in a row. A miss sets this back to 0. */
    private perfectStreak = 0;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.stack = [];
        this.mover = null;
        this.pallet = null;
        this.grounded = true;
        this.phase = 'play';
        this.accumulator = 0;
        this.overText = null;
        this.cameraLocked = true;
        this.heightMeters = 0;
        this.perfectStreak = 0;

        this.cameras.main.setBackgroundColor(COLOR_BG);
        this.cameras.main.roundPixels = true;

        this.background = this.add.image(0, 0, 'background')
            .setScrollFactor(0)
            .setDepth(DEPTH_BACKGROUND);

        const base = this.createBlock({ ...BASE_ART }, false);

        this.stack.push(base);
        this.support = base;

        const playerNode = this.add.rectangle(this.body(base).x, 0, PLAYER_W, PLAYER_H).setVisible(false);
        const playerSprite = this.add.sprite(0, 0, 'player-idle-0')
            .setOrigin(0.5, PLAYER_ART_FEET / PLAYER_ART_HEIGHT)
            .setScale(PLAYER_SCALE)
            .setDepth(DEPTH_PLAYER);

        this.player = { node: playerNode, sprite: playerSprite, vx: 0, vy: 0 };
        this.groundOn(base);
        this.syncPlayerSprite();

        this.hint = this.add.text(0, 0, '点击屏幕起跳', {
            fontFamily: 'Arial',
            fontSize: 32,
            color: '#ffffff',
            stroke: '#c45b86',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_UI);

        this.heightText = new MeterDigits(this, DEPTH_UI);
        this.updateHeight();

        this.starBurst = new StarBurst(this, DEPTH_PLAYER + 1);
        this.scenery = new Scenery(this);
        this.checkpoints = new Checkpoints(this, DEPTH_PLAYER + 10);
        this.debugPanel = new DebugPanel(this, DEPTH_UI + 1);
        this.pauseButton = new PauseButton(
            this,
            DEPTH_UI + 1,
            () =>
            {
                playSfx(this, 'ui');
                this.freezePlay();
            },
            () =>
            {
                playSfx(this, 'ui');
                this.startResumeCountdown();
            }
        );

        this.anchorX = this.body(base).x;
        this.addTuneControls();
        this.debugPanel.addButton('测试装饰', () =>
        {
            this.scenery.preview(this.anchorX);
            // Close next frame so this click still counts as a UI click and does not jump or restart.
            this.time.delayedCall(0, () => this.debugPanel.close());
        });
        this.debugPanel.addButton('测试Checkpoint', () =>
        {
            this.checkpoints.preview(this.anchorX, this.cameras.main.scrollY + this.scale.height * 0.38);
            this.time.delayedCall(0, () => this.debugPanel.close());
        });
        this.layout();
        this.followCamera(true);
        this.spawnMover();
        startBgm(this);

        this.input.on('pointerdown', this.onPointerDown, this);
        this.events.once('shutdown', () =>
        {
            this.input.off('pointerdown', this.onPointerDown, this);
            this.clearResumeCountdown();
        });

        bindResize(this, () =>
        {
            this.layout();

            if (this.cameraLocked)
            {
                this.followCamera(true);
            }
        });
    }

    update (_time: number, delta: number)
    {
        if (this.pauseButton.isPaused())
        {
            return;
        }

        this.accumulator += Math.min(delta, 48);

        while (this.accumulator >= STEP_MS)
        {
            this.simulate(STEP_MS / 1000);
            this.accumulator -= STEP_MS;
        }

        this.syncPlayerSprite();
        this.scenery.cull(this.cameras.main.scrollY, this.scale.height);

        if (this.phase === 'play')
        {
            this.followCamera(false);
            this.checkpoints.layout();
        }
    }

    private freezePlay ()
    {
        this.clearResumeCountdown();
        this.tweens.pauseAll();
        this.checkpoints.setPaused(true);
        this.anims.pauseAll();
        pauseBgm(this);
        this.accumulator = 0;
    }

    private unfreezePlay ()
    {
        this.tweens.resumeAll();
        this.checkpoints.setPaused(false);
        this.anims.resumeAll();
        resumeBgm(this);
        this.pauseButton.finishResume();
    }

    /** Keep the run frozen, flash 2 then 1, then unfreeze. */
    private startResumeCountdown ()
    {
        this.clearResumeCountdown();
        this.tweens.resumeAll();
        this.checkpoints.setPaused(true);

        let index = 0;

        const tick = () =>
        {
            if (index >= RESUME_COUNT.length)
            {
                this.clearResumeCountdown();
                this.unfreezePlay();
                return;
            }

            const value = RESUME_COUNT[index++];

            this.resumeDigit?.destroy();
            this.resumeDigit = this.add.image(this.scale.width / 2, this.scale.height / 2, `combo-${value}`)
                .setScrollFactor(0)
                .setDepth(DEPTH_UI + 50)
                .setScale(RESUME_DIGIT_SCALE * 0.55);

            this.tweens.add({
                targets: this.resumeDigit,
                scale: RESUME_DIGIT_SCALE,
                duration: 220,
                ease: 'Back.Out'
            });

            this.resumeTimer = this.time.delayedCall(RESUME_STEP_MS, tick);
        };

        tick();
    }

    private clearResumeCountdown ()
    {
        this.resumeTimer?.remove(false);
        this.resumeTimer = null;
        this.resumeDigit?.destroy();
        this.resumeDigit = null;
    }

    private simulate (dt: number)
    {
        const player = this.player;

        this.prevBottom = this.bottom(player.node);

        if (!this.grounded)
        {
            player.vy += this.gravity(player.vy < 0) * dt;
            player.node.y += player.vy * dt;
            player.node.x += player.vx * dt;
        }
        else
        {
            player.vx = 0;
            player.vy = 0;
            player.node.y = this.top(this.body(this.support)) - player.node.displayHeight / 2;
        }

        if (this.mover?.moving && this.mover.vx !== 0)
        {
            const center = this.anchorX;
            const before = this.body(this.mover).x;

            this.mover.node.x += this.mover.vx * dt;

            const after = this.body(this.mover).x;

            if ((before - center) * (after - center) <= 0)
            {
                this.placeBlock(this.mover, center, this.stackBottom(this.support));
                this.mover.vx = 0;
            }
            else if (this.phase === 'play' && this.passed(this.mover))
            {
                this.mover.node.destroy();
                this.pallet?.destroy();
                this.pallet = null;
                this.mover = null;
                this.spawnMover();
            }
        }

        if (this.mover?.moving)
        {
            this.syncPallet();
        }

        if (this.phase === 'play')
        {
            this.checkpoints.observeJump(this.player.node.x, this.top(this.player.node), !this.grounded && this.player.vy < 0, PLAYER_W);
            this.resolve();
        }

        if (this.phase === 'dead' && this.top(player.node) > this.cameras.main.scrollY + this.scale.height + 80)
        {
            this.phase = 'over';
            this.showOver();
        }
    }

    private resolve ()
    {
        const mover = this.mover;

        if (mover?.moving)
        {
            if (this.tryLand(mover))
            {
                return;
            }

            if (this.intersects(this.player.node, this.body(mover)))
            {
                this.fly(mover.vx);
                return;
            }
        }

        if (!this.grounded)
        {
            this.tryLandOnSupport();
        }

        if (!this.grounded && this.bottom(this.player.node) > this.bottom(this.body(this.support)) + 36)
        {
            this.phase = 'dead';
            this.hint.setVisible(false);
            this.player.sprite.play(PLAYER_HIT_ANIM);
            playSfx(this, 'fail');
        }
    }

    private tryLand (block: Block)
    {
        if (this.grounded || this.player.vy < 0)
        {
            return false;
        }

        const overlap = this.xOverlap(this.player.node, this.body(block));
        const surface = this.top(this.body(block));
        const feet = this.bottom(this.player.node);
        const crossed = this.prevBottom <= surface + 8 && feet >= surface - 1;

        if (!crossed || overlap < this.player.node.displayWidth * 0.5)
        {
            return false;
        }

        const perfect = this.isCentered(block) && this.isCentered(this.support);

        block.moving = false;
        block.vx = 0;
        block.vy = 0;
        this.releasePallet();
        this.mover = null;
        this.stack.push(block);
        this.squash(block);
        this.celebrate(block);

        if (perfect)
        {
            this.flashPerfect(block);
        }
        this.scoreLand(perfect);
        this.updateHeight();
        this.scenery.sync(this.meters(), this.top(this.body(block)), this.anchorX);
        this.groundOn(block);
        this.checkpoints.land(this.meters());
        this.spawnMover();

        return true;
    }

    private tryLandOnSupport ()
    {
        const support = this.body(this.support);
        const surface = this.top(support);
        const feet = this.bottom(this.player.node);
        const crossed = this.prevBottom <= surface + 8 && feet >= surface - 1;
        const overlap = this.xOverlap(this.player.node, support);

        if (this.player.vy >= 0 && crossed && overlap >= this.player.node.displayWidth * 0.5)
        {
            this.perfectStreak = 0;
            this.squash(this.support);
            playSfx(this, 'land');
            this.starBurst.burst(this.player.node.x, this.top(support));
            this.groundOn(this.support);
            this.prepareCheckpoint();
        }
    }

    /** Ground is the centred base. A mover is centred only when it stopped on the stack column. */
    private isCentered (block: Block)
    {
        if (block.art.key !== MOVER_ART.key)
        {
            return true;
        }

        return Math.abs(this.body(block).x - this.anchorX) <= CENTER_TOLERANCE;
    }

    /** Short white column and a washed-out top box, matching a perfect centre stack. */
    private flashPerfect (block: Block)
    {
        const body = this.body(block);
        const node = block.node;
        const depth = node.depth;
        const beamH = this.scale.height * 0.62;
        const beamY = this.top(body) - beamH * 0.15;

        node.setTint(0xffffff).setTintMode(TintModes.FILL);
        this.time.delayedCall(140, () =>
        {
            if (node.scene)
            {
                node.clearTint();
            }
        });

        const beam = this.add.rectangle(body.x, beamY, body.displayWidth * 0.9, beamH, 0xffffff, 0.72)
            .setDepth(depth - 0.2);
        const core = this.add.rectangle(body.x, beamY, body.displayWidth * 0.34, beamH, 0xffffff, 0.92)
            .setDepth(depth - 0.1);

        this.tweens.add({
            targets: [ beam, core ],
            alpha: 0,
            scaleX: 1.45,
            duration: 220,
            ease: 'Quad.Out',
            onComplete: () =>
            {
                beam.destroy();
                core.destroy();
            }
        });
    }

    private celebrate (block: Block)
    {
        const x = this.player.node.x;
        const y = this.top(this.body(block));

        playSfx(this, 'land');
        this.starBurst.burst(x, y);
    }

    private onPointerDown (pointer: Phaser.Input.Pointer)
    {
        if (pointer.button !== undefined && pointer.button !== 0)
        {
            return;
        }

        // HUD buttons opt out with setInteractive() and setData('ui', true).
        const overUi = this.input.hitTestPointer(pointer).some(obj => obj.getData('ui') === true);

        if (overUi)
        {
            return;
        }

        if (this.pauseButton.isPaused() || this.pauseButton.isResuming())
        {
            return;
        }

        if (this.phase === 'over')
        {
            playSfx(this, 'ui');
            this.scene.restart();
            return;
        }

        if (this.phase !== 'play' || !this.grounded)
        {
            return;
        }

        this.grounded = false;
        this.player.vy = -2 * this.risePx;
        this.player.node.y -= 2;
        this.player.sprite.play(PLAYER_JUMP_ANIM);
        playSfx(this, 'jump');
        this.hint.setVisible(false);
        this.prepareCheckpoint();
        this.checkpoints.beginJump();
    }

    private fly (dir: number)
    {
        const sign = dir === 0 ? 1 : Math.sign(dir);

        this.phase = 'dead';
        this.grounded = false;
        this.hint.setVisible(false);
        this.player.vx = sign * 540;
        this.player.vy = -360;
        this.player.sprite.play(PLAYER_HIT_ANIM);
        playSfx(this, 'fail');
    }

    /** Pins the image bottom and compresses the board, then springs it back. */
    private squash (block: Block)
    {
        const node = block.node;
        const { art } = block;
        const frame = node.frame;
        const bottom = node.y + frame.height * node.scaleY / 2;
        const restY = bottom - frame.height * art.scaleY / 2;

        this.tweens.killTweensOf(node);

        this.tweens.add({
            targets: node,
            scaleX: art.scaleX * SQUASH_X,
            scaleY: art.scaleY * SQUASH_Y,
            y: bottom - frame.height * art.scaleY * SQUASH_Y / 2,
            duration: SQUASH_IN_MS,
            ease: 'Quad.Out',
            onComplete: () =>
            {
                this.tweens.add({
                    targets: node,
                    scaleX: art.scaleX,
                    scaleY: art.scaleY,
                    y: restY,
                    duration: SQUASH_OUT_MS,
                    ease: 'Back.Out',
                    onComplete: () =>
                    {
                        node.setScale(art.scaleX, art.scaleY);
                        node.y = restY;
                    }
                });
            }
        });
    }

    private groundOn (block: Block)
    {
        this.support = block;
        this.grounded = true;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.node.y = this.top(this.body(block)) - this.player.node.displayHeight / 2;
        this.player.sprite.play(PLAYER_IDLE_ANIM);
    }

    private syncPlayerSprite ()
    {
        const { node, sprite } = this.player;

        sprite.setPosition(node.x, this.bottom(node));
    }

    private spawnMover ()
    {
        if (this.phase !== 'play' || this.mover)
        {
            return;
        }

        this.prepareCheckpoint();
        const fromLeft = Math.random() < 0.5;
        const support = this.support;
        const block = this.createBlock(MOVER_ART, true);
        const half = (block.art.right - block.art.left) * block.art.scaleX / 2;
        const viewLeft = this.cameras.main.scrollX;
        const viewRight = viewLeft + this.scale.width;
        const spawnX = fromLeft ? viewLeft - half - 24 : viewRight + half + 24;

        this.placeBlock(block, spawnX, this.stackBottom(support));
        block.node.setDepth(this.stack.length + 1);
        block.vx = (fromLeft ? 1 : -1) * this.boardSpeed();
        this.mover = block;
        this.palletSign = fromLeft ? 1 : -1;
        this.pallet = this.add.image(0, 0, 'block-pallet');
        this.syncPallet();
    }

    /** A centred support can earn the next perfect bonus; otherwise the next land is 1m. */
    private prepareCheckpoint ()
    {
        const possibleGain = this.isCentered(this.support)
            ? Math.min(PERFECT_METERS_MAX, this.perfectStreak + NORMAL_METERS + 1)
            : NORMAL_METERS;

        this.checkpoints.prepare(
            this.meters(), possibleGain, this.anchorX, this.top(this.body(this.support)),
            PLAYER_H, BOX_VISUAL_H * this.jumpBoxes
        );
    }

    /** Keeps the board under the moving box, trailing back toward the side it came from. */
    private syncPallet ()
    {
        const block = this.mover;
        const pallet = this.pallet;

        if (!block || !pallet)
        {
            return;
        }

        const { node, art } = block;
        const frame = node.frame;
        const originX = node.x - frame.width * art.scaleX / 2;
        const originY = node.y - frame.height * art.scaleY / 2;
        const visualLeft = originX + BOX_VISUAL_LEFT * art.scaleX;
        const visualRight = originX + BOX_VISUAL_RIGHT * art.scaleX;
        const visualBottom = originY + BOX_VISUAL_BOTTOM * art.scaleY;
        const lead = (this.palletSign > 0 ? PALLET_RIGHT : PALLET_LEFT) - PALLET_FRAME_W / 2;
        const topLead = PALLET_TOP - PALLET_FRAME_H / 2;

        pallet.setScale(PALLET_SCALE);
        pallet.setPosition(
            (this.palletSign > 0 ? visualRight : visualLeft) - lead * PALLET_SCALE,
            visualBottom - topLead * PALLET_SCALE
        );
        pallet.setDepth(node.depth - 0.1);
    }

    /** After the box is set down, the board disappears. */
    private releasePallet ()
    {
        this.pallet?.destroy();
        this.pallet = null;
    }

    /** Where the bottom of the next box sits. On another box, that is partway down the lid. */
    private stackBottom (support: Block)
    {
        const surface = this.top(this.body(support));

        if (support.art.key !== MOVER_ART.key)
        {
            return surface;
        }

        return surface + (MOVER_LID_BOTTOM_PX - support.art.surface) * support.art.scaleY;
    }

    /** World pixels per second. The debug panel can change it during a round. */
    private boardSpeed ()
    {
        return this.boardPx;
    }

    /** Keep a box that is already sliding on the speed chosen in the debug panel. */
    private applyBoardSpeed ()
    {
        const speed = this.boardSpeed();

        if (this.mover?.moving && this.mover.vx !== 0)
        {
            this.mover.vx = Math.sign(this.mover.vx) * speed;
        }
    }

    /** Rise and fall use separate gravity so the debug panel can tune them apart. */
    private gravity (rising: boolean)
    {
        const speed = rising ? this.risePx : this.fallPx;

        return (2 * speed * speed) / (BOX_VISUAL_H * this.jumpBoxes);
    }

    /** Height, rise speed, fall speed and box speed for the current round. */
    private addTuneControls ()
    {
        const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

        this.debugPanel.addStepper(
            () => `高度 ${this.jumpBoxes.toFixed(2)}盒`,
            (direction) =>
            {
                this.jumpBoxes = clamp(Math.round((this.jumpBoxes + direction * 0.05) * 100) / 100, 0.4, 3);
            }
        );
        this.debugPanel.addStepper(
            () => `上升 ${Math.round(this.risePx)}/秒`,
            (direction) =>
            {
                this.risePx = clamp(this.risePx + direction * 40, 80, 2000);
            }
        );
        this.debugPanel.addStepper(
            () => `落下 ${Math.round(this.fallPx)}/秒`,
            (direction) =>
            {
                this.fallPx = clamp(this.fallPx + direction * 40, 80, 2000);
            }
        );
        this.debugPanel.addStepper(
            () => `盒子 ${Math.round(this.boardSpeed())}/秒`,
            (direction) =>
            {
                this.boardPx = clamp(this.boardSpeed() + direction * 40, 40, 1600);
                this.applyBoardSpeed();
            }
        );
    }

    private passed (block: Block)
    {
        const body = this.body(block);
        const viewLeft = this.cameras.main.scrollX;
        const viewRight = viewLeft + this.scale.width;

        if (block.vx > 0)
        {
            return this.left(body) > viewRight + 80;
        }

        return this.right(body) < viewLeft - 80;
    }

    private createBlock (art: BlockArt, moving: boolean): Block
    {
        const node = this.add.image(0, 0, art.key).setScale(art.scaleX, art.scaleY).setDepth(1);

        return { node, art, vx: 0, vy: 0, moving };
    }

    /** Moves the block so its collision area is centred on `x` with its bottom at `bottom`. */
    private placeBlock (block: Block, x: number, bottom: number)
    {
        const { node, art } = block;
        const frame = node.frame;

        node.setPosition(
            x - ((art.left + art.right) / 2 - frame.width / 2) * art.scaleX,
            bottom - (art.bottom - frame.height / 2) * art.scaleY
        );
    }

    private body (block: Block): Box
    {
        const { node, art } = block;
        const frame = node.frame;
        const originX = node.x - frame.width * art.scaleX / 2;
        const originY = node.y - frame.height * art.scaleY / 2;
        const left = originX + art.left * art.scaleX;
        const right = originX + art.right * art.scaleX;
        const top = originY + art.surface * art.scaleY;
        const bottom = originY + art.bottom * art.scaleY;

        return {
            x: (left + right) / 2,
            y: (top + bottom) / 2,
            displayWidth: right - left,
            displayHeight: bottom - top
        };
    }

    private followCamera (snap: boolean)
    {
        const camera = this.cameras.main;
        const height = this.scale.height;

        camera.scrollX = this.anchorX - this.scale.width / 2;

        if (snap)
        {
            this.cameraLocked = true;
            const strip = (BASE_DIRT_BOTTOM_PX - BASE_SURFACE_PX) * this.stack[0].art.scaleY;
            const centerScreen = height - strip - PLAYER_H / 2;

            this.lockedScrollY = this.player.node.y - centerScreen;
            camera.scrollY = this.lockedScrollY;
            return;
        }

        if (this.cameraLocked)
        {
            camera.scrollY = this.lockedScrollY;

            if (!this.grounded)
            {
                return;
            }

            const screenY = this.player.node.y - this.lockedScrollY;

            if (screenY > height * CAMERA_FOLLOW_SCREEN_Y)
            {
                return;
            }

            this.cameraLocked = false;
            this.cameraFocusY = this.player.node.y - height * CAMERA_FOLLOW_SCREEN_Y;
        }
        else if (this.grounded)
        {
            this.cameraFocusY = this.player.node.y - height * CAMERA_FOLLOW_SCREEN_Y;
        }

        camera.scrollY += (this.cameraFocusY - camera.scrollY) * 0.18;
    }

    private layoutGround (width: number, height: number)
    {
        if (this.stack.length !== 1 || !this.grounded)
        {
            return;
        }

        const base = this.stack[0];
        const art = base.art;
        const strip = BASE_DIRT_BOTTOM_PX - BASE_SURFACE_PX;
        const scale = Math.max(width / BASE_FRAME_W, (height * BASE_SCREEN_FRACTION) / strip);

        art.scaleX = scale;
        art.scaleY = scale;
        art.left = 16;
        art.right = BASE_FRAME_W - 16;
        art.bottom = art.surface + 48 / scale;
        base.node.setScale(scale);
        this.placeBlock(base, width / 2, BASE_SURFACE_Y + (art.bottom - art.surface) * scale);
        this.player.node.x = width / 2;
        this.groundOn(base);
        this.syncPlayerSprite();
        this.anchorX = this.body(base).x;
    }

    private layout ()
    {
        const width = this.scale.width;
        const height = this.scale.height;

        coverImage(this.background, width, height);
        this.layoutGround(width, height);
        this.hint.setPosition(width / 2, Math.max(48, height * 0.08));
        this.overText?.setPosition(width / 2, height * 0.42);
        this.heightText.setPosition(width / 2, height * HEIGHT_TEXT_Y - BOX_VISUAL_H);
        this.debugPanel.layout(width, height);
        this.pauseButton.layout(width, height);
        this.resumeDigit?.setPosition(width / 2, height / 2);
        this.checkpoints.layout();
    }

    private updateHeight ()
    {
        this.heightText.setValue(this.meters());
    }

    private meters ()
    {
        return this.heightMeters;
    }

    /** Ordinary land is 1m. Each perfect in a row adds one more metre than the last, from 2 up to 5. */
    private scoreLand (perfect: boolean)
    {
        if (!perfect)
        {
            this.perfectStreak = 0;
            this.heightMeters += NORMAL_METERS;
            return;
        }

        this.perfectStreak++;
        this.heightMeters += Math.min(PERFECT_METERS_MAX, this.perfectStreak + NORMAL_METERS);
    }

    private showOver ()
    {
        if (this.overText)
        {
            return;
        }

        const meters = this.meters();

        this.overText = this.add.text(this.scale.width / 2, this.scale.height * 0.42, `掉下来啦\n本次高度 ${meters}m\n点一下再冲`, {
            fontFamily: 'Arial',
            fontSize: 48,
            color: '#ffffff',
            stroke: '#8e2c45',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_UI);
    }

    private intersects (a: Box, b: Box)
    {
        return this.xOverlap(a, b) > 0 && Math.abs(a.y - b.y) * 2 < a.displayHeight + b.displayHeight;
    }

    private xOverlap (a: Box, b: Box)
    {
        const left = Math.max(this.left(a), this.left(b));
        const right = Math.min(this.right(a), this.right(b));

        return Math.max(0, right - left);
    }

    private left (node: Box)
    {
        return node.x - node.displayWidth / 2;
    }

    private right (node: Box)
    {
        return node.x + node.displayWidth / 2;
    }

    private top (node: Box)
    {
        return node.y - node.displayHeight / 2;
    }

    private bottom (node: Box)
    {
        return node.y + node.displayHeight / 2;
    }
}
