<?php
/**
 * RAR Public Dashboard Template
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

$public_races = RAR_Database::get_all_races();
$public_race = ! empty( $public_races ) ? $public_races[0] : null;
$public_data = $public_race ? RAR_Database::get_race_data( intval( $public_race->id ) ) : null;
?>

<div class="rar-container rar-public-container">
    <div class="rar-content">
        <div id="raceContent" class="rar-section rar-public-section"<?php echo $public_race ? '' : ' style="display: none;"'; ?>>
            <input type="hidden" id="rotationSequence" value="<?php echo esc_attr( $public_race->rotation_sequence ?? '' ); ?>">

            <div class="rar-race-title-row">
                <h2 id="activeRaceName"><?php echo $public_race ? esc_html( $public_race->race_name ) : ''; ?></h2>
            </div>

            <div class="rar-card rar-card-switch">
                <h3>Fahrerwechsel</h3>
                <div class="rar-switch-layout">
                    <div class="rar-switch-preview-panel">
                        <div id="nextSwitchPreview" class="rar-switch-preview">Noch keine Fahrerfolge</div>
                        <div id="nextSwitchTimePreview" class="rar-switch-time-preview">Keine Prognose verfügbar</div>
                    </div>
                </div>
            </div>

            <div class="rar-card rar-card-forecast">
                <h3>Wechsel-Prognose</h3>
                <div id="swapForecast" class="rar-forecast-list"><p>Prognose wird geladen...</p></div>
            </div>

            <div class="rar-card rar-card-drivers">
                <h3>Fahrer & Statistiken</h3>
                <div id="driversList" class="rar-drivers-list">
                    <?php if ( $public_data && ! empty( $public_data['drivers'] ) ) : ?>
                        <?php foreach ( $public_data['drivers'] as $driver ) : ?>
                            <div class="rar-driver-card rar-driver-color-<?php echo esc_attr( ( ( intval( $driver->driver_order ) - 1 ) % 4 ) + 1 ); ?>" data-driver-order="<?php echo esc_attr( $driver->driver_order ); ?>" tabindex="0" role="button" aria-pressed="false">
                                <div class="rar-driver-order">#<?php echo esc_html( $driver->driver_order ); ?></div>
                                <div class="rar-driver-name"><?php echo esc_html( $driver->driver_name ); ?></div>
                                <div class="rar-driver-stats-row">
                                    <span><small>Plan</small><strong><?php echo esc_html( number_format_i18n( floatval( $driver->avg_lap_time ) / 60, 2 ) ); ?>m</strong></span>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php else : ?>
                        <p>Noch keine Fahrer</p>
                    <?php endif; ?>
                </div>
            </div>

            <details class="rar-card rar-collapsible-card rar-card-log">
                <summary>Wechsel-Verlauf</summary>
                <div id="switchLog" class="rar-log">
                    <?php if ( $public_race ) : ?>
                        <?php
                        $first_lap_extra_minutes = floatval( $public_race->first_lap_extra_time ?? 0 ) / 60;
                        $target_offset_minutes = floatval( $public_race->target_offset_time ?? 0 ) / 60;
                        ?>
                        <div class="rar-log-entry rar-log-entry-config">
                            Start: <?php echo esc_html( mysql2date( 'd.m. H:i', $public_race->start_time ) ); ?>
                            | Ziel: <?php echo esc_html( mysql2date( 'd.m. H:i', $public_race->planned_end_time ) ); ?>
                            | Erste Runde: +<?php echo esc_html( number_format_i18n( $first_lap_extra_minutes, 2 ) ); ?> Minuten
                            | Ziel-Offset: +<?php echo esc_html( number_format_i18n( $target_offset_minutes, 2 ) ); ?> Minuten
                        </div>
                    <?php endif; ?>
                    <?php if ( $public_data && ! empty( $public_data['rotations'] ) ) : ?>
                        <?php foreach ( $public_data['rotations'] as $rotation ) : ?>
                            <div class="rar-log-entry">
                                <?php echo esc_html( $rotation->from_driver ); ?> zu <?php echo esc_html( $rotation->to_driver ); ?>
                                (<?php echo esc_html( $rotation->switched_at ); ?>)
                            </div>
                        <?php endforeach; ?>
                    <?php else : ?>
                        <p>Noch keine Wechsel</p>
                    <?php endif; ?>
                </div>
            </details>
        </div>

        <div id="publicRaceEmpty" class="rar-card rar-public-empty"<?php echo $public_race ? ' style="display: none;"' : ''; ?>>
            <h3>Kein Rennen verfügbar</h3>
            <p>Aktuell ist noch kein Rennen eingerichtet.</p>
        </div>
    </div>
</div>
