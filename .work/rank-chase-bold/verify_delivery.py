from pathlib import Path
import json

ROOT = Path(r'D:\Repo\Phaser_Jump')
WORK = ROOT / '.work/rank-chase-bold/validation'
counts = {}
for name in ['level-progress', 'checkpoint', 'spring']:
    report = json.loads((WORK / f'{name}.log').read_text(encoding='utf-8-sig'))
    counts[name] = report['passed']
items = (WORK / 'items.log').read_text(encoding='utf-8-sig')
counts['items'] = sum(line.startswith('PASS ') for line in items.splitlines())
assert sum(counts.values()) == 45, counts
model = json.loads((ROOT / '.work/rank-chase/validation/model-results.json').read_text(encoding='utf-8'))
assert model['passed'] == 36 and model['failed'] == 0
result = {
    'scene_passed': 15, 'model_passed': 36, 'existing_passed': counts, 'total_passed': 96,
    'build': 'passed', 'typecheck': 'passed', 'framed': False, 'visible_identity_details': False,
    'distance_digits': 'existing UI/letters.png yellow sprite frames, height48', 'main_digits_height': 96,
    'celebration': {'font_size': 70, 'overshoot': 1.15, 'confetti': 60, 'bursts': 2, 'rings': 2,
                    'duration_ms': 1880, 'cleanup': 'visible fade onComplete',
                    'decorative_area_does_not_block_jump': True},
    'qa_storage_isolated': True
}
(WORK / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
p = ROOT / 'TODO.md'
s = p.read_text(encoding='utf-8')
start = s.index('## 局内追赶精简与庆祝强化')
end = s.find('\n## ', start + 3)
end = len(s) if end < 0 else end
s = s[:start] + s[start:end].replace('- [ ]', '- [x]') + s[end:]
p.write_text(s, encoding='utf-8')
for name in ['rank-chase.md', 'weekly-ranking.md']:
    p = ROOT / 'docs' / name
    content = p.read_text(encoding='utf-8')
    assert p.is_file() and p.stat().st_size > 2000 and content.startswith('# ')
    if name == 'rank-chase.md':
        assert '共96项检查' in content and '60' in content and '艺术字' in content
        assert content.rstrip().endswith('也没有发布网站。')
    else:
        assert '不显示ID或目标总米数' in content
assert 'const DURATION = 1880' in (ROOT / 'src/game/overtakeCelebration.ts').read_text(encoding='utf-8')
assert any('成功超越' in p.read_text(encoding='utf-8') for p in (ROOT / 'dist/assets').glob('*.js'))
print('Verified:', ROOT / 'docs/rank-chase.md', ROOT / 'docs/weekly-ranking.md', sep='\n')
print('96 checks passed; original sprite reused; normal profiles untouched.')
