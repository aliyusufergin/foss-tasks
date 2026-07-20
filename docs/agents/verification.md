# Verification

What counts as evidence that app work is done. Read this before claiming any ticket touching `app/` is complete.

## Green tests are not evidence the app runs

The app's CI (`.github/workflows/ci.yml`) runs two seams in Node — the pure domain harness and the local data-layer harness — plus `tsc`. **It never builds the React Native bundle and never launches the app.**

So a fully green CI is consistent with an app that cannot start at all.

This is not hypothetical. In T02 (#3), every relative import carried a `.js` extension, copied from `services/auth`'s Node ESM convention. TypeScript (`moduleResolution: "Bundler"`) and vitest both accept the `.js`→`.ts`/`.tsx` mapping; **Metro does not**. The bundle had never once built. At that moment: 36 tests passing, two typechecks clean, and nothing had ever executed on a device.

Eight defects in that ticket were reachable *only* by building on hardware:

- four version-matrix conflicts (Kotlin/Compose, `@powersync/op-sqlite` native extension, peer deps, `react-native` patch)
- Metro module resolution (above)
- a native plugin listed in `app.json` that isn't a config plugin
- a swallowed startup rejection that left the app on an infinite spinner with nothing on screen
- reading `SyncStatus.downloadError` at the top level, where it does not exist

None of these are the kind of bug more unit tests would have caught. They live in the gap between "the code typechecks" and "the code runs on a phone".

## The rule

**For any ticket that touches `app/`, build and run on a real device early — before the ticket's logic is finished, not after.**

The first device build of a ticket should happen as soon as there is anything at all to render. Its purpose is not to verify the feature; it is to prove the toolchain still assembles. Leaving it to the end means discovering toolchain breakage *and* logic bugs at the same time, with no way to tell which is which.

Concretely:

1. `npm run android` (or `ios`) once, early, and see the app on screen.
2. Build the feature, keeping the app running.
3. Verify the acceptance criteria on the device, and record what you observed — with timings where the criterion is about sync latency.

## Recording the evidence

When closing an app ticket, comment on the issue with what was actually observed on the device, not what the tests report. State the device, the steps, and the outcome per criterion.

If a criterion could not be verified on hardware, say so explicitly and say why. An unverified criterion is an open question, not a passing one.

## Startup failures must be visible

Never `void` a startup promise without a `catch`. A rejected promise in app boot produces a blank screen or an endless spinner, which is the hardest possible thing to diagnose — there is nothing on screen and nothing in the test output. Surface the error on screen and log it. In T02 this single change is what made the next bug findable.
