#!/usr/bin/env python3
"""Package the supplied original PNG/APNG files without changing their sprite frames.

python3 scripts/prepare_snorlax.py --normal /path/Spr_3e_143.png --shiny /path/Spr_3e_143_s.png

Extract static entry/rest frames and set APNG's play count to one. Animated
pixels, frame timing, and disposal/blending instructions are preserved.
"""
import argparse
import json
from pathlib import Path
import struct
import zlib

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PNG = b"\x89PNG\r\n\x1a\n"


def play_once(data: bytes) -> bytes:
    if not data.startswith(PNG):
        raise ValueError("Expected an original PNG/APNG file")
    output = bytearray(PNG)
    position = len(PNG)
    while position < len(data):
        size = struct.unpack(">I", data[position:position + 4])[0]
        kind = data[position + 4:position + 8]
        content = data[position + 8:position + 8 + size]
        original_crc = struct.unpack(">I", data[position + 8 + size:position + 12 + size])[0]
        if zlib.crc32(kind + content) & 0xffffffff != original_crc:
            raise ValueError(f"Invalid PNG checksum in {kind!r}")
        if kind == b"acTL":
            frames, _ = struct.unpack(">II", content)
            content = struct.pack(">II", frames, 1)
        output += struct.pack(">I", len(content)) + kind + content
        output += struct.pack(">I", zlib.crc32(kind + content) & 0xffffffff)
        position += size + 12
    return bytes(output)


def prepare(source: Path, destination: Path) -> dict:
    data = source.read_bytes()
    image = Image.open(source)
    if image.format != "PNG":
        raise ValueError(f"{source.name}: expected PNG/APNG, got {image.format}")
    first = 1 if image.info.get("default_image") else 0
    frames = getattr(image, "n_frames", 1)
    if frames - first < 2:
        raise ValueError(f"{source.name}: this PNG is static; the original animated file is needed")
    destination.mkdir(parents=True, exist_ok=True)
    durations = []
    for index in range(first, frames):
        image.seek(index)
        durations.append(image.info.get("duration", 0))
        if index == first:
            image.convert("RGBA").save(destination / "first.png")
    image.convert("RGBA").save(destination / "rest.png")
    (destination / "once.png").write_bytes(play_once(data))
    check = Image.open(destination / "once.png")
    if frames > 1 and check.info.get("loop") != 1:
        raise ValueError("APNG did not retain a single play")
    return {"size": list(image.size), "frames": frames - first, "durationMs": sum(durations), "plays": 1}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--normal", type=Path, required=True)
    parser.add_argument("--shiny", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=ROOT / "public/easter-eggs/snorlax")
    args = parser.parse_args()
    manifest = {name: prepare(source, args.output / name) for name, source in [("normal", args.normal), ("shiny", args.shiny)]}
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
