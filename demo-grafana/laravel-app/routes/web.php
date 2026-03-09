<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Http;

Route::get('/', function () {
    return response()->json([
        'app' => 'Laravel Observatory Demo',
        'message' => 'Welcome! Try these endpoints:',
        'endpoints' => [
            'GET /' => 'This page',
            'GET /api/users' => 'List users (demo)',
            'GET /api/slow' => 'Slow endpoint (500ms delay)',
            'GET /api/external' => 'Makes outbound HTTP call',
            'GET /api/error' => 'Triggers an error',
            'GET /metrics' => 'Prometheus metrics',
        ],
    ]);
});

Route::get('/api/users', function () {
    return response()->json([
        'users' => [
            ['id' => 1, 'name' => 'John Doe'],
            ['id' => 2, 'name' => 'Jane Smith'],
            ['id' => 3, 'name' => 'Bob Johnson'],
        ],
    ]);
});

Route::get('/api/slow', function () {
    usleep(500000); // 500ms delay
    return response()->json(['message' => 'This was slow!']);
});

Route::get('/api/external', function () {
    // Make an outbound HTTP call to demonstrate outbound monitoring
    try {
        $response = Http::timeout(5)->get('https://httpbin.org/json');
        return response()->json([
            'message' => 'External API called successfully',
            'external_data' => $response->json(),
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'message' => 'External API call failed',
            'error' => $e->getMessage(),
        ], 500);
    }
});

Route::get('/api/error', function () {
    throw new \Exception('This is a demo error!');
});

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});
