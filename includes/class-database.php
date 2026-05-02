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
            planned_end_time datetime NULL,
            first_lap_extra_time decimal(10, 2) NOT NULL DEFAULT 0 COMMENT 'in seconds',
            rotation_sequence longtext NULL,
            total_laps int(11) DEFAULT 0,
            notes longtext NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) $charset_collate;";

        // Drivers table
        $sql_drivers = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}rar_drivers (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            race_id bigint(20) NOT NULL,
            driver_order int(11) NOT NULL DEFAULT 0,
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

        self::maybe_add_column(
            "{$wpdb->prefix}rar_race_sessions",
            'first_lap_extra_time',
            "ALTER TABLE {$wpdb->prefix}rar_race_sessions ADD COLUMN first_lap_extra_time decimal(10, 2) NOT NULL DEFAULT 0 COMMENT 'in seconds' AFTER end_time"
        );

        self::maybe_add_column(
            "{$wpdb->prefix}rar_race_sessions",
            'planned_end_time',
            "ALTER TABLE {$wpdb->prefix}rar_race_sessions ADD COLUMN planned_end_time datetime NULL AFTER end_time"
        );

        self::maybe_add_column(
            "{$wpdb->prefix}rar_race_sessions",
            'rotation_sequence',
            "ALTER TABLE {$wpdb->prefix}rar_race_sessions ADD COLUMN rotation_sequence longtext NULL AFTER first_lap_extra_time"
        );

        self::maybe_add_column(
            "{$wpdb->prefix}rar_drivers",
            'driver_order',
            "ALTER TABLE {$wpdb->prefix}rar_drivers ADD COLUMN driver_order int(11) NOT NULL DEFAULT 0 AFTER race_id"
        );

        self::backfill_driver_order();
    }

    /**
     * Add a column when dbDelta does not alter an existing table.
     */
    private static function maybe_add_column( $table, $column, $alter_sql ) {
        global $wpdb;

        $column_exists = $wpdb->get_var( $wpdb->prepare(
            "SHOW COLUMNS FROM {$table} LIKE %s",
            $column
        ) );

        if ( ! $column_exists ) {
            $wpdb->query( $alter_sql );
        }
    }

    /**
     * Existing drivers keep their creation order as the default rotation.
     */
    private static function backfill_driver_order() {
        global $wpdb;

        $race_ids = $wpdb->get_col(
            "SELECT DISTINCT race_id FROM {$wpdb->prefix}rar_drivers WHERE driver_order = 0 ORDER BY race_id ASC"
        );

        foreach ( $race_ids as $race_id ) {
            $drivers = $wpdb->get_results( $wpdb->prepare(
                "SELECT id FROM {$wpdb->prefix}rar_drivers WHERE race_id = %d ORDER BY created_at ASC, id ASC",
                $race_id
            ) );

            $driver_order = 1;
            foreach ( $drivers as $driver ) {
                $wpdb->update(
                    "{$wpdb->prefix}rar_drivers",
                    [ 'driver_order' => $driver_order ],
                    [ 'id' => $driver->id ],
                    [ '%d' ],
                    [ '%d' ]
                );
                $driver_order++;
            }
        }
    }

    /**
     * Create a new race session
     */
    public static function create_race( $race_name, $first_lap_extra_time = 0, $start_time = null, $planned_end_time = null ) {
        global $wpdb;

        $start_time = $start_time ?: current_time( 'mysql' );
        
        $wpdb->insert( 
            "{$wpdb->prefix}rar_race_sessions",
            [
                'race_name' => $race_name,
                'start_time' => $start_time,
                'planned_end_time' => $planned_end_time,
                'first_lap_extra_time' => $first_lap_extra_time,
            ],
            [ '%s', '%s', '%s', '%f' ]
        );

        return $wpdb->insert_id;
    }

    /**
     * Add a driver to a race
     */
    public static function add_driver( $race_id, $driver_name, $avg_lap_time = null ) {
        global $wpdb;

        $driver_order = intval( $wpdb->get_var( $wpdb->prepare(
            "SELECT COALESCE(MAX(driver_order), 0) + 1 FROM {$wpdb->prefix}rar_drivers WHERE race_id = %d",
            $race_id
        ) ) );
        
        $wpdb->insert(
            "{$wpdb->prefix}rar_drivers",
            [
                'race_id' => $race_id,
                'driver_order' => $driver_order,
                'driver_name' => $driver_name,
                'avg_lap_time' => $avg_lap_time,
            ],
            [ '%d', '%d', '%s', '%f' ]
        );

        return $wpdb->insert_id;
    }

    /**
     * Save a race-specific rotation sequence.
     */
    public static function save_rotation_sequence( $race_id, $rotation_sequence ) {
        global $wpdb;

        $wpdb->update(
            "{$wpdb->prefix}rar_race_sessions",
            [ 'rotation_sequence' => $rotation_sequence ],
            [ 'id' => $race_id ],
            [ '%s' ],
            [ '%d' ]
        );
    }

    /**
     * Delete a race and all related race data.
     */
    public static function delete_race( $race_id ) {
        global $wpdb;

        $wpdb->delete(
            "{$wpdb->prefix}rar_driver_rotations",
            [ 'race_id' => $race_id ],
            [ '%d' ]
        );

        $wpdb->delete(
            "{$wpdb->prefix}rar_lap_times",
            [ 'race_id' => $race_id ],
            [ '%d' ]
        );

        $wpdb->delete(
            "{$wpdb->prefix}rar_drivers",
            [ 'race_id' => $race_id ],
            [ '%d' ]
        );

        return (bool) $wpdb->delete(
            "{$wpdb->prefix}rar_race_sessions",
            [ 'id' => $race_id ],
            [ '%d' ]
        );
    }

    /**
     * Set or correct the race start time.
     */
    public static function start_race( $race_id, $start_time ) {
        global $wpdb;

        $wpdb->update(
            "{$wpdb->prefix}rar_race_sessions",
            [ 'start_time' => $start_time ],
            [ 'id' => $race_id ],
            [ '%s' ],
            [ '%d' ]
        );
    }

    /**
     * Validate rotation sequence tokens against driver order numbers.
     */
    public static function validate_rotation_sequence( $race_id, $rotation_sequence ) {
        global $wpdb;

        $rotation_sequence = trim( $rotation_sequence );
        if ( '' === $rotation_sequence ) {
            return '';
        }

        if ( substr_count( $rotation_sequence, '|' ) > 1 ) {
            return 'Bitte nur einen Trenner "|" verwenden';
        }

        $valid_orders = array_map( 'intval', $wpdb->get_col( $wpdb->prepare(
            "SELECT driver_order FROM {$wpdb->prefix}rar_drivers WHERE race_id = %d",
            $race_id
        ) ) );

        if ( empty( $valid_orders ) ) {
            return 'Bitte zuerst Fahrer hinzufügen';
        }

        $tokens = preg_split( '/[\s,|]+/', $rotation_sequence, -1, PREG_SPLIT_NO_EMPTY );
        foreach ( $tokens as $token ) {
            if ( ! ctype_digit( $token ) || ! in_array( intval( $token ), $valid_orders, true ) ) {
                return sprintf( 'Unbekannte Fahrernummer: %s', $token );
            }
        }

        return '';
    }

    /**
     * Record a lap time
     */
    public static function record_lap( $driver_id, $race_id, $lap_time ) {
        global $wpdb;

        $race_lap_count = intval( $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}rar_lap_times WHERE race_id = %d",
            $race_id
        ) ) );

        if ( 0 === $race_lap_count ) {
            $first_lap_extra_time = floatval( $wpdb->get_var( $wpdb->prepare(
                "SELECT first_lap_extra_time FROM {$wpdb->prefix}rar_race_sessions WHERE id = %d",
                $race_id
            ) ) );

            $lap_time += $first_lap_extra_time;
        }

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
    public static function record_driver_switch( $race_id, $from_driver_id, $to_driver_id, $switched_at = null ) {
        global $wpdb;

        $switched_at = $switched_at ?: current_time( 'mysql' );

        $wpdb->insert(
            "{$wpdb->prefix}rar_driver_rotations",
            [
                'race_id' => $race_id,
                'from_driver_id' => $from_driver_id,
                'to_driver_id' => $to_driver_id,
                'switched_at' => $switched_at,
            ],
            [ '%d', '%d', '%d', '%s' ]
        );

        return $wpdb->insert_id;
    }

    /**
     * Delete the latest driver switch for a race.
     */
    public static function undo_last_driver_switch( $race_id ) {
        global $wpdb;

        $switch_id = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}rar_driver_rotations
             WHERE race_id = %d
             ORDER BY switched_at DESC, id DESC
             LIMIT 1",
            $race_id
        ) );

        if ( ! $switch_id ) {
            return false;
        }

        return (bool) $wpdb->delete(
            "{$wpdb->prefix}rar_driver_rotations",
            [ 'id' => $switch_id ],
            [ '%d' ]
        );
    }

    /**
     * Update driver statistics
     */
    private static function update_driver_stats( $driver_id, $race_id ) {
        global $wpdb;

        $stats = $wpdb->get_row( $wpdb->prepare(
            "SELECT COUNT(*) as total_laps, SUM(lap_time) as total_time
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
                    'total_time' => $stats->total_time,
                ],
                [ 'id' => $driver_id ],
                [ '%d', '%f' ],
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
            "SELECT d.*,
                (
                    SELECT AVG(l.lap_time)
                    FROM {$wpdb->prefix}rar_lap_times l
                    WHERE l.driver_id = d.id AND l.race_id = d.race_id
                ) as actual_avg_lap_time
             FROM {$wpdb->prefix}rar_drivers d
             WHERE d.race_id = %d
             ORDER BY d.driver_order ASC, d.created_at ASC, d.id ASC",
            $race_id
        ) );

        $latest_lap = $wpdb->get_row( $wpdb->prepare(
            "SELECT l.*, d.driver_name
             FROM {$wpdb->prefix}rar_lap_times l
             LEFT JOIN {$wpdb->prefix}rar_drivers d ON l.driver_id = d.id
             WHERE l.race_id = %d
             ORDER BY l.recorded_at DESC, l.id DESC
             LIMIT 1",
            $race_id
        ) );

        $recorded_laps = intval( $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}rar_lap_times WHERE race_id = %d",
            $race_id
        ) ) );

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
            'latest_lap' => $latest_lap,
            'recorded_laps' => $recorded_laps,
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
