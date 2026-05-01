<?php
/**
 * RAR Dashboard Template
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
?>

<div class="rar-container">
    <div class="rar-header">
        <h1>Rad am Ring</h1>
        <p>24-Stunden-Bike-Rennen-Tracking-Tool</p>
    </div>

    <div class="rar-content">
        <!-- Race Selection/Creation -->
        <div class="rar-section">
            <h2>Rennverwaltung</h2>
            
            <div class="rar-card">
                <h3>Neues Rennen erstellen</h3>
                <div class="rar-form-group">
                    <input type="text" id="raceName" placeholder="Rennname" class="rar-input">
                    <button id="createRaceBtn" class="rar-btn rar-btn-primary">Neues Rennen starten</button>
                </div>
            </div>

            <div class="rar-card">
                <h3>Rennen auswählen</h3>
                <select id="raceSelect" class="rar-input">
                    <option value="">-- Rennen wählen --</option>
                </select>
                <button id="loadRaceBtn" class="rar-btn rar-btn-secondary">Rennen laden</button>
            </div>
        </div>

        <!-- Active Race Display -->
        <div id="raceContent" class="rar-section" style="display: none;">
            <h2 id="activeRaceName"></h2>
            
            <!-- Drivers Section -->
            <div class="rar-card">
                <h3>Fahrer hinzufügen</h3>
                <div class="rar-form-group">
                    <input type="text" id="driverName" placeholder="Fahrername" class="rar-input">
                    <input type="number" id="avgLapTime" placeholder="Durchschn. Rundenzeit (Minuten)" class="rar-input" step="0.01">
                    <button id="addDriverBtn" class="rar-btn rar-btn-primary">Fahrer hinzufügen</button>
                </div>
            </div>

            <!-- Current Drivers -->
            <div class="rar-card">
                <h3>Fahrer & Statistiken</h3>
                <div id="driversList" class="rar-drivers-list"></div>
            </div>

            <!-- Lap Recording -->
            <div class="rar-card rar-card-large">
                <h3>Runde aufzeichnen</h3>
                <div class="rar-form-group">
                    <select id="lapDriver" class="rar-input rar-input-large">
                        <option value="">-- Fahrer wählen --</option>
                    </select>
                    <input type="number" id="lapTime" placeholder="Rundenzeit (Minuten)" class="rar-input rar-input-large" step="0.01">
                    <button id="recordLapBtn" class="rar-btn rar-btn-success rar-btn-large">RUNDE AUFZEICHNEN</button>
                </div>
            </div>

            <!-- Driver Switch -->
            <div class="rar-card">
                <h3>Fahrerwechsel</h3>
                <div class="rar-form-group">
                    <select id="switchFromDriver" class="rar-input">
                        <option value="">-- Von Fahrer --</option>
                    </select>
                    <select id="switchToDriver" class="rar-input">
                        <option value="">-- Zu Fahrer --</option>
                    </select>
                    <button id="switchDriverBtn" class="rar-btn rar-btn-secondary">Fahrer wechseln</button>
                </div>
            </div>

            <!-- Driver Switches Log -->
            <div class="rar-card">
                <h3>Wechsel-Verlauf</h3>
                <div id="switchLog" class="rar-log"></div>
            </div>

            <!-- End Race -->
            <div class="rar-card">
                <button id="endRaceBtn" class="rar-btn rar-btn-danger">Rennsitzung beenden</button>
            </div>
        </div>
    </div>
</div>
