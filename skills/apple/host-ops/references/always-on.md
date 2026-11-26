# A Mac that stays reachable

## Contents

- Sleep and the lid
- What a lock, a log out and a restart stop
- Automatic updates
- Heat, memory and resets
- Keyboards, Bluetooth and input sources

## Sleep and the lid

`pmset` sets sleep per power source; `pmset -g` shows the current values and `man pmset` lists them. On a laptop used as a server, `sudo pmset -a disablesleep 1` kept one reachable with its lid shut in 18/18 probes (IL-9). Prove it rather than trusting the setting:

- `ioreg -r -k SleepDisabled` should print `SleepDisabled = Yes`.
- While probing, `ioreg -r -k AppleClamshellState` must print `Yes`: a screen that only turned off is a different test.
- `pmset -g log` tells whether the Mac slept or woke, and when.

A laptop that never sleeps keeps running in a bag. Pair the setting with a rule that gives sleep back on battery with the lid shut, and say so to the user. Run the `pmset` change as a root step through the system dialog (see `launchd-and-permissions.md`).

## What a lock, a log out and a restart stop

| Event | Effect (IL-9) |
|---|---|
| Screen lock | nothing stops: SSH, agents and daemons keep running |
| Log out | the user's LaunchAgents and login items stop, including a VPN that runs per user; daemons keep running |
| Restart with FileVault on | nothing runs until someone unlocks the disk at the Mac: no SSH, no daemons, no VPN |
| Restart without FileVault | daemons start at boot; agents only after a login |

Tell the user which of these their setup survives. FileVault's unlock before startup is described in Apple Platform Security; turning FileVault off to stay reachable is the user's decision, never the agent's.

## Automatic updates

Automatic installation of macOS updates can restart the Mac on its own; on one machine it restarted every week until automatic installation was turned off (IL-9). Read the setting with `defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates`; changing it, and keeping security responses, is the user's choice in System Settings. Compare `last reboot` with the update schedule when restarts look random.

## Heat, memory and resets

On a fanless laptop with 8 GB of memory, sustained heat came from memory compression while the CPU was about 82 % idle (IL-10). Before blaming a process:

- `memory_pressure` and `vm_stat`: swapping and compression mean too little memory, not too much CPU.
- A busy `kernel_task` means the Mac is throttling itself for heat.
- `sysctl kern.shutdownreason` after an unexpected shutdown names a thermal or power cause.
- A reset diagnostic that names a watchdog (wdog) with no panic report points at memory exhaustion.
- Local language models above about 4B parameters at 4-bit quantization thrashed on that machine (IL-10): size models to the memory, not to the CPU.

## Keyboards, Bluetooth and input sources

- macOS may not reconnect a dropped Bluetooth keyboard until a key is pressed. A LaunchAgent that checks every 15 s and tries twice brought one back in 13 s (IL-12). Prove such a watchdog by disconnecting the device on purpose.
- Bluetooth logs may be unreadable to a normal user; do not promise a diagnosis from them. AirDrop and Handoff share the 2.4 GHz band with Bluetooth and can interfere (IL-12).
- A watchdog check written as `cmd | grep -q` under `set -o pipefail` gives false negatives [HO-PIPE-01].
- A large input-source indicator flashing on screen comes from switching input sources: with two input methods for one language enabled, Caps Lock, Control-Space and Fn all switch between them (IL-11). Keep one; removing one can leave an orphan entry that `defaults read com.apple.HIToolbox AppleEnabledInputSources` shows.

Sources: man pmset, man ioreg, man sysctl. Apple Platform Security, FileVault: https://support.apple.com/guide/security/welcome/web
