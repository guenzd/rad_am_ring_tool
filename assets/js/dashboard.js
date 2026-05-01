/**
 * Rad am Ring Dashboard JavaScript
 */

jQuery(document).ready(function($) {
    let currentRaceId = null;
    let raceData = null;

    // Load all races on startup
    loadAllRaces();

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
                    $('#raceSelect').empty().append('<option value="">-- Rennen wählen --</option>');
                    response.data.races.forEach(function(race) {
                        $('#raceSelect').append(
                            '<option value="' + race.id + '">' + race.race_name + ' (' + race.start_time + ')</option>'
                        );
                    });
                }
            }
        });
    }

    /**
     * Create new race
     */
    $('#createRaceBtn').on('click', function() {
        let raceName = $('#raceName').val().trim();
        
        if (!raceName) {
            showMessage('Bitte geben Sie einen Rennamen ein', 'error');
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_create_race',
                race_name: raceName,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    currentRaceId = response.data.race_id;
                    $('#raceName').val('');
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
                    $('#raceContent').show();
                    
                    updateDriversList();
                    updateDriverSelects();
                    updateSwitchLog();
                    showMessage('Rennen geladen!', 'success');
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
        if (!currentRaceId) {
            showMessage('Bitte wählen Sie zuerst ein Rennen', 'error');
            return;
        }

        let driverName = $('#driverName').val().trim();
        let avgLapTime = $('#avgLapTime').val();

        if (!driverName) {
            showMessage('Bitte geben Sie einen Fahrernamen ein', 'error');
            return;
        }

        // Convert minutes to seconds
        let avgLapTimeSeconds = avgLapTime ? parseFloat(avgLapTime) * 60 : null;

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
     * Record lap
     */
    $('#recordLapBtn').on('click', function() {
        let driverId = $('#lapDriver').val();
        let lapTime = $('#lapTime').val();

        if (!driverId || !lapTime) {
            showMessage('Bitte wählen Sie einen Fahrer und geben Sie die Rundenzeit ein', 'error');
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_record_lap',
                driver_id: driverId,
                race_id: currentRaceId,
                lap_time: parseFloat(lapTime) * 60,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    $('#lapTime').val('');
                    showMessage('Runde aufgezeichnet!', 'success');
                    loadRaceData();
                } else {
                    showMessage('Fehler beim Aufzeichnen der Runde: ' + response.data, 'error');
                }
            }
        });
    });

    /**
     * Switch driver
     */
    $('#switchDriverBtn').on('click', function() {
        let fromDriverId = $('#switchFromDriver').val();
        let toDriverId = $('#switchToDriver').val();

        if (!fromDriverId || !toDriverId || fromDriverId === toDriverId) {
            showMessage('Bitte wählen Sie zwei verschiedene Fahrer', 'error');
            return;
        }

        $.ajax({
            url: rarData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'rar_switch_driver',
                race_id: currentRaceId,
                from_driver_id: fromDriverId,
                to_driver_id: toDriverId,
                nonce: rarData.nonce,
            },
            success: function(response) {
                if (response.success) {
                    $('#switchFromDriver').val('');
                    $('#switchToDriver').val('');
                    showMessage('Fahrer gewechselt!', 'success');
                    loadRaceData();
                } else {
                    showMessage('Fehler beim Wechsel des Fahrers: ' + response.data, 'error');
                }
            }
        });
    });

    /**
     * End race
     */
    $('#endRaceBtn').on('click', function() {
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
                    showMessage('Rennen beendet!', 'success');
                    loadAllRaces();
                } else {
                    showMessage('Fehler beim Beenden des Rennens: ' + response.data, 'error');
                }
            }
        });
    });

    /**
     * Update drivers list display
     */
    function updateDriversList() {
        let html = '';
        
        if (!raceData || !raceData.drivers || raceData.drivers.length === 0) {
            html = '<p>Noch keine Fahrer</p>';
        } else {
            raceData.drivers.forEach(function(driver) {
                html += '<div class="rar-driver-card">' +
                    '<div class="rar-driver-name">' + driver.driver_name + '</div>' +
                    '<div class="rar-driver-stat">Runden: ' + (driver.total_laps || 0) + '</div>' +
                    '<div class="rar-driver-stat">Durchschn.: ' + (driver.avg_lap_time ? (driver.avg_lap_time / 60).toFixed(2) : '--') + ' min</div>' +
                    '<div class="rar-driver-stat">Gesamt: ' + (driver.total_time ? (driver.total_time / 60).toFixed(1) : '--') + ' min</div>' +
                    '</div>';
            });
        }

        $('#driversList').html(html);
    }

    /**
     * Update driver select dropdowns
     */
    function updateDriverSelects() {
        let driverOptions = '<option value="">-- Fahrer wählen --</option>';
        let switchOptions = '<option value="">-- Wählen --</option>';
        
        if (raceData && raceData.drivers) {
            raceData.drivers.forEach(function(driver) {
                driverOptions += '<option value="' + driver.id + '">' + driver.driver_name + '</option>';
                switchOptions += '<option value="' + driver.id + '">' + driver.driver_name + '</option>';
            });
        }

        $('#lapDriver').html(driverOptions);
        $('#switchFromDriver').html(switchOptions);
        $('#switchToDriver').html(switchOptions);
    }

    /**
     * Update switch log
     */
    function updateSwitchLog() {
        let html = '';
        
        if (!raceData || !raceData.rotations || raceData.rotations.length === 0) {
            html = '<p>Noch keine Wechsel</p>';
        } else {
            raceData.rotations.forEach(function(rotation) {
                html += '<div class="rar-log-entry">' +
                    rotation.from_driver + ' zu ' + rotation.to_driver + 
                    ' (' + rotation.switched_at + ')' +
                    '</div>';
            });
        }

        $('#switchLog').html(html);
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
