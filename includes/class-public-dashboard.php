<?php
/**
 * RAR Public Dashboard Shortcode
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class RAR_Public_Dashboard {

    public function __construct() {
        add_shortcode( 'rad_am_ring_public', [ $this, 'render_shortcode' ] );
    }

    public function render_shortcode( $atts ) {
        $this->enqueue_assets();

        ob_start();
        include RAR_PLUGIN_DIR . 'public/dashboard.php';
        return ob_get_clean();
    }

    private function enqueue_assets() {
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

        wp_localize_script( 'rar-dashboard-js', 'rarData', [
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce' => wp_create_nonce( 'rar_nonce' ),
            'canEdit' => false,
            'readOnly' => true,
        ] );
    }
}
