# Testing

The race logic is tested with Node's built-in test runner. No npm packages are required.

## Run Tests

```sh
npm test
```

Run JavaScript syntax checks:

```sh
npm run lint:js
```

## What Is Tested

The tests live in `tests/race-logic.test.js` and cover the pure race rules from `assets/js/race-logic.js`.

### Queue Parsing

These tests verify that the queue format is interpreted correctly:

- `1,2,1,2 | 1,2,3,4` means a one-time queue followed by a repeat queue.
- ` | 1,2,3,4` means repeat-only from the start.
- Whitespace and commas both work.
- Invalid tokens are ignored instead of breaking the queue.

### Queue Order

These tests verify which driver is assigned to each lap:

- The one-time queue is consumed first.
- The repeat queue loops after the one-time queue is finished.
- If no queue is configured, the natural driver order is used.
- Unknown queue numbers fall back to the natural driver order.

### Driver Changes

These tests protect the driver-switch behavior:

- The first change starts with the first two queue entries.
- After a switch, the current driver is taken from the latest recorded switch target.
- The next driver respects the current queue.
- Reordering the queue during a race changes the next driver correctly.
- Duplicate queue entries do not cause a driver to switch to themselves.
- Fewer than two drivers means no switch is possible.

This is the area that would catch the bug where the UI kept showing `1 -> 2`.

### Rotation Sorting

Switches are sorted by `switched_at`, then by database `id` when times are equal. This matters for corrected/manual switch times.

### Rolling Lap Average

These tests verify the lap-time prognosis source:

- Lap durations are inferred from driver switch timestamps.
- The first lap's configured delta is deducted before it affects the first driver's average.
- Only the previous 3 inferred laps are used for each driver's rolling average.
- If a driver has no history, the configured planned lap time is used.

### Lap Prognosis And Cutoff

These tests verify the race-end rule:

- The first lap includes the configured `+x` minutes.
- The final lap may finish if applying the `-x` minutes delta reaches the cutoff.
- The final lap is rejected if it still misses the cutoff after the reduction.
- Invalid race times return no prognosis.
