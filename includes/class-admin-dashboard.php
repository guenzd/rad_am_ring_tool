<?php
/**
 * RAR Admin Dashboard Class
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class RAR_Admin_Dashboard {

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'add_menu' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_assets' ] );
    }

    /**
     * Add admin menu
     */
    public function add_menu() {
        add_menu_page(
            'Rad am Ring',
            'Rad am Ring',
            'manage_options',
            'rad-am-ring',
            [ $this, 'dashboard_page' ],
            'dashicons-chart-line',
            30
        );
    }

    /**
     * Enqueue scripts and styles
     */
    public function enqueue_assets( $hook ) {
        // Only load on our plugin page
        if ( $hook !== 'toplevel_page_rad-am-ring' ) {
            return;
        }

        wp_enqueue_style(
            'rar-dashboard-css',
            RAR_PLUGIN_URL . 'assets/css/dashboard.css',
            [],
            RAR_PLUGIN_VERSION
        );

        wp_enqueue_script(
            'rar-race-logic-js',
            RAR_PLUGIN_URL . 'assets/js/race-logic.js',
            [],
            RAR_PLUGIN_VERSION,
            true
        );

        wp_enqueue_script(
            'rar-dashboard-js',
            RAR_PLUGIN_URL . 'assets/js/dashboard.js',
            [ 'jquery', 'rar-race-logic-js' ],
            RAR_PLUGIN_VERSION,
            true
        );

        // Pass nonce and AJAX URL to JavaScript
        wp_localize_script( 'rar-dashboard-js', 'rarData', [
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce' => wp_create_nonce( 'rar_nonce' ),
            'canEdit' => current_user_can( 'manage_options' ),
            'readOnly' => ! current_user_can( 'manage_options' ),
            'publicMode' => false,
            'raceId' => 0,
        ] );
    }

    /**
     * Render dashboard page
     */
    public function dashboard_page() {
        include RAR_PLUGIN_DIR . 'admin/dashboard.php';
    }
}
