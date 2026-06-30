<?php
/**
 * Pure race and queue helpers.
 */

if ( ! defined( 'ABSPATH' ) && ! defined( 'RAR_TESTING' ) ) {
    exit;
}

class RAR_Race_Logic {

    public static function parse_rotation_sequence( $value ) {
        $tokens = preg_split( '/[\s,]+/', strval( $value ), -1, PREG_SPLIT_NO_EMPTY );

        return array_values(
            array_map(
                'intval',
                array_filter(
                    $tokens,
                    function ( $token ) {
                        return preg_match( '/^-?\d+$/', $token );
                    }
                )
            )
        );
    }

    public static function serialize_rotation_sequence( $sequence ) {
        $sequence = array_values(
            array_filter(
                array_map( 'intval', (array) $sequence ),
                function ( $driver_order ) {
                    return 0 !== $driver_order;
                }
            )
        );

        return implode( ',', $sequence );
    }

    public static function mutate_queue( $sequence, $operation, $args, $drivers, $completed_laps = 0 ) {
        $queue = array_values( array_map( 'intval', (array) $sequence ) );
        $completed_laps = intval( $completed_laps );

        switch ( $operation ) {
            case 'clear':
                return [];

            case 'remove':
                $index = intval( $args['index'] ?? -1 );
                $materialize_length = intval( $args['materialize_length'] ?? $index + 1 );
                self::assert_future_index( $index, $completed_laps );
                self::ensure_queue_length( $queue, max( $materialize_length, $index + 1 ), $drivers );
                $removed_from_visible_bottom = $index >= $materialize_length - 1;
                $removed_driver_order = intval( $queue[ $index ] ?? 0 );
                array_splice( $queue, $index, 1 );
                self::fill_queue_after_remove(
                    $queue,
                    $materialize_length,
                    $drivers,
                    $removed_from_visible_bottom ? $removed_driver_order : 0
                );
                return $queue;

            case 'move':
                $source_index = intval( $args['source_index'] ?? -1 );
                $target_index = intval( $args['target_index'] ?? -1 );
                self::assert_future_index( $source_index, $completed_laps );
                self::assert_future_index( $target_index, $completed_laps );

                if ( $source_index === $target_index ) {
                    return $queue;
                }

                self::ensure_queue_length( $queue, max( $source_index, $target_index ) + 1, $drivers );
                $moved = array_splice( $queue, $source_index, 1 );
                array_splice( $queue, min( $target_index, count( $queue ) ), 0, $moved );
                return $queue;

            case 'insert':
                $target_index = intval( $args['target_index'] ?? -1 );
                $driver_order = intval( $args['driver_order'] ?? 0 );
                self::assert_future_index( $target_index, $completed_laps );

                if ( ! self::driver_order_exists( $drivers, $driver_order ) ) {
                    throw new InvalidArgumentException( 'Unbekannte Fahrernummer' );
                }

                self::ensure_queue_length( $queue, $target_index, $drivers );
                array_splice( $queue, $target_index, 0, [ $driver_order ] );
                return $queue;
        }

        throw new InvalidArgumentException( 'Unbekannte Queue-Operation' );
    }

    public static function get_next_switch_drivers( $race_data ) {
        $drivers = array_values( $race_data['drivers'] ?? [] );

        if ( empty( $drivers ) ) {
            return null;
        }

        $rotations = self::get_ordered_rotations( $race_data['rotations'] ?? [] );
        $completed_laps = count( $rotations );
        $sequence = self::parse_rotation_sequence( $race_data['race']->rotation_sequence ?? '' );
        $latest_rotation = ! empty( $rotations ) ? $rotations[ count( $rotations ) - 1 ] : null;
        $from_driver = $latest_rotation ? self::get_driver_by_id( $drivers, $latest_rotation->to_driver_id ?? 0 ) : null;

        if ( ! $from_driver ) {
            $from_driver = self::get_driver_for_lap( $completed_laps, $drivers, $sequence );
        }

        $to_driver = self::get_driver_for_lap( $completed_laps + 1, $drivers, $sequence );

        if ( ! $from_driver || ! $to_driver ) {
            return null;
        }

        return [
            'from' => $from_driver,
            'to'   => $to_driver,
        ];
    }

    public static function get_ordered_rotations( $rotations ) {
        $rotations = array_values( (array) $rotations );
        usort(
            $rotations,
            function ( $a, $b ) {
                $time_compare = strcmp( $a->switched_at ?? '', $b->switched_at ?? '' );
                if ( 0 !== $time_compare ) {
                    return $time_compare;
                }

                return intval( $a->id ?? 0 ) <=> intval( $b->id ?? 0 );
            }
        );

        return $rotations;
    }

    public static function get_driver_for_lap( $lap_index, $drivers, $sequence ) {
        $drivers = array_values( (array) $drivers );

        if ( empty( $drivers ) ) {
            return null;
        }

        $driver_order = $sequence[ $lap_index ] ?? null;
        if ( null !== $driver_order ) {
            foreach ( $drivers as $driver ) {
                if ( intval( $driver->driver_order ?? 0 ) === intval( $driver_order ) ) {
                    return $driver;
                }
            }
        }

        return $drivers[ $lap_index % count( $drivers ) ] ?? null;
    }

    private static function ensure_queue_length( &$queue, $length, $drivers ) {
        while ( count( $queue ) < $length ) {
            $driver = self::get_driver_for_lap( count( $queue ), $drivers, $queue );
            if ( ! $driver ) {
                throw new InvalidArgumentException( 'Keine Fahrer verfügbar' );
            }

            $queue[] = intval( $driver->driver_order );
        }
    }

    private static function fill_queue_after_remove( &$queue, $length, $drivers, $removed_driver_order = 0 ) {
        if ( count( $queue ) >= $length ) {
            $queue = array_slice( $queue, 0, max( 0, $length - 1 ) );
        }

        $next_after_removed = $removed_driver_order ? self::get_next_default_driver_order_after( $removed_driver_order, $drivers ) : null;
        while ( count( $queue ) < $length ) {
            if ( null !== $next_after_removed ) {
                $queue[] = $next_after_removed;
                $next_after_removed = null;
                continue;
            }

            $queue[] = self::get_next_default_driver_order( $queue, $drivers );
        }
    }

    private static function get_next_default_driver_order_after( $driver_order, $drivers ) {
        $drivers = array_values( (array) $drivers );
        if ( empty( $drivers ) ) {
            throw new InvalidArgumentException( 'Keine Fahrer verfügbar' );
        }

        foreach ( $drivers as $index => $driver ) {
            if ( intval( $driver->driver_order ?? 0 ) === intval( $driver_order ) ) {
                $next_driver = $drivers[ ( $index + 1 ) % count( $drivers ) ];
                return intval( $next_driver->driver_order );
            }
        }

        return null;
    }

    private static function get_next_default_driver_order( $queue, $drivers ) {
        $drivers = array_values( (array) $drivers );
        if ( empty( $drivers ) ) {
            throw new InvalidArgumentException( 'Keine Fahrer verfügbar' );
        }

        $last_driver_order = count( $queue ) ? intval( $queue[ count( $queue ) - 1 ] ) : null;
        foreach ( $drivers as $index => $driver ) {
            if ( intval( $driver->driver_order ?? 0 ) === $last_driver_order ) {
                $next_driver = $drivers[ ( $index + 1 ) % count( $drivers ) ];
                return intval( $next_driver->driver_order );
            }
        }

        $driver = $drivers[ count( $queue ) % count( $drivers ) ];
        return intval( $driver->driver_order );
    }

    private static function assert_future_index( $index, $completed_laps ) {
        if ( $index < 0 || $index <= $completed_laps ) {
            throw new InvalidArgumentException( 'Nur zukünftige Stints können bearbeitet werden' );
        }
    }

    private static function driver_order_exists( $drivers, $driver_order ) {
        foreach ( (array) $drivers as $driver ) {
            if ( intval( $driver->driver_order ?? 0 ) === intval( $driver_order ) ) {
                return true;
            }
        }

        return false;
    }

    private static function get_driver_by_id( $drivers, $driver_id ) {
        foreach ( (array) $drivers as $driver ) {
            if ( intval( $driver->id ?? 0 ) === intval( $driver_id ) ) {
                return $driver;
            }
        }

        return null;
    }
}
