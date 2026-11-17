import { Scene } from 'phaser';

export type SfxKey = 'jump' | 'land' | 'fail' | 'ui';

const BGM_KEY = 'bgm';
const BGM_VOLUME = 0.28;

const FILES: Record<SfxKey, string> = {
    jump: 'Audio/jump.mp3',
    land: 'Audio/land.mp3',
    fail: 'Audio/fail.mp3',
    ui: 'Audio/ui.mp3'
};

const VOLUME: Record<SfxKey, number> = {
    jump: 0.55,
    land: 0.5,
    fail: 0.55,
    ui: 0.4
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

export function pauseBgm (scene: Scene)
{
    const bgm = scene.sound.get(BGM_KEY);

    if (bgm?.isPlaying)
    {
        bgm.pause();
    }
}

export function resumeBgm (scene: Scene)
{
    const bgm = scene.sound.get(BGM_KEY);

    if (bgm?.isPaused)
    {
        bgm.resume();
    }
}
