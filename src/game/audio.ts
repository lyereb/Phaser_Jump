import { Scene } from 'phaser';
import { isSoundEnabled, setSoundEnabled } from './audioPreferences';

export type SfxKey =
    | 'land' | 'perfect' | 'fail' | 'item'
    | 'checkpoint' | 'overtake'
    | 'coin' | 'shield' | 'shield-break' | 'speed' | 'spring'
    | 'ui' | 'deny' | 'confirm';

const BGM_KEY = 'bgm';
const BGM_VOLUME = 0.28;

const FILES: Record<SfxKey, string> = {
    land: 'Audio/land.wav',
    perfect: 'Audio/perfect.wav',
    fail: 'Audio/fail.mp3',
    item: 'Audio/item.mp3',
    checkpoint: 'Audio/checkpoint.wav',
    overtake: 'Audio/jackpot.mp3',
    coin: 'Audio/coin.wav',
    shield: 'Audio/shield.wav',
    'shield-break': 'Audio/shield-break.wav',
    speed: 'Audio/speed.wav',
    spring: 'Audio/spring.wav',
    ui: 'Audio/ui.mp3',
    deny: 'Audio/deny.wav',
    confirm: 'Audio/confirm.wav'
};

const VOLUME: Record<SfxKey, number> = {
    land: 0.5,
    perfect: 0.46,
    fail: 0.5,
    item: 0.5,
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

export function isAudioEnabled (): boolean { return isSoundEnabled(); }

/** Phaser shares one SoundManager across scenes. Mute never changes individual track volumes. */
export function applyAudioSettings (scene: Scene): boolean
{
    const enabled = isSoundEnabled();
    try { scene.sound.mute = !enabled; }
    catch { /* No-audio environments must still be able to display the settings UI. */ }
    return enabled;
}

export function setAudioEnabled (scene: Scene, enabled: boolean)
{
    setSoundEnabled(enabled);
    applyAudioSettings(scene);
}

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
    if (!applyAudioSettings(scene)) return;
    const play = () =>
    {
        // A queued unlock callback must respect a switch changed while it was waiting.
        if (!applyAudioSettings(scene)) return;
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
    applyAudioSettings(scene);
    const play = () =>
    {
        applyAudioSettings(scene);
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
    applyAudioSettings(scene);
    const music = scene.sound.get(BGM_KEY);
    if (music?.isPaused) music.resume();
}
