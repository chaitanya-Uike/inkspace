.PHONY: live live/templ live/server live/tailwind live/esbuild live/sync_assets build clean

# run templ in watch mode with a proxy in front of your server
live/templ:
	templ generate --watch --proxy="http://localhost:8080" --open-browser=false -v

# run air to watch .go files, rebuild and restart the server
live/server:
	go run github.com/air-verse/air@latest \
	--build.cmd "go build -o tmp/bin/main ./cmd/server" \
	--build.bin "tmp/bin/main" \
	--build.delay "100" \
	--build.exclude_dir "node_modules" \
	--build.include_ext "go" \
	--build.stop_on_error "false" \
	--misc.clean_on_exit true

# watch tailwind
live/tailwind:
	npx --yes tailwindcss -i ./assets/css/input.css -o ./static/css/output.css --watch

# watch typescript with esbuild
live/esbuild:
	npx --yes esbuild assets/src/app.ts --bundle --outdir=static/js/ --watch

# when assets change, notify the templ proxy to reload the browser
live/sync_assets:
	go run github.com/air-verse/air@latest \
	--build.cmd "templ generate --notify-proxy" \
	--build.bin "/usr/bin/true" \
	--build.delay "100" \
	--build.exclude_dir "" \
	--build.include_dir "static" \
	--build.include_ext "js,css"

# start everything
live:
	make -j5 live/templ live/server live/tailwind live/esbuild live/sync_assets

# production build
build:
	templ generate
	npx tailwindcss -i ./assets/css/input.css -o ./static/css/output.css --minify
	npx esbuild static/js/app.ts --bundle --outdir=static/js/
	go build -o bin/server ./cmd/server

clean:
	rm -rf bin tmp static/js/app.js static/css/output.css views/*_templ.go
