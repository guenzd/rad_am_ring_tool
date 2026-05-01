/**
 * Rad am Ring Dashboard JavaScript
 */

jQuery(document).ready(function($) {
    let currentRaceId = null;
    let raceData = null;
    let forecastTimer = null;
    let canEdit = !!(window.rarData && window.rarData.canEdit);
    let publicMode = !!(window.rarData && window.rarData.publicMode);
    let publicRaceId = parseInt((window.rarData && window.rarData.raceId) || 0, 10);
    let queueEditorState = {
        oneTime: [],
        repeat: []
    };

    // Load all races on startup
    setDefaultRaceTimes();
    loadAllRaces();
    applyReadOnlyState();

    /**
     * Load all races
     */
    function loadAllRaces() {
        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_get_all_races',
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    let races = response.data.races || [];

                    $('#raceSelect').empty().append('<option value="">-- Rennen wählen --</option>');
                    races.forEach(function(race) {
                        $('#raceSelect').append(
                            '<option value="' + race.id + '">' + race.race_name + ' (' + race.start_time + ')</option>'
                        );
                    });

                    if (publicMode) {
                        loadPublicRace(races);
                    }
                }
            }
        });
    }

    function loadPublicRace(races) {
        if (currentRaceId) {
            return;
        }

        let selectedRace = null;

        if (publicRaceId > 0) {
            selectedRace = races.find(function(race) {
                return parseInt(race.id, 10) === publicRaceId;
            });
        }

        if (!selectedRace && races.length > 0) {
            selectedRace = races[0];
        }

        if (!selectedRace) {
            $('#publicRaceEmpty').show();
            return;
        }

        currentRaceId = selectedRace.id;
        loadRaceData();
    }

    /**
     * Create new race
     */
    $('#createRaceBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        let raceName = $('#raceName').val().trim();
        let startTime = $('#raceStartTime').val();
        let plannedEndTime = $('#plannedEndTime').val();
        let firstLapExtraTime = parseFloat($('#firstLapExtraTime').val());
        
        if (!raceName) {
            showMessage('Bitte geben Sie einen Rennamen ein', 'error');
            return;
        }

        if (!startTime || !plannedEndTime) {
            showMessage('Bitte geben Sie Startzeit und geplante Zielzeit ein', 'error');
            return;
        }

        if (new Date(plannedEndTime).getTime() <= new Date(startTime).getTime()) {
            showMessage('Die geplante Zielzeit muss nach der Startzeit liegen', 'error');
            return;
        }

        if (Number.isNaN(firstLapExtraTime) || firstLapExtraTime < 0) {
            showMessage('Bitte geben Sie eine gültige Zusatzzeit für die erste Runde ein', 'error');
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_create_race',
                race_name: raceName,
                start_time: startTime.replace('T', ' '),
                planned_end_time: plannedEndTime.replace('T', ' '),
                first_lap_extra_time: firstLapExtraTime * 60,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    currentRaceId = response.data.race_id;
                    $('#raceName').val('');
                    $('#firstLapExtraTime').val('0');
                    setDefaultRaceTimes();
                    showMessage('Rennen erfolgreich erstellt!', 'success');
                    loadAllRaces();
                    loadRaceData();
                } else {
                    showMessage('Fehler beim Erstellen des Rennens: ' + response.data, 'error');
                }
            },
            error: function() {
                showMessage('AJAX-Fehler', 'error');
            }
        });
    });

    /**
     * Load selected race
     */
    $('#loadRaceBtn').on('click', function() {
        let raceId = $('#raceSelect').val();
        
        if (!raceId) {
            showMessage('Bitte wählen Sie ein Rennen', 'error');
            return;
        }

        currentRaceId = raceId;
        loadRaceData();
    });

    /**
     * Load race data and display it
     */
    function loadRaceData() {
        if (!currentRaceId) {
            showMessage('Kein Rennen ausgewählt', 'error');
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_get_race_data',
                race_id: currentRaceId,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    raceData = response.data;
                    $('#activeRaceName').text(raceData.race.race_name);
                    $('#setupSummaryStatus').text(raceData.race.race_name);
                    $('#raceSetupPanel').prop('open', false);
                    $('#rotationSequence').val(raceData.race.rotation_sequence || '');
                    renderRotationEditor();
                    updateManualTimeInputs();
                    updateRaceConfig();
                    $('#raceContent').show();
                    
                    updateDriversList();
                    updateSwapForecast();
                    updateLapPrognosis();
                    updateNextSwitchPreview();
                    startForecastTimer();
                    updateSwitchLog();
                    applyReadOnlyState();
                    if (!publicMode) {
                        showMessage('Rennen geladen!', 'success');
                    }
                } else {
                    showMessage('Fehler beim Laden des Rennens: ' + response.data, 'error');
                }
            }
        });
    }

    /**
     * Add driver
     */
    $('#addDriverBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        if (!currentRaceId) {
            showMessage('Bitte wählen Sie zuerst ein Rennen', 'error');
            return;
        }

        let driverName = $('#driverName').val().trim();
        let avgLapTime = parseFloat($('#avgLapTime').val());

        if (!driverName) {
            showMessage('Bitte geben Sie einen Fahrernamen ein', 'error');
            return;
        }

        if (Number.isNaN(avgLapTime) || avgLapTime <= 0) {
            showMessage('Bitte geben Sie die Rundenzeit des Fahrers in Minuten ein', 'error');
            return;
        }

        // Convert minutes to seconds
        let avgLapTimeSeconds = avgLapTime * 60;

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_add_driver',
                race_id: currentRaceId,
                driver_name: driverName,
                avg_lap_time: avgLapTimeSeconds,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    $('#driverName').val('');
                    $('#avgLapTime').val('');
                    showMessage('Fahrer hinzugefügt!', 'success');
                    loadRaceData();
                } else {
                    showMessage('Fehler beim Hinzufügen des Fahrers: ' + response.data, 'error');
                }
            }
        });
    });

    /**
     * Save editable driver rotation sequence
     */
    $('#saveRotationSequenceBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        if (!currentRaceId) {
            showMessage('Bitte wählen Sie zuerst ein Rennen', 'error');
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_save_rotation_sequence',
                race_id: currentRaceId,
                rotation_sequence: serializeRotationEditor(),
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    showMessage('Fahrerfolge gespeichert!', 'success');
                    loadRaceData();
                } else {
                    showMessage('Fehler beim Speichern der Folge: ' + response.data, 'error');
                }
            },
            error: function() {
                showMessage('AJAX-Fehler', 'error');
            }
        });
    });

    $('#startRaceBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        if (!currentRaceId) {
            showMessage('Bitte wählen Sie zuerst ein Rennen', 'error');
            return;
        }

        if ($(this).prop('disabled')) {
            return;
        }

        let manualStartTime = $('#manualStartTime').val();
        let startTime = raceData && raceData.race ? parseWpDate(raceData.race.start_time) : null;
        let startTimeValue = startTime ? formatDateTimeLocal(startTime) : '';
        let isCorrection = manualStartTime && manualStartTime !== startTimeValue;

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_start_race',
                race_id: currentRaceId,
                start_time: isCorrection ? manualStartTime.replace('T', ' ') : '',
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    showMessage(isCorrection ? 'Startzeit korrigiert!' : 'Rennen gestartet!', 'success');
                    loadRaceData();
                } else {
                    showMessage('Fehler beim Setzen der Startzeit: ' + response.data, 'error');
                }
            },
            error: function() {
                showMessage('AJAX-Fehler', 'error');
            }
        });
    });

    $('#manualStartTime').on('input change', function() {
        updateStartRaceButton();
    });

    $('#applyRotationPatternBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        applyRotationPatternInput();
    });

    $('#rotationPatternInput').on('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (!ensureCanEdit()) {
                return;
            }
            applyRotationPatternInput();
        }
    });

    $('#clearRotationPatternBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        queueEditorState = {
            oneTime: [],
            repeat: []
        };
        syncRotationEditor();
    });

    $(document).on('click', '.rar-queue-add-btn', function() {
        if (!ensureCanEdit()) {
            return;
        }

        let queueName = $(this).data('queue');
        let driverOrder = parseInt($(this).data('driver-order'), 10);

        if (!queueEditorState[queueName] || Number.isNaN(driverOrder)) {
            return;
        }

        queueEditorState[queueName].push(driverOrder);
        syncRotationEditor();
    });

    $(document).on('change', '.rar-queue-driver-select', function() {
        if (!ensureCanEdit()) {
            return;
        }

        let item = $(this).closest('.rar-queue-item');
        let queueName = item.data('queue');
        let index = parseInt(item.data('index'), 10);
        let driverOrder = parseInt($(this).val(), 10);

        if (!queueEditorState[queueName] || Number.isNaN(index) || Number.isNaN(driverOrder)) {
            return;
        }

        queueEditorState[queueName][index] = driverOrder;
        syncRotationEditor();
    });

    $(document).on('click', '.rar-queue-remove', function() {
        if (!ensureCanEdit()) {
            return;
        }

        let queueName = $(this).closest('.rar-queue-item').data('queue');
        let index = parseInt($(this).closest('.rar-queue-item').data('index'), 10);

        queueEditorState[queueName].splice(index, 1);
        syncRotationEditor();
    });

    $(document).on('click', '.rar-queue-move', function() {
        if (!ensureCanEdit()) {
            return;
        }

        let direction = $(this).data('direction');
        let item = $(this).closest('.rar-queue-item');
        let queueName = item.data('queue');
        let index = parseInt(item.data('index'), 10);
        let targetIndex = direction === 'up' ? index - 1 : index + 1;

        moveQueueItem(queueName, index, targetIndex);
    });

    $(document).on('dragstart', '.rar-queue-item', function(event) {
        if (!canEdit) {
            event.preventDefault();
            return;
        }

        event.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
            queue: $(this).data('queue'),
            index: $(this).data('index')
        }));
        event.originalEvent.dataTransfer.effectAllowed = 'move';
    });

    $(document).on('dragover', '.rar-queue-list, .rar-queue-item', function(event) {
        event.preventDefault();
    });

    $(document).on('drop', '.rar-queue-list, .rar-queue-item', function(event) {
        event.preventDefault();

        if (!ensureCanEdit()) {
            return;
        }

        let payload = JSON.parse(event.originalEvent.dataTransfer.getData('text/plain') || '{}');
        let targetList = $(this).hasClass('rar-queue-list') ? $(this) : $(this).closest('.rar-queue-list');
        let targetQueue = targetList.data('queue');
        let targetIndex = $(this).hasClass('rar-queue-item')
            ? parseInt($(this).data('index'), 10)
            : queueEditorState[targetQueue].length;

        if (!queueEditorState[payload.queue] || !queueEditorState[targetQueue]) {
            return;
        }

        moveQueueItem(payload.queue, parseInt(payload.index, 10), targetIndex, targetQueue);
    });

    /**
     * Switch driver
     */
    $('#switchDriverBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        let switchDrivers = getNextSwitchDrivers();

        if (!switchDrivers) {
            showMessage('Kein Fahrerwechsel möglich', 'error');
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_switch_driver',
                race_id: currentRaceId,
                from_driver_id: switchDrivers.from.id,
                to_driver_id: switchDrivers.to.id,
                switched_at: $('#manualSwitchTime').val() ? $('#manualSwitchTime').val().replace('T', ' ') : '',
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    showMessage('Fahrerwechsel: ' + switchDrivers.from.driver_name + ' zu ' + switchDrivers.to.driver_name, 'success');
                    loadRaceData();
                } else {
                    showMessage('Fehler beim Wechsel des Fahrers: ' + response.data, 'error');
                }
            }
        });
    });

    $('#undoSwitchBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        if (!currentRaceId) {
            showMessage('Bitte wählen Sie zuerst ein Rennen', 'error');
            return;
        }

        if (!confirm('Letzten Fahrerwechsel wirklich rückgängig machen?')) {
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_undo_driver_switch',
                race_id: currentRaceId,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    showMessage('Letzter Fahrerwechsel rückgängig gemacht', 'success');
                    loadRaceData();
                } else {
                    showMessage('Fehler beim Rückgängig machen: ' + response.data, 'error');
                }
            },
            error: function() {
                showMessage('AJAX-Fehler', 'error');
            }
        });
    });

    /**
     * End race
     */
    $('#endRaceBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        if (!confirm('Sind Sie sicher, dass Sie dieses Rennen beenden möchten?')) {
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_end_race',
                race_id: currentRaceId,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    currentRaceId = null;
                    $('#raceContent').hide();
                    $('#setupSummaryStatus').text('Kein Rennen geladen');
                    $('#raceSetupPanel').prop('open', true);
                    stopForecastTimer();
                    showMessage('Rennen beendet!', 'success');
                    loadAllRaces();
                } else {
                    showMessage('Fehler beim Beenden des Rennens: ' + response.data, 'error');
                }
            }
        });
    });

    /**
     * Update race configuration display
     */
    function updateRaceConfig() {
        let firstLapExtraMinutes = 0;
        let startTime = raceData && raceData.race ? parseWpDate(raceData.race.start_time) : null;
        let plannedEndTime = raceData && raceData.race ? parseWpDate(raceData.race.planned_end_time) : null;

        if (raceData && raceData.race && raceData.race.first_lap_extra_time) {
            firstLapExtraMinutes = parseFloat(raceData.race.first_lap_extra_time) / 60;
        }

        $('#raceConfig').text(
            'Start: ' + (startTime ? formatDateTime(startTime) : '--') +
            ' | Ziel: ' + (plannedEndTime ? formatDateTime(plannedEndTime) : '--') +
            ' | Erste Runde: +' + firstLapExtraMinutes.toFixed(2) + ' Minuten' +
            ' | Letzte Runde: -' + firstLapExtraMinutes.toFixed(2) + ' Minuten'
        );
    }

    function updateManualTimeInputs() {
        let startTime = raceData && raceData.race ? parseWpDate(raceData.race.start_time) : null;

        $('#manualStartTime').val(startTime ? formatDateTimeLocal(startTime) : formatDateTimeLocal(new Date()));
        $('#manualSwitchTime').val(formatDateTimeLocal(new Date()));
        updateStartRaceButton();
        applyReadOnlyState();
    }

    function updateStartRaceButton() {
        let $button = $('#startRaceBtn');

        if (!raceData || !raceData.race) {
            $button.prop('disabled', true).text('Rennen jetzt starten');
            return;
        }

        let startTime = parseWpDate(raceData.race.start_time);
        let manualStartTime = $('#manualStartTime').val();
        let startTimeValue = startTime ? formatDateTimeLocal(startTime) : '';
        let isCorrection = manualStartTime && manualStartTime !== startTimeValue;
        let isRunning = startTime && Date.now() >= startTime.getTime();

        if (isCorrection) {
            $button.prop('disabled', false).text('Startzeit korrigieren');
            applyReadOnlyState();
            return;
        }

        if (isRunning) {
            $button.prop('disabled', true).text('Rennen läuft');
            applyReadOnlyState();
            return;
        }

        $button.prop('disabled', false).text('Rennen jetzt starten');
        applyReadOnlyState();
    }

    /**
     * Update drivers list display
     */
    function updateDriversList() {
        let html = '';
        let lapStats = getInferredLapStats();
        
        if (!raceData || !raceData.drivers || raceData.drivers.length === 0) {
            html = '<p>Noch keine Fahrer</p>';
        } else {
            raceData.drivers.forEach(function(driver) {
                let stats = lapStats.byDriver[driver.id] || { count: 0, total: 0, recentAverage: null };

                html += '<div class="rar-driver-card">' +
                    '<div class="rar-driver-order">#' + driver.driver_order + '</div>' +
                    '<div class="rar-driver-name">' + escapeHtml(driver.driver_name) + '</div>' +
                    '<div class="rar-driver-stat">Runden: ' + stats.count + '</div>' +
                    '<div class="rar-driver-stat">Plan: ' + (driver.avg_lap_time ? (driver.avg_lap_time / 60).toFixed(2) : '--') + ' min</div>' +
                    '<div class="rar-driver-stat">3er Ø: ' + (stats.recentAverage ? (stats.recentAverage / 60).toFixed(2) : '--') + ' min</div>' +
                    '<div class="rar-driver-stat">Gesamt: ' + (stats.total ? (stats.total / 60).toFixed(1) : '--') + ' min</div>' +
                    '</div>';
            });
        }

        $('#driversList').html(html);
    }

    /**
     * Update upcoming driver swaps from the default rotation order.
     */
    function updateSwapForecast() {
        let html = '';

        if (!raceData || !raceData.drivers || raceData.drivers.length === 0) {
            $('#swapForecast').html('<p>Noch keine Fahrer</p>');
            return;
        }

        let drivers = raceData.drivers;
        let sequence = parseRotationSequence(getCurrentRotationSequenceValue());
        let lapStats = getInferredLapStats();
        let firstLapExtra = parseFloat(raceData.race.first_lap_extra_time || 0);
        let baseTime = getForecastBaseTime(lapStats);
        let plannedEndTime = parseWpDate(raceData.race.planned_end_time);
        let recordedLaps = lapStats.completedLaps;

        if (!baseTime) {
            $('#swapForecast').html('<p>Keine Prognose möglich</p>');
            return;
        }

        if (plannedEndTime && baseTime.getTime() >= plannedEndTime.getTime()) {
            $('#swapForecast').html('<p>Geplante Rennzeit erreicht</p>');
            return;
        }

        let projectedTime = new Date(baseTime.getTime());
        let forecastCount = Math.min(Math.max(getRotationCycleLength(sequence, drivers.length) * 3, 16), 80);
        let renderedCount = 0;

        for (let i = 0; i < forecastCount; i++) {
            let lapIndex = recordedLaps + i;
            let driver = getDriverForLap(lapIndex, drivers, sequence);

            if (!driver) {
                continue;
            }

            let lapSeconds = getForecastLapSeconds(driver, lapStats);

            if (lapIndex === 0) {
                lapSeconds += firstLapExtra;
            }

            let normalCrossingTime = new Date(projectedTime.getTime() + (lapSeconds * 1000));
            let isFinalLap = plannedEndTime && normalCrossingTime.getTime() >= plannedEndTime.getTime();

            if (isFinalLap) {
                let finalLapSeconds = Math.max(1, lapSeconds - firstLapExtra);
                let finalCrossingTime = new Date(projectedTime.getTime() + (finalLapSeconds * 1000));

                if (finalCrossingTime.getTime() > plannedEndTime.getTime()) {
                    break;
                }

                lapSeconds = finalLapSeconds;
            }

            projectedTime = new Date(projectedTime.getTime() + (lapSeconds * 1000));

            html += '<div class="rar-forecast-item' + (i === 0 ? ' is-current' : '') + (isFinalLap ? ' is-final' : '') + '">' +
                '<div class="rar-forecast-main">' +
                    '<span class="rar-forecast-order">#' + driver.driver_order + '</span>' +
                    '<span class="rar-forecast-name">' + escapeHtml(driver.driver_name) + '</span>' +
                '</div>' +
                '<div class="rar-forecast-meta">' +
                    '<span>' + (isFinalLap ? 'Zielrunde ' : '') + formatTime(projectedTime) + '</span>' +
                    '<strong>' + formatCountdown(projectedTime) + '</strong>' +
                '</div>' +
                '</div>';
            renderedCount++;

            if (isFinalLap) {
                break;
            }
        }

        if (!html && plannedEndTime) {
            html = '<p>Kein weiterer Fahrer erreicht die Cutoff-Zeit</p>';
        } else if (html && renderedCount >= 16) {
            html += '<div class="rar-forecast-note">Weitere Fahrer folgen nach gespeicherter Folge.</div>';
        }

        $('#swapForecast').html(html);
    }

    function updateLapPrognosis() {
        let prognosis = calculateLapPrognosis();

        if (!prognosis) {
            $('#lapPrognosis').html('<strong>--</strong><span>Runden-Prognose</span>');
            return;
        }

        $('#lapPrognosis').html(
            '<strong>' + prognosis.laps + '</strong>' +
            '<span>Runden-Prognose</span>' +
            '<em class="is-' + prognosis.closenessClass + '">' + prognosis.closenessLabel + ' · ' + prognosis.bufferLabel + '</em>'
        );
    }

    function calculateLapPrognosis() {
        if (!raceData || !raceData.drivers || raceData.drivers.length === 0) {
            return null;
        }

        let startTime = parseWpDate(raceData.race.start_time);
        let plannedEndTime = parseWpDate(raceData.race.planned_end_time);
        let basePrognosis = RARRaceLogic.calculateLapPrognosis(raceData, getCurrentRotationSequenceValue(), parseWpDate);

        if (!basePrognosis || !startTime || !plannedEndTime) {
            return null;
        }

        let lapStats = getInferredLapStats();
        let closeness = getPrognosisCloseness(startTime, plannedEndTime, lapStats);

        return {
            laps: basePrognosis.laps,
            closenessClass: closeness.className,
            closenessLabel: closeness.label,
            bufferLabel: formatBuffer(basePrognosis.bufferMinutes)
        };
    }

    function formatBuffer(bufferMinutes) {
        let prefix = bufferMinutes < 0 ? '-' : '+';
        let absoluteMinutes = Math.abs(bufferMinutes);
        let hours = Math.floor(absoluteMinutes / 60);
        let minutes = absoluteMinutes % 60;

        if (hours > 0) {
            return prefix + hours + 'h ' + String(minutes).padStart(2, '0') + 'm Puffer';
        }

        return prefix + minutes + 'm Puffer';
    }

    function getPrognosisCloseness(startTime, plannedEndTime, lapStats) {
        let now = new Date();
        let raceDuration = plannedEndTime.getTime() - startTime.getTime();
        let elapsedRatio = Math.max(0, Math.min(1, (now.getTime() - startTime.getTime()) / raceDuration));
        let driversWithActuals = raceData.drivers.filter(function(driver) {
            return lapStats.byDriver[driver.id] && lapStats.byDriver[driver.id].count > 0;
        }).length;
        let actualRatio = raceData.drivers.length ? driversWithActuals / raceData.drivers.length : 0;
        let score = Math.round(((elapsedRatio * 0.65) + (actualRatio * 0.35)) * 100);

        if (score >= 70) {
            return { className: 'high', label: 'nah ' + score + '%' };
        }

        if (score >= 35) {
            return { className: 'medium', label: 'mittel ' + score + '%' };
        }

        return { className: 'low', label: 'grob ' + score + '%' };
    }

    function getRotationCycleLength(sequence, driverCount) {
        return RARRaceLogic.getRotationCycleLength(sequence, driverCount);
    }

    function parseRotationSequence(value) {
        return RARRaceLogic.parseRotationSequence(value);
    }

    function getCurrentRotationSequenceValue() {
        return $('#rotationSequence').val() || (raceData && raceData.race ? raceData.race.rotation_sequence : '') || '';
    }

    function renderRotationEditor() {
        let sequence = parseRotationSequence($('#rotationSequence').val());

        queueEditorState = {
            oneTime: sequence.oneTime.slice(),
            repeat: sequence.repeat.slice()
        };

        updateRotationPatternInput();
        renderQueueDriverButtons();
        renderQueueLists();
    }

    function renderQueueDriverButtons() {
        let html = '';

        if (!raceData || !raceData.drivers || raceData.drivers.length === 0) {
            $('#queueDriverButtons').html('<p>Noch keine Fahrer</p>');
            return;
        }

        raceData.drivers.forEach(function(driver) {
            let label = '#' + driver.driver_order + ' ' + escapeHtml(driver.driver_name);

            html += '<div class="rar-queue-button-row">' +
                '<span>' + label + '</span>' +
                '<button type="button" class="rar-mini-btn rar-queue-add-btn" data-queue="oneTime" data-driver-order="' + driver.driver_order + '">Einmal</button>' +
                '<button type="button" class="rar-mini-btn rar-queue-add-btn" data-queue="repeat" data-driver-order="' + driver.driver_order + '">Repeat</button>' +
                '</div>';
        });

        $('#queueDriverButtons').html(html);
        applyReadOnlyState();
    }

    function renderQueueLists() {
        renderQueueList('oneTime', '#oneTimeQueue');
        renderQueueList('repeat', '#repeatQueue');
    }

    function renderQueueList(queueName, selector) {
        let html = '';

        queueEditorState[queueName].forEach(function(driverOrder, index) {
            let driver = getDriverByOrder(driverOrder);
            let name = driver ? driver.driver_name : 'Unbekannt';

            html += '<div class="rar-queue-item" draggable="true" data-queue="' + queueName + '" data-index="' + index + '">' +
                '<span class="rar-queue-grip">::</span>' +
                '<strong>#' + driverOrder + ' ' + escapeHtml(name) + '</strong>' +
                '<select class="rar-queue-driver-select" aria-label="Fahrer an dieser Position ändern">' + renderQueueDriverOptions(driverOrder) + '</select>' +
                '<button type="button" class="rar-mini-icon rar-queue-move" data-direction="up">Up</button>' +
                '<button type="button" class="rar-mini-icon rar-queue-move" data-direction="down">Down</button>' +
                '<button type="button" class="rar-mini-icon rar-queue-remove">X</button>' +
                '</div>';
        });

        if (!html) {
            html = '<p>Leer</p>';
        }

        $(selector).html(html);
        applyReadOnlyState();
    }

    function syncRotationEditor() {
        $('#rotationSequence').val(serializeRotationEditor());
        updateRotationPatternInput();
        renderQueueLists();
        updateSwapForecast();
        updateLapPrognosis();
        updateNextSwitchPreview();
    }

    function serializeRotationEditor() {
        return RARRaceLogic.serializeRotationSequence(queueEditorState.oneTime, queueEditorState.repeat);
    }

    function applyRotationPatternInput() {
        let sequence = parseRotationSequence($('#rotationPatternInput').val());

        queueEditorState = {
            oneTime: sequence.oneTime.slice(),
            repeat: sequence.repeat.slice()
        };

        syncRotationEditor();
    }

    function updateRotationPatternInput() {
        $('#rotationPatternInput').val(serializeRotationEditor());
    }

    function renderQueueDriverOptions(selectedOrder) {
        let html = '';

        if (!raceData || !raceData.drivers) {
            return html;
        }

        raceData.drivers.forEach(function(driver) {
            let driverOrder = parseInt(driver.driver_order, 10);
            let selected = driverOrder === parseInt(selectedOrder, 10) ? ' selected' : '';

            html += '<option value="' + driverOrder + '"' + selected + '>#' + driver.driver_order + ' ' + escapeHtml(driver.driver_name) + '</option>';
        });

        if (!getDriverByOrder(selectedOrder)) {
            html = '<option value="' + selectedOrder + '" selected>Unbekannt #' + selectedOrder + '</option>' + html;
        }

        return html;
    }

    function moveQueueItem(sourceQueue, sourceIndex, targetIndex, targetQueue) {
        targetQueue = targetQueue || sourceQueue;

        if (
            Number.isNaN(sourceIndex) ||
            Number.isNaN(targetIndex) ||
            !queueEditorState[sourceQueue] ||
            !queueEditorState[targetQueue] ||
            sourceIndex < 0 ||
            sourceIndex >= queueEditorState[sourceQueue].length
        ) {
            return;
        }

        let item = queueEditorState[sourceQueue].splice(sourceIndex, 1)[0];

        if (sourceQueue === targetQueue && targetIndex > sourceIndex) {
            targetIndex--;
        }

        targetIndex = Math.max(0, Math.min(targetIndex, queueEditorState[targetQueue].length));
        queueEditorState[targetQueue].splice(targetIndex, 0, item);
        syncRotationEditor();
    }

    function parseSequencePart(value) {
        return RARRaceLogic.parseSequencePart(value);
    }

    function getDriverForLap(lapIndex, drivers, sequence) {
        return RARRaceLogic.getDriverForLap(lapIndex, drivers, sequence);
    }

    function getInferredLapStats() {
        return RARRaceLogic.getInferredLapStats(raceData, parseWpDate);
    }

    function getForecastBaseTime(lapStats) {
        if (lapStats.latestSwitchTime) {
            return lapStats.latestSwitchTime;
        }

        return raceData && raceData.race ? parseWpDate(raceData.race.start_time) : null;
    }

    function getForecastLapSeconds(driver, lapStats) {
        return RARRaceLogic.getForecastLapSeconds(driver, lapStats);
    }

    function getNextSwitchDrivers() {
        return RARRaceLogic.getNextSwitchDrivers(raceData, getCurrentRotationSequenceValue(), parseWpDate);
    }

    function getOrderedRotations() {
        return RARRaceLogic.getOrderedRotations(raceData, parseWpDate);
    }

    function ensureCanEdit() {
        if (canEdit) {
            return true;
        }

        showMessage('Nur-Lese-Modus: keine Änderungen erlaubt', 'error');
        applyReadOnlyState();
        return false;
    }

    function applyReadOnlyState() {
        $('#readOnlyBadge').toggle(!canEdit);

        if (canEdit) {
            return;
        }

        if (publicMode) {
            $('#readOnlyBadge').hide();
        }

        $(
            '#createRaceBtn, #addDriverBtn, #saveRotationSequenceBtn, #startRaceBtn, ' +
            '#applyRotationPatternBtn, #clearRotationPatternBtn, #switchDriverBtn, ' +
            '#undoSwitchBtn, #endRaceBtn, .rar-queue-add-btn, .rar-queue-move, .rar-queue-remove'
        ).prop('disabled', true);

        $(
            '#raceName, #raceStartTime, #plannedEndTime, #firstLapExtraTime, ' +
            '#driverName, #avgLapTime, #rotationPatternInput, #manualStartTime, ' +
            '#manualSwitchTime, .rar-queue-driver-select'
        ).prop('disabled', true);

        $('.rar-queue-item').attr('draggable', 'false');
    }

    function getDriverById(driverId) {
        if (!raceData || !raceData.drivers) {
            return null;
        }

        return raceData.drivers.find(function(driver) {
            return parseInt(driver.id, 10) === parseInt(driverId, 10);
        }) || null;
    }

    function getDriverByOrder(driverOrder) {
        if (!raceData || !raceData.drivers) {
            return null;
        }

        return raceData.drivers.find(function(driver) {
            return parseInt(driver.driver_order, 10) === parseInt(driverOrder, 10);
        }) || null;
    }

    function updateNextSwitchPreview() {
        let switchDrivers = getNextSwitchDrivers();

        if (!switchDrivers) {
            $('#nextSwitchPreview').text('Noch kein Wechsel möglich');
            $('#switchDriverBtn').prop('disabled', true);
            applyReadOnlyState();
            return;
        }

        $('#nextSwitchPreview').html(
            '<span>Aktuell</span><strong>#' + switchDrivers.from.driver_order + ' ' + escapeHtml(switchDrivers.from.driver_name) + '</strong>' +
            '<span>Nächster</span><strong>#' + switchDrivers.to.driver_order + ' ' + escapeHtml(switchDrivers.to.driver_name) + '</strong>'
        );
        $('#switchDriverBtn').prop('disabled', false);
        applyReadOnlyState();
    }

    /**
     * Update switch log
     */
    function updateSwitchLog() {
        let html = '';
        
        if (!raceData || !raceData.rotations || raceData.rotations.length === 0) {
            html = '<p>Noch keine Wechsel</p>';
            $('#undoSwitchBtn').prop('disabled', true);
        } else {
            $('#undoSwitchBtn').prop('disabled', false);
            raceData.rotations.forEach(function(rotation) {
                html += '<div class="rar-log-entry">' +
                    rotation.from_driver + ' zu ' + rotation.to_driver + 
                    ' (' + rotation.switched_at + ')' +
                    '</div>';
            });
        }

        $('#switchLog').html(html);
        applyReadOnlyState();
    }

    function startForecastTimer() {
        stopForecastTimer();
        forecastTimer = setInterval(function() {
            updateSwapForecast();
            updateLapPrognosis();
            updateStartRaceButton();
        }, 1000);
    }

    function stopForecastTimer() {
        if (forecastTimer) {
            clearInterval(forecastTimer);
            forecastTimer = null;
        }
    }

    function parseWpDate(value) {
        if (!value) {
            return null;
        }

        let parsed = new Date(value.replace(' ', 'T'));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function formatDateTime(date) {
        return date.toLocaleString([], {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function setDefaultRaceTimes() {
        let now = new Date();
        now.setSeconds(0, 0);

        let end = new Date(now.getTime() + (24 * 60 * 60 * 1000));

        $('#raceStartTime').val(formatDateTimeLocal(now));
        $('#plannedEndTime').val(formatDateTimeLocal(end));
    }

    function formatDateTimeLocal(date) {
        return date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0') + 'T' +
            String(date.getHours()).padStart(2, '0') + ':' +
            String(date.getMinutes()).padStart(2, '0');
    }

    function formatCountdown(date) {
        let totalSeconds = Math.round((date.getTime() - Date.now()) / 1000);
        let prefix = totalSeconds < 0 ? '-' : '';

        totalSeconds = Math.abs(totalSeconds);

        let hours = Math.floor(totalSeconds / 3600);
        let minutes = Math.floor((totalSeconds % 3600) / 60);
        let seconds = totalSeconds % 60;

        return prefix + String(hours).padStart(2, '0') + ':' +
            String(minutes).padStart(2, '0') + ':' +
            String(seconds).padStart(2, '0');
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Show message
     */
    function showMessage(message, type) {
        let msg = $('<div class="rar-message ' + type + '">' + message + '</div>');
        $('body').prepend(msg);
        
        setTimeout(function() {
            msg.fadeOut(function() {
                $(this).remove();
            });
        }, 3000);
    }
});
