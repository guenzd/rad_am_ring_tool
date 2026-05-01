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
