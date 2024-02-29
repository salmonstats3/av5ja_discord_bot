AUTHOR := $(shell cat package.json | jq -r '.author')
VERSION := $(shell cat package.json | jq -r '.version')
NAME := $(shell cat package.json | jq -r '.name')
DATE := $(shell date '+%Y%m%d')

include .env

PHONY: build
build:
	docker buildx build --push --no-cache --platform linux/amd64,linux/arm64 -t ${AUTHOR}/${NAME}:${DATE} -t ${AUTHOR}/${NAME}:latest .

PHONY: up
up:
	docker compose up --build --force-recreate