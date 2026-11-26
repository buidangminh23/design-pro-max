#!/bin/sh
ssh build-host "cd ~/src/app && echo $(git rev-parse HEAD)"
