<?php
/**
 * RAR Database Class
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class RAR_Database {

    /**
     * Create database tables
     */
    public static function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();

        // Race Sessions table
        $sql_races = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}rar_race_sessions (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            race_name varchar(255) NOT NULL,
            start_time datetime DEFAULT CURRENT_TIMESTAMP,
            end_time datetime NULL,
            total_laps int(11) DEFAULT 0,
            notes longtext NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) $charset_collate;";

        // Drivers table
        $sql_drivers = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}rar_drivers (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            race_id bigint(20) NOT NULL,
            driver_name varchar(255) NOT NULL,
            avg_lap_time decimal(10, 2) NULL COMMENT 'in seconds',
            total_laps int(11) DEFAULT 0,
            total_time decimal(15, 2) DEFAULT 0 COMMENT 'in seconds',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY race_id (race_id)
        ) $charset_collate;";

        // Lap Times table
        $sql_laps = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}rar_lap_times (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            driver_id bigint(20) NOT NULL,
            race_id bigint(20) NOT NULL,
            lap_number int(11) NOT NULL,
            lap_time decimal(10, 2) NOT NULL COMMENT 'in seconds',
            recorded_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY driver_id (driver_id),
            KEY race_id (race_id),
            KEY lap_number (lap_number)
        ) $charset_collate;";

        // Driver Rotations table
        $sql_rotations = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}rar_driver_rotations (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            race_id bigint(20) NOT NULL,
            from_driver_id bigint(20) NOT NULL,
            to_driver_id bigint(20) NOT NULL,
            switched_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY race_id (race_id),
            KEY from_driver_id (from_driver_id),
            KEY to_driver_id (to_driver_id)
        ) $charset_collate;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        
        dbDelta( $sql_races );
        dbDelta( $sql_drivers );
        dbDelta( $sql_laps );
        dbDelta( $sql_rotations );
    }

    /**
     * Create a new race session
     */
    public static function create_race( $race_name ) {
        global $wpdb;
        
        $wpdb->insert( 
            "{$wpdb->prefix}rar_race_sessions",
            [
                'race_name' => $race_name,
                'start_time' => current_time( 'mysql' ),
            ],
            [ '%s', '%s' ]
        );

        return $wpdb->insert_id;
    }

    /**
     * Add a driver to a race
     */
    public static function add_driver( $race_id, $driver_name, $avg_lap_time = null ) {
        global $wpdb;
        
        $wpdb->insert(
            "{$wpdb->prefix}rar_drivers",
            [
                'race_id' => $race_id,
                'driver_name' => $driver_name,
                'avg_lap_time' => $avg_lap_time,
            ],
            [ '%d', '%s', '%f' ]
        );

        return $wpdb->insert_id;
    }

    /**
     * Record a lap time
     */
    public static function record_lap( $driver_id, $race_id, $lap_time ) {
        global $wpdb;

        // Get current lap number for this driver
        $lap_count = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}rar_lap_times WHERE driver_id = %d AND race_id = %d",
            $driver_id,
            $race_id
        ) );
        $lap_number = $lap_count + 1;

        $wpdb->insert(
            "{$wpdb->prefix}rar_lap_times",
            [
                'driver_id' => $driver_id,
                'race_id' => $race_id,
                'lap_number' => $lap_number,
                'lap_time' => $lap_time,
                'recorded_at' => current_time( 'mysql' ),
            ],
            [ '%d', '%d', '%d', '%f', '%s' ]
        );

        // Update driver stats
        self::update_driver_stats( $driver_id, $race_id );

        return $wpdb->insert_id;
    }

    /**
     * Record driver switch
     */
    public static function record_driver_switch( $race_id, $from_driver_id, $to_driver_id ) {
        global $wpdb;

        $wpdb->insert(
            "{$wpdb->prefix}rar_driver_rotations",
            [
                'race_id' => $race_id,
                'from_driver_id' => $from_driver_id,
                'to_driver_id' => $to_driver_id,
                'switched_at' => current_time( 'mysql' ),
            ],
            [ '%d', '%d', '%d', '%s' ]
        );

        return $wpdb->insert_id;
    }

    /**
     * Update driver statistics
     */
    private static function update_driver_stats( $driver_id, $race_id ) {
        global $wpdb;

        $stats = $wpdb->get_row( $wpdb->prepare(
            "SELECT COUNT(*) as total_laps, AVG(lap_time) as avg_lap_time, SUM(lap_time) as total_time
             FROM {$wpdb->prefix}rar_lap_times
             WHERE driver_id = %d AND race_id = %d",
            $driver_id,
            $race_id
        ) );

        if ( $stats ) {
            $wpdb->update(
                "{$wpdb->prefix}rar_drivers",
                [
                    'total_laps' => $stats->total_laps,
                    'avg_lap_time' => $stats->avg_lap_time,
                    'total_time' => $stats->total_time,
                ],
                [ 'id' => $driver_id ],
                [ '%d', '%f', '%f' ],
                [ '%d' ]
            );
        }
    }

    /**
     * Get average lap time for a driver
     */
    public static function get_average_lap_time( $driver_id, $race_id ) {
        global $wpdb;

        $result = $wpdb->get_var( $wpdb->prepare(
            "SELECT AVG(lap_time) FROM {$wpdb->prefix}rar_lap_times 
             WHERE driver_id = %d AND race_id = %d",
            $driver_id,
            $race_id
        ) );

        return $result ? floatval( $result ) : 0;
    }

    /**
     * Get race data (drivers, laps, rotations)
     */
    public static function get_race_data( $race_id ) {
        global $wpdb;

        $race = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}rar_race_sessions WHERE id = %d",
            $race_id
        ) );

        $drivers = $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}rar_drivers WHERE race_id = %d ORDER BY created_at ASC",
            $race_id
        ) );

        $rotations = $wpdb->get_results( $wpdb->prepare(
            "SELECT r.*, d1.driver_name as from_driver, d2.driver_name as to_driver
             FROM {$wpdb->prefix}rar_driver_rotations r
             LEFT JOIN {$wpdb->prefix}rar_drivers d1 ON r.from_driver_id = d1.id
             LEFT JOIN {$wpdb->prefix}rar_drivers d2 ON r.to_driver_id = d2.id
             WHERE r.race_id = %d
             ORDER BY r.switched_at ASC",
            $race_id
        ) );

        return [
            'race' => $race,
            'drivers' => $drivers,
            'rotations' => $rotations,
        ];
    }

    /**
     * Get all races
     */
    public static function get_all_races() {
        global $wpdb;

        return $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}rar_race_sessions ORDER BY start_time DESC"
        );
    }

    /**
     * End a race session
     */
    public static function end_race( $race_id ) {
        global $wpdb;

        // Count total laps
        $total_laps = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}rar_lap_times WHERE race_id = %d",
            $race_id
        ) );

        $wpdb->update(
            "{$wpdb->prefix}rar_race_sessions",
            [
                'end_time' => current_time( 'mysql' ),
                'total_laps' => $total_laps,
            ],
            [ 'id' => $race_id ],
            [ '%s', '%d' ],
            [ '%d' ]
        );
    }
}
