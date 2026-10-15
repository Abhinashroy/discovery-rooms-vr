"""Fetch credited CC BY 4.0 planet maps; store all runtime assets locally."""

from pathlib import Path
import json, re, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

root = Path(__file__).resolve().parent.parent
out = root / "public" / "planetarium"
out.mkdir(parents=True, exist_ok=True)
page = "https://www.solarsystemscope.com/textures/"


def read(url):
    return urllib.request.urlopen(
        urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0", "Referer": page}
        ),
        timeout=60,
    ).read()


html = read(page).decode()
wanted = {
    "mercury": "2k_mercury.jpg",
    "venus": "2k_venus_atmosphere.jpg",
    "earth": "2k_earth_daymap.jpg",
    "clouds": "2k_earth_clouds.jpg",
    "mars": "2k_mars.jpg",
    "jupiter": "2k_jupiter.jpg",
    "saturn": "2k_saturn.jpg",
    "rings": "2k_saturn_ring_alpha.png",
    "uranus": "2k_uranus.jpg",
    "neptune": "2k_neptune.jpg",
    "sun": "2k_sun.jpg",
    "stars": "2k_stars_milky_way.jpg",
}
from urllib.parse import urljoin

links = [urljoin(page, x) for x in re.findall(r'href=["\']([^"\']+)["\']', html)]


def fetch(pair):
    name, filename = pair
    url = next((u for u in links if u.endswith("/" + filename)), None)
    if not url:
        raise RuntimeError("Missing official asset link: " + filename)
    target = out / filename
    if not target.exists():
        target.write_bytes(read(url))
    with Image.open(target) as im:
        size = list(im.size)
        # Lower resolution variants only; originals and their colours remain intact.
        low = im.resize(
            (max(1, im.width // 2), max(1, im.height // 2)), Image.Resampling.LANCZOS
        )
        low.save(out / ("low_" + filename))
    print(name, filename, size, target.stat().st_size, flush=True)
    return {
        "id": name,
        "file": filename,
        "low": "low_" + filename,
        "source": url,
        "dimensions": size,
        "bytes": target.stat().st_size,
    }


with ThreadPoolExecutor(max_workers=4) as pool:
    assets = list(pool.map(fetch, wanted.items()))
(out / "credits.json").write_text(
    json.dumps(
        {
            "creator": "Solar System Scope / INOVE",
            "source": page,
            "license": "CC BY 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
            "notes": "Representative, colour-enhanced maps; some coverage is reconstructed. Low variants are resized copies. Neptune colour is moderated in the rendering material.",
            "assets": assets,
        },
        indent=2,
    )
)
