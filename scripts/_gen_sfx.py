"""Original short cues for the delivery jump game. No sampled music."""
import math
import os
import random
import struct
import wave

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'Audio')
rng = random.Random(7)


def noise():
    return rng.uniform(-1, 1)


def write(name, samples):
    peak = max(abs(x) for x in samples) or 1
    scale = 0.9 / peak
    path = os.path.join(OUT, name)
    with wave.open(path, 'w') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        frames = bytearray()
        for sample in samples:
            value = max(-1, min(1, sample * scale))
            frames += struct.pack('<h', int(value * 32767))
        handle.writeframes(frames)
    print(name, len(samples))


def silence(seconds):
    return [0.0] * int(SR * seconds)


def mix(parts):
    length = max(len(part) for part in parts)
    out = [0.0] * length
    for part in parts:
        for index, sample in enumerate(part):
            out[index] += sample
    return out


def tone(seconds, freq, volume=0.5, partials=(1,), decay=4.5, attack=0.004):
    count = int(SR * seconds)
    phase = 0.0
    out = []
    for index in range(count):
        t = index / SR
        f = freq(t) if callable(freq) else freq
        phase += 2 * math.pi * f / SR
        sample = 0.0
        weight = 0.0
        for harmonic in partials:
            sample += math.sin(phase * harmonic) / harmonic
            weight += 1 / harmonic
        env = (1 - math.exp(-t / attack)) * math.exp(-t * decay)
        out.append(sample / weight * volume * env)
    return out


def noise_burst(seconds, volume=0.4, decay=18, color=0.35):
    count = int(SR * seconds)
    out = []
    state = 0.0
    for index in range(count):
        t = index / SR
        state += color * (noise() - state)
        env = math.exp(-t * decay) * (1 - math.exp(-t / 0.002))
        out.append(state * volume * env)
    return out


def jump():
    return mix([
        tone(0.12, lambda t: 420 + 380 * (1 - math.exp(-t * 28)), 0.7, (1, 2), decay=9, attack=0.002),
        noise_burst(0.03, 0.12, 40, 0.2),
    ])


def land():
    """Very short cardboard tap. The body is gone before 70ms."""
    return mix([
        tone(0.055, lambda t: 240 - 90 * t, 0.5, (1, 2), decay=48, attack=0.001),
        noise_burst(0.04, 0.5, 80, 0.75),
    ])


def perfect():
    return mix([
        tone(0.16, 784, 0.45, (1, 2), decay=7),
        silence(0.06) + tone(0.2, 1174, 0.5, (1, 2), decay=6),
    ])


def fail():
    return mix([
        tone(0.46, lambda t: 430 * math.exp(-t * 2.4) + 8 * math.sin(t * 30), 0.7, (1, 2), decay=2.2, attack=0.006),
        noise_burst(0.12, 0.12, 10, 0.4),
    ])


def checkpoint():
    notes = [523.25, 659.25, 783.99, 1046.5]
    parts = []
    for index, freq in enumerate(notes):
        parts.append(silence(index * 0.075) + tone(0.22, freq, 0.42, (1, 2, 3), decay=6))
    return mix(parts)


def overtake():
    whoosh = []
    state = 0.0
    count = int(SR * 0.34)
    for index in range(count):
        t = index / SR
        state += (0.15 + t * 1.4) * (noise() - state)
        env = math.sin(math.pi * min(1, t / 0.34)) ** 1.4
        whoosh.append(state * 0.55 * env)
    sparkle = silence(0.16) + tone(0.2, lambda t: 1318 + 180 * t, 0.4, (1, 2), decay=8)
    return mix([whoosh, sparkle])


def coin():
    tick = lambda freq: tone(0.12, freq, 0.55, (1, 2.76, 5.4), decay=12, attack=0.001)
    return mix([tick(988), silence(0.055) + tick(1318)])


def shield():
    return mix([
        tone(0.26, lambda t: 360 + 280 * (1 - math.exp(-t * 8)), 0.55, (1, 2), decay=4.5),
        tone(0.2, 1568, 0.12, (1,), decay=8),
    ])


def shield_break():
    return mix([
        noise_burst(0.1, 0.45, 16, 0.8),
        tone(0.16, lambda t: 880 * math.exp(-t * 8), 0.4, (1, 2), decay=10, attack=0.001),
    ])


def speed():
    out = []
    state = 0.0
    count = int(SR * 0.2)
    for index in range(count):
        t = index / SR
        state += (0.2 + t * 3) * (noise() - state)
        env = math.sin(math.pi * t / 0.2) ** 0.8 * math.exp(-t * 3)
        out.append(state * 0.7 * env)
    rise = tone(0.16, lambda t: 520 + 700 * t, 0.25, (1,), decay=8)
    return mix([out, rise])


def spring():
    out = []
    phase = 0.0
    count = int(SR * 0.32)
    for index in range(count):
        t = index / SR
        freq = 210 + 240 * math.exp(-t * 5.5) * math.cos(t * 32)
        phase += 2 * math.pi * max(40, freq) / SR
        env = math.exp(-t * 4.2) * (1 - math.exp(-t * 90))
        out.append((math.sin(phase) * 0.85 + math.sin(phase * 2) * 0.12) * env)
    return mix([out, noise_burst(0.03, 0.1, 30, 0.3)])


def ui():
    return tone(0.045, 1480, 0.7, (1, 2), decay=40, attack=0.001)


def deny():
    return mix([
        tone(0.09, 311, 0.55, (1, 2), decay=14),
        silence(0.07) + tone(0.1, 233, 0.5, (1, 2), decay=12),
    ])


def confirm():
    return mix([
        tone(0.1, 659.25, 0.45, (1, 2), decay=10),
        silence(0.06) + tone(0.14, 880, 0.5, (1, 2), decay=8),
    ])


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    write('land.wav', land())
    write('perfect.wav', perfect())
    write('checkpoint.wav', checkpoint())
    write('overtake.wav', overtake())
    write('coin.wav', coin())
    write('shield.wav', shield())
    write('shield-break.wav', shield_break())
    write('speed.wav', speed())
    write('spring.wav', spring())
    write('ui.wav', ui())
    write('deny.wav', deny())
    write('confirm.wav', confirm())
