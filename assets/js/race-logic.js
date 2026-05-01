(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.RARRaceLogic = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    function parseRotationSequence(value) {
        let parts = String(value || '').split('|');

        return {
            oneTime: parseSequencePart(parts[0] || ''),
            repeat: parseSequencePart(parts[1] || '')
        };
    }

    function parseSequencePart(value) {
        return String(value || '')
            .split(/[\s,]+/)
            .map(function(item) {
                return parseInt(item, 10);
            })
            .filter(function(item) {
                return !Number.isNaN(item);
            });
    }

    function serializeRotationSequence(oneTime, repeat) {
        let oneTimeValue = (oneTime || []).join(',');
        let repeatValue = (repeat || []).join(',');

        if (oneTimeValue && repeatValue) {
            return oneTimeValue + ' | ' + repeatValue;
        }

        if (repeatValue) {
            return ' | ' + repeatValue;
        }

        return oneTimeValue;
    }

    function getRotationCycleLength(sequence, driverCount) {
        if (sequence.oneTime.length > 0 || sequence.repeat.length > 0) {
            return sequence.oneTime.length + (sequence.repeat.length || driverCount);
        }

        return driverCount;
    }

    function getDriverForLap(lapIndex, drivers, sequence) {
        let driverOrder = null;

        if (sequence.oneTime.length > 0 && lapIndex < sequence.oneTime.length) {
            driverOrder = sequence.oneTime[lapIndex];
        } else if (sequence.repeat.length > 0) {
            driverOrder = sequence.repeat[(lapIndex - sequence.oneTime.length) % sequence.repeat.length];
        }

        if (driverOrder !== null) {
            let sequencedDriver = drivers.find(function(driver) {
                return parseInt(driver.driver_order, 10) === driverOrder;
            });

            if (sequencedDriver) {
                return sequencedDriver;
            }
        }

        return drivers[lapIndex % drivers.length] || null;
    }

    function getOrderedRotations(raceData, parseDate) {
        if (!raceData || !raceData.rotations) {
            return [];
        }

        return raceData.rotations.slice().sort(function(a, b) {
            let aTime = parseDate(a.switched_at);
            let bTime = parseDate(b.switched_at);
            let timeDiff = (aTime ? aTime.getTime() : 0) - (bTime ? bTime.getTime() : 0);

            if (timeDiff !== 0) {
                return timeDiff;
            }

            return parseInt(a.id || 0, 10) - parseInt(b.id || 0, 10);
        });
    }

    function getInferredLapStats(raceData, parseDate) {
        let stats = {
            byDriver: {},
            completedLaps: 0,
            latestSwitchTime: null
        };

        if (!raceData || !raceData.rotations || !raceData.race) {
            return stats;
        }

        let previousTime = parseDate(raceData.race.start_time);
        let firstLapExtra = parseFloat(raceData.race.first_lap_extra_time || 0);
        let rotations = getOrderedRotations(raceData, parseDate);

        rotations.forEach(function(rotation, index) {
            let switchTime = parseDate(rotation.switched_at);
            let driverId = String(rotation.from_driver_id);

            if (!switchTime || !previousTime || switchTime.getTime() <= previousTime.getTime()) {
                return;
            }

            let lapSeconds = (switchTime.getTime() - previousTime.getTime()) / 1000;

            if (index === 0) {
                lapSeconds = Math.max(1, lapSeconds - firstLapExtra);
            }

            if (!stats.byDriver[driverId]) {
                stats.byDriver[driverId] = {
                    count: 0,
                    total: 0,
                    laps: [],
                    recentAverage: null
                };
            }

            stats.byDriver[driverId].count++;
            stats.byDriver[driverId].total += lapSeconds;
            stats.byDriver[driverId].laps.push(lapSeconds);
            stats.byDriver[driverId].laps = stats.byDriver[driverId].laps.slice(-3);
            stats.byDriver[driverId].recentAverage = stats.byDriver[driverId].laps.reduce(function(sum, value) {
                return sum + value;
            }, 0) / stats.byDriver[driverId].laps.length;

            stats.completedLaps++;
            stats.latestSwitchTime = switchTime;
            previousTime = switchTime;
        });

        return stats;
    }

    function getForecastLapSeconds(driver, lapStats) {
        let stats = lapStats.byDriver[String(driver.id)];

        if (stats && stats.recentAverage) {
            return stats.recentAverage;
        }

        return parseFloat(driver.avg_lap_time || 0);
    }

    function getNextSwitchDrivers(raceData, rotationSequenceValue, parseDate) {
        if (!raceData || !raceData.drivers || raceData.drivers.length < 2) {
            return null;
        }

        let rotations = getOrderedRotations(raceData, parseDate);
        let completedLaps = rotations.length;
        let sequence = parseRotationSequence(rotationSequenceValue);
        let latestRotation = rotations.length ? rotations[rotations.length - 1] : null;
        let fromDriver = latestRotation ? getDriverById(raceData.drivers, latestRotation.to_driver_id) : null;

        if (!fromDriver) {
            fromDriver = getDriverForLap(completedLaps, raceData.drivers, sequence);
        }

        let toDriver = getNextQueuedDriver(raceData.drivers, fromDriver, completedLaps, sequence);

        if (!fromDriver || !toDriver || parseInt(fromDriver.id, 10) === parseInt(toDriver.id, 10)) {
            return null;
        }

        return {
            from: fromDriver,
            to: toDriver
        };
    }

    function getNextQueuedDriver(drivers, fromDriver, completedLaps, sequence) {
        if (!fromDriver) {
            return getNextDifferentDriver(drivers, completedLaps + 1, fromDriver, sequence);
        }

        let currentAtLapCount = getDriverForLap(completedLaps, drivers, sequence);

        if (currentAtLapCount && parseInt(currentAtLapCount.id, 10) === parseInt(fromDriver.id, 10)) {
            return getNextDifferentDriver(drivers, completedLaps + 1, fromDriver, sequence);
        }

        let searchLimit = Math.max(getRotationCycleLength(sequence, drivers.length) * 2, drivers.length + 20);

        for (let offset = 1; offset <= searchLimit; offset++) {
            let lapIndex = completedLaps + offset;
            let candidate = getDriverForLap(lapIndex, drivers, sequence);

            if (candidate && parseInt(candidate.id, 10) === parseInt(fromDriver.id, 10)) {
                return getNextDifferentDriver(drivers, lapIndex + 1, fromDriver, sequence);
            }
        }

        for (let lapIndex = Math.max(0, completedLaps - searchLimit); lapIndex < completedLaps; lapIndex++) {
            let candidate = getDriverForLap(lapIndex, drivers, sequence);

            if (candidate && parseInt(candidate.id, 10) === parseInt(fromDriver.id, 10)) {
                return getNextDifferentDriver(drivers, lapIndex + 1, fromDriver, sequence);
            }
        }

        return getNextDifferentDriver(drivers, completedLaps + 1, fromDriver, sequence);
    }

    function getNextDifferentDriver(drivers, startLapIndex, fromDriver, sequence) {
        for (let offset = 0; offset < drivers.length + 20; offset++) {
            let candidate = getDriverForLap(startLapIndex + offset, drivers, sequence);

            if (candidate && (!fromDriver || parseInt(candidate.id, 10) !== parseInt(fromDriver.id, 10))) {
                return candidate;
            }
        }

        return null;
    }

    function getDriverById(drivers, driverId) {
        return drivers.find(function(driver) {
            return parseInt(driver.id, 10) === parseInt(driverId, 10);
        }) || null;
    }

    function calculateLapPrognosis(raceData, rotationSequenceValue, parseDate) {
        if (!raceData || !raceData.drivers || raceData.drivers.length === 0) {
            return null;
        }

        let startTime = parseDate(raceData.race.start_time);
        let plannedEndTime = parseDate(raceData.race.planned_end_time);

        if (!startTime || !plannedEndTime || plannedEndTime.getTime() <= startTime.getTime()) {
            return null;
        }

        let sequence = parseRotationSequence(rotationSequenceValue);
        let lapStats = getInferredLapStats(raceData, parseDate);
        let firstLapExtra = parseFloat(raceData.race.first_lap_extra_time || 0);
        let projectedTime = new Date(startTime.getTime());
        let laps = 0;
        let lastCrossingTime = new Date(startTime.getTime());

        for (let lapIndex = 0; lapIndex < 2000; lapIndex++) {
            let driver = getDriverForLap(lapIndex, raceData.drivers, sequence);

            if (!driver) {
                break;
            }

            let lapSeconds = getForecastLapSeconds(driver, lapStats);

            if (lapIndex === 0) {
                lapSeconds += firstLapExtra;
            }

            let normalCrossingTime = new Date(projectedTime.getTime() + (lapSeconds * 1000));
            let isFinalLap = normalCrossingTime.getTime() >= plannedEndTime.getTime();

            if (isFinalLap) {
                let finalLapSeconds = Math.max(1, lapSeconds - firstLapExtra);
                let finalCrossingTime = new Date(projectedTime.getTime() + (finalLapSeconds * 1000));

                if (finalCrossingTime.getTime() > plannedEndTime.getTime()) {
                    break;
                }

                laps++;
                lastCrossingTime = finalCrossingTime;
                break;
            }

            projectedTime = normalCrossingTime;
            lastCrossingTime = normalCrossingTime;
            laps++;
        }

        return {
            laps: laps,
            bufferMinutes: Math.floor((plannedEndTime.getTime() - lastCrossingTime.getTime()) / 60000)
        };
    }

    return {
        calculateLapPrognosis: calculateLapPrognosis,
        getDriverForLap: getDriverForLap,
        getForecastLapSeconds: getForecastLapSeconds,
        getInferredLapStats: getInferredLapStats,
        getNextSwitchDrivers: getNextSwitchDrivers,
        getOrderedRotations: getOrderedRotations,
        getRotationCycleLength: getRotationCycleLength,
        parseRotationSequence: parseRotationSequence,
        parseSequencePart: parseSequencePart,
        serializeRotationSequence: serializeRotationSequence
    };
}));
