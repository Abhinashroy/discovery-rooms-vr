"""Extract one complete thud from the supplied four-step recording."""

from pathlib import Path
import numpy as np
import soundfile as sf

root = Path(__file__).resolve().parent.parent
samples, rate = sf.read(root / "sounds" / "walk sound.mp3", always_2d=True)
# Second thud peaks at 0.63 s; preserve its sole/room decay, exclude neighbours.
clip = samples[round(0.595 * rate) : round(0.960 * rate)].copy()
fade_in, fade_out = round(0.006 * rate), round(0.020 * rate)
clip[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
clip[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
destination = root / "public" / "audio" / "footstep.wav"
destination.parent.mkdir(parents=True, exist_ok=True)
sf.write(destination, clip, rate, subtype="PCM_16")
print(
    f"{destination.name}: {len(clip) / rate:.3f}s, {rate}Hz, {clip.shape[1]} channels"
)
