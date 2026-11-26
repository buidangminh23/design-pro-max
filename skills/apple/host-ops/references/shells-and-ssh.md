# Shells, SSH and AppleScript

## Contents

- Which shell runs, and which files it reads
- Sending a script over SSH
- The login Keychain over SSH
- Secrets in .env files
- open -a and the environment
- AppleScript targets and GUI scripting
- Sources

## Which shell runs, and which files it reads

`ssh host 'command'` starts the user's login shell with `-c`, as neither a login nor an interactive shell, so `PATH` holds only the system folders and tools installed by a package manager seem missing (IL-1). zsh reads `.zshenv` for every shell, `.zprofile` and `.zlogin` for login shells and `.zshrc` only for interactive ones (man zsh, STARTUP/SHUTDOWN FILES). So:

- `zsh -lc '<command>'` reads `.zprofile`, not `.zshrc`. PATH lines an agent needs over SSH belong in `.zprofile`; lines only a person at the keyboard needs (prompt, completion, aliases) stay in `.zshrc`.
- A missing tool over SSH is first a PATH question: compare `ssh host 'echo $PATH'` with `ssh host 'zsh -lc "echo \$PATH"'` before reinstalling anything.
- A launchd job reads none of these files. Give it absolute paths and, if it needs more, an `EnvironmentVariables` dictionary with `PATH` (see `launchd-and-permissions.md`).

## Sending a script over SSH

In double quotes, `$VAR` and `$(...)` expand on the machine that runs `ssh`, not on the Mac [HO-WARN-SSH]. Use single quotes for one line, and a here-document with a quoted delimiter for more:

```
ssh host.example.com 'zsh -ls' <<'EOF'
set -eu
cd ~/src/app
git rev-parse HEAD
EOF
```

`zsh -ls` reads the script from standard input as a login shell; the quoted `'EOF'` stops the local shell from expanding anything inside. Keep the remote side's exit code: `ssh` returns it.

## The login Keychain over SSH

An SSH session cannot unlock or read the login Keychain: `security find-generic-password` exits 36 (`errSecInteractionNotAllowed`) for an item the logged-in session reads, and tools that keep credentials there fail with messages that name something else: a CLI says it is signed out, a container tool says the keychain cannot be accessed, git and gh fail on private repositories (IL-0). Do not sign in again; the sign-in is not the problem. Options, lightest first:

1. Skip the credential where it is not needed (public images, public repositories).
2. Run the step as a LaunchAgent, which runs in the user's session and can use the login Keychain.
3. Use a token made for headless use, stored in a file only its owner can read (`chmod 600`), outside every repository, loaded by the job that needs it.

`man security` describes the keychain commands and their exit statuses.

## Secrets in .env files

A `.env` file is data, not a script [HO-ENV-01]. `set -a; . ./.env` runs every line as shell code: a value with an unbalanced quote or an ampersand becomes a command, and zsh prints the value in its `command not found` message, which lands in the agent's transcript (IL-6). Read one value at a time:

```
token=$(grep -E '^DEPLOY_TOKEN=' .env | cut -d= -f2-)
[ -n "$token" ] || { echo "DEPLOY_TOKEN is empty" >&2; exit 1; }
```

`assets/env-value.sh <file> <NAME>` prints only whether the value is set and how long it is; `--value` prints the value for a pipe into the command that needs it. Never echo a value, never write it to a log, a plist or a repository, and report only lengths to the user.

## open -a and the environment

`open -a App` hands the calling shell's environment to the app, so tokens and variables from an agent session reach it [HO-WARN-OPENENV] (IL-7). To start an app the way the Dock does:

```
env -i HOME="$HOME" USER="$USER" LOGNAME="$LOGNAME" SHELL="$SHELL" TMPDIR="$TMPDIR" PATH=/usr/bin:/bin:/usr/sbin:/sbin open -a Notes
```

Quit the app first if it is running, since `open` only brings a running app forward. Some apps' child processes show their own Dock icons; `lsappinfo list` shows the records that share one bundle identifier.

## AppleScript targets and GUI scripting

AppleScript loads an application's dictionary when the script is compiled, from the application named in `tell application "<name>"` [HO-OSA-01] (IL-2). With a variable target the dictionary is not loaded, and the app's own terms fail or are read as plain words. Use a literal name; when the target must vary, check it against a list and either interpolate it as a quoted literal or wrap the block:

```
using terms from application "Notes"
	tell application appName
		count notes
	end tell
end using terms from
```

`tell application id "com.example.app"` with a literal bundle identifier is also fine. Other traps (IL-2):

- Some menu items are enabled only while their app is frontmost: `activate` it or `open -a` it first.
- An element's default accessibility action may do more than select it, such as connecting or opening something; read its actions before performing one.
- GUI scripting from an SSH session needs the Accessibility permission for the SSH server binary, not for Terminal. Probe `tell application "System Events" to get UI elements enabled` first and stop with a message if it is false.

## Sources

- man zsh (startup files), man ssh, man security.
- AppleScript Language Guide: https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/introduction/ASLR_intro.html
