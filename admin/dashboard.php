<?php
/**
 * RAR Dashboard Template
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
?>

<div class="rar-container">
    <div class="rar-content">
        <!-- Race Selection/Creation -->
        <details id="raceSetupPanel" class="rar-setup-panel" open>
            <summary>
                <span>Rennverwaltung</span>
                <strong id="setupSummaryStatus">Kein Rennen geladen</strong>
            </summary>
            <div class="rar-section rar-setup-section">
            
            <div class="rar-card rar-create-race-card">
                <h3>Neues Rennen erstellen</h3>
                <div class="rar-form-group rar-create-race-form">
                    <label class="rar-field rar-field-race-name">
                        <span>Rennname</span>
                        <input type="text" id="raceName" placeholder="Rennname" class="rar-input" required>
                    </label>
                    <label class="rar-field rar-field-time">
                        <span>Startzeit</span>
                        <input type="datetime-local" id="raceStartTime" class="rar-input" step="1" required>
                    </label>
                    <label class="rar-field rar-field-time">
                        <span>Cutoff / Zielzeit</span>
                        <input type="datetime-local" id="plannedEndTime" class="rar-input" step="1" required>
                    </label>
                    <label class="rar-field rar-field-compact">
                        <span>Offset erste Runde (Minuten)</span>
                        <input type="text" inputmode="decimal" id="firstLapExtraTime" placeholder="z.B. 3,5" class="rar-input rar-input-compact" value="3" required>
                    </label>
                    <label class="rar-field rar-field-compact">
                        <span>Zielprognose-Offset (Minuten)</span>
                        <input type="text" inputmode="decimal" id="targetOffsetTime" placeholder="z.B. 5" class="rar-input rar-input-compact" value="5" required>
                    </label>
                    <label class="rar-field rar-field-drivers">
                        <span>Fahrer</span>
                        <textarea id="defaultDriverNames" class="rar-input rar-textarea">Daniel, Moritz, Heiko, Stefan</textarea>
                    </label>
                    <button id="createRaceBtn" class="rar-btn rar-btn-primary">Neues Rennen starten</button>
                </div>
            </div>

            <div class="rar-card">
                <h3>Rennen auswählen</h3>
                <select id="raceSelect" class="rar-input">
                    <option value="">-- Rennen wählen --</option>
                </select>
                <button id="loadRaceBtn" class="rar-btn rar-btn-secondary">Rennen laden</button>
                <button id="deleteRaceBtn" class="rar-btn rar-btn-danger" disabled>Rennen löschen</button>
            </div>

            <div id="addDriverPanel" class="rar-card" style="display: none;">
                <h3>Fahrer hinzufügen</h3>
                <div class="rar-form-group">
                    <input type="text" id="driverName" placeholder="Fahrername" class="rar-input" required>
                    <input type="number" id="avgLapTime" placeholder="Pflicht: Rundenzeit (Minuten)" class="rar-input" min="0.01" step="0.01" required>
                    <button id="addDriverBtn" class="rar-btn rar-btn-primary">Fahrer hinzufügen</button>
                </div>
            </div>
            </div>
        </details>

        <!-- Active Race Display -->
        <div id="raceContent" class="rar-section rar-race-section" style="display: none;">
            <input type="hidden" id="rotationSequence">
            <div class="rar-race-title-row">
                <h2 id="activeRaceName"></h2>
                <div id="raceEndCountdown" class="rar-race-end-countdown">--:--:--</div>
                <div class="rar-race-title-actions">
                    <div id="rarCurrentClock" class="rar-current-clock">--:--:--</div>
                    <div id="readOnlyBadge" class="rar-readonly-badge" style="display: none;">Nur Lesen</div>
                </div>
            </div>

            <div class="rar-race-main-column">
            <!-- Driver Switch -->
            <div class="rar-card rar-card-switch">
                <h3>Fahrerwechsel</h3>
                <div class="rar-switch-layout">
                    <div class="rar-switch-preview-panel">
                        <div id="nextSwitchPreview" class="rar-switch-preview">Noch keine Fahrerfolge</div>
                        <div id="nextSwitchTimePreview" class="rar-switch-time-preview">Keine Prognose verfügbar</div>
                    </div>
                    <div class="rar-switch-action-panel">
                        <div class="rar-switch-time-row">
                            <label class="rar-field rar-switch-time">
                                <span id="manualSwitchTimeLabel">Wechselzeit nachträglich korrigieren</span>
                                <input type="datetime-local" id="manualSwitchTime" class="rar-input" step="1">
                            </label>
                            <button id="updateLastSwitchTimeBtn" class="rar-btn">Wechsel editieren</button>
                        </div>
                        <div class="rar-switch-actions">
                            <button id="switchDriverBtn" class="rar-btn rar-btn-secondary">Fahrerwechsel</button>
                            <button id="undoSwitchBtn" class="rar-btn">Letzten Fahrerwechsel rückgängig</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Current Drivers -->
            <div class="rar-card rar-card-drivers">
                <h3>Fahrer & Statistiken</h3>
                <div id="driversList" class="rar-drivers-list"></div>
            </div>

            <!-- End Race -->
            <div class="rar-card">
                <a id="exportRaceBtn" class="rar-btn rar-btn-success rar-btn-full" href="#" style="display: none;">Excel Export</a>
                <button id="endRaceBtn" class="rar-btn rar-btn-danger">Rennsitzung beenden</button>
            </div>

            <!-- Driver Switches Log -->
            <details class="rar-card rar-collapsible-card rar-card-log">
                <summary>Wechsel-Verlauf</summary>
                <div id="switchLog" class="rar-log"></div>
            </details>
            </div>

            <div class="rar-race-side-column">
            <!-- Rotation Forecast -->
            <div class="rar-card rar-card-forecast">
                <h3>Wechsel-Prognose</h3>
                <div id="swapForecast" class="rar-forecast-list"></div>
            </div>
            </div>
        </div>
    </div>
</div>
