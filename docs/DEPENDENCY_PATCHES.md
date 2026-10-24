# Private Playwright reliability patches

## Reviewed9f975: native96 remains incomplete

Core9f975 is the current reviewed implementation. Native96 cc9562b confirms
the ordered-window change is insufficient:117 JPEG headers include16 at320×98
across main/fresh Chromium streams; gray frame zero remains failed. Source
Mac capture-unavailable errors do not recur in this sample, without proof a
native retry fired or a broad recovery guarantee.

A later unshipped146 headless-window experiment fails local first-JPEG geometry
(320×180 against320×240 requested/metadata). Its attempted display-free headed
calibration actually remained headless and provides no headed-GUI verification.
Repeated explicit-flag and direct visible-size controls also yield mixed first
frames. These alternatives are rejected, never pushed; clean npm installation
restores9f975. No new warmup, seek/skip, capture-backend/encoder replacement,
default channel/transport change or deadline increase is retained. Original
first-frame assertions remain strict.
[Rejected experiments](evidence/native97-rejected-browser-experiments.json).

The historical native95 and local source-order evidence follows. Its controlled
positive does not establish an unforced macOS clipping fix.

Native95 original workflow39837569201 atfdd83e0 completes600/8, including its
separate fresh/legacy controls. Mac main196/4 includes two capture-unavailable
errors, Chromium gray frame zero and Firefox trusted-click interruption after58
confirmed clicks. The input observer measures118 real JPEG headers:102 at320×240
and16 at320×98 across two short streams. Both short blocks are adjacent to
Chromium source/failure receipts (main and fresh control); receipts did not yet
carry project fields, so raw adjacency is retained explicitly. Encoder gray
padding explains y100/y239 outside98-high input. Browser and independent ffmpeg
frame zero agree there. Actual window bounds/viewport-update cause are not
measured by these receipts.

The current local patch retains the reviewed VP9 flags and adds:

- One retry of Chromium's exact real capture-unavailable ProtocolError for
  Page.captureScreenshot, with identical capture arguments and original progress
  deadline. An abort check precedes retry. Persistent unavailability fails after
  two attempts; other errors, real closed targets and timeouts are not retried.
- Completion of the existing Browser.setWindowBounds request before sending
  Emulation.setDeviceMetricsOverride. The old concurrent requests can overlap,
  demonstrated on a real full Chromium with a trusted100ms delayed bounds-promise
  resolution. This sequencing targets the observed short surface; native macOS
  geometry/cause/fix remains pending. No additional protocol request is introduced.

There is no sleep/warmup in product code, frame skip/seek, changed recording
arguments, input replay, new model option, default channel/transport change or
raised action/RPC/test/job limit. The ordering test's scheduling delay is test-only.
The actual strict screenshot/video assertions remain unchanged.

Checked-in actual-engine Node tests pass on20/22/24: one viewport-order case plus
six capture conditions each (18 screenshot conditions total). Controlled error
injection follows successful owned PNG captures and uses a real ProtocolError;
it proves selection/bounds, not the native error's cause or native recovery.
Original video and stock PNG/PCM cases pass6/6 locally on Chromium/Firefox.
Fresh production installation/smokes pass on Node22 with the final9f975 core and
unchanged source hashes during verification. Native95 uses metadata-only3eb. Native96 tests9f975 and still fails gray recording; neither run proves the original clipping cause is fixed.

Prepared source identities:

- Registry829: `829521b67ed7be90c7d6d6098ff39f2241562d47e4ad7ccab13710924a56001d`.
- Reviewed metadata-only3eb: `3eb68a089871529d6dccd723546bc87e20299047e140d382dc5fe380b1350192`.
- Earlier local capture-only2e36: `2e36b79ec8f27082edc4bb688abc800cfbc351d5c5c3c9a2320629939cc29686`.
- Current9f975: `9f9750ae24604e2099e1c1f6564d5d6cb3d19d30dfbc8b5ec61ba18c0989e25a`.

Only these exact bytes are accepted: registry/3eb/2e36 migrate to9f975; current
9f975 validates without rewrite. Matrix-onlyB46 and unknown bytes remain rejected.
The clean-checkout final proof installs exact registry bytes with scripts disabled,
prepares9f975, verifies unchanged inode/mtime on repeat and rejects deliberately
altered dependency bytes without rewriting. Main2e36→9f975 migration also passes.
No runtime source clone is packaged. The script's historical filename and fixed
metadata receipt component remain stable; its SHA identifies the full patch.

These are private fork patches, not an upstream release or a proven native gray
fix. The original encoder metadata evidence below is historical. Windows media,
cleanup uncertainty and old birth gaps remain separate acceptance gates.

## Independent local visible-surface control during native96

Actual full Chromium on Linux, separate fresh owned fixtures, same prepared
encoder9f975 and six clicks per case. Public CDP deliberately controls window
and visible-size metrics before recording; every decode samples frame zero.

| Control | Window height | DOM/visual height | First JPEG height | Frame-zero RGB at100,100 |
| --- | ---: | ---: | ---: | --- |
| Normal |240|240|240|253,0,0|
| Deliberately short surface |185|240|98|128,128,128|
| Same window, restored visible-size metrics |185|240|240|253,0,0|

The319,239 samples agree. This reproduces the short-surface padding mechanism
and a metrics intervention without changing the encoder, skipping/seeking frames
or changing original tests. It does not establish macOS's initial window cause,
native recovery or reliability of the source-order fix.
[Complete actual comparison](evidence/native96-visible-surface-comparison.json).

A further real-CDP control delays actual window dispatch100ms: concurrent setup
produces a153-high JPEG/gray encoded tail; ordered setup produces240-high/red.
The stronger checked-in viewport regression now checks the actual first JPEG
before any screenshot. It fails on an unmodified old3eb checkout with153-high
input, and passes on9f975 across Node20/22/24 with240-high input. This version
postdates active native96; product code is unchanged. Controlled scheduling
proves this intervention, not the unforced native macOS initial-window cause.
[Old API baseline](evidence/native96-first-input-order-baseline-proof.json),
[fixed first inputs](evidence/native96-first-input-order-fixed-proof.json).

## Earlier metadata-only evidence

Native88 original workflow39788239509 at702b616 verifies the actual Mac WebKit
producer now passes the unchanged320×240 decoded-red threshold and six-click
recording case. Exact successful pixel values are not logged. Eleven of twelve
native original recording cases pass; Windows WebKit still fails readiness after
two206 responses. WAV also remains unready after one206. This narrows the native
primaries fix's claim; byte ranges alone did not repair Windows media playback.
Docker prepared3eb hash and two endpoint cases pass. Overall original550/7 with
other input/lifecycle failures; batch still active at this evidence checkpoint.
See evidence/native88-original-checkpoint-proof.json and complete job logs.

This private source candidate keeps Playwright/core1.64.1 and SDK1.32.1. It adds
`-color_primaries bt709` alongside the reviewed `-colorspace smpte170m` matrix tag.
Native87 Mac WebKit metadata-only controls change red248/37/0 to255/2/0 with
unchanged encoded-stream hashes. Primaries alone is sufficient in that control;
transfer709/sRGB variants produce the same sample, so transfer stays unchanged.
The actual encoder addition now has local regression and native88 Mac WebKit
source verification for the controlled frame. Existing failures and acceptance gates stay open. Original tool APIs, browser revisions, flags,
timeouts and workflow permissions otherwise retain their pinned behavior.
This is a fork patch, not an upstream release or permission to publish under
Microsoft's registry identities. Upstream licenses/notices remain included.

The source module is `packages/playwright-core/src/server/videoRecorder.ts` at
Playwright v1.64.1. The corresponding installed `lib/coreBundle.js` hashes are:

- Registry source: `829521b67ed7be90c7d6d6098ff39f2241562d47e4ad7ccab13710924a56001d`.
- Earlier metadata-only prepared source: `3eb68a089871529d6dccd723546bc87e20299047e140d382dc5fe380b1350192`.

The earlier matrix-only source was `b46a37ecb04912c639ffd32f890269ea33a612dfdcb43f518bac76b85cc0fa9f`.
The current candidate additionally accepts exact reviewed3eb and local2e36 bytes for migration. Use a clean
`npm ci` when upgrading an existing matrix-only checkout; unknown/old prepared
bytes are not silently modified. Browser APIs, encoded workflow permissions and
existing timeouts remain unchanged.

`npm ci` runs the deterministic prepare script after installing the pinned
registry dependencies. It accepts only the exact registry, reviewed3eb/local2e36 or current9f975 bytes,
checks the dependency stays inside this checkout's physical node_modules, and
refuses unreviewed versions, shared/link targets and incomplete private output.
It makes one atomic replacement of its own installed source file. A repeated
prepare validates the prepared hash without rewriting it. Receipts use stderr;
`npm pack --json` stdout remains machine-readable.

The tarball uses npm's bundled dependencies for Playwright and core, so both
resolve the same prepared core inside this fork. A production tarball install
with `--omit=dev --ignore-scripts` needs no patch execution. Installed-package
verification checks that module provenance/hash before exercising real endpoints.
Browser downloads remain separate. The combined local dry pack contains297 files,
4,525,569 compressed bytes and20,115,348 unpacked bytes. The earlier unbundled
119-file media checkpoint was434,950/1,376,883 bytes; these are different source
checkpoints, not an isolated size benchmark. This increases the payload to carry
its own runtime pair; it avoids relying on a consumer's shared core installation.

For a source checkout installed with scripts disabled, run `npm run prepare`
explicitly before tests or packaging. The former matrix-only prepared hash
`b46a37ecb04912c639ffd32f890269ea33a612dfdcb43f518bac76b85cc0fa9f`
is deliberately rejected by this candidate. Update a source checkout with a clean
`npm ci`, which restores the pinned registry bytes and prepares the new flags.
Do not edit vendor bytes manually or treat the older prepared hash as current.
On an upstream upgrade, review/rebase the
small source change and establish new exact hashes with full regression evidence;
unknown bytes fail preparation. Preserve any incomplete private output for review
instead of treating a failed preparation as success.

The patch addresses the reproduced matrix-tag color shift. It does not establish
that macOS gray first frames, Windows WebKit media readiness, native deadlines,
historical ownership uncertainty or every video codec works. Those remain
separate acceptance gates and retain their failing evidence.

Docker dependency layers bind the prepare script during both npm installs. The
image verifier resolves core from the actual `/app/cli.js`, checks its hash and
uses only the locally built image. Native image/browser checks remain required.

A caller-supplied BrowserContext or remote Playwright server keeps the host's
encoder implementation. The fork does not modify that host's dependencies. Basic
contextGetter interoperability is tested with a separate unmodified host module;
this patch's fidelity claims concern encoding owned by the prepared runtime.

Pinned upstream playback tests explicitly exclude WebKit/Windows WebM as
“not supported” and mark Windows WebKit audio playback as a known issue (and
“audio does not play at all” in the autoplay test). Its general video test also
notes a Windows Server Media Pack problem on hosted runners. Source:
[capabilities.spec.ts at v1.64.1](https://github.com/microsoft/playwright/blob/v1.64.1/tests/library/capabilities.spec.ts#L69).
This explains the upstream support scope, not the exact mechanism of our WAV
ready0/network2/error0 sample or every Windows host/codec. This fork retains its
strict playback failures; no skip, xfail or assertion/deadline change follows.
The earlier Mac WebKit color failure has a controlled native88 producer pass above; this does not generalize to Windows playback or gray frames.
Exact source blob and scope: evidence/native86-upstream-webkit-media-proof.json.

Metadata-copy diagnostics use an optional external ffmpeg tool, not a product
runtime dependency or fix. CI can install it on macOS within a separate5m step
budget; the existing30m job and all test/action limits remain unchanged. Optional
setup failure is retained without hiding original browser tests. Copies never
replace the original recording or its strict decoded-pixel result. Native86 had
no stock ffmpeg; its empty controls prove no metadata hypothesis. Local gate fix
requires an actual failed result because successful tool replies echo source.

Local follow-up excluded from native88 adds an explicit Docker context allowlist:
the existing12 root inputs (including Dockerfile), the ignore file, the prepare
script and two profile modules are the only files sent to the builder (16 total).
A network-disabled scratch COPY/export verifies every included byte matches source;
93,192 exported file bytes at that checkpoint. Git history, installed dependencies,
QA evidence, tests and arbitrary local files are excluded. This does not validate
a production image or change the Dockerfile's installs, entrypoint or default
browser. Native product Docker/hash/browser verification is still required.
See evidence/native88-docker-context-proof.json and actual BuildKit log.

Native90 retains a separate Mac Chromium gray-frame failure: source PNG red, first
browser-decoded sample128/128/128/255; all three metadata copies retain gray with
identical encoded streams. The primaries fix still passes Mac WebKit. No gray-frame
producer fix is established. Local follow-up logs five points from the source PNG
and same first browser canvas plus an independent ffmpeg frame-zero decode, sharing
the original5s diagnostic budget. Strict pixel/readiness/counter assertions remain.
An eligible actual Mac Chromium mismatch can trigger three fresh isolated controls
with separate nested outputs; source echo cannot trigger them. Local calibration
passes and original files retain bytes/inodes/mtime. Native91/92 actual-gray gates
are ineligible; independent decoder measurements remain unexecuted.
See native90-independent-frame-proof.json; no header/capture patch follows yet.

## Native97 capture-readiness limit

Three stronger first-JPEG tests fail despite correct request ordering; original Mac recording passes this sample. The public portable reproducer still returns seven short inputs in eight cases. See [the scoped reproduction](evidence/native97-chromium-capture-repro.md). Core9f975 is unchanged. No additional browser patch or general capture-fidelity claim follows.

## Native98 capture evidence

The original Mac Chrome stream has eight320×98 JPEG inputs, with source-red pixels independently decoded as gray padding in frame zero. Two strict first-JPEG cases also fail. Core9f975 is unchanged. Matching Chrome controls are added prospectively; no renderer warmup, frame discard or encoder rewrite is shipped. See [native98 video proof](evidence/native98-video-input-native-proof.json).
