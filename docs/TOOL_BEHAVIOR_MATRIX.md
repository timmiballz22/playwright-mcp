# Original tool behavior review index

Pinned stable1.64.1 extended Chromium discovery defines72 tools. This index maps
source fixture touchpoints; a source call is not itself a PASS or a coverage
percentage. Consult execution evidence for the exact commit, engine and OS.
Latest completed native82 atbbf4764 reports normal original156 per platform,
Docker2 and Mac modal3 passes, with three legacy Windows failures. These results
do not include subsequent media/frame tests. Native83 at e95f029 is pending.
New local frame regression fails Firefox color fidelity; diagnostics identify
missing VP9 color matrix metadata, not a shipped fix. See native83-video-proof.json.

Archived native76 checkpoint:

Latest completed native76 (9591621) reports462 original passes/two legacy Windows
failures. Normal Linux/Windows/Mac suites152 each, Docker2 and Mac modal3 pass;
legacy Windows1/2 fails raw input (including an unacknowledged delivered click).
All12 profile and12 routing-negative cases pass;72 schemas remain checked.
This healthy Mac capture sample does not causally fix older failures. Parameter/
negative/interactive acceptance remains incomplete. Companion API cancellation
proof does not change the original endpoint's expert trust model.

Interactive annotation/debugger-resume flows remain open. Other rows still need
full negative/parameter/native review; export overwrite
permissions/Windows ACLs, route alternatives and video frame content are examples.
The original trusted-code/evaluate tools retain their documented expert trust.
Companion workflows expose no code/file/network-policy injection fields.

| Tool | Fixture source touchpoints | Review state |
|---|---|---|
| browser_close | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [advanced.spec.ts](../tests/advanced.spec.ts), [devtools.spec.ts](../tests/devtools.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts), [input-parity.spec.ts](../tests/input-parity.spec.ts), [interactions.spec.ts](../tests/interactions.spec.ts), [large-dom.spec.ts](../tests/large-dom.spec.ts), [network-console.spec.ts](../tests/network-console.spec.ts), [network-routing.spec.ts](../tests/network-routing.spec.ts), [popup.spec.ts](../tests/popup.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts), [storage.spec.ts](../tests/storage.spec.ts), [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts), [media.spec.ts](../tests/media.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_resize | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_get_config | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_console_messages | [network-console.spec.ts](../tests/network-console.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_list | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_get | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_set | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_delete | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_clear | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_resume | [devtools.spec.ts](../tests/devtools.spec.ts) | Malformed-location negative passes native2d8fe7f host suites; successful interactive lifecycle pending |
| browser_highlight | [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_hide_highlight | [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_annotate | No automated behavior fixture | Interactive acceptance pending |
| browser_handle_dialog | [interactions.spec.ts](../tests/interactions.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_emulate_media | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_evaluate | [input-parity.spec.ts](../tests/input-parity.spec.ts), [network-routing.spec.ts](../tests/network-routing.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_file_upload | [interactions.spec.ts](../tests/interactions.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_drop | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_find | [large-dom.spec.ts](../tests/large-dom.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_fill_form | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_press_key | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_type | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_mouse_move_xy | [held-input.spec.ts](../tests/held-input.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_mouse_click_xy | [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_mouse_drag_xy | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_mouse_down | [held-input.spec.ts](../tests/held-input.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_mouse_up | [held-input.spec.ts](../tests/held-input.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_mouse_wheel | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_navigate | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [advanced.spec.ts](../tests/advanced.spec.ts), [click.spec.ts](../tests/click.spec.ts), [core.spec.ts](../tests/core.spec.ts), [devtools.spec.ts](../tests/devtools.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts), [input-parity.spec.ts](../tests/input-parity.spec.ts), [interactions.spec.ts](../tests/interactions.spec.ts), [large-dom.spec.ts](../tests/large-dom.spec.ts), [network-console.spec.ts](../tests/network-console.spec.ts), [network-routing.spec.ts](../tests/network-routing.spec.ts), [popup.spec.ts](../tests/popup.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts), [storage.spec.ts](../tests/storage.spec.ts), [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_navigate_back | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_network_requests | [network-console.spec.ts](../tests/network-console.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_network_request | [network-console.spec.ts](../tests/network-console.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_network_state_set | [network-routing.spec.ts](../tests/network-routing.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_pdf_save | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_start_recording | [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_stop_recording | [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_route | [network-routing.spec.ts](../tests/network-routing.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_route_list | [network-routing.spec.ts](../tests/network-routing.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_unroute | [network-routing.spec.ts](../tests/network-routing.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_run_code_unsafe | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [advanced.spec.ts](../tests/advanced.spec.ts), [media.spec.ts](../tests/media.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_take_screenshot | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [advanced.spec.ts](../tests/advanced.spec.ts), [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_snapshot | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [devtools.spec.ts](../tests/devtools.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts), [input-parity.spec.ts](../tests/input-parity.spec.ts), [interactions.spec.ts](../tests/interactions.spec.ts), [large-dom.spec.ts](../tests/large-dom.spec.ts), [popup.spec.ts](../tests/popup.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_click | [advanced.spec.ts](../tests/advanced.spec.ts), [click.spec.ts](../tests/click.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts), [interactions.spec.ts](../tests/interactions.spec.ts), [large-dom.spec.ts](../tests/large-dom.spec.ts), [popup.spec.ts](../tests/popup.spec.ts), [media.spec.ts](../tests/media.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_drag | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_hover | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_select_option | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_generate_locator | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_storage_state | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_set_storage_state | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_tabs | [advanced.spec.ts](../tests/advanced.spec.ts), [popup.spec.ts](../tests/popup.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_start_tracing | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_stop_tracing | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_verify_element_visible | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_verify_text_visible | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_verify_list_visible | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_verify_value | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_start_video | [advanced.spec.ts](../tests/advanced.spec.ts), [video-playback.spec.ts](../tests/video-playback.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_stop_video | [advanced.spec.ts](../tests/advanced.spec.ts), [video-playback.spec.ts](../tests/video-playback.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_video_chapter | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_video_show_actions | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_video_hide_actions | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_wait_for | [input-parity.spec.ts](../tests/input-parity.spec.ts), [network-console.spec.ts](../tests/network-console.spec.ts), [media.spec.ts](../tests/media.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_list | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_get | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_set | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_delete | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_clear | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_list | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_get | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_set | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_delete | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_clear | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |


Slider fixture: local Chromium/Firefox each verify value7 and its real input event,
then invalid text returns a tool error after HTML range sanitization changes the
value to5. This is non-atomic original behavior, not a safe-retry signal. Pinned
core sets input.value before comparing the sanitized value and throwing Malformed
value. No upstream implementation is changed. Initial incorrect state-preservation
expectation failed2/2; corrected contract passes2/2. Native WebKit/host evidence
remains pending. See original-slider-nonatomic-before.txt/original-slider-local.txt.

Malformed browser_resume source locations return an explicit error and preserve
a usable session: local Chromium/Firefox2/2. This negative call does not prove
step/resume/breakpoint behavior or close the interactive acceptance gate.
Evidence: original-resume-negative-local.txt.

Native2d8fe7f original suites pass144/144 each on Linux, macOS Intel and Windows,
including slider valid/event/invalid partial-mutation behavior and malformed
resume-location rejection with a usable session afterward. The companion/native
Codex attempt has two client failures and an unreported cancelled macOS batch job; this is scoped original-tool evidence,
not a full green matrix or successful interactive debugger/annotation proof.


## Interactive annotation acceptance: NOT TESTED

Pinned playwright-core1.64.1 implements browser_annotate under the devtools
capability. Source review (evidence/annotation-source-review.json, bundle SHA256
included) shows it starts a detached dashboard process, then an annotation client,
and waits for human input. The abort listener kills that client; this review does
not establish dashboard shutdown or a successful screenshot/ARIA/annotation result.
No annotation call was made in this headless audit. The tool is preserved through
upstream delegation and schema discovery; its interactive acceptance remains open.

Operator procedure on a supported graphical desktop:

1. Launch this fork's original stdio endpoint with --caps=devtools and a dedicated
   isolated session. Navigate to a static page owned by the operator.
2. Invoke browser_annotate, draw a box over a known visible fixture element, add
   a fixed test label and submit. Verify the returned annotated image, matching
   ARIA element and annotation coordinates/label. Record exact engine/OS/SHA.
3. Repeat with explicit cancellation and confirm later browser_snapshot remains
   usable, without treating cancellation as a submitted annotation.
4. Close the browser/client and independently inspect the captured launcher and
   dashboard process identities. Record any surviving owned dashboard rather
   than declaring cleanup based solely on the annotation client's exit.

This procedure is not an executed PASS. The companion batch/jobs endpoints do not
expose annotation or desktop dashboard startup. The default original core tool set
omits the devtools capability; optional tool invocation retains upstream behavior.

Local post543c14f slider boundary/step fixture passes Chromium and Firefox via
actual MCP: exact min/max values succeed; below/above bounds and step mismatch
return errors after range sanitization changes the DOM, before input events.
A later valid value emits one event. This does not make failed fills atomic or
replay-safe. See original-slider-bounds-local.txt. Native68 at4f50caa verifies all12 variants
across Chrome/Chromium/Firefox/WebKit on Linux/macOS/Windows; the separate
Windows named-tab case fails, so whole original acceptance remains failed.

Latest slider bounds/step contract: tests/input-parity.spec.ts now checks lower/upper
clamping and step sanitization, including mutation before tool error and no replay.
All12 executions (four engine projects on three hosts) pass in native68 and native70.
This closes that specific parameter gap; interactive annotation/resume and the
remaining per-tool negatives stay open. See worker-ci-seventieth-wrapper evidence.

Uncommitted follow-up after native71 source6847985: malformed route headers
(missing colon and missing name) each return an error while preserving the prior
route list. Removing an unknown pattern removes zero routes. A real fetch still
returns exactly the existing202/mock body with zero server hits. Local Chromium
and Firefox pass2/2 with final exact assertions; the broader pre-refinement
routing run passes4/4. Lint passes. Native/WebKit evidence pending; no upstream
implementation or security policy changed. Evidence: original-route-negative-*.

Native72 closes the scoped routing-negative verification above: all12 executions
pass on four engine projects across three OSs. Other route parameters and the
remaining per-tool negative/operator gaps stay open. See native72-route-negative-tests.json.

Pending profile contract extension reuses browser_cookie_clear,
browser_localstorage_clear and browser_sessionstorage_clear in an opt-in profile,
then restarts it and verifies a sibling profile's persisted values remain intact.
Local Chromium/Firefox2/2 pass within the unchanged90s test limit; other projects/
native evidence is pending. This covers logical state for the fixture origin,
not full filesystem profile erasure or stale ownership recovery.

Local original dynamic DOM acceptance now covers nested open shadow snapshot refs
and Unicode activation, plus a400-logical/20-rendered-row fixture with actual
wheel materialization and stale-ref no-duplicate check. Chromium/Firefox4 each
Node20/22/24 pass; source/runtime defaults remain intact. This does not cover
closed roots, asynchronous infinite loading or native/WebKit variants. Initial
fixture quoting/tool-name/charset failures are retained in native84-dynamic-proof.json.
