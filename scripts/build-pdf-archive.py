"""Download the catalog's official question PDFs and package an ASCII-only ZIP."""

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
NAME = "DB-Exam-PDF-2016-2025"
catalog = json.loads((ROOT / "src/pdf-catalog.json").read_text())
assert sorted(entry["year"] for entry in catalog) == list(range(2016, 2026))
jobs = [
    (f"{NAME}/{part.upper()}/{entry['year']}-{part.upper()}.pdf", entry["papers"][part])
    for part in ("am1", "am2", "pm1", "pm2")
    for entry in sorted(catalog, key=lambda entry: entry["year"])
]


cached_questions = {}
if "--reuse-questions" in sys.argv:
    with ZipFile(ROOT / "output" / f"{NAME}.zip") as existing:
        cached_questions = {name: existing.read(name) for name, _ in jobs}


def download(job):
    name, url = job
    if name in cached_questions:
        data = cached_questions[name]
    else:
        with urlopen(url, timeout=60) as response:
            data = response.read()
    if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-2048:]:
        raise ValueError(f"Invalid PDF: {url}")
    return name, data


destination = ROOT / "output" / f"{NAME}.zip"
destination.parent.mkdir(parents=True, exist_ok=True)
temporary = destination.with_suffix(".zip.tmp")
try:
    with ThreadPoolExecutor(max_workers=4) as executor:
        with ZipFile(temporary, "w", compression=ZIP_DEFLATED) as archive:
            for name, data in executor.map(download, jobs):
                info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
                info.compress_type = ZIP_DEFLATED
                info.create_system = 0
                archive.writestr(info, data)
                print(f"Added {name} ({len(data):,} bytes)", flush=True)
    with ZipFile(temporary, "a", compression=ZIP_DEFLATED) as archive:
        for filename in ["morning.pdf", "2016-2025-pm1.pdf", "2016-2025-pm2.pdf", "diagram-scoring-guide.pdf"]:
            data = (ROOT / "public/answer-sheets" / filename).read_bytes()
            assert data.startswith(b"%PDF-")
            info = ZipInfo(f"{NAME}/ANSWER-SHEETS/{filename}", date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.create_system = 0
            archive.writestr(info, data)
    with ZipFile(temporary) as archive:
        assert len(archive.namelist()) == 44
        assert all(name.isascii() for name in archive.namelist())
        assert archive.testzip() is None
    temporary.replace(destination)
finally:
    temporary.unlink(missing_ok=True)
print(f"Created {destination} ({destination.stat().st_size:,} bytes)")

# Keep each static asset small; the page joins these bytes back into one ZIP.
assets = ROOT / "public/downloads"
assets.mkdir(parents=True, exist_ok=True)
parts = []
with destination.open("rb") as source:
    while data := source.read(20 * 1024 * 1024):
        name = f"{NAME}.part{len(parts) + 1:02d}"
        (assets / name).write_bytes(data)
        parts.append({"file": name, "size": len(data)})
(assets / f"{NAME}.json").write_text(json.dumps({
    "filename": destination.name,
    "pdfCount": 44,
    "size": destination.stat().st_size,
    "parts": parts,
}, indent=2) + "\n")

# Per-session downloads use the same chunked delivery as the all-in-one ZIP.
with ZipFile(destination) as all_in_one:
    for session in ("am1", "am2", "pm1", "pm2"):
        session_name = f"{NAME}-{session}"
        session_zip = destination.parent / f"{session_name}.zip"
        names = [name for name in all_in_one.namelist() if name.startswith(f"{NAME}/{session.upper()}/")]
        assert len(names) == 10
        with ZipFile(session_zip, "w", compression=ZIP_DEFLATED) as archive:
            for name in names:
                info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
                info.compress_type = ZIP_DEFLATED
                info.create_system = 0
                archive.writestr(info, all_in_one.read(name))
        session_parts = []
        with session_zip.open("rb") as source:
            while data := source.read(20 * 1024 * 1024):
                name = f"{session_name}.part{len(session_parts) + 1:02d}"
                (assets / name).write_bytes(data)
                session_parts.append({"file": name, "size": len(data)})
        (assets / f"{session_name}.json").write_text(json.dumps({
            "filename": session_zip.name,
            "pdfCount": 10,
            "size": session_zip.stat().st_size,
            "parts": session_parts,
        }, indent=2) + "\n")
