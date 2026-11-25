"""Copy only the user-facing HTML + assets into AMOS_Team_Forms for sharing."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEAM = ROOT / "AMOS_Team_Forms"
ASSETS = TEAM / "assets"

HTML = [
    "00_Login.html",
    "00_Dashboard.html",
    "01_Enquiry_Sheet.html",
    "02_Store_Requisition.html",
    "03_Outside_Test_Pass.html",
    "04_Store_Stock_Entry.html",
    "05_3D_Print_Job.html",
    "06_Purchase_Order.html",
    "07_Work_Assign.html",
    "08_My_Work.html",
    "09_Project_Pack.html",
    "10_HR_Supervision.html",
    "11_Org_Structure.html",
]

ASSET_FILES = [
    "auth.js",
    "cloud-config.js",
    "dashboard.js",
    "work.js",
    "hr.js",
    "org.js",
    "doc.css",
    "master.js",
    "exceljs.min.js",
    "company-logo.jpg",
    "Amos.jpg",
    "company-logo.svg",
    "authorize-signature.svg",
    "team-org-chart.svg",
    "team-org-chart.png",
]


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    for name in HTML:
        src = ROOT / name
        if not src.exists():
            raise SystemExit(f"Missing {src}")
        shutil.copy2(src, TEAM / name)
    for name in ASSET_FILES:
        src = ROOT / "assets" / name
        if src.exists():
            shutil.copy2(src, ASSETS / name)
    # Team pack always uses teamMode so users never need the Excel file.
    cfg = ASSETS / "cloud-config.js"
    text = cfg.read_text(encoding="utf-8")
    if "teamMode: false" in text:
        text = text.replace("teamMode: false", "teamMode: true")
    elif "teamMode:" not in text:
        text = text.rstrip().rstrip(";") + ",\n  teamMode: true\n};\n"
        text = text.replace("};\n,", ",")  # no-op safety
    cfg.write_text(text, encoding="utf-8")
    index = TEAM / "index.html"
    if not index.exists():
        index.write_text(
            '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=00_Login.html">'
            "<title>AMOS Forms</title></head><body><a href='00_Login.html'>Open login</a></body></html>",
            encoding="utf-8",
        )
    print(f"Updated share pack: {TEAM}")
    print("Share only AMOS_Team_Forms with users.")


if __name__ == "__main__":
    main()
