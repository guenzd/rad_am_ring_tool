/**
 * Rad am Ring Dashboard JavaScript
 */

jQuery(document).ready(function($) {
    let currentRaceId = null;
    let raceData = null;
    let allRaces = [];
    let forecastTimer = null;
    let canEdit = !!(window.rarData && window.rarData.canEdit);
    let publicView = $('.rar-public-container').length > 0;
    let focusedDriverOrder = null;
    let queueEditorState = {
        oneTime: [],
        repeat: []
    };
    let skippedForecastLapIndexes = {};

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
                    allRaces = races;

                    $('#raceSelect').empty().append('<option value="">-- Rennen wählen --</option>');
                    races.forEach(function(race) {
                        $('#raceSelect').append(
                            '<option value="' + race.id + '">' + race.race_name + ' (' + race.start_time + ')</option>'
                        );
                    });
                    updateDeleteRaceButton();

                    if (publicView) {
                        loadPublicRace(races);
                    }
                }
            }
        });
    }

    $('#raceSelect').on('change', function() {
        updateDeleteRaceButton();
    });

    function loadPublicRace(races) {
        if (currentRaceId) {
            return;
        }

        let selectedRace = races.length > 0 ? races[0] : null;

        if (!selectedRace) {
            $('#raceContent').hide();
            $('#publicRaceEmpty').show();
            return;
        }

        $('#publicRaceEmpty').hide();
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
        let defaultDriverNames = $('#defaultDriverNames').val();
        
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
                default_driver_names: defaultDriverNames,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    currentRaceId = response.data.race_id;
                    $('#raceName').val('');
                    $('#firstLapExtraTime').val('5');
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

    $('#deleteRaceBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        let raceId = $('#raceSelect').val();
        let race = getRaceById(raceId);

        if (!race || !canDeleteRace(race)) {
            showMessage('Dieses Rennen kann nur gelöscht werden, wenn die geplante Zielzeit in der Zukunft liegt', 'error');
            updateDeleteRaceButton();
            return;
        }

        if (!confirm('Rennen "' + race.race_name + '" wirklich löschen?')) {
            return;
        }

        if (isRacePlannedEndInFuture(race) && !confirm('Das Rennen liegt noch vor der geplanten Zielzeit. Trotzdem endgültig löschen?')) {
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_delete_race',
                race_id: raceId,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    if (String(currentRaceId) === String(raceId)) {
                        currentRaceId = null;
                        raceData = null;
                        $('#raceStartPanel, #addDriverPanel').hide();
                        $('#raceContent').hide();
                        stopForecastTimer();
                    }

                    showMessage('Rennen gelöscht', 'success');
                    loadAllRaces();
                } else {
                    showMessage('Fehler beim Löschen: ' + response.data, 'error');
                }
            },
            error: function() {
                showMessage('AJAX-Fehler', 'error');
            }
        });
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
                    skippedForecastLapIndexes = {};
                    $('#activeRaceName').text(raceData.race.race_name);
                    $('#setupSummaryStatus').text(raceData.race.race_name);
                    $('#raceSetupPanel').prop('open', false);
                    $('#rotationSequence').val(raceData.race.rotation_sequence || '');
                    renderRotationEditor();
                    updateManualTimeInputs();
                    updateRaceConfig();
                    updateExportLink();
                    $('#raceStartPanel, #addDriverPanel').show();
                    $('#raceContent').show();
                    
                    updateDriversList();
                    updateSwapForecast();
                    updateLapPrognosis();
                    updateNextSwitchPreview();
                    startForecastTimer();
                    updateSwitchLog();
                    applyReadOnlyState();
                    if (!publicView) {
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
                    skippedForecastLapIndexes = {};
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

    $('#startRaceTimeOkBtn').on('click', function() {
        $('#startRaceBtn').trigger('click');
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

    $('#clearAllQueuesBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        clearAllQueues();
    });

    $(document).on('click', '.rar-queue-add-btn', function() {
        if (!ensureCanEdit()) {
            return;
        }

        let driverOrder = parseInt($(this).data('driver-order'), 10);

        if (Number.isNaN(driverOrder)) {
            return;
        }

        insertQueueItems('repeat', queueEditorState.repeat.length, [driverOrder]);
    });

    $(document).on('click', '.rar-driver-card', function() {
        let driverOrder = parseInt($(this).data('driver-order'), 10);

        if (Number.isNaN(driverOrder)) {
            return;
        }

        focusedDriverOrder = focusedDriverOrder === driverOrder ? null : driverOrder;
        applyDriverFocus();
    });

    $(document).on('keydown', '.rar-driver-card', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        $(this).trigger('click');
    });

    $(document).on('click keydown', '.rar-driver-plan-time, .rar-driver-name-input', function(event) {
        event.stopPropagation();
    });

    $(document).on('change', '.rar-driver-plan-time', function() {
        saveDriverPlanTime($(this));
    });

    $(document).on('keydown', '.rar-driver-plan-time', function(event) {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        saveDriverPlanTime($(this));
        $(this).blur();
    });

    $(document).on('change', '.rar-driver-name-input', function() {
        saveDriverName($(this));
    });

    $(document).on('keydown', '.rar-driver-name-input', function(event) {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        saveDriverName($(this));
        $(this).blur();
    });

    $(document).on('click', '.rar-queue-remove', function() {
        if (!ensureCanEdit()) {
            return;
        }

        let item = $(this).closest('.rar-queue-item, .rar-editor-forecast-item');
        let queueName = item.data('queue');
        let index = parseInt(item.data('index'), 10);

        queueEditorState[queueName].splice(index, 1);
        syncRotationEditor();
    });

    $(document).on('click', '.rar-queue-move', function() {
        if (!ensureCanEdit()) {
            return;
        }

        let direction = $(this).data('direction');
        let item = $(this).closest('.rar-queue-item, .rar-editor-forecast-item');
        let queueName = item.data('queue');
        let index = parseInt(item.data('index'), 10);
        let targetIndex = direction === 'up' ? index - 1 : index + 1;

        moveQueueItem(queueName, index, targetIndex);
    });

    $(document).on('dragstart', '.rar-queue-driver-chip', function(event) {
        if (!canEdit) {
            event.preventDefault();
            return;
        }

        event.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'driver',
            driverOrder: $(this).data('driver-order')
        }));
        event.originalEvent.dataTransfer.effectAllowed = 'copy';
    });

    $(document).on('dragstart', '.rar-queue-item, .rar-editor-forecast-item', function(event) {
        if (!canEdit) {
            event.preventDefault();
            return;
        }

        event.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'queueItem',
            queue: $(this).data('queue'),
            index: $(this).data('index')
        }));
        event.originalEvent.dataTransfer.effectAllowed = 'move';
    });

    $(document).on('dragover', '.rar-queue-list, .rar-queue-item, .rar-editor-forecast-item', function(event) {
        event.preventDefault();
    });

    $(document).on('drop', '.rar-queue-list, .rar-queue-item, .rar-editor-forecast-item', function(event) {
        event.preventDefault();

        if (!ensureCanEdit()) {
            return;
        }

        let payload = JSON.parse(event.originalEvent.dataTransfer.getData('text/plain') || '{}');
        let targetList = $(this).hasClass('rar-queue-list') ? $(this) : $(this).closest('.rar-queue-list');
        let targetQueue = targetList.data('queue');
        let targetIndex = $(this).hasClass('rar-queue-item') || $(this).hasClass('rar-editor-forecast-item')
            ? parseInt($(this).data('index'), 10)
            : queueEditorState[targetQueue].length;

        if (!queueEditorState[targetQueue]) {
            return;
        }

        if (payload.type === 'driver') {
            insertQueueItems(targetQueue, targetIndex, [parseInt(payload.driverOrder, 10)]);
            return;
        }

        if (!queueEditorState[payload.queue]) {
            return;
        }

        moveQueueItem(payload.queue, parseInt(payload.index, 10), targetIndex, targetQueue);
    });

    $(document).on('click', '.rar-forecast-remove', function(event) {
        event.stopPropagation();

        if (!ensureCanEdit()) {
            return;
        }

        skipForecastStint(parseInt($(this).data('source-lap'), 10));
    });

    /**
     * Switch driver
     */
    $('#switchDriverTimeOkBtn').on('click', function() {
        $('#switchDriverBtn').trigger('click');
    });

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
                    raceData = null;
                    $('#raceStartPanel, #addDriverPanel').hide();
                    $('#raceContent').hide();
                    $('#exportRaceBtn').hide().attr('href', '#');
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

    function updateExportLink() {
        if (!raceData || !raceData.race || !canEdit || !raceData.race.end_time) {
            $('#exportRaceBtn').hide().attr('href', '#');
            return;
        }

        $('#exportRaceBtn')
            .show()
            .attr(
                'href',
                rarData.ajaxUrl +
                    '?action=rar_export_race&race_id=' + encodeURIComponent(raceData.race.id) +
                    '&nonce=' + encodeURIComponent(rarData.nonce)
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
        let $okButton = $('#startRaceTimeOkBtn');

        if (!raceData || !raceData.race) {
            $button.prop('disabled', true).text('Rennen jetzt starten');
            $okButton.prop('disabled', true);
            updateRaceStartCountdown(null);
            return;
        }

        let startTime = parseWpDate(raceData.race.start_time);
        let manualStartTime = $('#manualStartTime').val();
        let startTimeValue = startTime ? formatDateTimeLocal(startTime) : '';
        let isCorrection = manualStartTime && manualStartTime !== startTimeValue;
        let isRunning = startTime && Date.now() >= startTime.getTime();

        if (isCorrection) {
            $button.prop('disabled', false).text('Startzeit korrigieren');
            $okButton.prop('disabled', false);
            updateRaceStartCountdown(startTime);
            applyReadOnlyState();
            return;
        }

        if (isRunning) {
            $button.prop('disabled', true).text('Rennen läuft');
            $okButton.prop('disabled', true);
            updateRaceStartCountdown(startTime);
            applyReadOnlyState();
            return;
        }

        $button.prop('disabled', false).text('Rennen jetzt starten');
        $okButton.prop('disabled', true);
        updateRaceStartCountdown(startTime);
        applyReadOnlyState();
    }

    function updateRaceStartCountdown(startTime) {
        if (!startTime) {
            $('#raceStartCountdown').hide().empty();
            return;
        }

        if (Date.now() >= startTime.getTime()) {
            $('#raceStartCountdown')
                .show()
                .html('<span>Rennen läuft seit</span><strong>' + formatCountdown(startTime) + '</strong>');
            return;
        }

        $('#raceStartCountdown')
            .show()
            .html('<span>Start in</span><strong>' + formatCountdown(startTime) + '</strong>');
    }

    /**
     * Update drivers list display
     */
    function updateDriversList() {
        let html = '';
        let lapStats = getInferredLapStats();
        let lapCountProjection = getDriverLapCountProjection();
        
        if (!raceData || !raceData.drivers || raceData.drivers.length === 0) {
            html = '<p>Noch keine Fahrer</p>';
        } else {
            raceData.drivers.forEach(function(driver) {
                let stats = lapStats.byDriver[driver.id] || { count: 0, total: 0, recentAverage: null };
                let remainingLaps = lapCountProjection.remainingByDriver[driver.id] || 0;
                let rideCountdown = getDriverRideCountdown(driver, lapStats);

                html += '<div class="rar-driver-card ' + getDriverColorClass(driver) + '" data-driver-order="' + driver.driver_order + '" tabindex="0" role="button" aria-pressed="false">' +
                    '<div class="rar-driver-order">#' + driver.driver_order + '</div>' +
                    '<label class="rar-driver-name-field"><small>Name</small><input type="text" class="rar-driver-name-input" data-driver-id="' + driver.id + '" value="' + escapeHtml(driver.driver_name) + '" aria-label="Fahrername"></label>' +
                    '<div class="rar-driver-stats-row">' +
                        '<span><small>Runden</small><strong>' + stats.count + '</strong></span>' +
                        '<span><small>Noch</small><strong>' + remainingLaps + '</strong></span>' +
                        '<label class="rar-driver-plan-field"><small>Plan</small><input type="number" class="rar-driver-plan-time" data-driver-id="' + driver.id + '" value="' + (driver.avg_lap_time ? (driver.avg_lap_time / 60).toFixed(2) : '') + '" min="0.01" step="0.01" aria-label="Planzeit in Minuten"></label>' +
                        '<span><small>3er Ø</small><strong>' + (stats.recentAverage ? (stats.recentAverage / 60).toFixed(2) : '--') + 'm</strong></span>' +
                        '<span><small>' + rideCountdown.label + '</small><strong>' + rideCountdown.value + '</strong></span>' +
                    '</div>' +
                    '</div>';
            });
        }

        $('#driversList').html(html);
        applyDriverFocus();
        applyReadOnlyState();
    }

    function saveDriverPlanTime($input) {
        if (!ensureCanEdit()) {
            return;
        }

        let driverId = parseInt($input.data('driver-id'), 10);
        let minutes = parseFloat($input.val());

        if (!currentRaceId || Number.isNaN(driverId) || Number.isNaN(minutes) || minutes <= 0) {
            showMessage('Bitte geben Sie eine gültige Planzeit in Minuten ein', 'error');
            return;
        }

        $input.prop('disabled', true);

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_update_driver_plan_time',
                race_id: currentRaceId,
                driver_id: driverId,
                avg_lap_time: minutes * 60,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    let driver = getDriverById(driverId);

                    if (driver) {
                        driver.avg_lap_time = response.data.avg_lap_time;
                    }

                    updateDriversList();
                    renderQueueLists();
                    updateSwapForecast();
                    updateLapPrognosis();
                    updateNextSwitchPreview();
                    showMessage('Planzeit gespeichert', 'success');
                } else {
                    showMessage('Fehler beim Speichern der Planzeit: ' + response.data, 'error');
                    $input.prop('disabled', false);
                }
            },
            error: function() {
                showMessage('AJAX-Fehler', 'error');
                $input.prop('disabled', false);
            }
        });
    }

    function saveDriverName($input) {
        if (!ensureCanEdit()) {
            return;
        }

        let driverId = parseInt($input.data('driver-id'), 10);
        let driverName = $input.val().trim();

        if (!currentRaceId || Number.isNaN(driverId) || !driverName) {
            showMessage('Bitte geben Sie einen Fahrernamen ein', 'error');
            return;
        }

        $input.prop('disabled', true);

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_update_driver_name',
                race_id: currentRaceId,
                driver_id: driverId,
                driver_name: driverName,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    let driver = getDriverById(driverId);

                    if (driver) {
                        driver.driver_name = response.data.driver_name;
                    }

                    updateDriversList();
                    renderQueueDriverButtons();
                    renderQueueLists();
                    updateSwapForecast();
                    updateNextSwitchPreview();
                    showMessage('Fahrername gespeichert', 'success');
                } else {
                    showMessage('Fehler beim Speichern des Fahrernamens: ' + response.data, 'error');
                    $input.prop('disabled', false);
                }
            },
            error: function() {
                showMessage('AJAX-Fehler', 'error');
                $input.prop('disabled', false);
            }
        });
    }

    function getDriverLapCountProjection() {
        let projection = {
            remainingByDriver: {}
        };

        if (!raceData || !raceData.drivers || raceData.drivers.length === 0) {
            return projection;
        }

        let forecastItems = buildForecastItems(parseRotationSequence(getCurrentRotationSequenceValue()));

        if (!forecastItems) {
            return projection;
        }

        forecastItems.forEach(function(item) {
            let driverId = String(item.driver.id);
            projection.remainingByDriver[driverId] = (projection.remainingByDriver[driverId] || 0) + 1;
        });

        return projection;
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

        let sequence = parseRotationSequence(getCurrentRotationSequenceValue());
        let plannedEndTime = parseWpDate(raceData.race.planned_end_time);
        let forecastItems = buildForecastItems(sequence);

        if (forecastItems === null) {
            $('#swapForecast').html('<p>Keine Prognose möglich</p>');
            return;
        }

        if (plannedEndTime && forecastItems.length === 0) {
            $('#swapForecast').html('<p>Geplante Rennzeit erreicht</p>');
            return;
        }

        forecastItems.forEach(function(item, index) {
            html += renderForecastItem(item, index === forecastItems.length - 1, false);
        });

        if (!html && plannedEndTime) {
            html = '<p>Kein weiterer Fahrer erreicht die Cutoff-Zeit</p>';
        }

        $('#swapForecast').html(html);
        applyDriverFocus();
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
            oneTime: [],
            repeat: sequence.oneTime.concat(sequence.repeat)
        };

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

            html += '<button type="button" class="rar-queue-button-row rar-queue-driver-chip rar-queue-add-btn ' + getDriverColorClass(driver) + '" draggable="true" data-driver-order="' + driver.driver_order + '">' +
                '<span>' + label + '</span>' +
                '<small>Anhängen</small>' +
                '</button>';
        });

        $('#queueDriverButtons').html(html);
        applyReadOnlyState();
    }

    function renderQueueLists() {
        renderQueueList('repeat', '#repeatQueue');
    }

    function renderQueueList(queueName, selector) {
        let html = '';
        let forecastItems = [];

        if (queueEditorState[queueName].length) {
            forecastItems = buildForecastItems({
                oneTime: [],
                repeat: queueEditorState[queueName].slice()
            }) || [];
        }

        if (forecastItems) {
            forecastItems.forEach(function(item, index) {
                html += renderForecastItem(item, index === forecastItems.length - 1, true, queueName);
            });
        }

        if (!html) {
            html = '<p>Queue leer. Fahrer hier reinziehen oder anklicken.</p>';
        }

        $(selector).html(html);
        applyReadOnlyState();
        applyDriverFocus();
    }

    function syncRotationEditor() {
        skippedForecastLapIndexes = {};
        $('#rotationSequence').val(serializeRotationEditor());
        renderQueueLists();
        updateSwapForecast();
        updateLapPrognosis();
        updateNextSwitchPreview();
    }

    function serializeRotationEditor() {
        return RARRaceLogic.serializeRotationSequence(queueEditorState.oneTime, queueEditorState.repeat);
    }

    function clearAllQueues() {
        queueEditorState = {
            oneTime: [],
            repeat: []
        };
        syncRotationEditor();
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

    function insertQueueItems(queueName, targetIndex, items) {
        if (!queueEditorState[queueName] || !Array.isArray(items)) {
            return;
        }

        items = items.filter(function(item) {
            return !Number.isNaN(parseInt(item, 10));
        }).map(function(item) {
            return parseInt(item, 10);
        });

        if (!items.length) {
            return;
        }

        targetIndex = Math.max(0, Math.min(targetIndex, queueEditorState[queueName].length));
        queueEditorState[queueName].splice.apply(queueEditorState[queueName], [targetIndex, 0].concat(items));
        syncRotationEditor();
    }

    function skipForecastStint(sourceLapIndex) {
        if (Number.isNaN(sourceLapIndex)) {
            return;
        }

        skippedForecastLapIndexes[sourceLapIndex] = true;
        updateDriversList();
        updateSwapForecast();
        updateLapPrognosis();
        updateNextSwitchPreview();
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

    function getDriverRideCountdown(driver, lapStats) {
        let switchDrivers = getNextSwitchDrivers();

        if (switchDrivers && parseInt(switchDrivers.from.id, 10) === parseInt(driver.id, 10)) {
            let currentLap = getNextSwitchPrognosis(switchDrivers);

            return {
                label: currentLap && currentLap.isFinal ? 'Ziel' : 'Runde',
                value: currentLap ? formatCountdown(currentLap.time) : '--'
            };
        }

        let nextStartTime = getNextDriverRideStartTime(driver, lapStats);

        return {
            label: 'Nächster',
            value: nextStartTime ? formatCountdown(nextStartTime) : '--'
        };
    }

    function getNextDriverRideStartTime(targetDriver, lapStats) {
        if (!raceData || !raceData.drivers || !raceData.race) {
            return null;
        }

        let drivers = raceData.drivers;
        let sequence = parseRotationSequence(getCurrentRotationSequenceValue());
        let firstLapExtra = parseFloat(raceData.race.first_lap_extra_time || 0);
        let plannedEndTime = parseWpDate(raceData.race.planned_end_time);
        let projectedTime = getForecastBaseTime(lapStats);
        let recordedLaps = lapStats.completedLaps;

        if (!projectedTime) {
            return null;
        }

        let forecastItems = buildForecastItems(sequence);

        if (forecastItems) {
            let nextRide = forecastItems.find(function(item, index) {
                return index > 0 && parseInt(item.driver.id, 10) === parseInt(targetDriver.id, 10);
            });

            return nextRide ? nextRide.startTime : null;
        }

        for (let i = 0; i < 2000; i++) {
            let lapIndex = recordedLaps + i;
            let driver = getDriverForLap(lapIndex, drivers, sequence);

            if (!driver) {
                continue;
            }

            let lapStartTime = new Date(projectedTime.getTime());
            let lapSeconds = getForecastLapSeconds(driver, lapStats);

            if (lapIndex === 0) {
                lapSeconds += firstLapExtra;
            }

            let normalCrossingTime = new Date(projectedTime.getTime() + (lapSeconds * 1000));
            let isFinalLap = plannedEndTime && normalCrossingTime.getTime() >= plannedEndTime.getTime();

            if (parseInt(driver.id, 10) === parseInt(targetDriver.id, 10) && i > 0) {
                return lapStartTime;
            }

            if (isFinalLap) {
                let finalLapSeconds = Math.max(1, lapSeconds - firstLapExtra);
                let finalCrossingTime = new Date(projectedTime.getTime() + (finalLapSeconds * 1000));

                if (!plannedEndTime || finalCrossingTime.getTime() <= plannedEndTime.getTime()) {
                    projectedTime = finalCrossingTime;
                }

                break;
            }

            projectedTime = normalCrossingTime;
        }

        return null;
    }

    function getNextSwitchDrivers() {
        let switchDrivers = RARRaceLogic.getNextSwitchDrivers(raceData, getCurrentRotationSequenceValue(), parseWpDate);

        if (!switchDrivers) {
            return null;
        }

        let forecastItems = buildForecastItems(parseRotationSequence(getCurrentRotationSequenceValue()));

        if (!forecastItems) {
            return switchDrivers;
        }

        let nextItem = forecastItems.find(function(item) {
            return parseInt(item.driver.id, 10) !== parseInt(switchDrivers.from.id, 10);
        });

        if (!nextItem) {
            return switchDrivers;
        }

        return {
            from: switchDrivers.from,
            to: nextItem.driver
        };
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

        if (publicView) {
            $('#readOnlyBadge').hide();
        }

        $(
            '#createRaceBtn, #addDriverBtn, #saveRotationSequenceBtn, #startRaceBtn, ' +
            '#startRaceTimeOkBtn, #switchDriverBtn, ' +
            '#switchDriverTimeOkBtn, #undoSwitchBtn, #endRaceBtn, #deleteRaceBtn, #clearAllQueuesBtn, ' +
            '.rar-queue-add-btn, .rar-queue-move, .rar-queue-remove, ' +
            '.rar-forecast-remove'
        ).prop('disabled', true);

        $(
            '#raceName, #raceStartTime, #plannedEndTime, #firstLapExtraTime, ' +
            '#defaultDriverNames, #driverName, #avgLapTime, #manualStartTime, ' +
            '#manualSwitchTime, .rar-driver-plan-time, .rar-driver-name-input'
        ).prop('disabled', true);

        $('.rar-queue-item, .rar-editor-forecast-item, .rar-queue-driver-chip').attr('draggable', 'false');
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

    function getDriverColorClass(driverOrOrder) {
        let driverOrder = typeof driverOrOrder === 'object' ? parseInt(driverOrOrder.driver_order, 10) : parseInt(driverOrOrder, 10);

        if (Number.isNaN(driverOrder)) {
            return 'rar-driver-color-1';
        }

        return 'rar-driver-color-' + (((driverOrder - 1) % 4) + 1);
    }

    function applyDriverFocus() {
        let hasFocus = focusedDriverOrder !== null;

        $('.rar-container').toggleClass('has-driver-focus', hasFocus);
        $('.rar-driver-card, .rar-forecast-item').each(function() {
            let itemOrder = parseInt($(this).data('driver-order'), 10);
            let isFocused = hasFocus && itemOrder === focusedDriverOrder;

            $(this)
                .toggleClass('is-driver-focused', isFocused)
                .toggleClass('is-driver-dimmed', hasFocus && !isFocused)
                .attr('aria-pressed', $(this).hasClass('rar-driver-card') && isFocused ? 'true' : 'false');
        });
    }

    function getRaceById(raceId) {
        return allRaces.find(function(race) {
            return String(race.id) === String(raceId);
        }) || null;
    }

    function canDeleteRace(race) {
        return isRacePlannedEndInFuture(race);
    }

    function isRacePlannedEndInFuture(race) {
        let plannedEndTime = parseWpDate(race && race.planned_end_time);

        return plannedEndTime && plannedEndTime.getTime() > Date.now();
    }

    function updateDeleteRaceButton() {
        let race = getRaceById($('#raceSelect').val());
        $('#deleteRaceBtn').prop('disabled', !canEdit || !race || !canDeleteRace(race));
    }

    function buildForecastItems(sequence) {
        if (!raceData || !raceData.drivers || raceData.drivers.length === 0) {
            return [];
        }

        let lapStats = getInferredLapStats();
        let firstLapExtra = parseFloat(raceData.race.first_lap_extra_time || 0);
        let baseTime = getForecastBaseTime(lapStats);
        let plannedEndTime = parseWpDate(raceData.race.planned_end_time);
        let recordedLaps = lapStats.completedLaps;

        if (!baseTime) {
            return null;
        }

        if (plannedEndTime && baseTime.getTime() >= plannedEndTime.getTime()) {
            return [];
        }

        let projectedTime = new Date(baseTime.getTime());
        let forecastCount = plannedEndTime ? 2000 : Math.max(getRotationCycleLength(sequence, raceData.drivers.length) * 3, 16);
        let forecastItems = [];

        for (let i = 0; forecastItems.length < forecastCount && i < forecastCount + 200; i++) {
            let lapIndex = recordedLaps + i;

            if (skippedForecastLapIndexes[lapIndex]) {
                continue;
            }

            let driver = getDriverForLap(lapIndex, raceData.drivers, sequence);

            if (!driver) {
                continue;
            }

            let lapSeconds = getForecastLapSeconds(driver, lapStats);

            if (lapIndex === 0) {
                lapSeconds += firstLapExtra;
            }

            let lapStartTime = new Date(projectedTime.getTime());
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

            let queueName = null;
            let queueIndex = null;

            if (sequence.oneTime.length > 0 && lapIndex < sequence.oneTime.length) {
                queueName = 'oneTime';
                queueIndex = lapIndex;
            } else if (sequence.repeat.length > 0) {
                queueName = 'repeat';
                queueIndex = (lapIndex - sequence.oneTime.length) % sequence.repeat.length;
            }

            forecastItems.push({
                driver: driver,
                sourceLapIndex: lapIndex,
                startTime: lapStartTime,
                time: projectedTime,
                isCurrent: forecastItems.length === 0,
                isFinal: isFinalLap,
                queueName: queueName,
                queueIndex: queueIndex
            });

            if (isFinalLap) {
                break;
            }
        }

        return forecastItems;
    }

    function renderForecastItem(item, isLast, isEditable, queueName) {
        let classes = 'rar-forecast-item ' + getDriverColorClass(item.driver) +
            (item.isCurrent ? ' is-current' : '') +
            (item.isFinal ? ' is-final' : '') +
            (isLast ? ' is-last' : '') +
            (isEditable ? ' rar-editor-forecast-item' : '');
        let attrs = ' data-driver-order="' + item.driver.driver_order + '"';
        let canRemove = !item.isCurrent && item.sourceLapIndex !== null && item.sourceLapIndex !== undefined;

        if (isEditable) {
            attrs += ' draggable="true" data-queue="' + queueName + '" data-index="' + item.queueIndex + '"';
        }

        return '<div class="' + classes + '"' + attrs + '>' +
            '<div class="rar-forecast-main">' +
                (isEditable ? '<span class="rar-queue-grip">::</span>' : '') +
                '<span class="rar-forecast-order">#' + item.driver.driver_order + '</span>' +
                '<span class="rar-forecast-name">' + escapeHtml(item.driver.driver_name) + '</span>' +
                (isLast ? '<span class="rar-forecast-last-badge">Letzter Fahrer</span>' : '') +
                (isEditable ? '<button type="button" class="rar-mini-icon rar-queue-move" data-direction="up">↑</button>' : '') +
                (isEditable ? '<button type="button" class="rar-mini-icon rar-queue-move" data-direction="down">↓</button>' : '') +
                (isEditable || canRemove ? '<button type="button" class="' + (isEditable ? 'rar-mini-icon rar-queue-remove' : 'rar-forecast-remove') + '" data-driver-order="' + item.driver.driver_order + '" data-queue="' + item.queueName + '" data-index="' + item.queueIndex + '" data-source-lap="' + item.sourceLapIndex + '" aria-label="Stint aus Folge entfernen">-</button>' : '') +
            '</div>' +
            '<div class="rar-forecast-meta">' +
                '<span>' + (item.isFinal ? 'Zielrunde ' : '') + formatTime(item.time) + '</span>' +
                '<strong>' + formatCountdown(item.time) + '</strong>' +
            '</div>' +
            '</div>';
    }

    function updateNextSwitchPreview() {
        let switchDrivers = getNextSwitchDrivers();

        if (!switchDrivers) {
            $('#nextSwitchPreview').text('Noch kein Wechsel möglich');
            $('#nextSwitchTimePreview').text('Keine Prognose verfügbar');
            $('#switchDriverBtn').prop('disabled', true);
            applyReadOnlyState();
            return;
        }

        $('#nextSwitchPreview').html(
            renderSwitchDriverPreview('Aktuell', switchDrivers.from, false) +
            renderSwitchDriverPreview('Nächster', switchDrivers.to, true)
        );
        updateNextSwitchTimePreview(switchDrivers);
        $('#switchDriverBtn').prop('disabled', false);
        applyReadOnlyState();
    }

    function renderSwitchDriverPreview(label, driver, isNext) {
        return '<div class="rar-switch-driver ' + getDriverColorClass(driver) + (isNext ? ' is-next' : '') + '">' +
            '<span>' + label + '</span>' +
            '<strong>#' + driver.driver_order + ' ' + escapeHtml(driver.driver_name) + '</strong>' +
            '</div>';
    }

    function updateNextSwitchTimePreview(switchDrivers) {
        let prognosis = getNextSwitchPrognosis(switchDrivers);

        if (!prognosis) {
            $('#nextSwitchTimePreview').text('Keine Prognose verfügbar');
            return;
        }

        $('#nextSwitchTimePreview').html(
            '<span>' + (prognosis.isFinal ? 'Ziel-Prognose' : 'Wechsel-Prognose') + '</span>' +
            '<strong>' + formatTime(prognosis.time) + '</strong>' +
            '<em>' + formatCountdown(prognosis.time) + '</em>'
        );
    }

    function getNextSwitchPrognosis(switchDrivers) {
        if (!raceData || !raceData.race || !switchDrivers || !switchDrivers.from) {
            return null;
        }

        let lapStats = getInferredLapStats();
        let baseTime = getForecastBaseTime(lapStats);

        if (!baseTime) {
            return null;
        }

        let completedLaps = lapStats.completedLaps;
        let lapSeconds = getForecastLapSeconds(switchDrivers.from, lapStats);
        let firstLapExtra = parseFloat(raceData.race.first_lap_extra_time || 0);

        if (completedLaps === 0) {
            lapSeconds += firstLapExtra;
        }

        let predictedTime = new Date(baseTime.getTime() + (lapSeconds * 1000));
        let plannedEndTime = parseWpDate(raceData.race.planned_end_time);

        if (plannedEndTime && predictedTime.getTime() >= plannedEndTime.getTime()) {
            let finalLapSeconds = Math.max(1, lapSeconds - firstLapExtra);
            predictedTime = new Date(baseTime.getTime() + (finalLapSeconds * 1000));

            return {
                time: predictedTime,
                isFinal: true
            };
        }

        return {
            time: predictedTime,
            isFinal: false
        };
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
            updateDriversList();
            renderQueueLists();
            updateSwapForecast();
            updateLapPrognosis();
            updateNextSwitchPreview();
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
