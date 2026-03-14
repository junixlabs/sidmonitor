<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Test API routes for SidMonitor Observatory
Route::prefix('api')->group(function () {

    // ====================================
    // INBOUND REQUEST TESTS
    // ====================================

    Route::get('/users', function () {
        return response()->json([
            'users' => [
                ['id' => 1, 'name' => 'John Doe', 'email' => 'john@example.com'],
                ['id' => 2, 'name' => 'Jane Smith', 'email' => 'jane@example.com'],
            ]
        ]);
    });

    Route::get('/users/{id}', function ($id) {
        return response()->json([
            'id' => $id,
            'name' => 'User ' . $id,
            'email' => 'user' . $id . '@example.com'
        ]);
    });

    Route::post('/users', function () {
        return response()->json([
            'id' => 3,
            'name' => request('name'),
            'email' => request('email'),
            'message' => 'User created'
        ], 201);
    });

    // ====================================
    // ERROR TEST ROUTES
    // ====================================

    Route::get('/error/400', fn() => abort(400, 'Bad Request'));
    Route::get('/error/401', fn() => abort(401, 'Unauthorized'));
    Route::get('/error/403', fn() => abort(403, 'Forbidden'));
    Route::get('/error/404', fn() => abort(404, 'Not Found'));
    Route::get('/error/500', fn() => abort(500, 'Internal Server Error'));
    Route::get('/error/503', fn() => abort(503, 'Service Unavailable'));

    Route::get('/error/exception', function () {
        throw new \Exception('Test exception - Unhandled exception for testing');
    });

    Route::get('/error/runtime', function () {
        throw new \RuntimeException('Runtime error - Unexpected condition');
    });

    Route::get('/error/random', function () {
        $errors = [400, 401, 403, 404, 422, 500, 502, 503];
        abort($errors[array_rand($errors)], 'Random test error');
    });

    Route::get('/slow', function () {
        sleep(2);
        return response()->json(['message' => 'Slow response']);
    });

    // ====================================
    // OUTBOUND REQUEST TESTS (auto-observed via Http facade)
    // ====================================

    Route::get('/test-outbound', function () {
        try {
            $response = Http::timeout(15)->get('https://jsonplaceholder.typicode.com/posts/1');

            return response()->json([
                'status' => 'success',
                'message' => 'Outbound request completed',
                'response_status' => $response->status(),
                'post_title' => $response->json('title', 'unknown'),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    });

    Route::get('/test-outbound-multi', function () {
        $results = [];

        try {
            $response = Http::timeout(10)->get('https://jsonplaceholder.typicode.com/posts/1');
            $results['jsonplaceholder'] = ['status' => $response->status()];
        } catch (\Exception $e) {
            $results['jsonplaceholder'] = ['error' => $e->getMessage()];
        }

        try {
            $response = Http::timeout(10)->get('https://jsonplaceholder.typicode.com/users/1');
            $results['jsonplaceholder_users'] = ['status' => $response->status()];
        } catch (\Exception $e) {
            $results['jsonplaceholder_users'] = ['error' => $e->getMessage()];
        }

        // Test outbound to a non-existent host (error case)
        try {
            $response = Http::timeout(2)->get('http://nonexistent-host.invalid/test');
            $results['nonexistent'] = ['status' => $response->status()];
        } catch (\Exception $e) {
            $results['nonexistent'] = ['error' => $e->getMessage()];
        }

        return response()->json([
            'status' => 'success',
            'results' => $results,
        ]);
    });

    // ====================================
    // JOB MONITORING TESTS
    // ====================================

    Route::get('/test-job', function () {
        \App\Jobs\TestMonitoringJob::dispatchSync('Test job message');

        return response()->json([
            'status' => 'success',
            'message' => 'Job dispatched and completed (sync)',
        ]);
    });

    Route::get('/test-job-fail', function () {
        try {
            \App\Jobs\TestMonitoringJob::dispatchSync('Failing job', true);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Job failed as expected',
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json(['status' => 'unexpected_success']);
    });

    Route::get('/test-jobs-batch', function () {
        $count = (int) request('count', 5);
        $results = [];

        for ($i = 1; $i <= $count; $i++) {
            try {
                $shouldFail = rand(1, 100) <= 20;
                \App\Jobs\TestMonitoringJob::dispatchSync("Batch job #{$i}", $shouldFail);
                $results[] = ['job' => $i, 'status' => 'completed'];
            } catch (\Exception $e) {
                $results[] = ['job' => $i, 'status' => 'failed', 'error' => $e->getMessage()];
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => "Dispatched {$count} jobs",
            'results' => $results,
        ]);
    });

    // ====================================
    // OBSERVATORY STATUS
    // ====================================

    Route::get('/observatory-status', function () {
        $exporter = app(\JunixLabs\Observatory\Contracts\ExporterInterface::class);

        return response()->json([
            'enabled' => config('observatory.enabled'),
            'exporter' => config('observatory.exporter'),
            'endpoint' => config('observatory.sidmonitor.endpoint'),
            'api_key_set' => !empty(config('observatory.sidmonitor.api_key')),
            'buffer_status' => json_decode($exporter->getOutput(), true),
        ]);
    });

    // Force flush all buffered data
    Route::get('/observatory-flush', function () {
        $exporter = app(\JunixLabs\Observatory\Contracts\ExporterInterface::class);
        $before = json_decode($exporter->getOutput(), true);
        $exporter->flush();
        $after = json_decode($exporter->getOutput(), true);

        return response()->json([
            'status' => 'flushed',
            'before' => $before,
            'after' => $after,
        ]);
    });
});
