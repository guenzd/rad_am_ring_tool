<?php
/**
 * Plugin Name: Rad am Ring
 * Plugin URI: 
 * Description: 24-Stunden-Bike-Rennen-Fahrer- & Rundenverfolgungs-Tool
 * Version: 0.1.0
 * Author: Daniel
 * Author URI: 
 * License: GPL-2.0+
 * Text Domain: rad-am-ring
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'RAR_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'RAR_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'RAR_PLUGIN_VERSION', '0.1.0' );
define( 'RAR_DB_VERSION', '0.5.0' );

// Include required files
require_once RAR_PLUGIN_DIR . 'includes/class-database.php';
require_once RAR_PLUGIN_DIR . 'includes/class-admin-dashboard.php';
require_once RAR_PLUGIN_DIR . 'includes/class-public-dashboard.php';

// Activation hook - Create tables
register_activation_hook( __FILE__, 'rar_activate_plugin' );
function rar_activate_plugin() {
    RAR_Database::create_tables();
    rar_ensure_public_page();
    update_option( 'rar_db_version', RAR_DB_VERSION );
    flush_rewrite_rules();
}

// Deactivation hook
register_deactivation_hook( __FILE__, 'rar_deactivate_plugin' );
function rar_deactivate_plugin() {
    flush_rewrite_rules();
}

// Initialize plugin
add_action( 'init', 'rar_init_plugin' );
add_action( 'template_redirect', 'rar_redirect_public_slug_when_rewrites_disabled' );
function rar_init_plugin() {
    if ( get_option( 'rar_db_version' ) !== RAR_DB_VERSION ) {
        RAR_Database::create_tables();
        update_option( 'rar_db_version', RAR_DB_VERSION );
    }

    if ( ! get_option( 'rar_public_page_id' ) ) {
        rar_ensure_public_page();
    }

    // Initialize admin dashboard
    if ( is_admin() ) {
        new RAR_Admin_Dashboard();
    }

    new RAR_Public_Dashboard();
}

function rar_redirect_public_slug_when_rewrites_disabled() {
    $path = trim( parse_url( $_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH ), '/' );

    if ( 'rad-am-ring-live' !== $path || is_page( 'rad-am-ring-live' ) ) {
        return;
    }

    $page_id = intval( get_option( 'rar_public_page_id' ) );
    if ( ! $page_id ) {
        $page_id = rar_ensure_public_page();
    }

    if ( $page_id ) {
        wp_safe_redirect( add_query_arg( 'page_id', $page_id, home_url( '/' ) ), 302 );
        exit;
    }
}

function rar_ensure_public_page() {
    if ( ! function_exists( 'get_page_by_path' ) || ! function_exists( 'wp_insert_post' ) ) {
        return 0;
    }

    $stored_page_id = intval( get_option( 'rar_public_page_id' ) );
    if ( $stored_page_id && get_post( $stored_page_id ) ) {
        return $stored_page_id;
    }

    $existing_page = get_page_by_path( 'rad-am-ring-live' );
    if ( $existing_page ) {
        update_option( 'rar_public_page_id', intval( $existing_page->ID ) );
        return intval( $existing_page->ID );
    }

    $existing_page_ids = get_posts(
        [
            'name' => 'rad-am-ring-live',
            'post_type' => 'page',
            'post_status' => [ 'publish', 'draft', 'pending', 'private' ],
            'fields' => 'ids',
            'numberposts' => 1,
        ]
    );

    if ( ! empty( $existing_page_ids ) ) {
        update_option( 'rar_public_page_id', intval( $existing_page_ids[0] ) );
        return intval( $existing_page_ids[0] );
    }

    $page_id = wp_insert_post(
        [
            'post_title' => 'Rad am Ring Live',
            'post_name' => 'rad-am-ring-live',
            'post_content' => '[rad_am_ring_public]',
            'post_status' => 'publish',
            'post_type' => 'page',
        ],
        true
    );

    if ( is_wp_error( $page_id ) ) {
        return 0;
    }

    update_option( 'rar_public_page_id', intval( $page_id ) );
    return intval( $page_id );
}

// Register AJAX handlers
add_action( 'wp_ajax_rar_create_race', 'rar_ajax_create_race' );
add_action( 'wp_ajax_rar_record_lap', 'rar_ajax_record_lap' );
add_action( 'wp_ajax_rar_switch_driver', 'rar_ajax_switch_driver' );
add_action( 'wp_ajax_rar_get_race_data', 'rar_ajax_get_race_data' );
add_action( 'wp_ajax_rar_get_prognosis', 'rar_ajax_get_prognosis' );
add_action( 'wp_ajax_rar_add_driver', 'rar_ajax_add_driver' );
add_action( 'wp_ajax_rar_end_race', 'rar_ajax_end_race' );
add_action( 'wp_ajax_rar_get_all_races', 'rar_ajax_get_all_races' );
add_action( 'wp_ajax_rar_save_rotation_sequence', 'rar_ajax_save_rotation_sequence' );
add_action( 'wp_ajax_rar_start_race', 'rar_ajax_start_race' );
add_action( 'wp_ajax_rar_undo_driver_switch', 'rar_ajax_undo_driver_switch' );
add_action( 'wp_ajax_rar_export_race', 'rar_ajax_export_race' );
add_action( 'wp_ajax_rar_delete_race', 'rar_ajax_delete_race' );
add_action( 'wp_ajax_nopriv_rar_get_race_data', 'rar_ajax_get_race_data' );
add_action( 'wp_ajax_nopriv_rar_get_prognosis', 'rar_ajax_get_prognosis' );
add_action( 'wp_ajax_nopriv_rar_get_all_races', 'rar_ajax_get_all_races' );

function rar_current_user_can_view() {
    return is_user_logged_in() ? current_user_can( 'read' ) : true;
}

function rar_current_user_can_edit() {
    return current_user_can( 'manage_options' );
}

function rar_require_view_access() {
    if ( ! rar_current_user_can_view() ) {
        wp_send_json_error( 'Nicht autorisiert' );
    }
}

function rar_require_edit_access() {
    if ( ! rar_current_user_can_edit() ) {
        wp_send_json_error( 'Nur-Lese-Modus: keine Änderungen erlaubt' );
    }
}

function rar_ajax_create_race() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }
    
    rar_require_edit_access();

    $race_name = sanitize_text_field( $_POST['race_name'] ?? '' );
    $start_time = sanitize_text_field( wp_unslash( $_POST['start_time'] ?? '' ) );
    $planned_end_time = sanitize_text_field( wp_unslash( $_POST['planned_end_time'] ?? '' ) );
    $first_lap_extra_time = isset( $_POST['first_lap_extra_time'] ) ? floatval( $_POST['first_lap_extra_time'] ) : 0;

    if ( ! $race_name ) {
        wp_send_json_error( 'Rennname erforderlich' );
    }

    if ( ! $start_time || ! $planned_end_time ) {
        wp_send_json_error( 'Startzeit und geplante Zielzeit erforderlich' );
    }

    $start_datetime = rar_parse_local_datetime( $start_time );
    $planned_end_datetime = rar_parse_local_datetime( $planned_end_time );

    if ( ! $start_datetime || ! $planned_end_datetime || $planned_end_datetime <= $start_datetime ) {
        wp_send_json_error( 'Geplante Zielzeit muss nach der Startzeit liegen' );
    }

    if ( $first_lap_extra_time < 0 ) {
        wp_send_json_error( 'Zusatzzeit der ersten Runde darf nicht negativ sein' );
    }

    $race_id = RAR_Database::create_race(
        $race_name,
        $first_lap_extra_time,
        $start_datetime->format( 'Y-m-d H:i:s' ),
        $planned_end_datetime->format( 'Y-m-d H:i:s' )
    );
    wp_send_json_success( [ 'race_id' => $race_id ] );
}

function rar_parse_local_datetime( $value ) {
    $value = str_replace( 'T', ' ', trim( $value ) );
    $timezone = wp_timezone();

    foreach ( [ 'Y-m-d H:i:s', 'Y-m-d H:i' ] as $format ) {
        $datetime = DateTimeImmutable::createFromFormat( $format, $value, $timezone );
        if ( $datetime instanceof DateTimeImmutable ) {
            return $datetime;
        }
    }

    return false;
}

function rar_ajax_record_lap() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }
    
    rar_require_edit_access();

    $driver_id = intval( $_POST['driver_id'] ?? 0 );
    $race_id = intval( $_POST['race_id'] ?? 0 );
    $lap_time = floatval( $_POST['lap_time'] ?? 0 );

    if ( ! $driver_id || ! $race_id || ! $lap_time ) {
        wp_send_json_error( 'Ungültige Daten' );
    }

    $lap_id = RAR_Database::record_lap( $driver_id, $race_id, $lap_time );
    wp_send_json_success( [ 'lap_id' => $lap_id ] );
}

function rar_ajax_switch_driver() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }
    
    rar_require_edit_access();

    $race_id = intval( $_POST['race_id'] ?? 0 );
    $from_driver_id = intval( $_POST['from_driver_id'] ?? 0 );
    $to_driver_id = intval( $_POST['to_driver_id'] ?? 0 );
    $switched_at_input = sanitize_text_field( wp_unslash( $_POST['switched_at'] ?? '' ) );

    if ( ! $race_id || ! $from_driver_id || ! $to_driver_id ) {
        wp_send_json_error( 'Ungültige Daten' );
    }

    $switched_at = current_time( 'mysql' );
    if ( $switched_at_input ) {
        $switched_at_datetime = rar_parse_local_datetime( $switched_at_input );
        if ( ! $switched_at_datetime ) {
            wp_send_json_error( 'Ungültige Wechselzeit' );
        }
        $switched_at = $switched_at_datetime->format( 'Y-m-d H:i:s' );
    }

    RAR_Database::record_driver_switch( $race_id, $from_driver_id, $to_driver_id, $switched_at );
    wp_send_json_success( [ 'switched' => true ] );
}

function rar_ajax_get_race_data() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }
    
    rar_require_view_access();

    $race_id = intval( $_POST['race_id'] ?? 0 );
    if ( ! $race_id ) {
        wp_send_json_error( 'Rennen-ID erforderlich' );
    }

    $data = RAR_Database::get_race_data( $race_id );
    wp_send_json_success( $data );
}

function rar_ajax_get_prognosis() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }
    
    rar_require_view_access();

    $driver_id = intval( $_POST['driver_id'] ?? 0 );
    $race_id = intval( $_POST['race_id'] ?? 0 );

    if ( ! $driver_id || ! $race_id ) {
        wp_send_json_error( 'Ungültige Daten' );
    }

    $avg_lap_time = RAR_Database::get_average_lap_time( $driver_id, $race_id );
    wp_send_json_success( [ 'avg_lap_time' => $avg_lap_time ] );
}

function rar_ajax_add_driver() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }
    
    rar_require_edit_access();

    $race_id = intval( $_POST['race_id'] ?? 0 );
    $driver_name = sanitize_text_field( $_POST['driver_name'] ?? '' );
    $avg_lap_time = isset( $_POST['avg_lap_time'] ) ? floatval( $_POST['avg_lap_time'] ) : 0;

    if ( ! $race_id || ! $driver_name || $avg_lap_time <= 0 ) {
        wp_send_json_error( 'Ungültige Daten' );
    }

    $driver_id = RAR_Database::add_driver( $race_id, $driver_name, $avg_lap_time );
    wp_send_json_success( [ 'driver_id' => $driver_id ] );
}

function rar_ajax_end_race() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }
    
    rar_require_edit_access();

    $race_id = intval( $_POST['race_id'] ?? 0 );
    if ( ! $race_id ) {
        wp_send_json_error( 'Ungültige Daten' );
    }

    RAR_Database::end_race( $race_id );
    wp_send_json_success( [ 'ended' => true ] );
}

function rar_ajax_delete_race() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }

    rar_require_edit_access();

    $race_id = intval( $_POST['race_id'] ?? 0 );
    if ( ! $race_id ) {
        wp_send_json_error( 'Ungültige Daten' );
    }

    $data = RAR_Database::get_race_data( $race_id );
    if ( empty( $data['race'] ) ) {
        wp_send_json_error( 'Rennen nicht gefunden' );
    }

    $planned_end_time = rar_parse_local_datetime( $data['race']->planned_end_time ?? '' );
    if ( ! $planned_end_time || $planned_end_time <= new DateTimeImmutable( 'now', wp_timezone() ) ) {
        wp_send_json_error( 'Rennen können nur gelöscht werden, wenn die geplante Zielzeit in der Zukunft liegt' );
    }

    $deleted = RAR_Database::delete_race( $race_id );
    if ( ! $deleted ) {
        wp_send_json_error( 'Rennen konnte nicht gelöscht werden' );
    }

    wp_send_json_success( [ 'deleted' => true ] );
}

function rar_ajax_get_all_races() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }
    
    rar_require_view_access();

    $races = RAR_Database::get_all_races();
    wp_send_json_success( [ 'races' => $races ] );
}

function rar_ajax_save_rotation_sequence() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }

    rar_require_edit_access();

    $race_id = intval( $_POST['race_id'] ?? 0 );
    $rotation_sequence = sanitize_text_field( wp_unslash( $_POST['rotation_sequence'] ?? '' ) );

    if ( ! $race_id ) {
        wp_send_json_error( 'Ungültige Daten' );
    }

    $validation_error = RAR_Database::validate_rotation_sequence( $race_id, $rotation_sequence );
    if ( $validation_error ) {
        wp_send_json_error( $validation_error );
    }

    RAR_Database::save_rotation_sequence( $race_id, $rotation_sequence );
    wp_send_json_success( [ 'rotation_sequence' => $rotation_sequence ] );
}

function rar_ajax_start_race() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }

    rar_require_edit_access();

    $race_id = intval( $_POST['race_id'] ?? 0 );
    $start_time_input = sanitize_text_field( wp_unslash( $_POST['start_time'] ?? '' ) );

    if ( ! $race_id ) {
        wp_send_json_error( 'Ungültige Daten' );
    }

    $start_time = current_time( 'mysql' );
    if ( $start_time_input ) {
        $start_datetime = rar_parse_local_datetime( $start_time_input );
        if ( ! $start_datetime ) {
            wp_send_json_error( 'Ungültige Startzeit' );
        }
        $start_time = $start_datetime->format( 'Y-m-d H:i:s' );
    }

    RAR_Database::start_race( $race_id, $start_time );
    wp_send_json_success( [ 'start_time' => $start_time ] );
}

function rar_ajax_undo_driver_switch() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }

    rar_require_edit_access();

    $race_id = intval( $_POST['race_id'] ?? 0 );
    if ( ! $race_id ) {
        wp_send_json_error( 'Ungültige Daten' );
    }

    $deleted = RAR_Database::undo_last_driver_switch( $race_id );
    if ( ! $deleted ) {
        wp_send_json_error( 'Kein Fahrerwechsel zum Rückgängig machen' );
    }

    wp_send_json_success( [ 'undone' => true ] );
}

function rar_ajax_export_race() {
    if ( ! isset( $_GET['nonce'] ) || ! wp_verify_nonce( $_GET['nonce'], 'rar_nonce' ) ) {
        wp_die( 'Sicherheitsüberprüfung fehlgeschlagen', 403 );
    }

    if ( ! rar_current_user_can_edit() ) {
        wp_die( 'Nicht autorisiert', 403 );
    }

    $race_id = intval( $_GET['race_id'] ?? 0 );
    if ( ! $race_id ) {
        wp_die( 'Rennen-ID erforderlich', 400 );
    }

    $data = RAR_Database::get_race_data( $race_id );
    if ( empty( $data['race'] ) ) {
        wp_die( 'Rennen nicht gefunden', 404 );
    }

    if ( empty( $data['race']->end_time ) ) {
        wp_die( 'Export ist erst nach Rennende verfügbar', 400 );
    }

    $rows = rar_build_race_export_rows( $data );
    $filename = sanitize_file_name( $data['race']->race_name . '-rundenzeiten.csv' );

    nocache_headers();
    header( 'Content-Type: text/csv; charset=utf-8' );
    header( 'Content-Disposition: attachment; filename="' . $filename . '"' );

    $output = fopen( 'php://output', 'w' );
    fwrite( $output, "\xEF\xBB\xBF" );
    fputcsv( $output, [ 'Uhrzeit', 'Fahrer', 'Rundenzeit' ], ';' );

    foreach ( $rows as $row ) {
        fputcsv( $output, $row, ';' );
    }

    fclose( $output );
    exit;
}

function rar_build_race_export_rows( $data ) {
    $race = $data['race'];
    $drivers = [];
    $rows = [];

    foreach ( $data['drivers'] as $driver ) {
        $drivers[ intval( $driver->id ) ] = $driver;
    }

    $timezone = wp_timezone();
    $previous_time = rar_export_datetime( $race->start_time, $timezone );
    $rotations = $data['rotations'];

    usort(
        $rotations,
        function ( $a, $b ) {
            $time_compare = strcmp( $a->switched_at, $b->switched_at );
            if ( 0 !== $time_compare ) {
                return $time_compare;
            }

            return intval( $a->id ) <=> intval( $b->id );
        }
    );

    foreach ( $rotations as $rotation ) {
        $switch_time = rar_export_datetime( $rotation->switched_at, $timezone );

        if ( ! $previous_time || ! $switch_time || $switch_time <= $previous_time ) {
            continue;
        }

        $driver = $drivers[ intval( $rotation->from_driver_id ) ] ?? null;
        $rows[] = [
            $switch_time->format( 'H:i:s' ),
            $driver ? $driver->driver_name : '',
            rar_format_export_duration( $switch_time->getTimestamp() - $previous_time->getTimestamp() ),
        ];

        $previous_time = $switch_time;
    }

    $end_time = rar_export_datetime( $race->end_time, $timezone );
    if ( $previous_time && $end_time && $end_time > $previous_time ) {
        if ( ! empty( $rotations ) ) {
            $last_rotation = end( $rotations );
            $driver = $drivers[ intval( $last_rotation->to_driver_id ) ] ?? null;
        } else {
            $driver = reset( $drivers );
        }

        $rows[] = [
            $end_time->format( 'H:i:s' ),
            $driver ? $driver->driver_name : '',
            rar_format_export_duration( $end_time->getTimestamp() - $previous_time->getTimestamp() ),
        ];
    }

    return $rows;
}

function rar_export_datetime( $value, $timezone ) {
    if ( ! $value ) {
        return false;
    }

    try {
        return new DateTimeImmutable( $value, $timezone );
    } catch ( Exception $e ) {
        return false;
    }
}

function rar_format_export_duration( $seconds ) {
    $seconds = max( 0, intval( $seconds ) );
    $hours = floor( $seconds / HOUR_IN_SECONDS );
    $minutes = floor( ( $seconds % HOUR_IN_SECONDS ) / MINUTE_IN_SECONDS );
    $remaining_seconds = $seconds % MINUTE_IN_SECONDS;

    return sprintf( '%02d:%02d:%02d', $hours, $minutes, $remaining_seconds );
}
