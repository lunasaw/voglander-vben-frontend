# Protocol Lab Channel Selection Design

## Goal

Make GB28181 protocol-lab live play and PTZ commands use a persisted, real device channel. The UI must never derive a channel ID from the device ID. When a device has no available channel, the command is not sent and the user receives a clear message.

## Scope

- Reuse `getDeviceChannelPage` from `#/api/device` with `{ page: 1, size: 200 }` and `{ deviceId }`.
- Load channels whenever the selected device changes.
- Reload channels after a `device.catalog` event for the selected device so a newly persisted catalog becomes available.
- Add a searchable channel selector shared by live play and PTZ.
- Remove both `channelId = deviceId` and `channelId = deviceId + '01'` fallbacks from the protocol-lab page.
- Keep unrelated protocol commands device-scoped and unchanged.

## Data Flow

1. The protocol event list discovers or updates an online device.
2. Selecting that device clears stale channel state and requests its persisted channels.
3. A successful non-empty response populates the selector and selects the first real channel unless the current selection is still present.
4. A successful empty response leaves the selection empty.
5. A `device.catalog` event continues updating lab event metadata and triggers a channel reload for the currently selected device.
6. Live play and PTZ read the same selected channel value immediately before sending their request.

The REST response is the source of truth for actionable channels. Catalog SSE data is a refresh signal and display metadata, not a fallback command target.

## Interaction And Errors

- Show channel loading state while the request is pending.
- Disable the channel selector, live-play button, and PTZ while no real channel is selected.
- If the user attempts live play or PTZ without a selected channel, show a localized "no available channel" warning and do not call the API.
- If channel loading fails, clear channel options, show a localized load-failure message, and do not guess a channel ID.
- Ignore stale channel responses when the user changes devices before an earlier request completes.
- Existing online-device checks and command loading state remain in force.

## Components And Contracts

- `ServerPanel.vue` owns channel loading, selected-channel state, guards, and selector rendering.
- `getDeviceChannelPage` remains the only channel-list API used by this page.
- `ProtocolLabApi` does not duplicate device-channel response types.
- `protocolLab.json` adds Chinese and English messages for channel selection, empty channels, and load failure.

## Tests

Update `ServerPanel.test.ts` to cover:

- Selecting an online device loads channels with the correct pagination and `deviceId` body.
- A non-empty response selects the first real channel and populates the selector.
- Live play and PTZ send the selected real channel.
- An empty response shows the no-channel warning and sends neither request.
- A failed channel request clears selection, reports failure, and sends neither request.
- Switching devices does not allow a stale response to replace the new device's channels.
- A Catalog event for the selected device reloads persisted channels.
- Existing device-scoped protocol commands remain unchanged.

## Non-Goals

- Changing backend endpoints or persistence.
- Using Catalog payload channel IDs directly for live play or PTZ.
- Adding server-side search or pagination beyond the existing 200-item behavior.
- Refactoring the device-management page's separate fallback behavior in this change.
