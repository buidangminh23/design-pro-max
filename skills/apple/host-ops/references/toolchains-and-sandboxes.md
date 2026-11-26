# Simulator, Xcode tools and agent sandboxes

## Contents

- Failures that come from the sandbox
- Simulator runtimes
- Stuck simulator processes
- Disk usage under CoreDevice
- Screen automation limits

## Failures that come from the sandbox

Some Apple build steps fail only inside an agent's per-command sandbox and pass outside it (IL-28):

- App Intents metadata processing (an "Exception during writing compiled data" error);
- `xcrun simctl` ("CoreSimulatorService connection became invalid", IL-24);
- tests that bind local ports, package-manager store locks;
- `xcodebuild` writing its own cache.

Before changing code, run the step once outside the sandbox with the user's approval and compare the output. Run one heavy build or simulator task at a time. Never leave the sandbox on your own; ask, or give the user the command.

## Simulator runtimes

- Install a runtime with `xcodebuild -downloadPlatform iOS`; it needs no `sudo` (IL-24). Apple documents it in Downloading and installing additional Xcode components.
- On a metered connection, such as a phone hotspot, the system download scheduler can hold the download at 0 bytes (IL-24). Read its decisions with `/usr/bin/log show --predicate 'process == "dasd"' --last 1h`: in zsh, `log` alone is a builtin [HO-WARN-LOG].
- A runtime newer than the installed Xcode's SDK can read as not installed; match the runtime to the Xcode that uses it.

## Stuck simulator processes

After the Simulator shuts down, runtime processes can linger and make `xcrun simctl shutdown all` hang; about 105 of them once held the load at 84-128 (IL-25). Find them with `pgrep -fl launchd_sim`, stop `launchd_sim` first, then run `simctl shutdown all`. Show the user the processes before stopping any.

CoreSimulator is shared by every Xcode on the Mac, so running `xcodebuild -runFirstLaunch` from an older Xcode can break runtimes a newer one installed (IL-25). Run first-launch setup from the Xcode you build with.

## Disk usage under CoreDevice

`du` counts a virtual device mount under the CoreDevice folder as if it were files on disk. Use `du -shx` to stay on one file system (IL-25). Freeing space is the `xcode-disk-cleanup` row of the router.

## Screen automation limits

Screen-automation tools can miss Notification Center widgets and cannot click menu bar apps that have no Dock icon (IL-28). Check a widget by reading its snapshot (`../../menubar-widgets/PART.md`) or by asking the user to look, not by clicking.

Sources: Downloading and installing additional Xcode components: https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components. man simctl is printed by `xcrun simctl help`.
