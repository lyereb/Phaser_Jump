import { GameObjects, Scene } from 'phaser';

export const COIN_STORAGE_KEY = 'phaser-jump-coins';

/** Coins persist between runs; storage failures never interrupt gameplay. */
export class CoinWallet
{
    private static sessions = new Map<string, { value: number; dirty: boolean }>();
    private balance: { value: number; dirty: boolean };

    constructor (private key = COIN_STORAGE_KEY)
    {
        this.balance = CoinWallet.sessions.get(key) ?? { value: 0, dirty: false };
        CoinWallet.sessions.set(key, this.balance);
        if (this.balance.dirty) return;
        try
        {
            const saved = localStorage.getItem(key);
            if (saved === null) return;
            const value = Number(saved);
            this.balance.value = Number.isSafeInteger(value) && value > 0 ? value : 0;
        }
        catch { /* Restricted in-app storage: keep a usable in-memory balance. */ }
    }

    get total ()
    {
        return this.balance.value;
    }

    add (amount: number)
    {
        if (!Number.isFinite(amount) || amount <= 0) return this.total;
        this.balance.value = Math.min(Number.MAX_SAFE_INTEGER, this.balance.value + Math.floor(amount));
        this.save();
        return this.total;
    }

    /** Local earned coins only. Never permit overdrafts, fractions or invalid amounts. */
    spend (amount: number): boolean
    {
        if (!Number.isSafeInteger(amount) || amount <= 0 || amount > this.total) return false;
        this.balance.value -= amount;
        this.save();
        return true;
    }

    private save ()
    {
        try
        {
            localStorage.setItem(this.key, String(this.balance.value));
            this.balance.dirty = false;
        }
        catch { this.balance.dirty = true; /* Preserve the shared session if storage fails. */ }
    }
}

export class CoinHud
{
    private root: GameObjects.Container;
    private label: GameObjects.Text;
    private icon: GameObjects.Container;
    private value = 0;

    constructor (scene: Scene, depth: number, parent?: GameObjects.Container)
    {
        this.root = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
        parent?.add(this.root);
        this.icon = scene.add.container(25, 32);
        const coin = scene.add.circle(0, 0, 24, 0xffcf35).setStrokeStyle(3, 0x925326);
        const rim = scene.add.circle(0, 0, 17).setStrokeStyle(2, 0xfff39a);
        const symbol = scene.add.text(0, 0, '$', { fontFamily: 'Arial', fontSize: 29, fontStyle: 'bold', color: '#a36b24' }).setOrigin(0.5);
        this.icon.add([ coin, rim, symbol ]);
        const title = scene.add.text(59, 0, '金币', { fontFamily: '"Microsoft YaHei", Arial, sans-serif', fontSize: 20, color: '#fff4d0', stroke: '#70452e', strokeThickness: 4 });
        this.label = scene.add.text(59, 23, '0', { fontFamily: 'Arial', fontSize: 35, fontStyle: 'bold', color: '#ffe35f', stroke: '#70452e', strokeThickness: 4 });
        this.root.add([ this.icon, title, this.label ]);
    }

    setValue (value: number)
    {
        const gained = value > this.value;
        this.value = value;
        this.label.setText(String(value)).setScale(1);
        if (this.label.width > 155) this.label.setScale(155 / this.label.width);
        if (gained)
        {
            this.pulse();
        }
    }

    /** Screen position of the coin icon, including the counter's scale. */
    iconCenter ()
    {
        return {
            x: this.root.x + this.icon.x * this.root.scaleX,
            y: this.root.y + this.icon.y * this.root.scaleY
        };
    }

    pulse ()
    {
        const scene = this.root.scene;

        scene.tweens.killTweensOf(this.icon);
        this.icon.setScale(1);
        scene.tweens.add({ targets: this.icon, scaleX: 1.28, scaleY: 1.28, duration: 90, yoyo: true, ease: 'Back.Out' });
    }

    layout (_width: number, _height: number)
    {
        this.root.setPosition(16, 16);
    }

    placeWithin (x: number, y: number)
    {
        this.root.setPosition(x, y);
    }

    setScale (scale: number)
    {
        this.root.setScale(scale);
    }
}
