# Homebrew casks

## Contents

- A cask for your own tap
- Install steps and flight blocks
- uninstall against zap
- Apps that update themselves
- Checking a cask
- Beta macOS, Homebrew and mas

## A cask for your own tap

Start from `assets/example.rb`: a pinned `version`, the `sha256` of the release archive, an https `url` that uses `#{version}`, `name`, `desc`, `homepage`, a `livecheck` that reads the same feed the app's updater reads, `auto_updates true` when the app updates itself, the `app` artifact, an `uninstall` that only quits the app, and a `zap` for everything the app leaves behind. Put it in `Casks/<token>.rb` of a tap repository named `homebrew-<tap>`; people install it with `brew install --cask <user>/<tap>/<token>`. Bump `version` and `sha256` in the same release job that publishes the archive, so the two never disagree [DD-WARN-CASKSHA].

`sha256 :no_check` and `version :latest` remove the check Homebrew would make and stop `brew upgrade` from seeing new releases; keep them for nightly builds that say so [DD-WARN-CASKSHA].

## Install steps and flight blocks

Homebrew's current cask style check refuses Ruby `preflight`, `postflight`, `uninstall_preflight` and `uninstall_postflight` blocks in favour of its declarative install-step stanzas, which the skill owner measured as `postflight_steps` and `uninstall_postflight_steps` (IL-22) [DD-CASK-01]. The names come from one Homebrew version: run `brew style --cask <token>` on the user's Homebrew and use the stanza it names. Most casks need no steps at all: an app that sets itself up on first launch does better than a cask that does it during install.

## uninstall against zap

`brew upgrade` runs a cask's `uninstall` stanza before it installs the new version, so whatever `uninstall` removes is gone after every upgrade (IL-22). Keep `uninstall` to stopping the app (`quit:`, `launchctl:` for its own agents, `signal:`) and move removing login items and the person's files under `~/Library` to `zap`, which runs only on `brew uninstall --zap` [DD-CASK-02]. A login item removed in `uninstall` silently stops the app starting at login after the next upgrade.

## Apps that update themselves

An app with its own updater (Sparkle, the Tauri updater, a custom one) declares `auto_updates true` [DD-CASK-03]. Casks marked so are still upgraded by `brew upgrade` by default unless the person sets `HOMEBREW_NO_UPGRADE_AUTO_UPDATES_CASKS` (IL-22), so both paths install builds: make them the same build by bumping the cask in the release job, and make the app's updater tolerate a copy Homebrew replaced while it was running. Upgrading through Homebrew against an app that was updating itself once removed the app entirely (IL-22); if you see that, tell the person to pick one path and set the variable.

## Checking a cask

```
node <absolute path to this part>/scripts/check-cask.mjs --self-updating Casks/<token>.rb
brew style --cask <token>
brew audit --cask --new <token>
brew install --cask <token> && brew uninstall --cask <token>
```

`check-cask.mjs` reads text only; `brew style` and `brew audit` are the authority, and an install and uninstall on a test account is the real check.

## Beta macOS, Homebrew and mas

- On a beta of macOS, Homebrew cannot place the OS, may ask for the newest Xcode or Command Line Tools, and may build from source because no bottle matches (IL-23) [DD-WARN-BETA]. `brew doctor` says which. The owner measured that `HOMEBREW_FAKE_MACOS` set to the last released version makes Homebrew pick release bottles; it is undocumented and read only in Homebrew's source, so offer it as a workaround to try, never as a fix to commit (IL-23).
- `mas upgrade` needs sudo for App Store apps, so do not script it in an agent; leave App Store apps to macOS automatic updates (IL-23).
- Never run `brew` with sudo, and do not update Homebrew in the middle of a release build: pin what the build needs.
