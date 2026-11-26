-- tell application appName would not load the dictionary
set appName to "Notes"
if appName is not in {"Notes", "Reminders"} then error "unexpected app"
tell application "Notes"
	make new note with properties {name:"Build report"}
end tell
using terms from application "Notes"
	tell application appName
		count notes
	end tell
end using terms from
