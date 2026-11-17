import { Scene } from 'phaser';

export type SfxKey =
    | 'jump' | 'land' | 'perfect' | 'fail'
    | 'checkpoint' | 'overtake'
    | 'coin' | 'shield' | 'shield-break' | 'speed' | 'spring'
    | 'ui' | 'deny' | 'confirm';

const BGM_KEY = 'bgm';
const BGM_VOLUME = 0.28;

const FILES: Record<SfxKey, string> = {
    jump: 'Audio/jump.wav',
    land: 'Audio/land.wav',
    perfect: 'Audio/perfect.wav',
    fail: 'Audio/fail.wav',
    checkpoint: 'Audio/checkpoint.wav',
    overtake: 'Audio/overtake.wav',
    coin: 'Audio/coin.wav',
    shield: 'Audio/shield.wav',
    'shield-break': 'Audio/shield-break.wav',
    speed: 'Audio/speed.wav',
    spring: 'Audio/spring.wav',
    ui: 'Audio/ui.wav',
    deny: 'Audio/deny.wav',
    confirm: 'Audio/confirm.wav'
};

const VOLUME: Record<SfxKey, number> = {
    jump: 0.5,
    land: 0.48,
    perfect: 0.46,
    fail: 0.5,
    checkpoint: 0.48,
    overtake: 0.46,
    coin: 0.5,
    shield: 0.42,
    'shield-break': 0.46,
    speed: 0.42,
    spring: 0.5,
    ui: 0.32,
    deny: 0.36,
    confirm: 0.38
};

export function loadAudioAssets (scene: Scene)
{
    (Object.keys(FILES) as SfxKey[]).forEach(key =>
    {
        scene.load.audio(`sfx-${key}`, FILES[key]);
    });

    scene.load.audio(BGM_KEY, 'Audio/bgm.mp3');
}

/** Unlock Web Audio on the first user gesture, then play a cue. Never throws. */
export function playSfx (scene: Scene, key: SfxKey)
{
    const play = () =>
    {
        scene.sound.play(`sfx-${key}`, { volume: VOLUME[key] });
    };

    try
    {
        if (!scene.sound.locked)
        {
            play();
            return;
        }

        scene.sound.once('unlocked', play);
        scene.sound.unlock();
    }
    catch
    {
        // In-app browsers such as WeChat can throw while unlocking audio.
    }
}

/** Looping gameplay music. Safe to call again after a scene restart. */
export function startBgm (scene: Scene)
{
    const play = () =>
    {
        const existing = scene.sound.get(BGM_KEY);

        if (existing)
        {
            if (existing.isPaused)
            {
                existing.resume();
            }
            else if (!existing.isPlaying)
            {
                existing.play({ volume: BGM_VOLUME, loop: true });
            }

            return;
        }

        scene.sound.add(BGM_KEY, { loop: true, volume: BGM_VOLUME }).play();
    };

    try
    {
        if (!scene.sound.locked)
        {
            play();
            return;
        }

        scene.sound.once('unlocked', play);
        scene.sound.unlock();
    }
    catch
    {
        // In-app browsers such as WeChat can throw while unlocking audio.
    }
}

export function stopBgm (scene: Scene)
{
    scene.sound.get(BGM_KEY)?.stop();
}

/** Remember whether this dialog actually paused the gameplay music. */
export function pauseBgm (scene: Scene): boolean
{
    const music = scene.sound.get(BGM_KEY);
    if (!music?.isPlaying) return false;
    music.pause();
    return true;
}

/** Continue the same track, without creating or restarting a sound. */
export function resumeBgm (scene: Scene)
{
    const music = scene.sound.get(BGM_KEY);
    if (music?.isPaused) music.resume();
}
