"""Rebuild Earth Explorer's bounded local asset pack. No runtime network needed.

Run from the repository: python scripts/fetch-earth-assets.py
Only public/earth-explorer is written. Country polygons use the pinned upstream
Natural Earth repository release, retaining its geometry and de facto policy.
"""

from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image
from io import BytesIO
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "earth-explorer"
MAP_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson"
MOON_URL = "https://www.solarsystemscope.com/textures/download/2k_moon.jpg"
COUNTRIES = json.loads(
    (ROOT / "src/earth-explorer/data/catalog.json").read_text(encoding="utf-8")
)
COUNTRY_IDS = {c["id"] for c in COUNTRIES}


def download(url):
    with urlopen(
        Request(url, headers={"User-Agent": "EarthExplorerAssetPreparation/1.0"}),
        timeout=45,
    ) as response:
        return response.read()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    raw = download(MAP_URL)
    original = json.loads(raw)
    fallback_ids = []
    features = []
    for source in original["features"]:
        props = source["properties"]
        iso = props["ISO_A3"]
        if iso == "-99":
            iso = props["ADM0_A3"]
            fallback_ids.append(
                {
                    "id": iso.lower(),
                    "name": props["ADMIN"],
                    "reason": "ISO_A3 missing in source; Natural Earth ADM0_A3 used",
                }
            )
        # Keep all rings, holes and all coordinate precision. Only unused metadata is removed.
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": iso.lower(),
                    "iso2": props.get("ISO_A2_EH")
                    if props.get("ISO_A2") == "-99"
                    else props.get("ISO_A2"),
                    "name": props.get("NAME_EN") or props["ADMIN"],
                    "label": [props["LABEL_X"], props["LABEL_Y"]],
                },
                "geometry": source["geometry"],
            }
        )
    data = {"type": "FeatureCollection", "features": features}
    assert len({f["properties"]["id"] for f in features}) == len(features), (
        "Duplicate country identifier"
    )
    assert COUNTRY_IDS <= {f["properties"]["id"] for f in features}, (
        "Learning country missing"
    )
    assert all(f["geometry"]["type"] in ("Polygon", "MultiPolygon") for f in features)
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode(
        "utf-8"
    )
    (OUT / "countries.geojson").write_bytes(encoded)
    moon = download(MOON_URL)
    image = Image.open(BytesIO(moon))
    assert image.format == "JPEG" and image.size == (2048, 1024), (
        "Unexpected Moon asset"
    )
    (OUT / "moon.jpg").write_bytes(moon)
    credits = {
        "prepared": "2026-10-15",
        "map": {
            "file": "countries.geojson",
            "creator": "Natural Earth contributors",
            "attribution": "Made with Natural Earth.",
            "license": "Public domain",
            "licenseUrl": "https://www.naturalearthdata.com/about/terms-of-use/",
            "source": MAP_URL,
            "repositoryRelease": "v5.1.2",
            "layer": "ne_50m_admin_0_countries",
            "scale": "1:50 million",
            "coordinateReferenceSystem": "WGS84 longitude, latitude (degrees)",
            "sourceSha256": digest(raw),
            "fileSha256": digest(encoded),
            "featureCount": len(features),
            "processing": "Removed unused properties and bbox metadata; retained Polygon/MultiPolygon geometry, rings, holes and coordinate precision unchanged.",
            "identifierPolicy": "ISO_A3 lowercase where present; Natural Earth ADM0_A3 lowercase fallback where source ISO_A3 is -99. Fallback values are map identifiers, not assertions of ISO recognition.",
            "fallbackIdentifiers": fallback_ids,
            "boundaryPolicy": "Natural Earth de facto boundaries from this pinned release; territorial outlines and names are educational map data, not an endorsement of sovereignty or a current legal boundary reference. This small-scale polygon layer does not include auxiliary disputed/claim-line overlays.",
            "boundaryPolicySource": "https://www.naturalearthdata.com/about/disputed-boundaries-policy/",
            "limitations": "Generalized small-scale geography: coastline detail is simplified. All 195 learning countries are mapped and searchable. A locator ring marks small countries without enlarging their borders. Other territories retain map names. Antarctica is shown as land, not a country quiz answer. No quiz tests disputed borders or sovereignty.",
        },
        "moon": {
            "file": "moon.jpg",
            "creator": "Solar System Scope / INOVE",
            "attribution": "Moon texture: Solar System Scope (solarsystemscope.com), CC BY 4.0.",
            "source": MOON_URL,
            "sourcePage": "https://www.solarsystemscope.com/textures/",
            "license": "CC BY 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
            "dimensions": list(image.size),
            "bytes": len(moon),
            "sha256": digest(moon),
            "processing": "Original 2k JPEG downloaded unchanged; rendering lighting may modify its appearance.",
            "notes": "Representative equirectangular visual texture; provider notes enhanced colours and reconstructed gaps in the texture collection. Not a measurement product.",
        },
        "sharedTextures": {
            "directory": "../planetarium/",
            "files": [
                "2k_earth_daymap.jpg",
                "2k_earth_clouds.jpg",
                "2k_sun.jpg",
                "2k_stars_milky_way.jpg",
            ],
            "credits": "../planetarium/credits.json",
            "creator": "Solar System Scope / INOVE",
            "license": "CC BY 4.0",
            "sourcePage": "https://www.solarsystemscope.com/textures/",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        },
        "learningContent": {
            "countryCount": 195,
            "factVersion": 2,
            "prepared": "2026-10-15",
            "coverage": "193 UN member states plus the two non-member observer states, Holy See and Palestine. Other mapped territories are not counted as additional countries.",
            "coverageSources": [
                "https://www.un.org/en/about-us/member-states",
                "https://www.un.org/en/about-us/non-member-states",
            ],
            "sources": {c["id"]: c["factSource"] for c in COUNTRIES},
            "textPolicy": "Short original factual summaries. Mostly UNESCO, supplemented by official tourism/government, museums, research and encyclopedia references. Source prose and photographs are not reproduced.",
            "regionConvention": "Country cards use geographic world regions. Oceania includes Australia and Pacific island countries. Russia, Turkey and Kazakhstan have Europe / Asia labels and paired-continent questions. Antarctica is not a country answer. Names and boundaries are not a political recognition policy.",
            "landingCoordinates": "Coordinates validated inside each bundled country polygon; these are navigation destinations, not official centroids or fact landmark locations.",
        },
        "decorativeSky": {
            "stars": "Procedural distant point field in both modes.",
            "comets": "Occasional fictional distant paths; unrelated to simulation clock. Disabled during quiz/menus, hidden tabs and reduced motion.",
        },
        "audio": {
            "clips": ["../audio/footstep.wav", "../audio/Hooray.m4a"],
            "source": "Existing user-supplied recordings; footstep reuses the previously extracted single thud. No ambient soundtrack.",
        },
        "scienceReferences": [
            "https://science.nasa.gov/earth/facts/",
            "https://science.nasa.gov/moon/moon-phases/",
            "https://spaceplace.nasa.gov/seasons/en/",
            "https://aa.usno.navy.mil/faq/leap_years",
        ],
        "simulationNote": "Teaching model with adjusted body sizes, distances and travel scale; not a live ephemeris or an eclipse/sunrise prediction service.",
    }
    (OUT / "credits.json").write_text(
        json.dumps(credits, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Saved {len(features)} country features ({len(encoded):,} bytes), Moon {image.size} ({len(moon):,} bytes), credits.json"
    )


if __name__ == "__main__":
    main()
