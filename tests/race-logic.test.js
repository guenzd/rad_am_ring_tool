const test = require('node:test');
const assert = require('node:assert/strict');

const logic = require('../assets/js/race-logic.js');

function parseDate(value) {
    if (!value) {
        return null;
    }

    const parsed = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function drivers(count = 4) {
    return Array.from({ length: count }, (_, index) => {
        const order = index + 1;

        return {
            id: order,
            driver_order: order,
            driver_name: `Driver ${order}`,
            avg_lap_time: 45 * 60
        };
    });
}

function raceData(overrides = {}) {
    return {
        race: {
            start_time: '2026-05-01 10:00:00',
            planned_end_time: '2026-05-01 16:00:00',
            first_lap_extra_time: 7 * 60,
            ...(overrides.race || {})
        },
        drivers: overrides.drivers || drivers(),
        rotations: overrides.rotations || []
    };
}

function switchPair(data, sequence) {
    const result = logic.getNextSwitchDrivers(data, sequence, parseDate);
    return result ? `${result.from.driver_order}->${result.to.driver_order}` : null;
}

test('parses one-time and repeat queues separated by pipe', () => {
    assert.deepEqual(logic.parseRotationSequence('1,2,1,2 | 1,2,3,4'), {
        oneTime: [1, 2, 1, 2],
        repeat: [1, 2, 3, 4]
    });
});

test('parses whitespace and comma separated entries', () => {
    assert.deepEqual(logic.parseRotationSequence('1 2, 3\n4 | 2 4'), {
        oneTime: [1, 2, 3, 4],
        repeat: [2, 4]
    });
});

test('ignores invalid queue tokens', () => {
    assert.deepEqual(logic.parseRotationSequence('1,abc,2 | nope,4').oneTime, [1, 2]);
    assert.deepEqual(logic.parseRotationSequence('1,abc,2 | nope,4').repeat, [4]);
});

test('serializes one-time only queue', () => {
    assert.equal(logic.serializeRotationSequence([1, 2, 3], []), '1,2,3');
});

test('serializes repeat only queue with leading pipe', () => {
    assert.equal(logic.serializeRotationSequence([], [1, 2, 3, 4]), ' | 1,2,3,4');
});

test('serializes combined one-time and repeat queue', () => {
    assert.equal(logic.serializeRotationSequence([1, 2, 1, 2], [1, 2, 3, 4]), '1,2,1,2 | 1,2,3,4');
});

test('uses one-time queue before repeat queue', () => {
    const sequence = logic.parseRotationSequence('1,2,1,2 | 3,4');
    const result = Array.from({ length: 8 }, (_, index) => {
        return logic.getDriverForLap(index, drivers(), sequence).driver_order;
    });

    assert.deepEqual(result, [1, 2, 1, 2, 3, 4, 3, 4]);
});

test('uses repeat-only queue from the first lap', () => {
    const sequence = logic.parseRotationSequence(' | 3,4,1,2');
    const result = Array.from({ length: 6 }, (_, index) => {
        return logic.getDriverForLap(index, drivers(), sequence).driver_order;
    });

    assert.deepEqual(result, [3, 4, 1, 2, 3, 4]);
});

test('falls back to driver order when no queue is configured', () => {
    const sequence = logic.parseRotationSequence('');
    const result = Array.from({ length: 6 }, (_, index) => {
        return logic.getDriverForLap(index, drivers(), sequence).driver_order;
    });

    assert.deepEqual(result, [1, 2, 3, 4, 1, 2]);
});

test('falls back to natural driver order for unknown queue numbers', () => {
    const sequence = logic.parseRotationSequence('99 | 88');

    assert.equal(logic.getDriverForLap(0, drivers(), sequence).driver_order, 1);
    assert.equal(logic.getDriverForLap(1, drivers(), sequence).driver_order, 2);
});

test('first driver change starts with first to second queue entry', () => {
    assert.equal(switchPair(raceData(), '1,2,1,2 | 1,2,3,4'), '1->2');
});

test('next driver is based on latest recorded switch target', () => {
    const data = raceData({
        rotations: [
            {
                id: 1,
                from_driver_id: 1,
                to_driver_id: 2,
                switched_at: '2026-05-01 10:52:00'
            }
        ]
    });

    assert.equal(switchPair(data, '1,2,1,2 | 1,2,3,4'), '2->1');
});

test('multiple switches continue through the queue', () => {
    const data = raceData({
        rotations: [
            { id: 1, from_driver_id: 1, to_driver_id: 2, switched_at: '2026-05-01 10:52:00' },
            { id: 2, from_driver_id: 2, to_driver_id: 1, switched_at: '2026-05-01 11:37:00' },
            { id: 3, from_driver_id: 1, to_driver_id: 2, switched_at: '2026-05-01 12:22:00' }
        ]
    });

    assert.equal(switchPair(data, '1,2,1,2 | 1,2,3,4'), '2->1');
});

test('reordered queue is respected after the race has already started', () => {
    const data = raceData({
        rotations: [
            { id: 1, from_driver_id: 1, to_driver_id: 2, switched_at: '2026-05-01 10:52:00' },
            { id: 2, from_driver_id: 2, to_driver_id: 3, switched_at: '2026-05-01 11:37:00' },
            { id: 3, from_driver_id: 3, to_driver_id: 4, switched_at: '2026-05-01 12:22:00' }
        ]
    });

    assert.equal(switchPair(data, ' | 3,4,1,2'), '4->1');
});

test('queue reordering can intentionally change the next driver', () => {
    const data = raceData({
        rotations: [
            { id: 1, from_driver_id: 1, to_driver_id: 2, switched_at: '2026-05-01 10:52:00' },
            { id: 2, from_driver_id: 2, to_driver_id: 3, switched_at: '2026-05-01 11:37:00' },
            { id: 3, from_driver_id: 3, to_driver_id: 4, switched_at: '2026-05-01 12:22:00' }
        ]
    });

    assert.equal(switchPair(data, '4,3,2,1 | 4,3,2,1'), '4->3');
});

test('does not switch from a driver to the same driver when queue contains duplicates', () => {
    const data = raceData({
        rotations: [
            { id: 1, from_driver_id: 1, to_driver_id: 2, switched_at: '2026-05-01 10:52:00' }
        ]
    });

    assert.equal(switchPair(data, '1,2,2,2,3 | 1,2,3,4'), '2->3');
});

test('returns null when fewer than two drivers exist', () => {
    const data = raceData({ drivers: drivers(1) });

    assert.equal(logic.getNextSwitchDrivers(data, '1', parseDate), null);
});

test('sorts rotations by switch time and then id', () => {
    const data = raceData({
        rotations: [
            { id: 3, switched_at: '2026-05-01 12:00:00' },
            { id: 1, switched_at: '2026-05-01 11:00:00' },
            { id: 2, switched_at: '2026-05-01 11:00:00' }
        ]
    });

    assert.deepEqual(logic.getOrderedRotations(data, parseDate).map((rotation) => rotation.id), [1, 2, 3]);
});

test('infers lap durations from driver switches', () => {
    const data = raceData({
        race: { first_lap_extra_time: 0 },
        rotations: [
            { id: 1, from_driver_id: 1, to_driver_id: 2, switched_at: '2026-05-01 10:45:00' },
            { id: 2, from_driver_id: 2, to_driver_id: 3, switched_at: '2026-05-01 11:30:00' }
        ]
    });

    const stats = logic.getInferredLapStats(data, parseDate);

    assert.equal(stats.completedLaps, 2);
    assert.equal(stats.byDriver['1'].recentAverage, 45 * 60);
    assert.equal(stats.byDriver['2'].recentAverage, 45 * 60);
});

test('deducts first lap extra time from the first inferred lap', () => {
    const data = raceData({
        race: { first_lap_extra_time: 7 * 60 },
        rotations: [
            { id: 1, from_driver_id: 1, to_driver_id: 2, switched_at: '2026-05-01 10:52:00' }
        ]
    });

    const stats = logic.getInferredLapStats(data, parseDate);

    assert.equal(stats.byDriver['1'].recentAverage, 45 * 60);
});

test('uses only the previous three laps for a driver average', () => {
    const data = raceData({
        race: { first_lap_extra_time: 0 },
        rotations: [
            { id: 1, from_driver_id: 1, to_driver_id: 2, switched_at: '2026-05-01 10:40:00' },
            { id: 2, from_driver_id: 2, to_driver_id: 1, switched_at: '2026-05-01 11:25:00' },
            { id: 3, from_driver_id: 1, to_driver_id: 2, switched_at: '2026-05-01 12:15:00' },
            { id: 4, from_driver_id: 2, to_driver_id: 1, switched_at: '2026-05-01 13:00:00' },
            { id: 5, from_driver_id: 1, to_driver_id: 2, switched_at: '2026-05-01 14:00:00' },
            { id: 6, from_driver_id: 2, to_driver_id: 1, switched_at: '2026-05-01 14:45:00' },
            { id: 7, from_driver_id: 1, to_driver_id: 2, switched_at: '2026-05-01 15:55:00' }
        ]
    });

    const stats = logic.getInferredLapStats(data, parseDate);

    assert.deepEqual(stats.byDriver['1'].laps, [50 * 60, 60 * 60, 70 * 60]);
    assert.equal(stats.byDriver['1'].recentAverage, 60 * 60);
});

test('forecast lap time uses rolling average when available', () => {
    const stats = {
        byDriver: {
            1: { recentAverage: 43 * 60 }
        }
    };

    assert.equal(logic.getForecastLapSeconds(drivers()[0], stats), 43 * 60);
});

test('forecast lap time falls back to configured driver minutes when no history exists', () => {
    const stats = { byDriver: {} };

    assert.equal(logic.getForecastLapSeconds({ id: 1, avg_lap_time: 46 * 60 }, stats), 46 * 60);
});

test('lap prognosis includes first lap extra time', () => {
    const data = raceData({
        race: {
            start_time: '2026-05-01 10:00:00',
            planned_end_time: '2026-05-01 11:31:00',
            first_lap_extra_time: 7 * 60
        },
        drivers: drivers(2),
        rotations: []
    });

    const prognosis = logic.calculateLapPrognosis(data, '1,2', parseDate);

    assert.equal(prognosis.laps, 2);
    assert.equal(prognosis.bufferMinutes, 1);
});

test('final lap can finish when cutoff is reached only after applying the delta reduction', () => {
    const data = raceData({
        race: {
            start_time: '2026-05-01 10:00:00',
            planned_end_time: '2026-05-01 11:30:00',
            first_lap_extra_time: 7 * 60
        },
        drivers: drivers(2),
        rotations: []
    });

    const prognosis = logic.calculateLapPrognosis(data, '1,2', parseDate);

    assert.equal(prognosis.laps, 2);
    assert.equal(prognosis.bufferMinutes, 0);
});

test('final lap is rejected when it still misses cutoff after delta reduction', () => {
    const data = raceData({
        race: {
            start_time: '2026-05-01 10:00:00',
            planned_end_time: '2026-05-01 11:29:00',
            first_lap_extra_time: 7 * 60
        },
        drivers: drivers(2),
        rotations: []
    });

    const prognosis = logic.calculateLapPrognosis(data, '1,2', parseDate);

    assert.equal(prognosis.laps, 1);
    assert.equal(prognosis.bufferMinutes, 37);
});

test('lap prognosis returns null for invalid race times', () => {
    const data = raceData({
        race: {
            start_time: '2026-05-01 12:00:00',
            planned_end_time: '2026-05-01 11:00:00'
        }
    });

    assert.equal(logic.calculateLapPrognosis(data, '1,2', parseDate), null);
});
