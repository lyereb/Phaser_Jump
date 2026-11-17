from pathlib import Path
p=Path(r'D:\Repo\Phaser_Jump\.work\checkpoint\validation.html')
s=p.read_text(encoding='utf-8')
s=s.replace("const game = StartGame('game-container');", "const game = StartGame('game-container');\ngame.registry.set('coinStorageKey', 'phaser-jump-coins-qa-checkpoint');")
s=s.replace('  g.placeBlock(g.mover,g.anchorX+1000,g.stackBottom(g.support));g.mover.vx=0;\n  g.heightMeters=', "  g.forceItem('normal');\n  g.placeBlock(g.mover,g.anchorX+1000,g.stackBottom(g.support));g.mover.vx=0;\n  g.heightMeters=",1)
s=s.replace('function jump(g) {', "function jump(g) {\n  g.forcedItem='normal';",1)
p.write_text(s,encoding='utf-8')
