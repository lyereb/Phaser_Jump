from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
source = (ROOT / '.work/speed-box/test_speed.cjs').read_text(encoding='utf-8')
key = 'const dependencies = {'
assert key in source
stub = "\n    '../altitudeBackground': {AltitudeBackground: class {constructor(g) {this.root=g.add.image(0,0,'background');} layout() {} update() {} freeze() {} destroy() {this.root.destroy();}}},"
stub += "\n    '../difficulty': load('src/game/difficulty.ts'),"
source = source.replace(key, key + stub, 1)
(ROOT / '.work/altitude-background/test_speed_compat.cjs').write_text(source, encoding='utf-8')
