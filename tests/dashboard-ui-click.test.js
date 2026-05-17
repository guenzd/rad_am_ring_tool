const test = require('node:test');
const assert = require('node:assert/strict');

const logic = require('../assets/js/race-logic.js');

function createElement(selector, length = 1) {
    return {
        selector,
        length,
        value: '',
        textValue: '',
        htmlValue: '',
        props: {},
        attrs: {},
        handlers: {},
        val(value) {
            if (value === undefined) {
                return this.value;
            }

            this.value = String(value);
            return this;
        },
        text(value) {
            if (value === undefined) {
                return this.textValue;
            }

            this.textValue = String(value);
            return this;
        },
        html(value) {
            if (value === undefined) {
                return this.htmlValue;
            }

            this.htmlValue = String(value);
            return this;
        },
        prop(name, value) {
            if (value === undefined) {
                return this.props[name];
            }

            this.props[name] = value;
            return this;
        },
        attr(name, value) {
            if (value === undefined) {
                return this.attrs[name];
            }

            this.attrs[name] = value;
            return this;
        },
        on(event, handler) {
            this.handlers[event] = this.handlers[event] || [];
            this.handlers[event].push(handler);
            return this;
        },
        trigger(event) {
            (this.handlers[event] || []).forEach((handler) => handler.call(this, { preventDefault() {} }));
            return this;
        },
        append(value) {
            this.htmlValue += typeof value === 'string' ? value : (value.textValue || value.htmlValue || '');
            return this;
        },
        prepend() { return this; },
        empty() {
            this.htmlValue = '';
            this.textValue = '';
            return this;
        },
        show() { return this; },
        hide() { return this; },
        addClass() { return this; },
        removeClass() { return this; },
        toggle() { return this; },
        toggleClass() { return this; },
        data(name, value) {
            this.dataValues = this.dataValues || {};

            if (value === undefined) {
                return this.dataValues[name];
            }

            this.dataValues[name] = value;
            return this;
        },
        each() { return this; },
        hasClass() { return false; },
        fadeOut(callback) {
            if (callback) {
                callback.call(this);
            }

            return this;
        },
        remove() { return this; },
    };
}

function createJqueryHarness(options = {}) {
    const elements = new Map();
    const documentHandlers = [];
    let focusMatchLength = 0;

    function getElement(selector) {
        if (selector.includes(':focus')) {
            return createElement(selector, focusMatchLength);
        }

        if (!elements.has(selector)) {
            elements.set(selector, createElement(selector, selector === '.rar-public-container' ? (options.publicView === false ? 0 : 1) : 1));
        }

        return elements.get(selector);
    }

    function $(selector) {
        if (selector === global.document) {
            return {
                ready(callback) {
                    callback($);
                    return this;
                },
                on(event, childSelector, handler) {
                    documentHandlers.push({ event, childSelector, handler });
                    return this;
                },
            };
        }

        if (typeof selector === 'string' && selector.trim().startsWith('<')) {
            return createElement(selector);
        }

        if (typeof selector === 'string') {
            if (selector.includes(',')) {
                const items = selector.split(',').map((item) => getElement(item.trim()));

                return {
                    prop(name, value) {
                        if (value === undefined) {
                            return items[0] ? items[0].prop(name) : undefined;
                        }

                        items.forEach((item) => item.prop(name, value));
                        return this;
                    },
                    attr(name, value) {
                        if (value === undefined) {
                            return items[0] ? items[0].attr(name) : undefined;
                        }

                        items.forEach((item) => item.attr(name, value));
                        return this;
                    },
                    hide() {
                        items.forEach((item) => item.hide());
                        return this;
                    },
                    show() {
                        items.forEach((item) => item.show());
                        return this;
                    },
                    each() {
                        return this;
                    },
                    toggleClass() {
                        return this;
                    },
                };
            }

            return getElement(selector);
        }

        return selector || createElement('unknown', 0);
    }

    $.Deferred = function() {
        return {
            resolve() {
                return {
                    promise() {
                        return {
                            then(callback) {
                                return callback ? callback() : this;
                            },
                        };
                    },
                };
            },
        };
    };
    $.extend = Object.assign;

    function setFocusMatchLength(length) {
        focusMatchLength = length;
    }

    return { $, elements, documentHandlers, setFocusMatchLength };
}

function parseLocalDate(value) {
    return new Date(String(value).replace(' ', 'T'));
}

function toMysqlDate(date) {
    return date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0') + ' ' +
        String(date.getHours()).padStart(2, '0') + ':' +
        String(date.getMinutes()).padStart(2, '0') + ':' +
        String(date.getSeconds()).padStart(2, '0');
}

function createDashboardClickTest(raceData, initialNow, options = {}) {
    let now = parseLocalDate(initialNow).getTime();
    const originals = {
        now: Date.now,
        setInterval: global.setInterval,
        clearInterval: global.clearInterval,
        window: global.window,
        document: global.document,
        jQuery: global.jQuery,
        dollar: global.$,
        rarData: global.rarData,
        logic: global.RARRaceLogic,
        confirm: global.confirm,
    };
    const harness = createJqueryHarness({ publicView: options.publicView !== false });
    const { $ } = harness;

    Date.now = () => now;
    global.setInterval = () => 1;
    global.clearInterval = () => {};
    global.document = {};
    global.confirm = () => options.confirmResult !== false;

    function getSwitchDrivers() {
        return logic.getNextSwitchDrivers(
            raceData,
            raceData.race.rotation_sequence,
            parseLocalDate
        );
    }

    function getCompletedLaps() {
        return raceData.rotations.length;
    }

    function getDriverByOrder(driverOrder) {
        return raceData.drivers.find((driver) => parseInt(driver.driver_order, 10) === parseInt(driverOrder, 10));
    }

    function getDriverForLap(lapIndex, queue) {
        return logic.getDriverForLap(lapIndex, raceData.drivers, queue);
    }

    function ensureQueueLength(queue, length) {
        while (queue.length < length) {
            const driver = getDriverForLap(queue.length, queue);

            if (!driver) {
                throw new Error('No driver available');
            }

            queue.push(parseInt(driver.driver_order, 10));
        }
    }

    function getNextDefaultDriverOrderAfter(driverOrder) {
        const driverIndex = raceData.drivers.findIndex((driver) => parseInt(driver.driver_order, 10) === parseInt(driverOrder, 10));

        if (driverIndex === -1) {
            return null;
        }

        return parseInt(raceData.drivers[(driverIndex + 1) % raceData.drivers.length].driver_order, 10);
    }

    function getNextDefaultDriverOrder(queue) {
        const lastDriverOrder = queue.length ? parseInt(queue[queue.length - 1], 10) : null;
        const driverIndex = raceData.drivers.findIndex((driver) => parseInt(driver.driver_order, 10) === lastDriverOrder);

        if (driverIndex !== -1) {
            return parseInt(raceData.drivers[(driverIndex + 1) % raceData.drivers.length].driver_order, 10);
        }

        return parseInt(raceData.drivers[queue.length % raceData.drivers.length].driver_order, 10);
    }

    function mutateQueueRemove(index, materializeLength) {
        const completedLaps = getCompletedLaps();

        if (index < 0 || index <= completedLaps) {
            throw new Error('Only future stints can be edited');
        }

        const queue = logic.parseRotationSequence(raceData.race.rotation_sequence);
        const length = Math.max(materializeLength, index + 1);

        ensureQueueLength(queue, length);

        const removedFromVisibleBottom = index >= length - 1;
        const removedDriverOrder = parseInt(queue[index] || 0, 10);

        queue.splice(index, 1);

        if (queue.length >= length) {
            queue.splice(Math.max(0, length - 1));
        }

        let nextAfterRemoved = removedFromVisibleBottom ? getNextDefaultDriverOrderAfter(removedDriverOrder) : null;

        while (queue.length < length) {
            if (nextAfterRemoved !== null) {
                queue.push(nextAfterRemoved);
                nextAfterRemoved = null;
                continue;
            }

            queue.push(getNextDefaultDriverOrder(queue));
        }

        return queue.join(',');
    }

    function ajaxResult(response) {
        return {
            then(resolve) {
                if (resolve) {
                    resolve(response);
                }

                return this;
            },
        };
    }

    $.ajax = function(options) {
        if (options.data.action === 'rar_get_all_races') {
            const response = { success: true, data: { races: [raceData.race] } };
            options.success(response);
            return ajaxResult(response);
        }

        if (options.data.action === 'rar_get_race_data') {
            const response = { success: true, data: raceData };
            options.success(response);
            return ajaxResult(response);
        }

        if (options.data.action === 'rar_start_race') {
            raceData.race.start_time = options.data.start_time || toMysqlDate(new Date(now));
            const response = { success: true, data: {} };
            options.success(response);
            return ajaxResult(response);
        }

        if (options.data.action === 'rar_switch_driver') {
            const switchDrivers = getSwitchDrivers();
            const switchedAt = options.data.switched_at || toMysqlDate(new Date(now));

            raceData.rotations.push({
                id: raceData.rotations.length + 1,
                from_driver_id: switchDrivers.from.id,
                to_driver_id: switchDrivers.to.id,
                from_driver: switchDrivers.from.driver_name,
                to_driver: switchDrivers.to.driver_name,
                switched_at: switchedAt,
            });

            const response = {
                success: true,
                data: {
                    from: switchDrivers.from,
                    to: switchDrivers.to,
                },
            };
            options.success(response);
            return ajaxResult(response);
        }

        if (options.data.action === 'rar_undo_driver_switch') {
            raceData.rotations.pop();
            const response = { success: true, data: {} };
            options.success(response);
            return ajaxResult(response);
        }

        if (options.data.action === 'rar_end_race') {
            raceData.race.end_time = toMysqlDate(new Date(now));
            const response = { success: true, data: {} };
            options.success(response);
            return ajaxResult(response);
        }

        if (options.data.action === 'rar_update_driver_plan_time') {
            const driver = raceData.drivers.find((candidate) => parseInt(candidate.id, 10) === parseInt(options.data.driver_id, 10));

            if (driver) {
                driver.avg_lap_time = options.data.avg_lap_time;
            }

            const response = { success: true, data: { avg_lap_time: options.data.avg_lap_time } };
            options.success(response);
            return ajaxResult(response);
        }

        if (options.data.action === 'rar_update_driver_name') {
            const driver = raceData.drivers.find((candidate) => parseInt(candidate.id, 10) === parseInt(options.data.driver_id, 10));

            if (driver) {
                driver.driver_name = options.data.driver_name;
            }

            const response = { success: true, data: { driver_name: options.data.driver_name } };
            options.success(response);
            return ajaxResult(response);
        }

        if (options.data.action === 'rar_mutate_rotation_queue') {
            raceData.race.rotation_sequence = mutateQueueRemove(
                parseInt(options.data.index, 10),
                parseInt(options.data.materialize_length, 10)
            );

            const response = {
                success: true,
                data: {
                    rotation_sequence: raceData.race.rotation_sequence,
                },
            };
            return ajaxResult(response);
        }

        return ajaxResult({ success: true, data: {} });
    };

    global.window = {
        rarData: {
            ajaxUrl: '/wp-admin/admin-ajax.php',
            nonce: 'nonce',
            canEdit: options.canEdit !== false,
        },
    };
    global.rarData = global.window.rarData;
    global.jQuery = $;
    global.$ = $;
    global.RARRaceLogic = logic;

    function setNow(value) {
        now = parseLocalDate(value).getTime();
        harness.elements.get('#manualSwitchTime').val(value.slice(0, 19));
    }

    function clickSwitchAt(value) {
        setNow(value);
        harness.elements.get('#switchDriverBtn').trigger('click');
    }

    function clickOkAt(value) {
        setNow(value);
        harness.elements.get('#switchDriverTimeOkBtn').trigger('click');
    }

    function clickUndo() {
        harness.elements.get('#undoSwitchBtn').trigger('click');
    }

    function clickEndAt(value) {
        setNow(value);
        harness.elements.get('#endRaceBtn').trigger('click');
    }

    function clickForecastRemove(index) {
        const handler = harness.documentHandlers.find((entry) => {
            return entry.event === 'click' && entry.childSelector === '.rar-forecast-remove';
        });

        assert.ok(handler, 'forecast remove click handler is registered');

        const button = createElement('.rar-forecast-remove');
        button.data = (name) => {
            if (name === 'index') {
                return index;
            }

            return undefined;
        };

        handler.handler.call(button, {
            stopPropagation() {},
            preventDefault() {},
        });
    }

    function triggerDelegatedChange(selector, element) {
        const handler = harness.documentHandlers.find((entry) => {
            return entry.event === 'change' && entry.childSelector === selector;
        });

        assert.ok(handler, selector + ' change handler is registered');
        handler.handler.call(element, {
            preventDefault() {},
            stopPropagation() {},
        });
    }

    function loadDashboard() {
        delete require.cache[require.resolve('../assets/js/dashboard.js')];
        require('../assets/js/dashboard.js');
    }

    function clickLoadRace() {
        harness.elements.get('#raceSelect').val(raceData.race.id);
        harness.elements.get('#loadRaceBtn').trigger('click');
    }

    function restore() {
        Date.now = originals.now;
        global.setInterval = originals.setInterval;
        global.clearInterval = originals.clearInterval;
        global.window = originals.window;
        global.document = originals.document;
        global.jQuery = originals.jQuery;
        global.$ = originals.dollar;
        global.rarData = originals.rarData;
        global.RARRaceLogic = originals.logic;
        global.confirm = originals.confirm;
    }

    return {
        $,
        harness,
        raceData,
        loadDashboard,
        clickLoadRace,
        setNow,
        clickSwitchAt,
        clickOkAt,
        clickUndo,
        clickEndAt,
        clickForecastRemove,
        triggerDelegatedChange,
        getDriverByOrder,
        restore,
    };
}

function createShortRaceData(overrides = {}) {
    return {
        race: {
            id: overrides.id || 24,
            race_name: overrides.raceName || 'Advanced Race',
            start_time: overrides.startTime || '2026-05-16 10:00:00',
            planned_end_time: overrides.plannedEndTime || '2026-05-16 10:20:00',
            first_lap_extra_time: overrides.firstLapExtraTime || 0,
            target_offset_time: overrides.targetOffsetTime || 0,
            rotation_sequence: overrides.rotationSequence || '1,2,3,4',
        },
        drivers: [
            { id: 1, driver_order: 1, driver_name: 'Daniel', avg_lap_time: overrides.lapTime || 300 },
            { id: 2, driver_order: 2, driver_name: 'Moritz', avg_lap_time: overrides.lapTime || 300 },
            { id: 3, driver_order: 3, driver_name: 'Heiko', avg_lap_time: overrides.lapTime || 300 },
            { id: 4, driver_order: 4, driver_name: 'Stefan', avg_lap_time: overrides.lapTime || 300 },
        ],
        rotations: [],
    };
}

test('manual race start click keeps first driver visible and start correction available', () => {
    const fixedNow = new Date('2026-05-16T15:15:00').getTime();
    const originalNow = Date.now;
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    const originalWindow = global.window;
    const originalDocument = global.document;
    const originalJquery = global.jQuery;
    const originalDollar = global.$;
    const originalRarData = global.rarData;
    const originalLogic = global.RARRaceLogic;

    Date.now = () => fixedNow;
    global.setInterval = () => 1;
    global.clearInterval = () => {};
    global.document = {};

    const harness = createJqueryHarness();
    const { $ } = harness;
    const raceData = {
        race: {
            id: 22,
            race_name: 'Test22',
            start_time: '2026-05-16 15:20:00',
            planned_end_time: '2026-05-17 14:03:00',
            first_lap_extra_time: 180,
            target_offset_time: 360,
            rotation_sequence: '1,2,3,4',
        },
        drivers: [
            { id: 1, driver_order: 1, driver_name: 'Daniel', avg_lap_time: 2700 },
            { id: 2, driver_order: 2, driver_name: 'Moritz', avg_lap_time: 2700 },
            { id: 3, driver_order: 3, driver_name: 'Heiko', avg_lap_time: 2700 },
            { id: 4, driver_order: 4, driver_name: 'Stefan', avg_lap_time: 2700 },
        ],
        rotations: [],
    };
    let startRaceRequests = 0;

    $.ajax = function(options) {
        if (options.data.action === 'rar_get_all_races') {
            options.success({ success: true, data: { races: [raceData.race] } });
        }

        if (options.data.action === 'rar_get_race_data') {
            options.success({ success: true, data: raceData });
        }

        if (options.data.action === 'rar_start_race') {
            startRaceRequests += 1;
            raceData.race.start_time = options.data.start_time;
            options.success({ success: true, data: {} });
        }

        return {
            then(resolve) {
                if (resolve) {
                    resolve({ success: true, data: {} });
                }
            },
        };
    };

    global.window = {
        rarData: {
            ajaxUrl: '/wp-admin/admin-ajax.php',
            nonce: 'nonce',
            canEdit: true,
        },
    };
    global.rarData = global.window.rarData;
    global.jQuery = $;
    global.$ = $;
    global.RARRaceLogic = logic;

    delete require.cache[require.resolve('../assets/js/dashboard.js')];

    try {
        require('../assets/js/dashboard.js');

        assert.match(harness.elements.get('#nextSwitchPreview').html(), /Startfahrer/);
        assert.match(harness.elements.get('#nextSwitchPreview').html(), /#1 Daniel/);

        harness.elements.get('#manualSwitchTime').val('2026-05-16T15:15:00');
        harness.elements.get('#switchDriverTimeOkBtn').trigger('click');

        assert.equal(startRaceRequests, 1);
        assert.match(harness.elements.get('#nextSwitchPreview').html(), /#1 Daniel/);
        assert.match(harness.elements.get('#nextSwitchPreview').html(), /#2 Moritz/);
        assert.match(harness.elements.get('#swapForecast').html(), /rar-forecast-order">#1/);
        assert.match(harness.elements.get('#swapForecast').html(), /rar-forecast-name">Daniel/);
        assert.equal(harness.elements.get('#switchDriverBtn').text(), 'Fahrerwechsel');
        assert.equal(harness.elements.get('#undoSwitchBtn').text(), 'Rennstart korrigieren');
    } finally {
        Date.now = originalNow;
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
        global.window = originalWindow;
        global.document = originalDocument;
        global.jQuery = originalJquery;
        global.$ = originalDollar;
        global.rarData = originalRarData;
        global.RARRaceLogic = originalLogic;
    }
});

test('accelerated click test can simulate a complete short race', () => {
    let now = new Date('2026-05-16T10:00:00').getTime();
    const originalNow = Date.now;
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    const originalWindow = global.window;
    const originalDocument = global.document;
    const originalJquery = global.jQuery;
    const originalDollar = global.$;
    const originalRarData = global.rarData;
    const originalLogic = global.RARRaceLogic;

    Date.now = () => now;
    global.setInterval = () => 1;
    global.clearInterval = () => {};
    global.document = {};

    const harness = createJqueryHarness();
    const { $ } = harness;
    const raceData = {
        race: {
            id: 23,
            race_name: 'Kurzrennen',
            start_time: '2026-05-16 10:00:00',
            planned_end_time: '2026-05-16 10:20:00',
            first_lap_extra_time: 0,
            target_offset_time: 0,
            rotation_sequence: '1,2,3,4',
        },
        drivers: [
            { id: 1, driver_order: 1, driver_name: 'Daniel', avg_lap_time: 300 },
            { id: 2, driver_order: 2, driver_name: 'Moritz', avg_lap_time: 300 },
            { id: 3, driver_order: 3, driver_name: 'Heiko', avg_lap_time: 300 },
            { id: 4, driver_order: 4, driver_name: 'Stefan', avg_lap_time: 300 },
        ],
        rotations: [],
    };

    function toMysqlDate(date) {
        return date.toISOString().slice(0, 19).replace('T', ' ');
    }

    function setNow(value) {
        now = new Date(value).getTime();
        harness.elements.get('#manualSwitchTime').val(value.slice(0, 19));
    }

    function clickSwitchAt(value) {
        setNow(value);
        harness.elements.get('#switchDriverBtn').trigger('click');
    }

    $.ajax = function(options) {
        if (options.data.action === 'rar_get_all_races') {
            options.success({ success: true, data: { races: [raceData.race] } });
        }

        if (options.data.action === 'rar_get_race_data') {
            options.success({ success: true, data: raceData });
        }

        if (options.data.action === 'rar_switch_driver') {
            const switchDrivers = logic.getNextSwitchDrivers(
                raceData,
                raceData.race.rotation_sequence,
                (value) => new Date(String(value).replace(' ', 'T'))
            );
            const switchedAt = options.data.switched_at || toMysqlDate(new Date(now));

            raceData.rotations.push({
                id: raceData.rotations.length + 1,
                from_driver_id: switchDrivers.from.id,
                to_driver_id: switchDrivers.to.id,
                from_driver: switchDrivers.from.driver_name,
                to_driver: switchDrivers.to.driver_name,
                switched_at: switchedAt,
            });

            options.success({
                success: true,
                data: {
                    from: switchDrivers.from,
                    to: switchDrivers.to,
                },
            });
        }

        return {
            then(resolve) {
                if (resolve) {
                    resolve({ success: true, data: {} });
                }
            },
        };
    };

    global.window = {
        rarData: {
            ajaxUrl: '/wp-admin/admin-ajax.php',
            nonce: 'nonce',
            canEdit: true,
        },
    };
    global.rarData = global.window.rarData;
    global.jQuery = $;
    global.$ = $;
    global.RARRaceLogic = logic;

    delete require.cache[require.resolve('../assets/js/dashboard.js')];

    try {
        require('../assets/js/dashboard.js');

        assert.match(harness.elements.get('#nextSwitchPreview').html(), /#1 Daniel/);
        assert.match(harness.elements.get('#nextSwitchPreview').html(), /#2 Moritz/);

        clickSwitchAt('2026-05-16T10:05:00');
        assert.equal(raceData.rotations.length, 1);
        assert.deepEqual(raceData.rotations.map((rotation) => `${rotation.from_driver}->${rotation.to_driver}`), [
            'Daniel->Moritz',
        ]);
        assert.match(harness.elements.get('#nextSwitchPreview').html(), /#2 Moritz/);
        assert.match(harness.elements.get('#nextSwitchPreview').html(), /#3 Heiko/);

        clickSwitchAt('2026-05-16T10:10:00');
        assert.equal(raceData.rotations.length, 2);
        assert.deepEqual(raceData.rotations.map((rotation) => `${rotation.from_driver}->${rotation.to_driver}`), [
            'Daniel->Moritz',
            'Moritz->Heiko',
        ]);
        assert.match(harness.elements.get('#nextSwitchPreview').html(), /#3 Heiko/);
        assert.match(harness.elements.get('#nextSwitchPreview').html(), /#4 Stefan/);

        clickSwitchAt('2026-05-16T10:15:00');
        assert.equal(raceData.rotations.length, 3);
        assert.deepEqual(raceData.rotations.map((rotation) => `${rotation.from_driver}->${rotation.to_driver}`), [
            'Daniel->Moritz',
            'Moritz->Heiko',
            'Heiko->Stefan',
        ]);
        assert.match(harness.elements.get('#nextSwitchPreview').html(), /#4 Stefan/);
        assert.match(harness.elements.get('#nextSwitchTimePreview').html(), /Ziel-Prognose/);
        assert.match(harness.elements.get('#swapForecast').html(), /Letzter Fahrer/);

        setNow('2026-05-16T10:21:00');
        harness.elements.get('#switchDriverTimeOkBtn').trigger('click');
        assert.equal(raceData.rotations.length, 4);
        assert.deepEqual(raceData.rotations.map((rotation) => `${rotation.from_driver}->${rotation.to_driver}`), [
            'Daniel->Moritz',
            'Moritz->Heiko',
            'Heiko->Stefan',
            'Stefan->Daniel',
        ]);
        assert.match(harness.elements.get('#swapForecast').html(), /Geplante Rennzeit erreicht/);
    } finally {
        Date.now = originalNow;
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
        global.window = originalWindow;
        global.document = originalDocument;
        global.jQuery = originalJquery;
        global.$ = originalDollar;
        global.rarData = originalRarData;
        global.RARRaceLogic = originalLogic;
    }
});

test('accelerated click test records manually corrected switch times', () => {
    const context = createDashboardClickTest(createShortRaceData({ id: 25 }), '2026-05-16T10:00:00');

    try {
        context.loadDashboard();

        context.clickSwitchAt('2026-05-16T10:05:00');
        assert.equal(context.raceData.rotations[0].switched_at, '2026-05-16 10:05:00');

        context.setNow('2026-05-16T10:12:00');
        context.harness.elements.get('#manualSwitchTime').val('2026-05-16T10:09:37');
        context.harness.elements.get('#switchDriverTimeOkBtn').trigger('click');

        assert.equal(context.raceData.rotations.length, 2);
        assert.deepEqual(context.raceData.rotations.map((rotation) => `${rotation.from_driver}->${rotation.to_driver}`), [
            'Daniel->Moritz',
            'Moritz->Heiko',
        ]);
        assert.equal(context.raceData.rotations[1].switched_at, '2026-05-16 10:09:37');
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /#3 Heiko/);
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /#4 Stefan/);
    } finally {
        context.restore();
    }
});

test('advanced queue quick edit changes upcoming drivers and still reaches race end', () => {
    const context = createDashboardClickTest(createShortRaceData({ id: 26 }), '2026-05-16T10:00:00');

    try {
        context.loadDashboard();

        context.clickForecastRemove(1);
        assert.equal(context.raceData.race.rotation_sequence, '1,3,4,1');
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /#1 Daniel/);
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /#3 Heiko/);

        context.clickSwitchAt('2026-05-16T10:05:00');
        assert.deepEqual(context.raceData.rotations.map((rotation) => `${rotation.from_driver}->${rotation.to_driver}`), [
            'Daniel->Heiko',
        ]);
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /#3 Heiko/);
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /#4 Stefan/);

        context.clickForecastRemove(2);
        assert.equal(context.raceData.race.rotation_sequence, '1,3,1,2');
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /#3 Heiko/);
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /#1 Daniel/);

        context.clickSwitchAt('2026-05-16T10:10:00');
        context.clickSwitchAt('2026-05-16T10:15:00');
        context.clickOkAt('2026-05-16T10:21:00');

        assert.deepEqual(context.raceData.rotations.map((rotation) => `${rotation.from_driver}->${rotation.to_driver}`), [
            'Daniel->Heiko',
            'Heiko->Daniel',
            'Daniel->Moritz',
            'Moritz->Daniel',
        ]);
        assert.match(context.harness.elements.get('#swapForecast').html(), /Geplante Rennzeit erreicht/);
    } finally {
        context.restore();
    }
});

test('advanced queue quick edit supports repeated bottom removals without stalling', () => {
    const context = createDashboardClickTest(createShortRaceData({ id: 27 }), '2026-05-16T10:00:00');

    try {
        context.loadDashboard();

        context.clickForecastRemove(3);
        assert.equal(context.raceData.race.rotation_sequence, '1,2,3,1');
        assert.match(context.harness.elements.get('#swapForecast').html(), /rar-forecast-order">#1/);

        context.clickForecastRemove(3);
        assert.equal(context.raceData.race.rotation_sequence, '1,2,3,2');
        assert.match(context.harness.elements.get('#swapForecast').html(), /rar-forecast-order">#2/);

        context.clickForecastRemove(3);
        assert.equal(context.raceData.race.rotation_sequence, '1,2,3,3');
        assert.match(context.harness.elements.get('#swapForecast').html(), /rar-forecast-order">#3/);

        context.clickSwitchAt('2026-05-16T10:05:00');
        context.clickSwitchAt('2026-05-16T10:10:00');
        context.clickSwitchAt('2026-05-16T10:15:00');

        assert.deepEqual(context.raceData.rotations.map((rotation) => `${rotation.from_driver}->${rotation.to_driver}`), [
            'Daniel->Moritz',
            'Moritz->Heiko',
            'Heiko->Heiko',
        ]);
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /#3 Heiko/);
    } finally {
        context.restore();
    }
});

test('advanced start correction keeps second precision before first real switch', () => {
    const context = createDashboardClickTest(
        createShortRaceData({
            id: 28,
            startTime: '2026-05-16 10:00:00',
            plannedEndTime: '2026-05-16 10:20:37',
        }),
        '2026-05-16T09:50:00'
    );

    try {
        context.loadDashboard();

        assert.equal(context.harness.elements.get('#undoSwitchBtn').text(), 'Rennstart korrigieren');
        context.harness.elements.get('#manualSwitchTime').val('2026-05-16T10:00:37');
        context.clickUndo();

        assert.equal(context.raceData.race.start_time, '2026-05-16 10:00:37');
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /Startfahrer/);
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /#1 Daniel/);

        context.clickSwitchAt('2026-05-16T10:05:37');
        assert.deepEqual(context.raceData.rotations.map((rotation) => `${rotation.from_driver}->${rotation.to_driver}@${rotation.switched_at}`), [
            'Daniel->Moritz@2026-05-16 10:05:37',
        ]);
    } finally {
        context.restore();
    }
});

test('advanced undo restores the previous current driver and can continue racing', () => {
    const context = createDashboardClickTest(createShortRaceData({ id: 29 }), '2026-05-16T10:00:00');

    try {
        context.loadDashboard();

        context.clickSwitchAt('2026-05-16T10:05:00');
        context.clickSwitchAt('2026-05-16T10:10:00');
        assert.deepEqual(context.raceData.rotations.map((rotation) => `${rotation.from_driver}->${rotation.to_driver}`), [
            'Daniel->Moritz',
            'Moritz->Heiko',
        ]);

        context.clickUndo();
        assert.deepEqual(context.raceData.rotations.map((rotation) => `${rotation.from_driver}->${rotation.to_driver}`), [
            'Daniel->Moritz',
        ]);
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /#2 Moritz/);
        assert.match(context.harness.elements.get('#nextSwitchPreview').html(), /#3 Heiko/);

        context.clickSwitchAt('2026-05-16T10:10:42');
        assert.deepEqual(context.raceData.rotations.map((rotation) => `${rotation.from_driver}->${rotation.to_driver}@${rotation.switched_at}`), [
            'Daniel->Moritz@2026-05-16 10:05:00',
            'Moritz->Heiko@2026-05-16 10:10:42',
        ]);
    } finally {
        context.restore();
    }
});

test('advanced read only mode blocks switches, queue edits and race end clicks', () => {
    const context = createDashboardClickTest(createShortRaceData({ id: 30 }), '2026-05-16T10:00:00', {
        canEdit: false,
        publicView: true,
    });

    try {
        context.loadDashboard();

        assert.doesNotMatch(context.harness.elements.get('#swapForecast').html(), /rar-forecast-remove/);
        context.clickSwitchAt('2026-05-16T10:05:00');
        context.clickForecastRemove(1);
        context.clickEndAt('2026-05-16T10:30:00');

        assert.deepEqual(context.raceData.rotations, []);
        assert.equal(context.raceData.race.rotation_sequence, '1,2,3,4');
        assert.equal(context.raceData.race.end_time, undefined);
        assert.equal(context.harness.elements.get('#switchDriverBtn').prop('disabled'), true);
        assert.equal(context.harness.elements.get('#manualSwitchTime').prop('disabled'), true);
    } finally {
        context.restore();
    }
});

test('advanced end race click records end time and resets loaded race state', () => {
    const context = createDashboardClickTest(createShortRaceData({ id: 31 }), '2026-05-16T10:00:00', {
        publicView: false,
    });

    try {
        context.loadDashboard();
        context.clickLoadRace();
        context.clickSwitchAt('2026-05-16T10:05:00');
        context.clickEndAt('2026-05-16T10:17:23');

        assert.equal(context.raceData.race.end_time, '2026-05-16 10:17:23');
        assert.equal(context.harness.elements.get('#setupSummaryStatus').text(), 'Kein Rennen geladen');
        assert.equal(context.harness.elements.get('#exportRaceBtn').attr('href'), '#');
    } finally {
        context.restore();
    }
});

test('advanced driver name save re-enables the input when focused rows skip rerender', () => {
    const context = createDashboardClickTest(createShortRaceData({ id: 32 }), '2026-05-16T10:00:00');

    try {
        context.loadDashboard();
        context.harness.setFocusMatchLength(1);

        const input = createElement('.rar-driver-name-input');
        input.data('driver-id', 1);
        input.val('Daniel Sekunden');

        context.triggerDelegatedChange('.rar-driver-name-input', input);

        assert.equal(context.raceData.drivers[0].driver_name, 'Daniel Sekunden');
        assert.equal(input.prop('disabled'), false);
    } finally {
        context.restore();
    }
});
