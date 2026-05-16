<?php

define( 'RAR_TESTING', true );

require_once __DIR__ . '/../includes/class-race-logic.php';

function rar_test_driver( $order ) {
    return (object) [
        'id'           => $order,
        'driver_order' => $order,
        'driver_name'  => 'Driver ' . $order,
    ];
}

function rar_test_drivers( $count = 4 ) {
    $drivers = [];

    for ( $order = 1; $order <= $count; $order++ ) {
        $drivers[] = rar_test_driver( $order );
    }

    return $drivers;
}

function rar_assert_same( $expected, $actual, $message ) {
    if ( $expected !== $actual ) {
        fwrite( STDERR, $message . PHP_EOL );
        fwrite( STDERR, 'Expected: ' . var_export( $expected, true ) . PHP_EOL );
        fwrite( STDERR, 'Actual:   ' . var_export( $actual, true ) . PHP_EOL );
        exit( 1 );
    }
}

function rar_assert_throws( $callback, $message ) {
    try {
        $callback();
    } catch ( InvalidArgumentException $exception ) {
        return;
    }

    fwrite( STDERR, $message . PHP_EOL );
    exit( 1 );
}

rar_assert_same(
    [ 1, 2, 3, 4 ],
    RAR_Race_Logic::parse_rotation_sequence( '1 2,3' . PHP_EOL . '4' ),
    'parses flat queue values'
);

rar_assert_same(
    [ 1, 3, 4, 1 ],
    RAR_Race_Logic::mutate_queue(
        [ 1, 2, 3, 4 ],
        'remove',
        [
            'index'              => 1,
            'materialize_length' => 4,
        ],
        rar_test_drivers(),
        0
    ),
    'remove deletes exactly one future stint'
);

rar_assert_same(
    [ 1, 3, 2, 4 ],
    RAR_Race_Logic::mutate_queue(
        [ 1, 2, 3, 4 ],
        'move',
        [
            'source_index' => 1,
            'target_index' => 2,
        ],
        rar_test_drivers(),
        0
    ),
    'move reorders one stint without removing duplicates'
);

rar_assert_same(
    [ 1, 4, 2, 3 ],
    RAR_Race_Logic::mutate_queue(
        [ 1, 2, 3 ],
        'insert',
        [
            'target_index' => 1,
            'driver_order' => 4,
        ],
        rar_test_drivers(),
        0
    ),
    'insert adds exactly one stint'
);

rar_assert_same(
    [ 1, 2, 3, 4, 2, 3, 4, 1 ],
    RAR_Race_Logic::mutate_queue(
        [ 1, 2, 3 ],
        'remove',
        [
            'index'              => 4,
            'materialize_length' => 8,
        ],
        rar_test_drivers(),
        0
    ),
    'remove materializes default queue before shifting'
);

rar_assert_same(
    [ 1, 2, 4, 1, 2, 3, 4, 1 ],
    RAR_Race_Logic::mutate_queue(
        [ 1, 2, 3, 4, 1, 2, 3, 4 ],
        'remove',
        [
            'index'              => 2,
            'materialize_length' => 8,
        ],
        rar_test_drivers(),
        0
    ),
    'remove appends the next default driver after the visible bottom'
);

rar_assert_throws(
    function () {
        RAR_Race_Logic::mutate_queue(
            [ 1, 2, 3 ],
            'remove',
            [ 'index' => 1 ],
            rar_test_drivers(),
            1
        );
    },
    'cannot edit completed/current stint'
);

$next_switch = RAR_Race_Logic::get_next_switch_drivers(
    [
        'race'      => (object) [ 'rotation_sequence' => '1,2,2,3' ],
        'drivers'   => rar_test_drivers( 3 ),
        'rotations' => [
            (object) [
                'id'             => 1,
                'from_driver_id' => 1,
                'to_driver_id'   => 2,
                'switched_at'    => '2026-05-01 10:45:00',
            ],
        ],
    ]
);

rar_assert_same( 2, intval( $next_switch['from']->driver_order ), 'next switch uses latest rotation target as current driver' );
rar_assert_same( 2, intval( $next_switch['to']->driver_order ), 'next switch allows double stints' );

echo 'PHP race logic tests passed' . PHP_EOL;
