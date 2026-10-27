#!/usr/bin/env bash
# Runs before every message to Claude (UserPromptSubmit hook): puts the KOS evidence record in front of the answer,
# so each reply builds on what is documented as working, built or failed, never as a new query (owner, 27 Oct).
# Kept under ~9 KB: larger hook output is cut to a preview and the record would not reach Claude whole.
cd "$(dirname "$0")/.." || exit 0
cut_to() { awk -v n="$1" '{ if (length($0) > n) print substr($0, 1, n) "…"; else print }'; }
{
echo "KOS EVIDENCE RECORD. Answer from this record, not as a new query. If reality contradicts a line, mark it Failed with evidence the same day. Full text: kos/04-State/*.md"
echo "## Current-State (Working / Built / Failed / Not built)"
awk '/^## History/{exit} /^\| [0-9]+ \||^\| [A-Z]/' kos/04-State/Current-State.md | grep -v '^| What |\|^| # |' | cut_to 190
echo "## Open known issues"
grep '^| KI-' kos/04-State/Known-Issues.md | grep -v 'FIXED' | cut_to 110
echo "## Open loops"
grep '^| OL-' kos/04-State/Open-Loop.md | grep -v '\*\*Done\*\*\|\*\*Answered\*\*\|\*\*Withdrawn' | cut_to 95
} | head -c 8800
