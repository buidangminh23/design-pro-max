#!/bin/sh
osascript -e 'do shell script "pmset -a disablesleep 1" with administrator privileges'
pmset -g | grep SleepDisabled
