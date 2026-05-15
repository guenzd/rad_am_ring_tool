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
            
            <div class="rar-card">
                <h3>Neues Rennen erstellen</h3>
                <div class="rar-form-group">
                    <label class="rar-field">
                        <span>Rennname</span>
                        <input type="text" id="raceName" placeholder="Rennname" class="rar-input" required>
                    </label>
                    <label class="rar-field">
                        <span>Startzeit</span>
                        <input type="datetime-local" id="raceStartTime" class="rar-input" required>
                    </label>
                    <label class="rar-field">
                        <span>Cutoff / Zielzeit</span>
                        <input type="datetime-local" id="plannedEndTime" class="rar-input" required>
                    </label>
                    <label class="rar-field">
                        <span>Delta erste/letzte Runde (Minuten)</span>
                        <input type="number" id="firstLapExtraTime" placeholder="z.B. 5" class="rar-input" min="0" step="0.01" value="5" required>
                    </label>
                    <label class="rar-field">
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

            <div id="raceStartPanel" class="rar-card" style="display: none;">
                <h3>Rennstart</h3>
                <div id="raceStartCountdown" class="rar-start-countdown"></div>
                <div class="rar-form-group">
                    <div class="rar-switch-time-row">
                        <label class="rar-field rar-switch-time">
                            <span>Startzeit setzen/korrigieren</span>
                            <input type="datetime-local" id="manualStartTime" class="rar-input">
                        </label>
                        <button type="button" id="startRaceTimeOkBtn" class="rar-btn rar-btn-secondary">OK</button>
                    </div>
                    <button id="startRaceBtn" class="rar-btn rar-btn-primary">Rennen jetzt starten</button>
                </div>
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
        <div id="raceContent" class="rar-section" style="display: none;">
            <div class="rar-race-title-row">
                <h2 id="activeRaceName"></h2>
                <div class="rar-race-title-actions">
                    <div id="readOnlyBadge" class="rar-readonly-badge" style="display: none;">Nur Lesen</div>
                    <div id="lapPrognosis" class="rar-lap-prognosis">-- Runden</div>
                </div>
            </div>
            <div id="raceConfig" class="rar-race-config"></div>

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
                                <span>Wechselzeit optional korrigieren</span>
                                <input type="datetime-local" id="manualSwitchTime" class="rar-input">
                            </label>
                            <button type="button" id="switchDriverTimeOkBtn" class="rar-btn rar-btn-secondary">OK</button>
                        </div>
                        <div class="rar-switch-actions">
                            <button id="switchDriverBtn" class="rar-btn rar-btn-secondary">Zum nächsten Fahrer wechseln</button>
                            <button id="undoSwitchBtn" class="rar-btn">Letzten Fahrerwechsel rückgängig</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Current Drivers -->
            <div class="rar-card">
                <h3>Fahrer & Statistiken</h3>
                <div id="driversList" class="rar-drivers-list"></div>
            </div>

            <!-- Rotation Editor -->
            <div class="rar-card rar-card-sequence-edit">
                <h3>Fahrerfolge</h3>
                <details class="rar-sequence-panel" open>
                    <summary>Fahrerfolge bearbeiten</summary>
                    <div class="rar-sequence-editor">
                        <input type="hidden" id="rotationSequence">
                        <div class="rar-queue-builder">
                            <div class="rar-queue-preview">
                                <div class="rar-queue-heading">
                                    <h4>Aktuelle Fahrer-Queue</h4>
                                    <button type="button" id="clearAllQueuesBtn" class="rar-mini-btn rar-queue-clear-all">Alles leeren</button>
                                </div>
                                <div id="repeatQueue" class="rar-queue-list rar-editor-forecast-list" data-queue="repeat"></div>
                            </div>
                            <div class="rar-queue-add">
                                <h4>Fahrer anhängen</h4>
                                <div id="queueDriverButtons" class="rar-queue-buttons"></div>
                            </div>
                        </div>
                        <button id="saveRotationSequenceBtn" class="rar-btn rar-btn-secondary">Folge speichern</button>
                    </div>
                </details>
            </div>

            <!-- Rotation Forecast -->
            <div class="rar-card rar-card-forecast">
                <h3>Wechsel-Prognose</h3>
                <div id="swapForecast" class="rar-forecast-list"></div>
            </div>

            <!-- Driver Switches Log -->
            <div class="rar-card">
                <h3>Wechsel-Verlauf</h3>
                <div id="switchLog" class="rar-log"></div>
            </div>

            <!-- End Race -->
            <div class="rar-card">
                <a id="exportRaceBtn" class="rar-btn rar-btn-success rar-btn-full" href="#" style="display: none;">Excel Export</a>
                <button id="endRaceBtn" class="rar-btn rar-btn-danger">Rennsitzung beenden</button>
            </div>
        </div>
    </div>
</div>
