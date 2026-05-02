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
                        <input type="number" id="firstLapExtraTime" placeholder="z.B. 7" class="rar-input" min="0" step="0.01" value="0" required>
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
            </div>
        </details>

        <!-- Active Race Display -->
        <div id="raceContent" class="rar-section" style="display: none;">
            <!-- Race Timing -->
            <details id="raceStartPanel" class="rar-card rar-collapsible-card">
                <summary>Rennstart</summary>
                <div class="rar-form-group">
                    <label class="rar-field">
                        <span>Startzeit setzen/korrigieren</span>
                        <input type="datetime-local" id="manualStartTime" class="rar-input">
                    </label>
                    <button id="startRaceBtn" class="rar-btn rar-btn-primary">Rennen jetzt starten</button>
                </div>
            </details>
            
            <!-- Drivers Section -->
            <details class="rar-card rar-collapsible-card">
                <summary>Fahrer hinzufügen</summary>
                <div class="rar-form-group">
                    <input type="text" id="driverName" placeholder="Fahrername" class="rar-input" required>
                    <input type="number" id="avgLapTime" placeholder="Pflicht: Rundenzeit (Minuten)" class="rar-input" min="0.01" step="0.01" required>
                    <button id="addDriverBtn" class="rar-btn rar-btn-primary">Fahrer hinzufügen</button>
                </div>
            </details>

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
                <div id="nextSwitchPreview" class="rar-switch-preview">Noch keine Fahrerfolge</div>
                <div id="nextSwitchTimePreview" class="rar-switch-time-preview">Keine Prognose verfügbar</div>
                <div class="rar-switch-time-row">
                    <label class="rar-field rar-switch-time">
                        <span>Wechselzeit optional korrigieren</span>
                        <input type="datetime-local" id="manualSwitchTime" class="rar-input">
                    </label>
                    <button type="button" id="switchDriverTimeOkBtn" class="rar-btn rar-btn-secondary">OK</button>
                </div>
                <button id="switchDriverBtn" class="rar-btn rar-btn-secondary rar-btn-full">Zum nächsten Fahrer wechseln</button>
                <button id="undoSwitchBtn" class="rar-btn rar-btn-secondary rar-btn-full">Letzten Fahrerwechsel rückgängig</button>
            </div>

            <!-- Current Drivers -->
            <div class="rar-card">
                <h3>Fahrer & Statistiken</h3>
                <div id="driversList" class="rar-drivers-list"></div>
            </div>

            <!-- Rotation Editor -->
            <div class="rar-card rar-card-sequence-edit">
                <h3>Fahrerfolge</h3>
                <details class="rar-sequence-panel">
                    <summary>Fahrerfolge bearbeiten</summary>
                    <div class="rar-sequence-editor">
                        <input type="hidden" id="rotationSequence">
                        <div class="rar-queue-builder">
                            <details class="rar-queue-pattern">
                                <summary>Muster direkt bearbeiten</summary>
                                <label class="rar-field">
                                    <span>Folge</span>
                                    <input type="text" id="rotationPatternInput" class="rar-input" placeholder="z.B. 1,2,1,2 | 1,2,3,4">
                                </label>
                                <button type="button" id="applyRotationPatternBtn" class="rar-btn rar-btn-secondary">Muster übernehmen</button>
                                <button type="button" id="clearRotationPatternBtn" class="rar-btn rar-btn-secondary">Leeren</button>
                            </details>
                            <div class="rar-queue-add">
                                <h4>Fahrer anhängen</h4>
                                <div id="queueDriverButtons" class="rar-queue-buttons"></div>
                            </div>
                            <div class="rar-queue-clear-actions">
                                <button type="button" class="rar-mini-btn rar-queue-clear" data-queue="oneTime">Einmal leeren</button>
                                <button type="button" class="rar-mini-btn rar-queue-clear" data-queue="repeat">Repeat leeren</button>
                                <button type="button" id="clearAllQueuesBtn" class="rar-mini-btn rar-queue-clear-all">Alles leeren</button>
                            </div>
                            <div class="rar-queue-lanes">
                                <div class="rar-queue-lane">
                                    <h4>Einmalige Folge</h4>
                                    <div id="oneTimeQueue" class="rar-queue-list" data-queue="oneTime"></div>
                                </div>
                                <div class="rar-queue-lane">
                                    <h4>Wiederholung</h4>
                                    <div id="repeatQueue" class="rar-queue-list" data-queue="repeat"></div>
                                </div>
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
