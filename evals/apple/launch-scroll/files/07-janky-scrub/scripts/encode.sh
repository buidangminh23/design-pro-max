#!/bin/sh
ffmpeg -y -i master.mov -c:v libx264 -crf 18 -preset slow -c:a aac public/film.mp4
