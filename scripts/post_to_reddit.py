# PDFPing Reddit post helper
# Posts to r/SideProject and r/webdev
#
# Usage:
#   python scripts/post_to_reddit.py sideproject
#   python scripts/post_to_reddit.py webdev

import sys
import webbrowser

urls = {
    "sideproject": "https://new.reddit.com/r/SideProject/submit",
    "webdev": "https://new.reddit.com/r/webdev/submit",
}

if len(sys.argv) < 2:
    print("Usage: python post_to_reddit.py [sideproject|webdev]")
    print("Available:", list(urls.keys()))
    sys.exit(1)

target = sys.argv[1]
if target not in urls:
    print(f"Unknown target: {target}")
    sys.exit(1)

with open(f"scripts/reddit_post_{target}.md") as f:
    content = f.read()

# Extract title and body
lines = content.split("\n")
title = ""
body_start = 0
for i, line in enumerate(lines):
    if line.startswith("## Title:"):
        title = lines[i + 1].strip()
    if line.startswith("## Body:"):
        body_start = i + 1
        break

body = "\n".join(lines[body_start:]).strip()

print("=" * 60)
print(f"TARGET: r/{target.capitalize()}")
print("=" * 60)
print()
print("TITLE:")
print(title)
print()
print("BODY:")
print(body)
print()
print("=" * 60)

answer = input("Open Reddit to post? (y/n): ")
if answer.lower() == "y":
    webbrowser.open(urls[target])
    print("Reddit opened. Copy-paste the title and body above.")
    print()
    print("--- Post body (with markdown) ---")
    print(body)
