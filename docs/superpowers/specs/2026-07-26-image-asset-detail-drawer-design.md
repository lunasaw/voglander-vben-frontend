# Image Asset Detail Drawer Stability

## Problem

Clicking an asset detail action can make the detail drawer enter and then exit immediately. The asset page currently drives the drawer twice for one action: the click handler opens it directly, then the `assetId` route watcher opens it again after the query string changes. Route transitions and drawer lifecycle callbacks can therefore compete over the same state.

## Scope

Keep the existing asset list, detail drawer, permissions, API calls, styling, and deep-link format. Change only how the asset page coordinates the selected asset between the route and the drawer.

## Design

The route detail identifier is the single source of truth for whether the drawer is open and which asset it displays.

- A detail click validates view permission and writes the selected `assetId` to the query on the list route, or updates the path parameter when already on a path-based detail route.
- The existing route-detail watcher resolves the selected row, supplies the drawer payload, and opens the drawer.
- Closing the drawer removes `assetId` from the query. The route watcher then observes the absent identifier and keeps the drawer closed.
- A path-based deep link continues to resolve `route.params.assetId`; closing it returns to `/image/assets` while preserving unrelated query filters.

The click handler must not open the drawer imperatively before updating the route. This removes the competing state transition without adding timing flags or animation-specific behavior.

## Error Handling

Permission denial remains unchanged and prevents the route update. Router navigation failures continue to reject through Vue Router's existing behavior. Detail and image loading errors remain isolated inside `AssetDetailDrawer`.

## Verification

- Add a focused regression test for the detail-route coordination: a detail click updates the route but does not imperatively open the drawer.
- Retain coverage for query-based and path-based asset detail identifiers.
- Run the focused image asset tests, TypeScript checking for the web app, and linting for changed source and test files.
- If browser automation is available, confirm the drawer remains open until explicit dismissal and that refreshing a deep link restores it. In this environment the `browser-use` executable is unavailable, so automated test coverage is the required verification path.

## Non-Goals

This change does not alter the collection drawer, shared drawer primitives, tab routing, asset APIs, or visual presentation.
