#!/bin/sh
if pmset -g | grep -q 'sleep  *0'; then echo 'sleep is off'; fi
