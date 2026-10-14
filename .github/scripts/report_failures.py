"""Turns Maven compile errors and failed tests into GitHub annotations, so failures are
readable from the checks UI and API without downloading the full log."""
import glob
import os
import re
import sys
import xml.etree.ElementTree as ET


def escape(text: str) -> str:
    return text.replace("%", "%25").replace("\r", "").replace("\n", "%0A")


def annotate(title: str, body: str) -> None:
    print(f"::error title={escape(title)}::{escape(body[:20000])}")


def main(log_path: str, reports_dir: str) -> None:
    if os.path.exists(log_path):
        with open(log_path, encoding="utf-8", errors="replace") as f:
            errors = [line.rstrip() for line in f if line.startswith("[ERROR]")]
        if errors:
            annotate("Maven errors", "\n".join(errors[:120]))

    failures = []
    for path in sorted(glob.glob(os.path.join(reports_dir, "TEST-*.xml"))):
        root = ET.parse(path).getroot()
        for case in root.iter("testcase"):
            for kind in ("failure", "error"):
                node = case.find(kind)
                if node is not None:
                    detail = (node.get("message") or "") + "\n" + (node.text or "")
                    detail = re.sub(r"\n\s+at (org\.junit|java\.base|org\.springframework\.test).*", "", detail)
                    failures.append(f"{case.get('classname')}.{case.get('name')} [{kind}]\n{detail[:3000]}")
    for i in range(0, min(len(failures), 40), 10):
        annotate(f"Failed tests {i + 1}-{min(i + 10, len(failures))} of {len(failures)}",
                 "\n\n----\n\n".join(failures[i:i + 10]))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
