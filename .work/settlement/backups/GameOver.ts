import { Scene } from 'phaser';
import { bindResize, coverImage } from '../layout';

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameover_text : Phaser.GameObjects.Text;

    constructor ()
    {
        super('GameOver');
    }

    create ()
    {
        this.camera = this.cameras.main
        this.camera.setBackgroundColor(0xff0000);

        this.background = this.add.image(0, 0, 'background');
        this.background.setAlpha(0.5);

        this.gameover_text = this.add.text(0, 0, 'Game Over', {
            fontFamily: 'Arial Black', fontSize: 72, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        });
        this.gameover_text.setOrigin(0.5);

        this.layout();
        bindResize(this, () => this.layout());

        this.input.once('pointerdown', () =>
        {
            this.scene.start('MainMenu');
        });
    }

    private layout ()
    {
        const width = this.scale.width;
        const height = this.scale.height;

        coverImage(this.background, width, height);
        this.gameover_text.setWordWrapWidth(width * 0.84);
        this.gameover_text.setPosition(width / 2, height / 2);
    }
}
