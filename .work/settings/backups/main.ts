import { Boot } from './scenes/Boot';
import { GameOver } from './scenes/GameOver';
import { Game as MainGame } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { ReturnConfirmation } from './scenes/ReturnConfirmation';
import { WeeklyRanking } from './scenes/WeeklyRanking';
import { SkinShop } from './scenes/SkinShop';
import { AUTO, Game, Scale } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { GAME_HEIGHT, GAME_WIDTH } from './layout';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#028af8',
    disableContextMenu: true,
    scale: {
        mode: Scale.EXPAND,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        MainGame,
        ReturnConfirmation,
        GameOver,
        WeeklyRanking,
        SkinShop
    ]
};

const StartGame = (parent: string) => {

    const game = new Game({ ...config, parent });

    window.visualViewport?.addEventListener('resize', () =>
    {
        game.scale.refresh();
    });

    return game;

}

export default StartGame;
