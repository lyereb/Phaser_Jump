import { Scene } from 'phaser';

export const PLAYER_IDLE_ANIM = 'player-idle';
export const PLAYER_JUMP_ANIM = 'player-jump';
export const PLAYER_HIT_ANIM = 'player-hit';

/** Source-pixel rows in the 192x256 frames: top of the head and the soles of the feet. */
export const PLAYER_ART_TOP = 26;
export const PLAYER_ART_FEET = 244;
export const PLAYER_ART_HEIGHT = 256;

const IDLE_FRAME_COUNT = 4;
const JUMP_FRAME_COUNT = 4;

export function loadPlayerAssets (scene: Scene)
{
    scene.load.image('player-hit-0', 'Entity/player_1_hit_0.png');

    for (let i = 0; i < IDLE_FRAME_COUNT; i++)
    {
        scene.load.image(`player-idle-${i}`, `Entity/player_1_idle_${i}.png`);
    }

    for (let i = 0; i < JUMP_FRAME_COUNT; i++)
    {
        scene.load.image(`player-jump-${i}`, `Entity/player_1_jump_${i}.png`);
    }
}

export function createPlayerAnimations (scene: Scene)
{
    if (scene.anims.exists(PLAYER_IDLE_ANIM))
    {
        scene.anims.remove(PLAYER_IDLE_ANIM);
    }

    const idleFrames: Phaser.Types.Animations.AnimationFrame[] = [];

    for (let i = 0; i < IDLE_FRAME_COUNT; i++)
    {
        idleFrames.push({ key: `player-idle-${i}` });
    }

    scene.anims.create({
        key: PLAYER_IDLE_ANIM,
        frames: idleFrames,
        frameRate: 6,
        repeat: -1
    });

    if (!scene.anims.exists(PLAYER_JUMP_ANIM))
    {
        const frames: Phaser.Types.Animations.AnimationFrame[] = [];

        for (let i = 0; i < JUMP_FRAME_COUNT; i++)
        {
            frames.push({ key: `player-jump-${i}` });
        }

        scene.anims.create({
            key: PLAYER_JUMP_ANIM,
            frames,
            frameRate: 6,
            repeat: 0
        });
    }

    if (!scene.anims.exists(PLAYER_HIT_ANIM))
    {
        scene.anims.create({
            key: PLAYER_HIT_ANIM,
            frames: [ { key: 'player-hit-0' } ],
            frameRate: 1,
            repeat: -1
        });
    }
}
