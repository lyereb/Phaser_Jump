from pathlib import Path
root=Path(r'D:\Repo\Phaser_Jump')
p=root/'.work/checkpoint/scripts/test_progress.cjs'
s=p.read_text(encoding='utf-8').replace("../../../..//node_modules/typescript", "../../../node_modules/typescript").replace("../../../../src/game/checkpointProgress.ts", "../../../src/game/checkpointProgress.ts")
p.write_text(s,encoding='utf-8')
p=root/'src/game/checkpoints.ts'
s=p.read_text(encoding='utf-8')
old='    /** Visual-only debug preview: does not alter score, next milestone or player state. */'
new='''    /** Countdown resumes the global tween manager for its digits, not these world effects. */
    setPaused (paused: boolean)
    {
        for (const object of this.effects)
        {
            const targets = object instanceof GameObjects.Container ? [ object, ...object.list ] : [ object ];
            for (const tween of this.scene.tweens.getTweensOf(targets))
            {
                if (paused) tween.pause();
                else tween.resume();
            }
        }
    }

    /** Visual-only debug preview: does not alter score, next milestone or player state. */'''
assert s.count(old)==1
s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
p=root/'src/game/scenes/Game.ts'
s=p.read_text(encoding='utf-8')
s=s.replace('        this.tweens.pauseAll();\n        this.anims.pauseAll();', '        this.tweens.pauseAll();\n        this.checkpoints.setPaused(true);\n        this.anims.pauseAll();',1)
s=s.replace('        this.tweens.resumeAll();\n        this.anims.resumeAll();', '        this.tweens.resumeAll();\n        this.checkpoints.setPaused(false);\n        this.anims.resumeAll();',1)
s=s.replace('        this.clearResumeCountdown();\n        this.tweens.resumeAll();\n\n        let index', '        this.clearResumeCountdown();\n        this.tweens.resumeAll();\n        this.checkpoints.setPaused(true);\n\n        let index',1)
s=s.replace('        this.hint.setVisible(false);\n        this.checkpoints.beginJump();', '        this.hint.setVisible(false);\n        this.prepareCheckpoint();\n        this.checkpoints.beginJump();',1)
p.write_text(s,encoding='utf-8')
