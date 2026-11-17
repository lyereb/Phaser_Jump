from pathlib import Path
root=Path(r'D:\Repo\Phaser_Jump')
p=root/'src/game/checkpoints.ts'
s=p.read_text(encoding='utf-8')
s=s.replace('    meters: number;\n};', '    meters: number;\n    viewportKey: string;\n};',1)
s=s.replace('const gate = { root, rope, bag, image, meters };', "const gate = { root, rope, bag, image, meters, viewportKey: '' };",1)
s=s.replace('        const camera = this.scene.cameras.main;\n        const left', '''        const camera = this.scene.cameras.main;
        const viewportKey = `${camera.scrollX}:${this.scene.scale.width}:${gate.root.x}`;
        if (gate.viewportKey === viewportKey)
        {
            return;
        }
        gate.viewportKey = viewportKey;
        const left''',1)
p.write_text(s,encoding='utf-8')
p=root/'src/game/scenes/Game.ts'
s=p.read_text(encoding='utf-8')
s=s.replace('            this.followCamera(false);\n        }\n    }', '            this.followCamera(false);\n            this.checkpoints.layout();\n        }\n    }',1)
p.write_text(s,encoding='utf-8')
