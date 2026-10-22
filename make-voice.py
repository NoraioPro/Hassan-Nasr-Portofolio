"""Render the Neural Portrait intro (dist/assets/avatar/voice.mp3 + voice.json) with a local Piper voice.

Uses the offline voice-agent install (Piper voices in ~/models/voice-agent/tts, ffmpeg on PATH).
voice.json holds per-word start times for the captions and a phoneme-accurate mouth track
[[t, jaw, wide, round], ...] built with the voice-agent viseme table. SCRIPT must match SCRIPT in dist/portrait.js.

usage:  ~/voice-agent/.venv/Scripts/python.exe make-voice.py dist/assets/avatar [--speed 1.08] [--voice en_US-ryan-high]
"""
import argparse, json, re, subprocess, sys
from pathlib import Path

import numpy as np

VA = Path.home() / 'voice-agent'
sys.path.insert(0, str(VA))
from app.visemes import viseme_for  # noqa: E402  (phoneme -> jaw/wide/round table)

MODELS = Path.home() / 'models' / 'voice-agent' / 'tts'

# What the captions show (must match SCRIPT in portrait.js word for word).
SCRIPT = ("Hi, I'm Hassan Nasr, CTO at Medioteq AS, based in Oslo. I'm a technology leader and founder. "
          "I build AI architecture for health, enterprise software and digital transformation, across Norway, the Gulf and Egypt. "
          "What I care about is intelligence that is actually useful: systems people can trust, built to fit real work. "
          "Move your cursor and I'll follow you. Click, and I'll wink.")
# What the voice reads: same number of words, spelled for the phonemizer.
SAY = {"Nasr,": "Nahsr,", "CTO": "C.T.O.", "Medioteq": "Meddio-tek", "AS,": "A.S.,", "AI": "A.I."}

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('--probe', action='store_true')
ap.add_argument('--speed', type=float, default=1.08); ap.add_argument('--voice', default='en_US-ryan-high')
ap.add_argument('--gap', type=float, default=0.14)
a = ap.parse_args()

from piper import PiperVoice, SynthesisConfig  # noqa: E402

voice = PiperVoice.load(model_path=MODELS / f'{a.voice}.onnx', config_path=MODELS / f'{a.voice}.onnx.json', use_cuda=False, include_alignments=True)
sr = voice.config.sample_rate
cfg = SynthesisConfig(length_scale=1.0 / a.speed, noise_scale=0.6, noise_w_scale=0.75, normalize_audio=True, volume=1.0)

cap_words = SCRIPT.split()
say_words = [SAY.get(w, w) for w in cap_words]
# sentence split on the caption words, keeping indices
sentences, cur = [], []
for i, w in enumerate(say_words):
    cur.append(i)
    if re.search(r'[.!?]$', cap_words[i]):
        sentences.append(cur); cur = []
if cur: sentences.append(cur)

audio, track, starts = [], [], []
t0 = 0.0
gap = np.zeros(int(sr * a.gap), dtype=np.float32)
for si, idx in enumerate(sentences):
    text = ' '.join(say_words[i] for i in idx)
    chunks = list(voice.synthesize(text, syn_config=cfg, include_alignments=True))
    for c in chunks:
        al = c.phoneme_alignments or []
        if a.probe:
            print(repr(text)); print(' '.join(x.phoneme for x in al))
        # word starts: first sounding phoneme after a space; mouth keyframes from the viseme table
        t, new_word = t0, True
        for x in al:
            dur = x.num_samples / sr
            if x.phoneme == ' ':
                new_word = True
            elif new_word and viseme_for(x.phoneme) is not None and x.phoneme not in '.,:;!?^$_':
                starts.append(round(t, 3)); new_word = False
            shape = viseme_for(x.phoneme)
            if shape is not None:
                track.append([round(t, 3), *[round(v, 2) for v in shape]])
            t += dur
        audio.append(c.audio_float_array.astype(np.float32))
        t0 += c.audio_float_array.size / sr
    track.append([round(t0, 3), 0.0, 0.1, 0.0])
    if si != len(sentences) - 1:
        audio.append(gap); t0 += gap.size / sr

samples = np.concatenate(audio)
# trim the long leading silence so Talk feels instant
lead = int(np.argmax(np.abs(samples) > 0.02)); lead = max(0, lead - int(0.03 * sr))
samples = samples[lead:]; shift = lead / sr
track = [[max(0.0, round(p[0] - shift, 3)), *p[1:]] for p in track]
starts = [max(0.0, round(s - shift, 3)) for s in starts]
dur = samples.size / sr
print(f'words caption={len(cap_words)} spoken={len(starts)} duration={dur:.2f}s track={len(track)} pts')
if len(starts) != len(cap_words):
    print('WARNING: word count mismatch; captions will use proportional timing')

out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
raw = (np.clip(samples, -1, 1) * 32767).astype('<i2').tobytes()
mp3 = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-f', 's16le', '-ar', str(sr), '-ac', '1', '-i', '-',
                      '-af', 'highpass=f=70,afade=t=out:st=%.2f:d=0.12' % max(0, dur - 0.12),
                      '-codec:a', 'libmp3lame', '-b:a', '64k', '-f', 'mp3', '-'], input=raw, capture_output=True)
if mp3.returncode or not mp3.stdout:
    sys.exit('ffmpeg failed: ' + mp3.stderr.decode(errors='replace'))
(out / 'voice.mp3').write_bytes(mp3.stdout)
data = {'voice': a.voice, 'duration': round(dur, 3), 'words': starts if len(starts) == len(cap_words) else [], 'track': track}
(out / 'voice.json').write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
print('wrote', out / 'voice.mp3', len(mp3.stdout) // 1024, 'KB;', out / 'voice.json')
