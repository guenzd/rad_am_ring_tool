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
    let currentForecastItems = null;
    let queueOperationChain = $.Deferred().resolve().promise();
    let slowForecastUpdatedAt = 0;
    let lastPublicRefreshAt = 0;
    let isLoadingRaceData = false;
    let manualSwitchTimeEdited = false;
    let initialAdminAutoLoadAttempted = false;
    let pendingRaceStart = null;
    const FIRST_SWITCH_LOCK_MINUTES = 15;
    const DEFAULT_FINAL_LAP_OFFSET_SECONDS = 5 * 60;
    const PUBLIC_RACE_REFRESH_MS = 5000;

    // Load all races on startup
    setDefaultRaceTimes();
    updateCurrentClock();
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
                            $('<option>')
                                .val(race.id)
                                .text(race.race_name + ' (' + race.start_time + ')')
                        );
                    });
                    if (currentRaceId) {
                        $('#raceSelect').val(currentRaceId);
                    }
                    updateDeleteRaceButton();

                    if (publicView) {
                        loadPublicRace(races);
                    } else {
                        autoLoadAdminRace(races);
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

    function autoLoadAdminRace(races) {
        if (initialAdminAutoLoadAttempted || currentRaceId) {
            return;
        }

        initialAdminAutoLoadAttempted = true;

        let selectedRace = races.find(function(race) {
            return !race.end_time;
        }) || null;

        if (!selectedRace) {
            return;
        }

        currentRaceId = selectedRace.id;
        $('#raceSelect').val(currentRaceId);
        updateDeleteRaceButton();
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
        let firstLapExtraTime = parseDecimalInput($('#firstLapExtraTime').val());
        let targetOffsetTime = parseDecimalInput($('#targetOffsetTime').val());
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

        if (Number.isNaN(targetOffsetTime) || targetOffsetTime < 0) {
            showMessage('Bitte geben Sie einen gültigen Zielprognose-Offset ein', 'error');
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
                target_offset_time: targetOffsetTime * 60,
                default_driver_names: defaultDriverNames,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    currentRaceId = response.data.race_id;
                    $('#raceName').val('');
                    $('#firstLapExtraTime').val('3');
                    $('#targetOffsetTime').val('5');
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

        if (!race) {
            showMessage('Bitte wählen Sie ein Rennen', 'error');
            updateDeleteRaceButton();
            return;
        }

        if (!confirm('Rennen "' + race.race_name + '" wirklich löschen?')) {
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
                        $('#raceSelect').val('');
                        $('#addDriverPanel').hide();
                        $('#raceContent').hide();
                        $('#exportRaceBtn').hide().attr('href', '#');
                        $('#setupSummaryStatus').text('Kein Rennen geladen');
                        $('#raceSetupPanel').prop('open', true);
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

        if (isLoadingRaceData) {
            return;
        }

        isLoadingRaceData = true;

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_get_race_data',
                race_id: currentRaceId,
                nonce: rarData.nonce,
            },
            success: function(response) {
                isLoadingRaceData = false;

                if (response.success) {
                    raceData = response.data;
                    invalidateForecastData();

                    if (
                        pendingRaceStart &&
                        raceData.race &&
                        parseInt(raceData.race.id, 10) === parseInt(pendingRaceStart.raceId, 10)
                    ) {
                        if (raceData.race.start_time === pendingRaceStart.startTime) {
                            pendingRaceStart = null;
                        } else if (parseWpDate(raceData.race.start_time) > parseWpDate(pendingRaceStart.startTime)) {
                            raceData.race.start_time = pendingRaceStart.startTime;
                        }
                    }

                    $('#raceSelect').val(currentRaceId);
                    updateDeleteRaceButton();
                    $('#activeRaceName').text(raceData.race.race_name);
                    $('#setupSummaryStatus').text(raceData.race.race_name);
                    $('#raceSetupPanel').prop('open', false);
                    $('#rotationSequence').val(raceData.race.rotation_sequence || '');
                    updateManualTimeInputs();
                    updateExportLink();
                    $('#addDriverPanel').show();
                    $('#raceContent').show();
                    
                    updateDriversList();
                    updateSwapForecast();
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
            },
            error: function() {
                isLoadingRaceData = false;
                showMessage('AJAX-Fehler', 'error');
            }
        });
    }

    function invalidateForecastData() {
        currentForecastItems = null;
        slowForecastUpdatedAt = 0;
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

        $('#switchDriverBtn').prop('disabled', true).text('Aktualisiere...');
        invalidateForecastData();

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

    function saveRaceStartTime() {
        if (!ensureCanEdit()) {
            return;
        }

        if (!currentRaceId) {
            showMessage('Bitte wählen Sie zuerst ein Rennen', 'error');
            return;
        }

        let manualStartTime = $('#manualSwitchTime').val();
        let startTime = raceData && raceData.race ? parseWpDate(raceData.race.start_time) : null;
        let startTimeValue = startTime ? formatDateTimeLocal(startTime) : '';
        let isCorrection = manualStartTime && manualStartTime !== startTimeValue;
        let parsedManualStartTime = manualStartTime ? new Date(manualStartTime) : null;

        if (isCorrection && (!parsedManualStartTime || Number.isNaN(parsedManualStartTime.getTime()))) {
            showMessage('Bitte gib eine gültige Startzeit ein', 'error');
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_start_race',
                race_id: currentRaceId,
                start_time: isCorrection ? getManualSwitchTimeMysqlValue() : formatMysqlDateTimeLocal(getCurrentDate()),
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    if (raceData && raceData.race && response.data && response.data.start_time) {
                        pendingRaceStart = {
                            raceId: currentRaceId,
                            startTime: response.data.start_time,
                        };
                        raceData.race.start_time = response.data.start_time;
                        updateManualTimeInputs();
                        updateSwapForecast();
                        updateNextSwitchPreview();
                        updateSwitchLog();
                    }

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
    }

    $('#manualSwitchTime').on('input change', function() {
        manualSwitchTimeEdited = true;
        updateSwitchTimeControls();
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

    $(document).on('click', '.rar-forecast-remove', function(event) {
        event.stopPropagation();

        if (!ensureCanEdit()) {
            return;
        }

        quickRemoveQueueStint(parseInt($(this).data('index'), 10));
    });

    $('#switchDriverBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        if (isRaceStartAdjustmentMode() && isBeforeRaceStart()) {
            saveRaceStartTime();
            return;
        }

        if (isFinalStintMode()) {
            endRaceFromSwitchPanel();
            return;
        }

        if (isCurrentTimeAfterRaceEnd() && !hasManualSwitchTimeCorrection()) {
            showMessage('Kein Fahrerwechsel möglich', 'error');
            updateSwapForecast();
            updateNextSwitchPreview();
            return;
        }

        let switchDrivers = getNextSwitchDrivers();

        if (!switchDrivers) {
            showMessage('Kein Fahrerwechsel möglich', 'error');
            updateSwapForecast();
            updateNextSwitchPreview();
            return;
        }

        if (hasNoRecordedSwitches() && !isFirstSwitchDue(getFirstSwitchReferenceDate())) {
            if (isRaceStartAdjustmentMode() && isRaceStartTimeCorrection()) {
                saveRaceStartTime();
                return;
            }

            showMessage('Der erste Fahrer ist noch auf der Strecke', 'error');
            updateNextSwitchPreview();
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_switch_driver',
                race_id: currentRaceId,
                switched_at: getSwitchDriverRequestTimeValue(),
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    let fromDriver = response.data.from || switchDrivers.from;
                    let toDriver = response.data.to || switchDrivers.to;

                    showMessage(getSwitchActionLabel({ from: fromDriver, to: toDriver }) + ': ' + fromDriver.driver_name + ' zu ' + toDriver.driver_name, 'success');
                    invalidateForecastData();
                    loadRaceData();
                } else {
                    showMessage('Fehler beim Wechsel des Fahrers: ' + response.data, 'error');
                    updateNextSwitchPreview();
                }
            },
            error: function() {
                showMessage('AJAX-Fehler', 'error');
                updateNextSwitchPreview();
            }
        });
    });

    $('#undoSwitchBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        if (isRaceStartAdjustmentMode()) {
            if (isRaceStartTimeCorrection()) {
                saveRaceStartTime();
            }
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

    $('#updateLastSwitchTimeBtn').on('click', function() {
        if (!ensureCanEdit()) {
            return;
        }

        if (!currentRaceId) {
            showMessage('Bitte wählen Sie zuerst ein Rennen', 'error');
            return;
        }

        if (hasNoRecordedSwitches()) {
            showMessage('Noch kein Fahrerwechsel vorhanden', 'error');
            return;
        }

        if (!manualSwitchTimeEdited) {
            $('#manualSwitchTime').focus();
            showMessage('Wechselzeit im Feld ändern, dann letzten Wechsel korrigieren klicken', 'error');
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_update_last_driver_switch_time',
                race_id: currentRaceId,
                switched_at: getManualSwitchTimeMysqlValue(),
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    showMessage('Letzter Wechsel korrigiert!', 'success');
                    loadRaceData();
                } else {
                    showMessage('Fehler beim Korrigieren des Wechsels: ' + response.data, 'error');
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

        endRace(formatMysqlDateTimeLocal(getCurrentDate()));
    });

    function endRaceFromSwitchPanel() {
        endRace(getSwitchDriverRequestTimeValue());
    }

    function endRace(endedAt) {
        if (!currentRaceId) {
            showMessage('Bitte wählen Sie zuerst ein Rennen', 'error');
            return;
        }

        if (typeof confirm === 'function' && !confirm('Sind Sie sicher, dass Sie dieses Rennen beenden möchten?')) {
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_end_race',
                race_id: currentRaceId,
                end_time: endedAt || '',
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    currentRaceId = null;
                    raceData = null;
                    $('#addDriverPanel').hide();
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
    }

    function getRaceConfigText() {
        let firstLapExtraMinutes = 0;
        let targetOffsetMinutes = 0;
        let startTime = raceData && raceData.race ? parseWpDate(raceData.race.start_time) : null;
        let plannedEndTime = raceData && raceData.race ? parseWpDate(raceData.race.planned_end_time) : null;

        if (raceData && raceData.race && raceData.race.first_lap_extra_time) {
            firstLapExtraMinutes = parseFloat(raceData.race.first_lap_extra_time) / 60;
        }

        if (raceData && raceData.race && raceData.race.target_offset_time) {
            targetOffsetMinutes = parseFloat(raceData.race.target_offset_time) / 60;
        }

        return (
            'Start: ' + (startTime ? formatDateTime(startTime) : '--') +
            ' | Ziel: ' + (plannedEndTime ? formatDateTime(plannedEndTime) : '--') +
            ' | Erste Runde: +' + firstLapExtraMinutes.toFixed(2) + ' Minuten' +
            ' | Ziel-Offset: +' + targetOffsetMinutes.toFixed(2) + ' Minuten'
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
        let defaultTime = getDefaultManualSwitchTime();

        $('#manualSwitchTime').val(formatDateTimeLocal(defaultTime));
        manualSwitchTimeEdited = false;

        updateSwitchTimeControls();
        applyReadOnlyState();
    }

    function getDefaultManualSwitchTime() {
        let startTime = raceData && raceData.race ? parseWpDate(raceData.race.start_time) : null;
        let rotations = getOrderedRotations();
        let latestRotation = rotations.length ? rotations[rotations.length - 1] : null;
        let latestSwitchTime = latestRotation ? parseWpDate(latestRotation.switched_at) : null;

        if (latestSwitchTime) {
            return latestSwitchTime;
        }

        if (startTime) {
            return startTime;
        }

        return getCurrentDate();
    }

    function getManualSwitchTimeMysqlValue() {
        let value = $('#manualSwitchTime').val();

        if (!value) {
            return '';
        }

        let normalizedValue = value.replace('T', ' ');

        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalizedValue)) {
            return normalizedValue + ':00';
        }

        return normalizedValue;
    }

    function updateSwitchTimeControls() {
        let $switchButton = $('#switchDriverBtn');
        let $label = $('#manualSwitchTimeLabel');
        let $updateLastSwitchButton = $('#updateLastSwitchTimeBtn');

        if (!raceData || !raceData.race) {
            $switchButton.prop('disabled', true).text('Fahrerwechsel');
            $updateLastSwitchButton.prop('disabled', true);
            $label.text('Wechselzeit nachträglich korrigieren');
            return;
        }

        let startTime = parseWpDate(raceData.race.start_time);
        let isCorrection = isRaceStartTimeCorrection();
        let startAdjustmentMode = isRaceStartAdjustmentMode();

        if (startAdjustmentMode) {
            $label.text('Rennstart anpassen');
            $updateLastSwitchButton.prop('disabled', true);
            $('#undoSwitchBtn').prop('disabled', false).text('Rennstart korrigieren');

            if (isBeforeRaceStart()) {
                $switchButton.prop('disabled', false).text(isCorrection ? 'Startzeit korrigieren' : 'Rennen jetzt starten');
                updateRaceStartCountdown(startTime);
            } else if (isCorrection) {
                $switchButton.prop('disabled', false).text('Startzeit korrigieren');
            } else {
                $switchButton.prop('disabled', true).text('Erste Runde läuft');
            }

            applyReadOnlyState();
            return;
        }

        $label.text('Wechselzeit nachträglich korrigieren');
        $('#undoSwitchBtn').text('Letzten Fahrerwechsel rückgängig');
        $updateLastSwitchButton.prop('disabled', hasNoRecordedSwitches());
        let switchDrivers = getNextSwitchDrivers();

        if (switchDrivers) {
            $switchButton
                .prop('disabled', false)
                .text(getSwitchActionLabel(switchDrivers, getNextSwitchPrognosis(switchDrivers)));
        }

        applyReadOnlyState();
    }

    function promptRaceStartCorrection() {
        $('#manualSwitchTime').focus();
        showMessage('Startzeit im Feld ändern, dann Rennstart korrigieren klicken', 'error');
    }

    function isRaceStartAdjustmentMode() {
        return !!(raceData && raceData.race && hasNoRecordedSwitches() && !isFirstSwitchDue(getCurrentDate()));
    }

    function hasNoRecordedSwitches() {
        return !raceData || !raceData.rotations || raceData.rotations.length === 0;
    }

    function isRaceStartTimeCorrection() {
        let manualStartTime = $('#manualSwitchTime').val();

        return !!(manualSwitchTimeEdited && manualStartTime && !isManualSwitchTimeRaceStartValue());
    }

    function isManualSwitchTimeRaceStartValue() {
        let startTime = raceData && raceData.race ? parseWpDate(raceData.race.start_time) : null;
        let manualTime = getManualSwitchTimeDate();

        if (!startTime || !manualTime) {
            return false;
        }

        return Math.abs(manualTime.getTime() - startTime.getTime()) < 1000;
    }

    function isBeforeRaceStart() {
        let startTime = raceData && raceData.race ? parseWpDate(raceData.race.start_time) : null;

        return !!(startTime && Date.now() < startTime.getTime());
    }

    function getManualSwitchTimeDate() {
        return parseWpDate(getManualSwitchTimeMysqlValue());
    }

    function getSwitchDriverRequestTimeValue() {
        return formatMysqlDateTimeLocal(getCurrentDate());
    }

    function getFirstSwitchReferenceDate() {
        if (manualSwitchTimeEdited && isRaceStartTimeCorrection()) {
            return getManualSwitchTimeDate();
        }

        return getCurrentDate();
    }

    function getCurrentDate() {
        return new Date(Date.now());
    }

    function isFirstSwitchDue(referenceDate) {
        if (!hasNoRecordedSwitches()) {
            return true;
        }

        let startTime = raceData && raceData.race ? parseWpDate(raceData.race.start_time) : null;

        if (!referenceDate || !startTime) {
            return false;
        }

        return referenceDate.getTime() >= startTime.getTime() + FIRST_SWITCH_LOCK_MINUTES * 60 * 1000;
    }

    function isCurrentTimeAfterRaceEnd() {
        let plannedEndTime = getEffectivePlannedEndTime(raceData && raceData.race ? raceData.race : null);

        return !!(plannedEndTime && Date.now() >= plannedEndTime.getTime());
    }

    function hasManualSwitchTimeCorrection() {
        let manualSwitchTime = getManualSwitchTimeDate();

        return !!(manualSwitchTimeEdited && manualSwitchTime && !isManualSwitchTimeRaceStartValue());
    }

    function updateRaceStartCountdown(startTime) {
        if (!startTime) {
            return;
        }

        if (Date.now() >= startTime.getTime()) {
            $('#nextSwitchTimePreview').html(
                '<span>Rennstart</span>' +
                '<strong>' + formatTime(startTime) + '</strong>' +
                '<em class="is-urgent">' + formatCountdown(startTime) + '</em>'
            );
            return;
        }

        $('#nextSwitchTimePreview').html(
            '<span>Start in</span>' +
            '<strong>' + formatTime(startTime) + '</strong>' +
            '<em>' + formatCountdown(startTime) + '</em>'
        );
    }

    /**
     * Update drivers list display
     */
    function updateDriversList() {
        if ($('.rar-driver-plan-time:focus, .rar-driver-name-input:focus').length) {
            return;
        }

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
                        '<label class="rar-driver-plan-field"><small>Plan</small><input type="text" inputmode="decimal" class="rar-driver-plan-time" data-driver-id="' + driver.id + '" value="' + (driver.avg_lap_time ? (driver.avg_lap_time / 60).toFixed(2) : '') + '" aria-label="Planzeit in Minuten"></label>' +
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
        let minutes = parseFloat(String($input.val()).replace(',', '.'));

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

                    $input.prop('disabled', false);
                    updateDriversList();
                    updateSwapForecast();
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

                    $input.prop('disabled', false);
                    updateDriversList();
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
        currentForecastItems = forecastItems;

        if (forecastItems === null) {
            $('#swapForecast').html('<p>Keine Prognose möglich</p>');
            return;
        }

        if (plannedEndTime && forecastItems.length === 0) {
            $('#swapForecast').html('<p>Geplante Rennzeit erreicht</p>');
            return;
        }

        forecastItems.forEach(function(item, index) {
            html += renderForecastItem(item, index, forecastItems);
        });

        if (!html && plannedEndTime) {
            html = '<p>Kein weiterer Fahrer erreicht die Cutoff-Zeit</p>';
        }

        $('#swapForecast').html(html);
        applyDriverFocus();
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

    function parseRotationSequence(value) {
        return RARRaceLogic.parseRotationSequence(value);
    }

    function parseDecimalInput(value) {
        return parseFloat(String(value || '').replace(',', '.'));
    }

    function getCurrentRotationSequenceValue() {
        let field = $('#rotationSequence');

        if (field.length) {
            return field.val() || '';
        }

        return (raceData && raceData.race ? raceData.race.rotation_sequence : '') || '';
    }

    function syncRotationEditor() {
        $('#rotationSequence').val(serializeRotationEditor());
        updateSwapForecast();
        updateNextSwitchPreview();
    }

    function serializeRotationEditor() {
        return getCurrentRotationSequenceValue();
    }

    function saveQueueOperation(operation, args, baseSequence, successMessage) {
        if (!currentRaceId) {
            showMessage('Bitte wählen Sie zuerst ein Rennen', 'error');
            return;
        }

        let requestData = $.extend({
            action: 'rar_mutate_rotation_queue',
            race_id: currentRaceId,
            operation: operation,
            rotation_sequence: baseSequence,
            nonce: rarData.nonce,
        }, args || {});

        queueOperationChain = queueOperationChain.then(function() {
            return $.ajax({
                url: rarData.ajaxUrl,
                type: 'POST',
                data: requestData,
            }).then(function(response) {
                if (response.success) {
                    if (raceData && raceData.race) {
                        raceData.race.rotation_sequence = response.data.rotation_sequence;
                    }

                    $('#rotationSequence').val(response.data.rotation_sequence || '');
                    updateSwapForecast();
                    updateNextSwitchPreview();
                    showMessage(successMessage, 'success');
                    return;
                }

                showMessage('Fehler beim Speichern der Folge: ' + response.data, 'error');
                loadRaceData();
            }, function() {
                showMessage('AJAX-Fehler', 'error');
                loadRaceData();
            });
        });
    }

    function quickRemoveQueueStint(queueIndex) {
        if (Number.isNaN(queueIndex)) {
            return;
        }

        let previousSequence = getCurrentRotationSequenceValue();
        let materializeLength = getQuickEditMaterializeLength(queueIndex);

        saveQueueOperation('remove', {
            index: queueIndex,
            materialize_length: materializeLength,
        }, previousSequence, 'Fahrerfolge aktualisiert');
    }

    function getQuickEditMaterializeLength(queueIndex) {
        let materializeLength = queueIndex + 1;
        let forecastItems = currentForecastItems || buildForecastItems(parseRotationSequence(getCurrentRotationSequenceValue()));

        if (forecastItems && forecastItems.length > 0) {
            let lastForecastItem = forecastItems[forecastItems.length - 1];
            let lastQueueIndex = parseInt(lastForecastItem.queueIndex, 10);

            if (!Number.isNaN(lastQueueIndex)) {
                materializeLength = Math.max(materializeLength, lastQueueIndex + 1);
            }
        }

        return materializeLength;
    }

    function applyEditorSequence(queue) {
        let sequence = queue.filter(function(driverOrder) {
            return !Number.isNaN(driverOrder);
        });

        $('#rotationSequence').val(sequence.join(','));
        syncRotationEditor();
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
                if (!plannedEndTime || normalCrossingTime.getTime() <= plannedEndTime.getTime()) {
                    projectedTime = normalCrossingTime;
                }

                break;
            }

            projectedTime = normalCrossingTime;
        }

        return null;
    }

    function getNextSwitchDrivers() {
        let lapStats = getInferredLapStats();

        if (isRaceForecastComplete(lapStats)) {
            return null;
        }

        let switchDrivers = RARRaceLogic.getNextSwitchDrivers(raceData, getCurrentRotationSequenceValue(), parseWpDate);

        if (!switchDrivers) {
            return null;
        }

        let forecastItems = currentForecastItems || buildForecastItems(parseRotationSequence(getCurrentRotationSequenceValue()));

        if (!forecastItems || forecastItems.length < 2) {
            return switchDrivers;
        }

        return {
            from: forecastItems[0].driver,
            to: forecastItems[1].driver
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
            '#createRaceBtn, #addDriverBtn, #switchDriverBtn, ' +
            '#updateLastSwitchTimeBtn, #undoSwitchBtn, #endRaceBtn, #deleteRaceBtn, ' +
            '.rar-forecast-remove'
        ).prop('disabled', true);

        $(
            '#raceName, #raceStartTime, #plannedEndTime, #firstLapExtraTime, #targetOffsetTime, ' +
            '#defaultDriverNames, #driverName, #avgLapTime, #manualSwitchTime, ' +
            '.rar-driver-plan-time, .rar-driver-name-input'
        ).prop('disabled', true);

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

    function updateDeleteRaceButton() {
        let race = getRaceById($('#raceSelect').val());
        $('#deleteRaceBtn').prop('disabled', !canEdit || !race);
    }

    function buildForecastItems(sequence) {
        if (!raceData || !raceData.drivers || raceData.drivers.length === 0) {
            return [];
        }

        let lapStats = getInferredLapStats();
        let firstLapExtra = parseFloat(raceData.race.first_lap_extra_time || 0);
        let baseTime = getForecastBaseTime(lapStats);
        let plannedEndTime = parseWpDate(raceData.race.planned_end_time);
        let finalLapCutoffTime = getFinalLapCutoffTime(raceData.race);
        let finalLapOffset = getFinalLapOffsetSeconds(raceData.race);
        let recordedLaps = lapStats.completedLaps;

        if (!baseTime) {
            return null;
        }

        if (isRaceForecastComplete(lapStats)) {
            return [];
        }

        let projectedTime = new Date(baseTime.getTime());
        let queueLength = sequence.length || raceData.drivers.length;
        let forecastCount = plannedEndTime ? 2000 : Math.max(queueLength * 3, 16);
        let forecastItems = [];
        let forecastLapsByDriver = {};

        for (let i = 0; forecastItems.length < forecastCount && i < forecastCount + 200; i++) {
            let lapIndex = recordedLaps + i;

            let driver = getDriverForLap(lapIndex, raceData.drivers, sequence);

            if (!driver) {
                continue;
            }

            let driverId = String(driver.id);
            let completedDriverLaps = lapStats.byDriver[driverId] ? lapStats.byDriver[driverId].count : 0;
            forecastLapsByDriver[driverId] = (forecastLapsByDriver[driverId] || 0) + 1;

            let lapSeconds = getForecastLapSeconds(driver, lapStats);

            if (lapIndex === 0) {
                lapSeconds += firstLapExtra;
            }

            let lapStartTime = new Date(projectedTime.getTime());
            let normalSwitchTime = new Date(projectedTime.getTime() + (lapSeconds * 1000));
            let finalFinishTime = finalLapOffset > 0
                ? new Date(normalSwitchTime.getTime() - (finalLapOffset * 1000))
                : normalSwitchTime;
            let startedAfterPlannedEnd = plannedEndTime && lapStartTime.getTime() >= plannedEndTime.getTime();
            let isFinalLap = !!(
                plannedEndTime &&
                (
                    startedAfterPlannedEnd ||
                    (finalLapCutoffTime && normalSwitchTime.getTime() >= finalLapCutoffTime.getTime())
                )
            );
            if (startedAfterPlannedEnd) {
                finalFinishTime = plannedEndTime;
            }
            let itemTime = isFinalLap ? finalFinishTime : normalSwitchTime;

            forecastItems.push({
                driver: driver,
                sourceLapIndex: lapIndex,
                driverLapNumber: completedDriverLaps + forecastLapsByDriver[driverId],
                startTime: lapStartTime,
                time: itemTime,
                switchTime: normalSwitchTime,
                isCurrent: forecastItems.length === 0,
                isFinal: isFinalLap,
                queueIndex: lapIndex
            });

            if (isFinalLap) {
                break;
            }

            projectedTime = normalSwitchTime;
        }

        return forecastItems;
    }

    function renderForecastItem(item, index, forecastItems) {
        let isLast = index === forecastItems.length - 1;
        let showBuffer = !item.isFinal && forecastItems[index + 1] && forecastItems[index + 1].isFinal;
        let classes = 'rar-forecast-item ' + getDriverColorClass(item.driver) +
            (item.isCurrent ? ' is-current' : '') +
            (item.isFinal ? ' is-final' : '') +
            (isLast ? ' is-last' : '');
        let attrs = ' data-driver-order="' + item.driver.driver_order + '"';
        let canRemove = canEdit && !item.isCurrent && item.queueIndex !== null && item.queueIndex !== undefined;

        let lapNumber = item.sourceLapIndex !== null && item.sourceLapIndex !== undefined
            ? item.sourceLapIndex + 1
            : null;
        let finishCrossingTime = showBuffer ? getForecastFinishCrossingTime(item) : null;
        let finishLabel = finishCrossingTime ? getForecastFinishLabel(finishCrossingTime) : '';
        let buffer = finishCrossingTime ? getForecastBuffer(finishCrossingTime) : null;
        return '<div class="' + classes + '"' + attrs + '>' +
            '<div class="rar-forecast-main">' +
                '<span class="rar-forecast-order">#' + item.driver.driver_order + '</span>' +
                '<span class="rar-forecast-name">' + escapeHtml(item.driver.driver_name) + '</span>' +
                (lapNumber ? '<span class="rar-forecast-lap">R ' + lapNumber + '</span>' : '') +
                (item.driverLapNumber ? '<span class="rar-forecast-driver-lap">FR ' + item.driverLapNumber + '</span>' : '') +
                (finishLabel ? '<span class="rar-forecast-last-badge">' + escapeHtml(finishLabel) + '</span>' : '') +
                (buffer ? '<span class="rar-forecast-buffer is-' + buffer.className + '">' + escapeHtml(buffer.label) + '</span>' : '') +
                (canRemove ? '<button type="button" class="rar-forecast-remove" data-driver-order="' + item.driver.driver_order + '" data-index="' + item.queueIndex + '" data-source-lap="' + item.sourceLapIndex + '" aria-label="Stint aus Folge entfernen">-</button>' : '') +
            '</div>' +
            '<div class="rar-forecast-meta">' +
                '<span>' + (item.isFinal ? 'Zielrunde ' : '') + formatTime(item.time) + '</span>' +
                '<strong>' + formatCountdown(item.time) + '</strong>' +
            '</div>' +
            '</div>';
    }

    function getRaceEndCountdownLabel() {
        let plannedEndTime = parseWpDate(raceData && raceData.race ? raceData.race.planned_end_time : null);

        if (!plannedEndTime) {
            return '';
        }

        return formatCountdown(plannedEndTime);
    }

    function getForecastFinishCrossingTime(item) {
        let switchTime = item && (item.switchTime || item.time);

        if (!switchTime) {
            return null;
        }

        return new Date(switchTime.getTime() - getFinalLapOffsetSeconds(raceData && raceData.race ? raceData.race : null) * 1000);
    }

    function getForecastFinishLabel(finishCrossingTime) {
        if (!finishCrossingTime) {
            return '';
        }

        return 'Ziel ' + formatTime(finishCrossingTime);
    }

    function getForecastBuffer(finishCrossingTime) {
        let plannedEndTime = parseWpDate(raceData && raceData.race ? raceData.race.planned_end_time : null);

        if (!plannedEndTime || !finishCrossingTime) {
            return null;
        }

        let bufferMinutes = Math.floor((plannedEndTime.getTime() - finishCrossingTime.getTime()) / 60000);

        return {
            className: getForecastBufferClass(bufferMinutes),
            label: formatBuffer(bufferMinutes)
        };
    }

    function getForecastBufferClass(bufferMinutes) {
        if (bufferMinutes > 10) {
            return 'good';
        }

        if (bufferMinutes > 5) {
            return 'warning';
        }

        return 'danger';
    }

    function updateNextSwitchPreview() {
        let switchDrivers = getNextSwitchDrivers();

        if (isRaceStartAdjustmentMode()) {
            $('#nextSwitchPreview').html(renderRaceStartDriverPreview(switchDrivers));
            updateNextSwitchTimePreview(switchDrivers);
            updateSwitchTimeControls();
            applyReadOnlyState();
            return;
        }

        if (!switchDrivers) {
            $('#nextSwitchPreview').text('Noch kein Wechsel möglich');
            $('#nextSwitchTimePreview').text('Keine Prognose verfügbar');
            $('#switchDriverBtn').prop('disabled', true);
            $('#switchDriverBtn').text('Fahrerwechsel');
            applyReadOnlyState();
            return;
        }

        $('#nextSwitchPreview').html(
            renderSwitchDriverPreview('Aktuell', switchDrivers.from, false) +
            renderSwitchDriverPreview(isSameSwitchDriver(switchDrivers) ? 'Nochmal' : 'Nächster', switchDrivers.to, true)
        );
        updateNextSwitchTimePreview(switchDrivers);
        let prognosis = getNextSwitchPrognosis(switchDrivers);

        if (isRaceStartAdjustmentMode()) {
            updateSwitchTimeControls();
        } else {
            $('#switchDriverBtn').prop('disabled', false);
            $('#switchDriverBtn').text(getSwitchActionLabel(switchDrivers, prognosis));
        }
        applyReadOnlyState();
    }

    function isSameSwitchDriver(switchDrivers) {
        return switchDrivers && parseInt(switchDrivers.from.id, 10) === parseInt(switchDrivers.to.id, 10);
    }

    function getSwitchActionLabel(switchDrivers, prognosis) {
        if (prognosis && prognosis.isFinal) {
            return 'Rennen beenden';
        }

        return isSameSwitchDriver(switchDrivers) ? 'Nächste Runde' : 'Fahrerwechsel';
    }

    function isFinalStintMode() {
        let switchDrivers = getNextSwitchDrivers();
        let prognosis = getNextSwitchPrognosis(switchDrivers);

        return !!(prognosis && prognosis.isFinal);
    }

    function renderSwitchDriverPreview(label, driver, isNext) {
        return '<div class="rar-switch-driver ' + getDriverColorClass(driver) + (isNext ? ' is-next' : '') + '">' +
            '<span>' + label + '</span>' +
            '<strong>#' + driver.driver_order + ' ' + escapeHtml(driver.driver_name) + '</strong>' +
            '</div>';
    }

    function renderRaceStartDriverPreview(switchDrivers) {
        if (!switchDrivers || !switchDrivers.from) {
            return 'Noch keine Fahrerfolge';
        }

        return renderSwitchDriverPreview('Startfahrer', switchDrivers.from, false);
    }

    function updateNextSwitchTimePreview(switchDrivers) {
        let prognosis = getNextSwitchPrognosis(switchDrivers);

        if (!prognosis) {
            $('#nextSwitchTimePreview').text('Keine Prognose verfügbar');
            return;
        }

        $('#nextSwitchTimePreview').html(
            '<span>' + getSwitchTimePreviewLabel(switchDrivers, prognosis) + '</span>' +
            '<strong>' + formatTime(prognosis.time) + '</strong>' +
            '<em class="' + getCountdownClass(prognosis.time) + '">' + formatCountdown(prognosis.time) + '</em>'
        );
    }

    function getCountdownClass(date) {
        return (date.getTime() - Date.now()) <= 120000 ? 'is-urgent' : '';
    }

    function getSwitchTimePreviewLabel(switchDrivers, prognosis) {
        if (prognosis.isFinal) {
            return 'Ziel-Prognose';
        }

        return isSameSwitchDriver(switchDrivers) ? 'Nächste Runde' : 'Wechsel-Prognose';
    }

    function getNextSwitchPrognosis(switchDrivers) {
        if (!raceData || !raceData.race || !switchDrivers || !switchDrivers.from) {
            return null;
        }

        let lapStats = getInferredLapStats();

        if (isRaceForecastComplete(lapStats)) {
            return null;
        }

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
        let finalLapCutoffTime = getFinalLapCutoffTime(raceData.race);
        let finalLapOffset = getFinalLapOffsetSeconds(raceData.race);

        if (
            plannedEndTime &&
            (
                baseTime.getTime() >= plannedEndTime.getTime() ||
                (finalLapCutoffTime && predictedTime.getTime() >= finalLapCutoffTime.getTime())
            )
        ) {
            let finalTime = baseTime.getTime() >= plannedEndTime.getTime()
                ? plannedEndTime
                : new Date(predictedTime.getTime() - (finalLapOffset * 1000));

            return {
                time: finalTime,
                isFinal: true
            };
        }

        return {
            time: predictedTime,
            isFinal: false
        };
    }

    function isRaceForecastComplete(lapStats) {
        return !!(raceData && raceData.race && raceData.race.end_time);
    }

    function getEffectivePlannedEndTime(race) {
        let plannedEndTime = parseWpDate(race ? race.planned_end_time : null);

        if (!plannedEndTime) {
            return null;
        }

        return new Date(plannedEndTime.getTime() + getFinalLapOffsetSeconds(race) * 1000);
    }

    function getFinalLapCutoffTime(race) {
        let plannedEndTime = parseWpDate(race ? race.planned_end_time : null);

        if (!plannedEndTime) {
            return null;
        }

        return new Date(plannedEndTime.getTime() + getFinalLapOffsetSeconds(race) * 1000);
    }

    function getFinalLapOffsetSeconds(race) {
        let targetOffset = parseFloat(race && race.target_offset_time ? race.target_offset_time : 0);

        return targetOffset > 0 ? targetOffset : DEFAULT_FINAL_LAP_OFFSET_SECONDS;
    }

    /**
     * Update switch log
     */
    function updateSwitchLog() {
        let html = raceData && raceData.race
            ? '<div class="rar-log-entry rar-log-entry-config">' + escapeHtml(getRaceConfigText()) + '</div>'
            : '';
        
        if (!raceData || !raceData.rotations || raceData.rotations.length === 0) {
            html += '<p>Noch keine Wechsel</p>';
            if (isRaceStartAdjustmentMode()) {
                $('#undoSwitchBtn').prop('disabled', false).text('Rennstart korrigieren');
            } else {
                $('#undoSwitchBtn').prop('disabled', true).text('Letzten Fahrerwechsel rückgängig');
            }
        } else {
            $('#undoSwitchBtn').prop('disabled', false).text('Letzten Fahrerwechsel rückgängig');
            raceData.rotations.forEach(function(rotation) {
                html += '<div class="rar-log-entry">' +
                    escapeHtml(rotation.from_driver || '') + ' zu ' + escapeHtml(rotation.to_driver || '') +
                    ' (' + escapeHtml(rotation.switched_at || '') + ')' +
                    '</div>';
            });
        }

        $('#switchLog').html(html);
        applyReadOnlyState();
    }

    function startForecastTimer() {
        stopForecastTimer();
        slowForecastUpdatedAt = Date.now();
        forecastTimer = setInterval(function() {
            updateCurrentClock();
            updateNextSwitchPreview();
            updateSwitchTimeControls();

            if (publicView && Date.now() - lastPublicRefreshAt >= PUBLIC_RACE_REFRESH_MS) {
                lastPublicRefreshAt = Date.now();
                loadRaceData();
                return;
            }

            if (Date.now() - slowForecastUpdatedAt >= 60000) {
                slowForecastUpdatedAt = Date.now();
                updateDriversList();
                updateSwapForecast();
            }
        }, 1000);
    }

    function stopForecastTimer() {
        if (forecastTimer) {
            clearInterval(forecastTimer);
            forecastTimer = null;
        }
    }

    function updateCurrentClock() {
        $('#rarCurrentClock').text(formatTime(getCurrentDate()));
        $('#raceEndCountdown').text(getRaceEndCountdownLabel() || '--:--:--');
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
            String(date.getMinutes()).padStart(2, '0') + ':' +
            String(date.getSeconds()).padStart(2, '0');
    }

    function formatMysqlDateTimeLocal(date) {
        return formatDateTimeLocal(date).replace('T', ' ');
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
        let msg = $('<div class="rar-message">')
            .addClass(type)
            .text(message);

        $('body').prepend(msg);
        
        setTimeout(function() {
            msg.fadeOut(function() {
                $(this).remove();
            });
        }, 3000);
    }
});
