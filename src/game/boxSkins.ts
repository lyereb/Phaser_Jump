export const SKIN_PRICE = 500;
export const SKIN_STORAGE_KEY = 'phaser-jump-box-skins';
export const DEFAULT_BOX_TEXTURE = 'block-mover';

/** Cosmetic only: every texture uses the same tray silhouette and collision art. */
export const BOX_SKINS = [
    { id: 'sunny', name: '阳光配送', texture: 'skin-sunny', file: 'sunny.png', color: 0xffdf78, price: 500 },
    { id: 'ocean', name: '蓝海速递', texture: 'skin-ocean', file: 'ocean.png', color: 0x85c2ff, price: 500 },
    { id: 'chicken', name: '红白炸鸡', texture: 'skin-chicken', file: 'chicken.png', color: 0xff9c9a, price: 500 },
    { id: 'coffee', name: '森林咖啡', texture: 'skin-coffee', file: 'coffee.png', color: 0xb0dc8f, price: 1000 },
    { id: 'cake', name: '草莓蛋糕', texture: 'skin-cake', file: 'cake.png', color: 0xffb9d5, price: 2000 },
    { id: 'royal', name: '黑金礼盒', texture: 'skin-royal', file: 'royal.png', color: 0xc4c9cd, price: 5000 }
] as const;
export type BoxSkin = typeof BOX_SKINS[number];
export type SkinId = BoxSkin['id'];
type State = { unlocked: Set<SkinId>; selected: Set<SkinId>; dirty: boolean };
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type WalletLike = { readonly total: number; spend: (amount: number) => boolean };
export type UnlockResult = 'unlocked' | 'already-unlocked' | 'insufficient-coins' | 'unknown-skin';

function browserStorage (): StorageLike | undefined
{
    try { return typeof localStorage === 'undefined' ? undefined : localStorage; }
    catch { return undefined; }
}
function knownId (value: unknown): value is SkinId
{
    return typeof value === 'string' && BOX_SKINS.some(skin => skin.id === value);
}

/** Local cosmetic ownership. Session state is shared if browser persistence is blocked. */
export class BoxSkinCollection
{
    private static sessions = new Map<string, State>();
    private state: State;

    constructor (private key = SKIN_STORAGE_KEY, private storage = browserStorage())
    {
        this.state = BoxSkinCollection.sessions.get(key) ?? { unlocked: new Set(), selected: new Set(), dirty: false };
        BoxSkinCollection.sessions.set(key, this.state);
        if (this.state.dirty) return;
        try
        {
            const raw = storage?.getItem(key);
            if (!raw) return;
            const saved: unknown = JSON.parse(raw);
            if (!saved || typeof saved !== 'object') return;
            const data = saved as { version?: unknown; unlocked?: unknown; selected?: unknown };
            if (data.version !== 1 || !Array.isArray(data.unlocked) || !Array.isArray(data.selected)) return;
            const unlocked = new Set(data.unlocked.filter(knownId));
            const selected = new Set(data.selected.filter(knownId).filter(id => unlocked.has(id)));
            this.state.unlocked = unlocked;
            this.state.selected = selected;
        }
        catch { /* Invalid/blocked storage leaves the current session usable. */ }
    }

    isUnlocked (id: string): boolean { return knownId(id) && this.state.unlocked.has(id); }
    isSelected (id: string): boolean { return knownId(id) && this.state.selected.has(id); }

    unlock (id: string, wallet: WalletLike): UnlockResult
    {
        if (!knownId(id)) return 'unknown-skin';
        if (this.state.unlocked.has(id)) return 'already-unlocked';
        const price = BOX_SKINS.find(skin => skin.id === id)!.price;
        if (!wallet.spend(price)) return 'insufficient-coins';
        this.state.unlocked.add(id);
        this.state.selected.add(id);
        this.save();
        return 'unlocked';
    }

    /** Locked and unknown IDs can never be equipped or enter the pool. */
    toggle (id: string): boolean
    {
        if (!knownId(id) || !this.state.unlocked.has(id)) return false;
        if (this.state.selected.has(id)) this.state.selected.delete(id);
        else this.state.selected.add(id);
        this.save();
        return true;
    }

    pool (): string[]
    {
        return [ DEFAULT_BOX_TEXTURE, ...BOX_SKINS.filter(skin => this.isSelected(skin.id)).map(skin => skin.texture) ];
    }

    /** Call only after the ordinary-vs-special roll: skins do not draw from item probability. */
    rollTexture (random: () => number = Math.random): string
    {
        const pool = this.pool();
        return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
    }

    snapshot ()
    {
        return {
            unlocked: BOX_SKINS.filter(skin => this.isUnlocked(skin.id)).map(skin => skin.id),
            selected: BOX_SKINS.filter(skin => this.isSelected(skin.id)).map(skin => skin.id),
            pool: this.pool(), price: SKIN_PRICE
        };
    }

    private save ()
    {
        if (!this.storage) { this.state.dirty = true; return; }
        try
        {
            this.storage.setItem(this.key, JSON.stringify({ version: 1, ...this.snapshot() }));
            this.state.dirty = false;
        }
        catch { this.state.dirty = true; /* Unlock/equip remains available for this session. */ }
    }
}
