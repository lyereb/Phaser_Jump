from pathlib import Path
root=Path(r'D:\Repo\Phaser_Jump')
p=root/'src/game/scenes/Game.ts'
s=p.read_text(encoding='utf-8')
changes=[
("import { DebugPanel } from '../debugPanel';", "import { DebugPanel } from '../debugPanel';\nimport { CoinHud, CoinWallet } from '../coinHud';\nimport { ItemEffects } from '../itemEffects';\nimport { rollCoinReward, rollItemKind, ShieldCharge, SPRING_STACK_COUNT, type ItemKind } from '../itemRules';\nimport { springDeliveryProgress, springTrajectory, SPRING_HEIGHT_BOXES } from '../springFlight';"),
('const MOVER_LID_BOTTOM_PX = 50;', "const MOVER_LID_BOTTOM_PX = 50;\nconst ITEM_ART: Record<ItemKind, BlockArt> = {\n    normal: MOVER_ART,\n    coin: { ...MOVER_ART, key: 'block-coin' },\n    shield: { ...MOVER_ART, key: 'block-shield' },\n    spring: { ...MOVER_ART, key: 'block-spring' }\n};"),
('    moving: boolean;\n};', '''    moving: boolean;
    item: ItemKind;
    itemConsumed: boolean;
};

type SpringDelivery = {
    block: Block;
    targetX: number;
    targetY: number;
    startX: number;
    startY: number;
};

type SpringFlight = {
    elapsed: number;
    launchSurface: number;
    landingSurface: number;
    columnX: number;
    deliveries: SpringDelivery[];
};'''),
('    private checkpoints: Checkpoints;', '''    private checkpoints: Checkpoints;
    private wallet: CoinWallet;
    private coinHud: CoinHud;
    private itemEffects: ItemEffects;
    private shieldCharge = new ShieldCharge();
    private springFlight: SpringFlight | null = null;
    private forcedItem: ItemKind | null = null;
    private springFlightsCompleted = 0;'''),
('        this.perfectStreak = 0;\n\n        this.cameras', '''        this.perfectStreak = 0;
        this.shieldCharge.reset();
        this.springFlight = null;
        this.forcedItem = null;
        this.springFlightsCompleted = 0;

        this.cameras'''),
('        this.checkpoints = new Checkpoints(this, DEPTH_PLAYER + 10);', '''        this.checkpoints = new Checkpoints(this, DEPTH_PLAYER + 10);
        this.wallet ??= new CoinWallet(import.meta.env.DEV ? this.registry.get('coinStorageKey') : undefined);
        this.coinHud = new CoinHud(this, DEPTH_UI);
        this.coinHud.setValue(this.wallet.total);
        this.itemEffects = new ItemEffects(this, DEPTH_PLAYER + 6, PLAYER_W, PLAYER_H);'''),
('        this.layout();\n        this.followCamera(true);\n        this.spawnMover();', '''        for (const [ kind, label ] of [ [ 'coin', '生成金币盒' ], [ 'shield', '生成护盾盒' ], [ 'spring', '生成弹簧盒' ] ] as const)
        {
            this.debugPanel.addButton(label, () =>
            {
                this.forceItem(kind);
                this.time.delayedCall(0, () => this.debugPanel.close());
            });
        }
        this.layout();
        this.followCamera(true);
        this.spawnMover();'''),
('        this.checkpoints.setPaused(true);\n        this.anims.pauseAll();', '        this.checkpoints.setPaused(true);\n        this.itemEffects.setPaused(true);\n        this.anims.pauseAll();'),
('        this.checkpoints.setPaused(false);\n        this.anims.resumeAll();', '        this.checkpoints.setPaused(false);\n        this.itemEffects.setPaused(false);\n        this.anims.resumeAll();'),
('        this.checkpoints.setPaused(true);\n\n        let index', '        this.checkpoints.setPaused(true);\n        this.itemEffects.setPaused(true);\n\n        let index'),
('    private simulate (dt: number)\n    {\n        const player', '''    private simulate (dt: number)
    {
        if (this.springFlight && this.phase === 'play')
        {
            this.simulateSpring(dt);
            return;
        }
        const player'''),
('                this.fly(mover.vx);\n                return;', '''                if (this.shieldCharge.consume())
                {
                    this.deflectWithShield(mover);
                }
                else
                {
                    this.fly(mover.vx);
                }
                return;'''),
('        this.checkpoints.land(this.meters());\n        this.spawnMover();', '''        this.checkpoints.land(this.meters());
        this.activateItem(block, perfect);
        this.spawnMover();'''),
('        if (block.art.key !== MOVER_ART.key)\n        {\n            return true;', '        if (block.art.key === BASE_ART.key)\n        {\n            return true;'),
('        sprite.setPosition(node.x, this.bottom(node));', '''        sprite.setPosition(node.x, this.bottom(node));
        this.itemEffects?.update(node.x, node.y, this.shieldCharge.active);'''),
("        if (this.phase !== 'play' || this.mover)\n", "        if (this.phase !== 'play' || this.mover || this.springFlight)\n"),
('        const block = this.createBlock(MOVER_ART, true);', '''        const kind = this.forcedItem ?? rollItemKind();
        this.forcedItem = null;
        const block = this.createBlock(ITEM_ART[kind], true, kind);'''),
('        if (support.art.key !== MOVER_ART.key)\n        {\n            return surface;', '        if (support.art.key === BASE_ART.key)\n        {\n            return surface;'),
('    private createBlock (art: BlockArt, moving: boolean): Block', "    private createBlock (art: BlockArt, moving: boolean, item: ItemKind = 'normal'): Block"),
('        return { node, art, vx: 0, vy: 0, moving };', '        return { node, art, vx: 0, vy: 0, moving, item, itemConsumed: false };'),
('        if (this.cameraLocked)\n        {\n            camera.scrollY = this.lockedScrollY;', '''        if (this.springFlight)
        {
            this.cameraLocked = false;
            this.cameraFocusY = Math.min(this.cameraFocusY, this.player.node.y - height * CAMERA_FOLLOW_SCREEN_Y);
            camera.scrollY += (this.cameraFocusY - camera.scrollY) * 0.18;
            return;
        }

        if (this.cameraLocked)
        {
            camera.scrollY = this.lockedScrollY;'''),
('        this.pauseButton.layout(width, height);', '        this.pauseButton.layout(width, height);\n        this.coinHud.layout(width, height);')
]
for old,new in changes:
    assert s.count(old)==1,(old,s.count(old))
    s=s.replace(old,new,1)
marker='    /** Keeps the board under the moving box, trailing back toward the side it came from. */'
methods='''    /** Consume the item only when landing on a new box, never on the old support. */
    private activateItem (block: Block, perfect: boolean)
    {
        if (block.itemConsumed || block.item === 'normal') return;
        block.itemConsumed = true;
        const x = this.player.node.x;
        const y = this.top(this.body(block));

        if (block.item === 'coin')
        {
            const amount = rollCoinReward(perfect);
            this.coinHud.setValue(this.wallet.add(amount));
            this.itemEffects.coins(x, y - PLAYER_H, amount, perfect);
            playSfx(this, 'checkpoint');
        }
        else if (block.item === 'shield')
        {
            this.shieldCharge.grant();
            this.itemEffects.shieldGranted(x, this.player.node.y);
            playSfx(this, 'ui');
        }
        else
        {
            this.startSpringFlight(block);
        }
    }

    private deflectWithShield (block: Block)
    {
        const sign = block.vx < 0 ? -1 : 1;
        block.moving = false;
        this.mover = null;
        this.releasePallet();
        this.itemEffects.shieldBroken(this.player.node.x, this.player.node.y);
        playSfx(this, 'ui');
        this.tweens.add({
            targets: block.node,
            x: block.node.x - sign * 240,
            y: block.node.y + 90,
            angle: -sign * 35,
            alpha: 0,
            duration: 350,
            ease: 'Quad.Out',
            onComplete: () => block.node.destroy()
        });
        this.spawnMover();
    }

    /** Developer UI: force only the next incoming box, keeping actual landing gameplay. */
    private forceItem (kind: ItemKind)
    {
        if (this.springFlight || this.phase !== 'play') return;
        this.mover?.node.destroy();
        this.mover = null;
        this.releasePallet();
        this.forcedItem = kind;
        this.spawnMover();
    }

    private startSpringFlight (source: Block)
    {
        const columnX = this.body(source).x;
        const launchSurface = this.top(this.body(source));
        const deliveries: SpringDelivery[] = [];
        let previous = source;

        // Measure all exact final positions before putting their drawings off-screen.
        for (let i = 0; i < SPRING_STACK_COUNT; i++)
        {
            const block = this.createBlock(MOVER_ART, false, 'normal');
            block.itemConsumed = true;
            block.node.setDepth(this.stack.length + i + 1);
            this.placeBlock(block, columnX, this.stackBottom(previous));
            const sign = i % 2 === 0 ? -1 : 1;
            deliveries.push({
                block, targetX: block.node.x, targetY: block.node.y,
                startX: columnX + sign * (this.scale.width / 2 + 160),
                startY: block.node.y + 100
            });
            previous = block;
        }
        const landingSurface = this.top(this.body(previous));
        for (const delivery of deliveries)
        {
            delivery.block.node.setPosition(delivery.startX, delivery.startY).setVisible(false);
        }

        this.springFlight = { elapsed: 0, columnX, launchSurface, landingSurface, deliveries };
        this.anchorX = columnX;
        this.player.node.x = columnX;
        this.grounded = false;
        this.player.vx = 0;
        this.player.vy = springTrajectory(0, launchSurface, landingSurface, BOX_VISUAL_H).vy;
        this.player.sprite.play(PLAYER_JUMP_ANIM);
        this.cameraLocked = false;
        this.cameraFocusY = this.cameras.main.scrollY;
        this.itemEffects.spring(columnX, launchSurface - PLAYER_H);
        playSfx(this, 'jump');

        let streak = this.perfectStreak;
        let bonus = 0;
        for (let i = 0; i < SPRING_STACK_COUNT; i++) bonus += Math.min(PERFECT_METERS_MAX, ++streak + NORMAL_METERS);
        this.checkpoints.prepareLeap(this.meters(), bonus, columnX, launchSurface, PLAYER_H, BOX_VISUAL_H * SPRING_HEIGHT_BOXES);
        this.checkpoints.beginJump();
    }

    private simulateSpring (dt: number)
    {
        const flight = this.springFlight!;
        flight.elapsed += dt;
        const trajectory = springTrajectory(flight.elapsed, flight.launchSurface, flight.landingSurface, BOX_VISUAL_H);
        this.player.node.setPosition(flight.columnX, trajectory.feetY - PLAYER_H / 2);
        this.player.vy = trajectory.vy;
        this.player.vx = 0;

        flight.deliveries.forEach((delivery, index) =>
        {
            const progress = springDeliveryProgress(flight.elapsed, index);
            delivery.block.node.setVisible(progress > 0).setPosition(
                delivery.startX + (delivery.targetX - delivery.startX) * progress,
                delivery.startY + (delivery.targetY - delivery.startY) * progress
            ).setAngle((index % 2 === 0 ? -12 : 12) * (1 - progress));
        });
        this.checkpoints.observeJump(flight.columnX, this.top(this.player.node), trajectory.rising, PLAYER_W);
        if (!trajectory.landed) return;

        for (const delivery of flight.deliveries)
        {
            delivery.block.node.setPosition(delivery.targetX, delivery.targetY).setVisible(true).setAngle(0);
            this.stack.push(delivery.block);
            this.scoreLand(true);
        }
        const top = flight.deliveries[flight.deliveries.length - 1].block;
        this.springFlight = null;
        this.springFlightsCompleted++;
        this.groundOn(top);
        this.updateHeight();
        this.scenery.sync(this.meters(), flight.landingSurface, flight.columnX);
        this.squash(top);
        this.celebrate(top);
        this.flashPerfect(top);
        this.checkpoints.land(this.meters());
        this.spawnMover();
    }

'''
assert s.count(marker)==1
s=s.replace(marker,methods+marker,1)
p.write_text(s,encoding='utf-8')
p=root/'src/game/pauseButton.ts'
s=p.read_text(encoding='utf-8').replace('Top-left pause / resume toggle','Top-right pause / resume toggle').replace('layout (_width: number, _height: number)','layout (width: number, _height: number)').replace('this.button.setPosition(MARGIN + SIZE / 2, MARGIN + SIZE / 2);','this.button.setPosition(width - MARGIN - SIZE / 2, MARGIN + SIZE / 2);')
p.write_text(s,encoding='utf-8')
p=root/'src/game/debugPanel.ts'
s=p.read_text(encoding='utf-8').replace('const PANEL_H = 480;','const PANEL_H = 620;').replace('const buttonY = MARGIN + BUTTON_H / 2;','const buttonY = MARGIN + 88 + GAP + BUTTON_H / 2;')
s=s.replace('const panelH = Math.min(PANEL_H, Math.max(120, height - buttonY - BUTTON_H / 2 - GAP - MARGIN));','const desiredH = 68 + (this.rows.length + this.steppers.length) * (ROW_H + GAP);\n        const panelH = Math.min(PANEL_H, desiredH, Math.max(120, height - buttonY - BUTTON_H / 2 - GAP - MARGIN));')
p.write_text(s,encoding='utf-8')
p=root/'src/game/scenes/Preloader.ts'
s=p.read_text(encoding='utf-8').replace("        this.load.image('block-mover', 'Obj/mover_normal.png');", "        this.load.image('block-mover', 'Obj/mover_normal.png');\n        this.load.image('block-coin', 'Special/coin_box.png');\n        this.load.image('block-shield', 'Special/shield_box.png');\n        this.load.image('block-spring', 'Special/spring_box.png');")
p.write_text(s,encoding='utf-8')
