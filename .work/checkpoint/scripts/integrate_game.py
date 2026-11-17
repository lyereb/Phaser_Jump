from pathlib import Path
p = Path(r'D:\Repo\Phaser_Jump\src\game\scenes\Game.ts')
s = p.read_text(encoding='utf-8')
changes = [
("import { DebugPanel } from '../debugPanel';", "import { Checkpoints } from '../checkpoints';\nimport { DebugPanel } from '../debugPanel';"),
('    private scenery: Scenery;', '    private scenery: Scenery;\n    private checkpoints: Checkpoints;'),
('        this.scenery = new Scenery(this);', '        this.scenery = new Scenery(this);\n        this.checkpoints = new Checkpoints(this, DEPTH_PLAYER + 10);'),
('        this.layout();\n        this.followCamera(true);\n        this.spawnMover();', "        this.debugPanel.addButton('测试Checkpoint', () =>\n        {\n            this.checkpoints.preview(this.anchorX, this.cameras.main.scrollY + this.scale.height * 0.38);\n            this.time.delayedCall(0, () => this.debugPanel.close());\n        });\n        this.layout();\n        this.followCamera(true);\n        this.spawnMover();"),
("        if (this.phase === 'play')\n        {\n            this.resolve();", "        if (this.phase === 'play')\n        {\n            this.checkpoints.observeJump(this.player.node.x, this.top(this.player.node), !this.grounded && this.player.vy < 0, PLAYER_W);\n            this.resolve();"),
('        this.groundOn(block);\n        this.spawnMover();', '        this.groundOn(block);\n        this.checkpoints.land(this.meters());\n        this.spawnMover();'),
('            this.groundOn(this.support);\n        }\n    }', '            this.groundOn(this.support);\n            this.prepareCheckpoint();\n        }\n    }'),
("        playSfx(this, 'jump');\n        this.hint.setVisible(false);", "        playSfx(this, 'jump');\n        this.hint.setVisible(false);\n        this.checkpoints.beginJump();"),
('        const fromLeft = Math.random() < 0.5;\n        const support = this.support;', '        this.prepareCheckpoint();\n        const fromLeft = Math.random() < 0.5;\n        const support = this.support;'),
('    /** Keeps the board under the moving box, trailing back toward the side it came from. */', '''    /** A centred support can earn the next perfect bonus; otherwise the next land is 1m. */
    private prepareCheckpoint ()
    {
        const possibleGain = this.isCentered(this.support)
            ? Math.min(PERFECT_METERS_MAX, this.perfectStreak + NORMAL_METERS + 1)
            : NORMAL_METERS;

        this.checkpoints.prepare(
            this.meters(), possibleGain, this.anchorX, this.top(this.body(this.support)),
            PLAYER_H, BOX_VISUAL_H * this.jumpBoxes
        );
    }

    /** Keeps the board under the moving box, trailing back toward the side it came from. */'''),
('        this.resumeDigit?.setPosition(width / 2, height / 2);', '        this.resumeDigit?.setPosition(width / 2, height / 2);\n        this.checkpoints.layout();')
]
for old, new in changes:
    assert s.count(old) == 1, (old, s.count(old))
    s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('Applied',len(changes),'Game.ts changes')
