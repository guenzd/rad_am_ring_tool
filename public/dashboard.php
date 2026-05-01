<?php
/**
 * RAR Public Dashboard Template
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
?>

<div class="rar-container rar-public-container">
    <div class="rar-content">
        <div id="raceContent" class="rar-section rar-public-section" style="display: none;">
            <input type="hidden" id="rotationSequence">

            <div class="rar-race-title-row">
                <h2 id="activeRaceName"></h2>
                <div class="rar-race-title-actions">
                    <div id="lapPrognosis" class="rar-lap-prognosis">-- Runden</div>
                </div>
            </div>

            <div id="raceConfig" class="rar-race-config"></div>

            <div class="rar-card">
                <h3>Fahrer & Statistiken</h3>
                <div id="driversList" class="rar-drivers-list"></div>
            </div>

            <div class="rar-card rar-card-forecast">
                <h3>Fahrerfolge & Wechsel-Prognose</h3>
                <div id="nextSwitchPreview" class="rar-switch-preview">Noch keine Fahrerfolge</div>
                <div id="swapForecast" class="rar-forecast-list"></div>
            </div>

            <div class="rar-card">
                <h3>Wechsel-Verlauf</h3>
                <div id="switchLog" class="rar-log"></div>
            </div>
        </div>

        <div id="publicRaceEmpty" class="rar-card rar-public-empty" style="display: none;">
            <h3>Kein Rennen verfügbar</h3>
            <p>Aktuell ist noch kein Rennen eingerichtet.</p>
        </div>
    </div>
</div>
