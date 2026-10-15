# Run, build and use Quest

## Local development

Install Node.js 24–26, then clone the repository and install its pinned dependencies:

```sh
git clone https://github.com/Abhinashroy/discovery-rooms-vr.git
cd discovery-rooms-vr
npm ci
npm run dev
```

Open the printed URL, usually <http://127.0.0.1:5173/>. Ports advance if occupied. Refresh an old tab with Ctrl+Shift+R and stop the server with Ctrl+C.

## Production output

```sh
npm run format:check
npm test
npm run build
npm run preview
```

The eight-entry build writes `dist/`. Preview usually runs at <http://127.0.0.1:4173/>. The static output includes the selector, three current rooms, four retained legacy routes and local map/texture/audio/vendor assets.

Host the **contents of `dist/`** on a static HTTPS service. Preserve `audio/`, `planetarium/`, `earth-explorer/`, `vendor/` and `assets/` together. Do not upload source credentials, `.env`, learner records, backups or downloaded USB tools. The current rooms require no AI provider.

GitHub Actions builds on push and pull requests. Its `discovery-rooms-dist` artifact contains the static output. The workflow does not publish a website automatically. The earlier separately hosted prototype is not updated by pushing this repository; its local checkout/hosting metadata is excluded from Git.

## Quest 3 over USB

Use either a trusted HTTPS deployment or USB-forwarded localhost. A PC browser preview is not a headset test. Enter VR enables only when the browser reports immersive support.

1. Enable the headset's developer/debugging setup and authorize the computer when prompted.
2. Install Android platform-tools from [Google's official download](https://developer.android.com/tools/releases/platform-tools). Add `adb` to PATH, or use the full path to `adb.exe`.
3. Start `npm run preview` and note its actual port.
4. In a second terminal, run:

```sh
adb devices
adb reverse tcp:4173 tcp:4173
adb reverse --list
```

Continue only when `adb devices` reports an authorized device. Replace both port numbers if preview selected another port. In Quest Browser, open `http://localhost:4173/` using that port. Keep the server and cable connected.

On the original development computer, the ignored local copy of platform-tools can also be invoked as `.\tools\quest-setup\platform-tools\adb.exe`; it is not included in a fresh clone.

### Controller controls

- Classroom/Planetarium: left stick walks, right stick snap-turns, triggers select and B/Y toggles controls.
- Earth: left stick takes short faded steps, right stick snap-turns, left trigger on Earth teleports, right trigger opens country information and B/Y toggles controls. Paginated destinations support seated/stationary play.
- Main room ends the run. Enter VR again if needed after changing rooms.

Follow [the headset checklist](headset-smoke-check.md) and record readability, comfort and actual frame stability. Existing desktop checks are not a hardware pass.

Remove forwarding when finished:

```sh
adb reverse --remove tcp:4173
```

## Optional legacy tutor

The current three rooms use authored local content and grading. Legacy tutor middleware is disabled unless configured. If working on that earlier feature, copy `.env.example` to `.env` and set the key/model locally. Never put a key in frontend files, screenshots, logs or source control. A static build does not provide a protected AI server endpoint.
