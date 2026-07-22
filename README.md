# Token Watch

A calm desktop dashboard for monitoring AI coding plan (Minimax) token usage.
Built with **Tauri 2 + React 19 + TypeScript**, with built-in auto-update via `tauri-plugin-updater` and minisign-signed GitHub Releases.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Local development

```bash
npm install
npm run tauri:dev
```

## Building

```bash
npm run tauri:build
```

The output DMG and `.app.tar.gz` (updater bundle) land in `src-tauri/target/release/bundle/`.

## Releasing

Releases are automated via GitHub Actions (`.github/workflows/release.yml`).

### One-time setup

Add the minisign private key and password as **repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | The full contents of `~/keys/token-watch.key` (a single line of base64) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password used when the key was generated |

Quick setup with the GitHub CLI:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/keys/token-watch.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD < ~/keys/token-watch.password
```

`GITHUB_TOKEN` is provided automatically by Actions.

### Cut a release

```bash
git tag v1.5.3
git push --tags
```

That's it. The workflow will:

1. Pull the version from the tag (everything after `v`)
2. Bump `package.json`, `Cargo.toml`, and `tauri.conf.json`
3. Pin the updater endpoint to the new release tag (so no CDN-cache surprises)
4. Build, sign, and upload the macOS DMG + updater bundle + signature
5. Generate `latest.json` using GitHub's **real** asset name (avoids the `%20` URL-encoding bug)
6. Smoke-test the full update chain end-to-end
7. Commit the version bump back to `main`
8. Leave the release as a **draft** so you can review notes & assets before publishing

Then in the GitHub UI, edit the release body (if you want custom notes) and click **Publish**.

### Why is the updater endpoint pinned to the release tag?

The official `releases/latest/download/latest.json` endpoint sits behind a stubborn CDN cache. v1.5.1 shipped a typo (`Token%20Watch.app.tar.gz`) and the cached manifest kept handing out the 404 URL for ~30 minutes, bricking the in-app updater for every user on that release. Pinning the endpoint to a fixed release tag eliminates the cache layer entirely.

> ⚠️ This is a manual handshake: every release must update `endpoints[0]` in `src-tauri/tauri.conf.json` to the new tag. The release workflow does this automatically.

### Manual fallback

If the workflow is broken for some reason, you can still publish by hand:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/keys/token-watch.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat ~/keys/token-watch.password)"
npm run tauri:build
# then create a release + upload the 4 assets (DMG, .app.tar.gz, .sig, latest.json)
# see the v1.5.1 commit for the curl recipe
```
