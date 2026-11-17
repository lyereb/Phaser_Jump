import { GameObjects, Scene } from 'phaser';

export const COIN_STORAGE_KEY = 'phaser-jump-coins';

/** Coins persist between runs; storage failures never interrupt gameplay. */
export class CoinWallet
{
    private balance = 0;

    constructor (private key = COIN_STORAGE_KEY)
    {
        try
        {
            const value = Number(localStorage.getItem(key));
            this.balance = Number.isSafeInteger(value) && value > 0 ? value : 0;
        }
        catch { /* Restricted in-app storage: keep a usable in-memory balance. */ }
    }

    get total ()
    {
        return this.balance;
    }

    add (amount: number)
    {
        this.balance = Math.min(Number.MAX_SAFE_INTEGER, this.balance + Math.max(0, Math.floor(amount)));
        try { localStorage.setItem(this.key, String(this.balance)); }
        catch { /* The visible counter still updates when persistence is unavailable. */ }
        return this.balance;
    }
}

export class CoinHud
{
    private root: GameObjects.Container;
    private label: GameObjects.Text;

    constructor (scene: Scene, depth: number)
    {
        this.root = scene.add.container(16, 16).setDepth(depth).setScrollFactor(0);
        const background = scene.add.graphics();
        background.fillStyle(0x17496d, 0.78).fillRoundedRect(0, 0, 248, 88, 18);
        background.lineStyle(2, 0xfff4c5, 0.9).strokeRoundedRect(0, 0, 248, 88, 18);
        const coin = scene.add.circle(42, 44, 27, 0xffd326).setStrokeStyle(3, 0x7d4d13);
        const rim = scene.add.circle(42, 44, 20).setStrokeStyle(2, 0xfff383);
        const symbol = scene.add.text(42, 44, '$', { fontFamily: 'Arial', fontSize: 35, fontStyle: 'bold', color: '#a86b13' }).setOrigin(0.5);
        const title = scene.add.text(80, 13, '金币', { fontFamily: 'Arial', fontSize: 20, color: '#fff4c5' });
        this.label = scene.add.text(80, 35, '0', { fontFamily: 'Arial', fontSize: 36, fontStyle: 'bold', color: '#ffe258', stroke: '#67482b', strokeThickness: 2 });
        this.root.add([ background, coin, rim, symbol, title, this.label ]);
    }

    setValue (value: number)
    {
        this.label.setText(String(value)).setScale(1);
        if (this.label.width > 151) this.label.setScale(151 / this.label.width);
    }

    layout (_width: number, _height: number)
    {
        this.root.setPosition(16, 16);
    }
}
