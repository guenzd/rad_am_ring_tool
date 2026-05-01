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

// Include required files
require_once RAR_PLUGIN_DIR . 'includes/class-database.php';
require_once RAR_PLUGIN_DIR . 'includes/class-admin-dashboard.php';

// Activation hook - Create tables
register_activation_hook( __FILE__, 'rar_activate_plugin' );
function rar_activate_plugin() {
    RAR_Database::create_tables();
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
    // Initialize admin dashboard
    if ( is_admin() ) {
        new RAR_Admin_Dashboard();
    }
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

function rar_ajax_create_race() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }
    
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Nicht autorisiert' );
    }

    $race_name = sanitize_text_field( $_POST['race_name'] ?? '' );
    if ( ! $race_name ) {
        wp_send_json_error( 'Rennname erforderlich' );
    }

    $race_id = RAR_Database::create_race( $race_name );
    wp_send_json_success( [ 'race_id' => $race_id ] );
}

function rar_ajax_record_lap() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }
    
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Nicht autorisiert' );
    }

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
    
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Nicht autorisiert' );
    }

    $race_id = intval( $_POST['race_id'] ?? 0 );
    $from_driver_id = intval( $_POST['from_driver_id'] ?? 0 );
    $to_driver_id = intval( $_POST['to_driver_id'] ?? 0 );

    if ( ! $race_id || ! $from_driver_id || ! $to_driver_id ) {
        wp_send_json_error( 'Ungültige Daten' );
    }

    RAR_Database::record_driver_switch( $race_id, $from_driver_id, $to_driver_id );
    wp_send_json_success( [ 'switched' => true ] );
}

function rar_ajax_get_race_data() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }
    
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Nicht autorisiert' );
    }

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
    
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Nicht autorisiert' );
    }

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
    
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Nicht autorisiert' );
    }

    $race_id = intval( $_POST['race_id'] ?? 0 );
    $driver_name = sanitize_text_field( $_POST['driver_name'] ?? '' );
    $avg_lap_time = ! empty( $_POST['avg_lap_time'] ) ? floatval( $_POST['avg_lap_time'] ) : null;

    if ( ! $race_id || ! $driver_name ) {
        wp_send_json_error( 'Ungültige Daten' );
    }

    $driver_id = RAR_Database::add_driver( $race_id, $driver_name, $avg_lap_time );
    wp_send_json_success( [ 'driver_id' => $driver_id ] );
}

function rar_ajax_end_race() {
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'rar_nonce' ) ) {
        wp_send_json_error( 'Sicherheitsüberprüfung fehlgeschlagen' );
    }
    
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Nicht autorisiert' );
    }

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
    
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( 'Nicht autorisiert' );
    }

    $races = RAR_Database::get_all_races();
    wp_send_json_success( [ 'races' => $races ] );
}
