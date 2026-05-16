(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.RARRaceLogic = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    function parseRotationSequence(value) {
        return String(value || '')
            .split(/[\s,]+/)
            .filter(function(item) {
                return item !== '';
            })
            .map(function(item) {
                return Number(item);
            })
            .filter(function(item) {
                return Number.isInteger(item);
            });
    }

    function getDriverForLap(lapIndex, drivers, sequence) {
        let driverOrder = sequence[lapIndex] || null;

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
        let stats = createEmptyLapStats();

        if (!raceData || !raceData.rotations || !raceData.race) {
            return stats;
        }

        let context = {
            drivers: raceData.drivers || [],
            firstLapExtra: parseFloat(raceData.race.first_lap_extra_time || 0),
            previousTime: parseDate(raceData.race.start_time)
        };
        let rotations = getOrderedRotations(raceData, parseDate);

        rotations.forEach(function(rotation, index) {
            addRotationLapStats(stats, context, rotation, index, parseDate);
        });

        return stats;
    }

    function createEmptyLapStats() {
        return {
            byDriver: {},
            completedLaps: 0,
            latestSwitchTime: null
        };
    }

    function createDriverLapStats() {
        return {
            count: 0,
            total: 0,
            laps: [],
            recentAverage: null
        };
    }

    function getDriverLapStats(stats, driverId) {
        if (!stats.byDriver[driverId]) {
            stats.byDriver[driverId] = createDriverLapStats();
        }

        return stats.byDriver[driverId];
    }

    function addRotationLapStats(stats, context, rotation, rotationIndex, parseDate) {
        let switchTime = parseDate(rotation.switched_at);
        let driverId = String(rotation.from_driver_id);

        if (!driverId) {
            return;
        }

        let driverStats = getDriverLapStats(stats, driverId);
        let lapResult = getRotationLapSeconds(context, driverId, switchTime, rotationIndex);

        driverStats.count++;
        stats.completedLaps++;

        if (!lapResult.lapSeconds) {
            return;
        }

        addDriverLapSeconds(driverStats, lapResult.lapSeconds);

        if (lapResult.hasValidTimeRange) {
            stats.latestSwitchTime = switchTime;
            context.previousTime = switchTime;
        }
    }

    function getRotationLapSeconds(context, driverId, switchTime, rotationIndex) {
        let hasValidTimeRange = switchTime && context.previousTime && switchTime.getTime() > context.previousTime.getTime();

        return {
            hasValidTimeRange: hasValidTimeRange,
            lapSeconds: hasValidTimeRange
                ? getTimedLapSeconds(context.previousTime, switchTime, rotationIndex, context.firstLapExtra)
                : getFallbackLapSeconds(context.drivers, driverId)
        };
    }

    function getTimedLapSeconds(previousTime, switchTime, rotationIndex, firstLapExtra) {
        let lapSeconds = (switchTime.getTime() - previousTime.getTime()) / 1000;

        if (rotationIndex === 0) {
            return Math.max(1, lapSeconds - firstLapExtra);
        }

        return lapSeconds;
    }

    function getFallbackLapSeconds(drivers, driverId) {
        let driver = getDriverById(drivers, driverId);
        let fallbackLapSeconds = driver ? parseFloat(driver.avg_lap_time || 0) : 0;

        return fallbackLapSeconds > 0 ? fallbackLapSeconds : null;
    }

    function addDriverLapSeconds(driverStats, lapSeconds) {
        driverStats.total += lapSeconds;
        driverStats.laps.push(lapSeconds);
        driverStats.laps = driverStats.laps.slice(-3);
        driverStats.recentAverage = getAverage(driverStats.laps);
    }

    function getAverage(values) {
        return values.reduce(function(sum, value) {
            return sum + value;
        }, 0) / values.length;
    }

    function getForecastLapSeconds(driver, lapStats) {
        let stats = lapStats.byDriver[String(driver.id)];

        if (stats && stats.recentAverage) {
            return stats.recentAverage;
        }

        return parseFloat(driver.avg_lap_time || 0);
    }

    function getNextSwitchDrivers(raceData, rotationSequenceValue, parseDate) {
        if (!raceData || !raceData.drivers || raceData.drivers.length === 0) {
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

        if (!fromDriver || !toDriver) {
            return null;
        }

        return {
            from: fromDriver,
            to: toDriver
        };
    }

    function getNextQueuedDriver(drivers, fromDriver, completedLaps, sequence) {
        return getDriverForLap(completedLaps + 1, drivers, sequence);
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
        let baseTime = lapStats.latestSwitchTime || startTime;
        let projectedTime = new Date(baseTime.getTime());
        let laps = lapStats.completedLaps;
        let lastCrossingTime = new Date(baseTime.getTime());

        for (let lapIndex = lapStats.completedLaps; lapIndex < 2000; lapIndex++) {
            let lap = getProjectedLap(raceData.drivers, sequence, lapIndex, projectedTime, lapStats, firstLapExtra, plannedEndTime);

            if (!lap) {
                break;
            }

            if (!lap.canCount) {
                break;
            }

            laps++;
            projectedTime = lap.crossingTime;
            lastCrossingTime = lap.crossingTime;

            if (lap.isFinal) {
                break;
            }
        }

        return buildLapPrognosisResult(laps, plannedEndTime, lastCrossingTime);
    }

    function getProjectedLap(drivers, sequence, lapIndex, projectedTime, lapStats, firstLapExtra, plannedEndTime) {
        let driver = getDriverForLap(lapIndex, drivers, sequence);

        if (!driver) {
            return null;
        }

        let lapSeconds = getForecastLapSeconds(driver, lapStats) + (lapIndex === 0 ? firstLapExtra : 0);
        let crossingTime = addSeconds(projectedTime, lapSeconds);

        if (crossingTime.getTime() < plannedEndTime.getTime()) {
            return {
                canCount: true,
                crossingTime: crossingTime,
                isFinal: false
            };
        }

        let finalCrossingTime = addSeconds(projectedTime, Math.max(1, lapSeconds - firstLapExtra));

        return {
            canCount: finalCrossingTime.getTime() <= plannedEndTime.getTime(),
            crossingTime: finalCrossingTime,
            isFinal: true
        };
    }

    function addSeconds(date, seconds) {
        return new Date(date.getTime() + (seconds * 1000));
    }

    function buildLapPrognosisResult(laps, plannedEndTime, lastCrossingTime) {
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
        parseRotationSequence: parseRotationSequence
    };
}));
