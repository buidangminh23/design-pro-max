# Field learnings (opt-in)

An own part's report can end with one lesson recorded in the user's project, so the next build there starts from what this one taught. It is off by default and belongs to the user.

## When it is on

Learnings are on only when one of these holds:

- The user asked in this conversation to record lessons, or agreed when offered once. Then pass `--create` on the first append.
- The user's project already holds a journal: a file whose first line is `# Apple field learnings`, at `APPLE-LEARNINGS.md` in the project root or at the relative path the user names with `--journal`.

Otherwise it is off: write nothing, and do not ask again in the same conversation. A file with the right name but another first line is not a journal; the helper refuses to touch it.

## What it never does

- Writes outside the user's project, into the installed skill, or into this repository. The helper refuses absolute paths, paths that leave the project, symlinked journals and a project that is or contains the skill.
- Records secrets, tokens, keys, passwords, emails, absolute paths, IP addresses, host or user names, or anything the user called private. Describe the situation in general words and relative paths.
- Sends an entry anywhere, commits it, or turns it into a change to this skill. Proposing a skill change is a separate request.
- Records a lesson that was not seen: only edits actually made and checked.

## One entry

One entry per finished task, at most, after the report. Run the helper by absolute path:

```
node <skill>/shared/learnings.mjs status --project <user project>
node <skill>/shared/learnings.mjs append --project <user project> --part <part> --verdict gap \
  --read "<what the read found>" --change "<what changed, with the measured values>" \
  --lesson "<what the situation taught>" --evidence "<the checker summary line>"
```

`--create` only on the opt-in above; `--journal <relative path>` when the user chose another file; `--date YYYY-MM-DD` to set the date. It appends:

```
## YYYY-MM-DD · <part> · <verdict>

- Read: ...
- Changed: ...
- Learned: ...
- Evidence: ...
```

Verdicts: `covered` when the part already said this, `gap` when it was silent or wrong, `refinement` when it was right but too vague to act on. Each field is one line. `check --project <user project>` validates every entry already in the journal.

Exit codes: 0 when the entry was written or `status` or `check` finished; 1 refused (learnings off, a privacy match, a bad field) with the reason on stdout; 2 bad usage. When it refuses, fix the entry or skip it; never write the journal by hand to get around a refusal.

## Reading it back

When learnings are on and a part starts work in that project, read the journal's entries for that part first. A `gap` there is the user's measured experience; follow it over the part's default when the two conflict, never over a hard rule or a never-ship item, and say so in the report.
