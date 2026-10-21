# Original tool behavior review index

Pinned stable1.64.1 extended Chromium discovery defines72 tools. This index maps
source fixture touchpoints; a source call is not itself a PASS or a coverage
percentage. Consult execution evidence for the exact commit, engine and OS.
New fixture additions have local Chromium/Firefox evidence and await native
confirmation. All72 versioned schemas remain checked by capabilities.spec.ts.

Interactive annotation/debugger-resume flows remain open. Other rows still need
full negative/parameter/native review; slider bounds/steps, export overwrite
permissions/Windows ACLs, route alternatives and video frame content are examples.
The original trusted-code/evaluate tools retain their documented expert trust.
Companion workflows expose no code/file/network-policy injection fields.

| Tool | Fixture source touchpoints | Review state |
|---|---|---|
| browser_close | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [advanced.spec.ts](../tests/advanced.spec.ts), [devtools.spec.ts](../tests/devtools.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts), [input-parity.spec.ts](../tests/input-parity.spec.ts), [interactions.spec.ts](../tests/interactions.spec.ts), [large-dom.spec.ts](../tests/large-dom.spec.ts), [network-console.spec.ts](../tests/network-console.spec.ts), [network-routing.spec.ts](../tests/network-routing.spec.ts), [popup.spec.ts](../tests/popup.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts), [storage.spec.ts](../tests/storage.spec.ts), [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_resize | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_get_config | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_console_messages | [network-console.spec.ts](../tests/network-console.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_list | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_get | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_set | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_delete | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_clear | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
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
| browser_run_code_unsafe | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_take_screenshot | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [advanced.spec.ts](../tests/advanced.spec.ts), [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_snapshot | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [devtools.spec.ts](../tests/devtools.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts), [input-parity.spec.ts](../tests/input-parity.spec.ts), [interactions.spec.ts](../tests/interactions.spec.ts), [large-dom.spec.ts](../tests/large-dom.spec.ts), [popup.spec.ts](../tests/popup.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_click | [advanced.spec.ts](../tests/advanced.spec.ts), [click.spec.ts](../tests/click.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts), [interactions.spec.ts](../tests/interactions.spec.ts), [large-dom.spec.ts](../tests/large-dom.spec.ts), [popup.spec.ts](../tests/popup.spec.ts) | Source coverage; native/variant evidence must be checked |
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
| browser_start_video | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_stop_video | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_video_chapter | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_video_show_actions | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_video_hide_actions | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_wait_for | [input-parity.spec.ts](../tests/input-parity.spec.ts), [network-console.spec.ts](../tests/network-console.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_list | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_get | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_set | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_delete | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_clear | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_list | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_get | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_set | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_delete | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_clear | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |


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
