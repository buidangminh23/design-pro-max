#!/bin/zsh
export $(grep -v '^#' .env | xargs)
npm run deploy
