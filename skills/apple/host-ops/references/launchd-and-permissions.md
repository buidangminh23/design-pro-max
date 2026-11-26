# launchd, permissions and root commands

## Contents

- Agent or daemon
- A job file that loads
- Loading, reloading and reading launchctl print
- Proving a job works
- Privacy permissions follow the launched binary
- Root commands without a password in the agent
- What disappears: /tmp and App Translocation
- Sources

## Agent or daemon

| | LaunchAgent | LaunchDaemon |
|---|---|---|
| File | `~/Library/LaunchAgents/<label>.plist` | `/Library/LaunchDaemons/<label>.plist`, owned by root |
| Domain | `gui/<uid>` | `system` |
| Runs | while the user is logged in, as the user | from boot, as root, before anyone logs in |
| Reaches | the login Keychain, the GUI, per-user login items | no user session, no GUI, no login Keychain |

Choose the agent unless the work needs root or must run before login. With FileVault on, neither runs after a restart until someone unlocks the disk (see `always-on.md`).

## A job file that loads

Start from `assets/com.example.sync.plist` [HO-PLIST-01] (IL-4):

- `Label` equal to the file name without `.plist`, so `launchctl print` and `bootout` use the name you see.
- `ProgramArguments` with an absolute program first. launchd does not read shell startup files and looks a bare name up only in `/usr/bin:/bin:/usr/sbin:/sbin`, so `node` alone fails where `/usr/local/bin/node` works.
- `WorkingDirectory`, `StandardOutPath` and `StandardErrorPath` outside `/tmp` [HO-TMP-01].
- `EnvironmentVariables` with `PATH` when the program starts other tools.
- A schedule: `StartInterval` (seconds), `StartCalendarInterval`, `WatchPaths`, `RunAtLoad`, or `KeepAlive` for a long-running process.

Check the file with `plutil -lint <file>` and `scripts/check-plist.mjs <file>`. `man launchd.plist` lists every key.

## Loading, reloading and reading launchctl print

```
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.example.sync.plist
launchctl print gui/$(id -u)/com.example.sync
launchctl bootout gui/$(id -u)/com.example.sync
```

For a daemon, use `sudo launchctl bootstrap system <file>` and `launchctl print system/<label>`. Facts that mislead (IL-4):

- `launchctl list` run as a user shows the user's jobs only; a daemon looks missing there. Read `launchctl print system/<label>`.
- `state = not running` between `StartInterval` runs is normal. Read `runs`, `last exit code` and the job's log instead.
- launchd keeps the copy of the file it loaded. After editing the file, `bootout` then `bootstrap`; `launchctl print` shows the arguments launchd really runs [HO-LAUNCHD-01].
- A `launchctl print` that ends in "Could not find service" (exit 113) means the job is not loaded in that domain; check the other domain before loading it twice.

`scripts/probe-launchd.mjs --label <label> --plist <file>` compares the loaded path, program and arguments with the file and reads the last exit code. To judge another Mac, record `launchctl print <domain>/<label> > print.txt 2>&1; echo $?` there and pass `--print print.txt --exit <code>`.

## Proving a job works

A listed job proves only that launchd has it. Force each branch the job has once (the success path, the "nothing to do" path, each error path), and read the timestamps and lines it writes to its log (IL-4). A watchdog that reconnects a device is proven by disconnecting the device on purpose and timing the recovery (IL-12).

## Privacy permissions follow the launched binary

macOS records privacy permissions (Files and Folders, Full Disk Access, Accessibility, Bluetooth) against the binary that is launched, not the script it runs (IL-3). A LaunchAgent whose program is `/bin/bash` asks for, and is refused, access under the name of bash; the same script started through a binary that already holds the permission works [HO-WARN-TCC]. Consequences:

- A refused folder can look empty: `ls` prints `total 0` and sqlite says "authorization denied" while `lsof` shows files in it open. `stat` a file you know exists before concluding data is gone.
- Grant a permission to the smallest binary that needs it and tell the user which binary that is. Never grant Full Disk Access to a shell: every script that shell runs would inherit it.
- A tool refused from an agent's shell may work as a LaunchAgent, since the agent's shell runs under the agent app's permissions.

## Root commands without a password in the agent

The agent never sees an administrator password [HO-PRIV-01] (IL-5):

```
osascript -e 'do shell script "pmset -a disablesleep 1" with administrator privileges'
```

macOS shows its own authentication dialog to the person at the Mac; the agent only sees the command's output. Keep the command free of nested quotes, one step per call, and show it to the user first. Do not add the `user name` and `password` clauses, and never use `sudo -S`. Touch ID for `sudo` works only after the user creates `/etc/pam.d/sudo_local` from the template macOS ships; that is their choice to make.

## What disappears: /tmp and App Translocation

- `/tmp` is a link to `/private/tmp`, and macOS deletes old files there on its own schedule and at restart (IL-8). A worktree or deploy folder kept there vanishes, and every later deploy fails [HO-TMP-01]. Use `mktemp` there only for files a single run creates and removes.
- An app launched from the folder it was downloaded to may run from a temporary App Translocation copy. Command-line or credential-helper links it creates then point into a folder that is removed later, and the tools report false credential errors (IL-8). Move the app to Applications, open it once from there and recreate the links, or put the app's own bin folder on PATH. `readlink` on the link shows an AppTranslocation path when this happened.

## Sources

- man launchctl, man launchd.plist, man plutil, man periodic.
- Creating Launch Daemons and Agents: https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html
- Technical Note TN2065, do shell script in AppleScript: https://developer.apple.com/library/archive/technotes/tn2065/_index.html
