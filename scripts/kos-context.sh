#!/usr/bin/env bash
# Runs before every message to Claude (UserPromptSubmit hook): puts the KOS evidence record in front of the answer,
# so each reply builds on what is documented as working, built or failed, never as a new query (owner, 27 Oct).
cd "$(dirname "$0")/.." || exit 0
echo "KOS EVIDENCE RECORD (kos/). Answer from this record, not as a new query. If reality contradicts a line, mark it Failed with evidence the same day."
echo
awk '/^## History/{exit} {print}' kos/04-State/Current-State.md
echo
echo "## Open loops (not Done / Answered)"
grep '^| OL-' kos/04-State/Open-Loop.md | grep -v '\*\*Done\*\*' | grep -v '\*\*Answered\*\*'
echo
echo "## Open known issues"
grep '^| KI-' kos/04-State/Known-Issues.md | grep -v 'FIXED'
