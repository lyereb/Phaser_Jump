import { Scene } from 'phaser';
import { bindResize, coverImage } from '../layout';
import { loadAudioAssets } from '../audio';
import { createMenuFrames, loadMenuAssets } from '../menu';
import { createPlayerAnimations, loadPlayerAssets } from '../player';
import { createLetterFrames, loadLetterAssets } from '../letters';
import { createStarFrames, loadStarAssets } from '../stars';
import { createCheckpointFrames, loadCheckpointAssets } from '../checkpoints';
import { BOX_SKINS } from '../boxSkins';
import { loadAltitudeBackgroundAssets } from '../altitudeBackground';

export class Preloader extends Scene
{
    private background: Phaser.GameObjects.Image;
    private barOutline: Phaser.GameObjects.Rectangle;
    private bar: Phaser.GameObjects.Rectangle;
    private progress = 0;

    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        this.background = this.add.image(0, 0, 'background');
        this.barOutline = this.add.rectangle(0, 0, 4, 32).setStrokeStyle(1, 0xffffff);
        this.bar = this.add.rectangle(0, 0, 4, 28, 0xffffff).setOrigin(0, 0.5);

        this.layout();
        bindResize(this, () => this.layout());

        this.load.on('progress', (progress: number) =>
        {
            this.progress = progress;
            this.drawBar();
        });
    }

    preload ()
    {
        this.load.setPath('assets');

        this.load.image('block-base', 'Obj/base.png');
        this.load.image('block-mover', 'Obj/mover_normal.png');
        this.load.image('block-coin', 'Special/coin_box.png');
        this.load.image('block-shield', 'Special/shield_box.png');
        this.load.image('block-spring', 'Special/spring_box.png');
        this.load.image('block-speed', 'Special/speed_box.png?v=red-v2');
        this.load.image('block-pallet', 'Obj/mover_pallet.png');
        for (const skin of BOX_SKINS)
        {
            this.load.image(skin.texture, `Skins/${skin.file}?v=shop-v1`);
        }
        loadLetterAssets(this);
        loadAudioAssets(this);
        loadStarAssets(this);
        loadPlayerAssets(this);
        loadMenuAssets(this);
        loadCheckpointAssets(this);
        loadAltitudeBackgroundAssets(this);
    }

    create ()
    {
        createPlayerAnimations(this);
        createLetterFrames(this);
        createStarFrames(this);
        createMenuFrames(this);
        createCheckpointFrames(this);

        this.scene.start('MainMenu');
    }

    private layout ()
    {
        coverImage(this.background, this.scale.width, this.scale.height);
        this.drawBar();
    }

    private drawBar ()
    {
        const width = this.scale.width;
        const height = this.scale.height;
        const barWidth = Math.round(width * 0.72);
        const innerWidth = barWidth - 8;
        const y = height / 2;

        this.barOutline.setPosition(width / 2, y);
        this.barOutline.setSize(barWidth, 32);

        this.bar.setPosition((width - barWidth) / 2 + 4, y);
        this.bar.width = Math.max(4, innerWidth * this.progress);
    }
}
