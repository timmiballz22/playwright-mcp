# Private Playwright encoder patch

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
- Candidate prepared source: `3eb68a089871529d6dccd723546bc87e20299047e140d382dc5fe380b1350192`.

The earlier matrix-only source was `b46a37ecb04912c639ffd32f890269ea33a612dfdcb43f518bac76b85cc0fa9f`.
This candidate accepts only exact registry or candidate bytes. Use a clean
`npm ci` when upgrading an existing matrix-only checkout; unknown/old prepared
bytes are not silently modified. Browser APIs, encoded workflow permissions and
existing timeouts remain unchanged.

`npm ci` runs the deterministic prepare script after installing the pinned
registry dependencies. It accepts only the exact original or prepared bytes,
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
Mac WebKit decoded-color fidelity remains a separate failure under investigation.
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
