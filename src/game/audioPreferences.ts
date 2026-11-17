export const SOUND_STORAGE_KEY = 'phaser-jump-sound-enabled';
let enabled: boolean | undefined;

/** One preference shared by all scenes; invalid or unavailable storage defaults to sound on. */
export function isSoundEnabled (): boolean
{
    if (enabled !== undefined) return enabled;
    try { enabled = localStorage.getItem(SOUND_STORAGE_KEY) !== '0'; }
    catch { enabled = true; }
    return enabled;
}

export function setSoundEnabled (value: boolean)
{
    enabled = value;
    try { localStorage.setItem(SOUND_STORAGE_KEY, value ? '1' : '0'); }
    catch { /* Keep this session usable when browser storage is unavailable. */ }
}
