# Deploying to a Samsung TV: the full story

This is exactly how Настин кинозал (Nastin Kinozal) was put on a 2017 Samsung UE50MU7000 (Tizen 3.0) from a Mac (Apple Silicon, macOS 27). The work was done with Claude Code, the AI coding agent, which drove the terminal. The guide records every step that worked, every step that failed and why, so you don't repeat the dead ends.

Short version: Samsung TVs accept apps only if they are signed with **your own Samsung certificate tied to the TV's ID**, and **only if the device profile that Samsung issues with that certificate is on the TV**. The second part is missing from most guides. Without it, every install fails with `install failed[118]`.

---

## 0. What you need

| | |
|---|---|
| TV | Samsung Tizen TV, 2016 or newer (tested: UE50MU7000, Tizen 3.0) |
| Computer | macOS, Linux or Windows on the same network as the TV |
| Account | a free Samsung account |
| Tools | Tizen CLI (`web-cli_Tizen_SDK_*`), `openssl` 3.x, Node.js 18+ |

## 1. Developer Mode on the TV

1. On the TV: **Apps**, then type `1 2 3 4 5` on the remote (on the Smart Remote, use the on-screen number pad).
2. Turn **Developer mode** on and enter your **computer's IP address**.
3. Restart the TV (hold Power until it reboots).

Check from the computer:

```sh
curl -s http://<tv-ip>:8001/api/v2/ | grep -o '"developerMode":"[01]","developerIP":"[^"]*"'
# "developerMode":"1","developerIP":"<your computer>"
nc -z <tv-ip> 26101 && echo "sdb port open"
```

## 2. Tizen CLI

Download `web-cli_Tizen_SDK_<version>_<os>.bin` from the Tizen site and run it. It installs into `~/tizen-studio`.

- **Apple Silicon:** the installer's bundled Java is Intel-only. It fails with `Bad CPU type in executable` until Rosetta is installed: `softwareupdate --install-rosetta --agree-to-license`.
- **Package repository:** the default repository URL (`usa.sdk-dl.tizen.org`) now returns 403. Point the package manager at the working server, then install the Samsung certificate tools:

```sh
sed -i '' 's#http://usa.sdk-dl.tizen.org/sdk/tizenstudio#https://download.tizen.org/sdk/tizenstudio#' ~/tizen-studio/.info/repository.info
~/tizen-studio/package-manager/package-manager-cli.bin install --accept-license Certificate-Manager,cert-add-on
```

## 3. Connect `sdb` (the network trap on macOS)

```sh
~/tizen-studio/tools/sdb connect <tv-ip>:26101
~/tizen-studio/tools/sdb devices        # <tv-ip>:26101  device  UE50MU7000
```

**macOS Local Network privacy.** Programs started from `tmux`, or by a tool that runs commands for you (such as an AI agent's shell), may get `EHOSTUNREACH` / "No route to host" even though `ping` and `curl` reach the TV. In that case:

- Run `sdb kill-server; sdb connect <tv-ip>:26101` **once from a normal Terminal window**. Allow "find devices on local network" if macOS asks.
- The `sdb` server keeps running in the background with Terminal's permission. Every later `sdb` command, from any shell, goes through it.
- A tool can open such a window itself: write the two commands into a `.command` file and run `open -a Terminal file.command`.

**Find the TV first: its address can change.** The router hands the TV its address, so after a restart it can come back on another one (2026-10-27: `192.168.1.175` → `.176`; `ping` and port 26101 at the old address simply stop answering). Rule (owner, 2026-10-27: «нужно предварительно сканировать сеть, потому что телевизор может оказаться по другому адресу»): **before every install or TV run, check the address and scan when it does not answer.** This is built in:

```sh
tools/find-tv.sh 192.168.1.175:26101   # prints the TV's ip:26101; scans the Mac's /24 network when the given one is silent
```

`./build.sh` and `tests/tv/launch.sh` call it on their own: they try `TV=` from `build.local.env` and, if the TV is not there, scan and use the address found (with a note to update `TV=`). If the TV moved, run the `sdb kill-server; sdb connect <new-ip>:26101` window once more. The TV's Developer Mode is bound to the Mac's address, not the TV's, so it keeps working after the TV moves.

## 4. Samsung certificates

### Why the official GUI was not used

The Tizen **Certificate Manager** is an old Eclipse application. On recent macOS it starts but never draws a window; its log shows `IllegalArgumentException: Argument cannot be null` while rendering. The certificates were therefore requested directly from Samsung's certificate service, doing the same calls the GUI makes.

### What the GUI does under the hood

The Samsung Certificate Extension (`org.tizen.common.cert_*.jar`) contains:

- the sign-in page: `https://account.samsung.com/mobile/account/check.do?serviceID=v285zxnl3h&actionID=StartOAuth2&accessToken=Y&redirect_uri=http://localhost:4794/signin/callback`
- the certificate service: `https://svdca.samsungqbe.com/apis/v1|v3/authors` and `…/distributors`
- Samsung's CA certificates: `res/ca/vd_tizen_dev_author_ca.cer` and `res/ca/vd_tizen_dev_public2.crt`

After you sign in, Samsung posts a JSON `code` (`access_token`, `userId`, `inputEmailID` …) to `localhost:4794`. A tiny local server must be listening there.

### The one-command way

```sh
~/tizen-studio/tools/sdb shell 0 getduid          # e.g. P7CDMCTY5WIXC
node tools/samsung-cert.mjs --duid <DUID> --name kinozal
```

The script:

1. prints the Samsung sign-in link and waits on `localhost:4794` (you sign in yourself; the script never sees your password);
2. creates two RSA keys and CSRs with `openssl`. The **distributor CSR carries the TV's DUID** in `subjectAltName = URI:URN:tizen:packageid=,URI:URN:tizen:deviceid=<DUID>`;
3. requests the **author** certificate (`POST /apis/v1/authors`: `access_token`, `user_id`, `platform=VD`, `csr`);
4. requests the **distributor** certificate (`POST /apis/v1/distributors`: also `privilege_level=Public`, `developer_type=Individual`). The answer is an XML **device profile**: `<Profile><Email>…<TestDevice>DUID</TestDevice><Certificate>…</Certificate><Signature>…`. The script saves the whole XML as `device-profile.xml` and extracts the certificate from it;
5. builds `author.p12` and `distributor.p12` with **`openssl pkcs12 -export -legacy`**. Each holds the certificate plus Samsung's CA certificate; the TV cannot read the newer PKCS#12 encryption;
6. registers a Tizen security profile (`tizen security-profiles add …`) and points the CLI at it (`tizen cli-config profiles.path=…`).

The certificates are valid for two years. Keep the keystore folder private: it holds your private keys.

### Mistakes made on the way (so you don't)

| Symptom | Cause |
|---|---|
| `401 Either userid or accesstoken is incorrect` | In zsh, `UID` is a read-only shell variable. Storing the Samsung user id in `$UID` silently sent the wrong id. Use another name. |
| No device profile from the v3 API | The `v3` distributor endpoint returns only a certificate. The `v1` endpoint returns the certificate *inside* the signed device profile, so one call gives both. The install succeeded with the v1 certificate plus its device profile. |
| `dev.tizen.samsung.com/apis/v2` | No connection from here (HTTP `000`); `svdca.samsungqbe.com` works. |

## 5. The device profile: the step most guides miss

Even with valid certificates, both this app and a minimal "Hello" test app failed:

```
app_id[...] install failed[118]
```

`118` is a generic install error. Here it meant the TV did not trust the distributor certificate, because **the TV had not been "permitted to install"**. In Tizen Studio, that is the Device Manager action *Permit to install applications*. It copies the signed device profile onto the TV. Do it by hand:

```sh
STAGE=/home/owner/share/tmp/sdk_tools
sdb -s <tv-ip>:26101 push <keystore>/device-profile.xml $STAGE/device-profile.xml
sdb -s <tv-ip>:26101 push package.wgt                   $STAGE/package.wgt
sdb -s <tv-ip>:26101 shell 0 vd_appinstall <AppId> $STAGE/package.wgt
# ... install completed
```

Two details matter:

- The package must be signed with **the distributor certificate from the same answer** as the device profile.
- Install from the staging directory with `vd_appinstall`. `tizen install` from the CLI does not push the profile.

## 6. Build and install (every update)

`build.local.env` (git-ignored, never commit it):

```sh
CERT_PROFILE=kinozal
DEVICE_PROFILE=/Users/<you>/tizen-studio-data/keystore/kinozal/device-profile.xml
TV=<tv-ip>:26101
# optional: build in the provider settings instead of typing them on the TV
OTT_KEY=...          # OTT Club subscriber key
PLAYLIST_URL=...     # or any M3U playlist URL
```

```sh
./build.sh
```

`build.sh` does the following:
1. copies the app into `.buildResult`;
2. fills in the provider settings;
3. packages and signs with `tizen package -t wgt -s $CERT_PROFILE`;
4. pushes the device profile and the package;
5. installs with `vd_appinstall`;
6. starts the app with `was_execute`.

## 7. Seeing inside the app on the TV

Your own signed app can run in debug mode, which a store app cannot:

```sh
sdb -s <tv-ip>:26101 shell 0 debug <AppId> 300   # "... launched pid = N with debug 1 port: 37836"
sdb -s <tv-ip>:26101 forward tcp:37836 tcp:37836
curl -s http://127.0.0.1:37836/json              # webSocketDebuggerUrl
```

Connect any Chrome DevTools Protocol client to that WebSocket. `Runtime.evaluate` reads the live state, for example `webapis.avplay.getState()` and `getCurrentStreamInfo()`. Synthetic `keydown` events act as the remote. This is how playback on the TV was verified: hardware H.264 1920×1080 in `PLAYING`, with the clock advancing.

The app also keeps its last 40 playback failures in `localStorage.failLog`, so a "no signal" notice can be explained afterwards.

## 8. Other useful commands

```sh
sdb shell 0 applist                    # installed apps
sdb shell 0 vd_applist                 # details: version, install date, size
sdb shell 0 was_execute <AppId>        # start an app
curl http://<tv-ip>:8001/api/v2/applications/<AppId>   # running / visible
```
