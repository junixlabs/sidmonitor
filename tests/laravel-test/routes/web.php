<?php

use Illuminate\Support\Facades\Route;
use GuzzleHttp\Client;
use GuzzleHttp\HandlerStack;
use SidStack\Monitoring\Middleware\GuzzleMonitoringMiddleware;

Route::get('/', function () {
    return view('welcome');
});

// Test API routes for SidMonitor
Route::prefix('api')->group(function () {
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
    // Routes for testing error reporting in SidMonitor dashboard
    // ====================================

    // --- 4xx Client Errors ---

    Route::get('/error/400', function () {
        abort(400, 'Bad Request - Invalid request syntax or malformed request');
    });

    Route::get('/error/401', function () {
        abort(401, 'Unauthorized - Authentication required');
    });

    Route::get('/error/403', function () {
        abort(403, 'Forbidden - Access to this resource is denied');
    });

    Route::get('/error/404', function () {
        abort(404, 'Not Found - The requested resource does not exist');
    });

    Route::get('/error/405', function () {
        abort(405, 'Method Not Allowed - HTTP method not supported for this endpoint');
    });

    Route::get('/error/422', function () {
        abort(422, 'Unprocessable Entity - Validation failed');
    });

    Route::get('/error/429', function () {
        abort(429, 'Too Many Requests - Rate limit exceeded');
    });

    // --- 5xx Server Errors ---

    Route::get('/error/500', function () {
        abort(500, 'Internal Server Error - Something went wrong on the server');
    });

    Route::get('/error/502', function () {
        abort(502, 'Bad Gateway - Invalid response from upstream server');
    });

    Route::get('/error/503', function () {
        abort(503, 'Service Unavailable - Server temporarily unavailable');
    });

    Route::get('/error/504', function () {
        abort(504, 'Gateway Timeout - Upstream server did not respond in time');
    });

    // --- Exception-based errors (for testing exception logging) ---

    Route::get('/error/exception', function () {
        throw new \Exception('Test exception - Unhandled exception for testing');
    });

    Route::get('/error/runtime', function () {
        throw new \RuntimeException('Runtime error - Unexpected condition during execution');
    });

    Route::get('/error/validation', function () {
        $validator = \Illuminate\Support\Facades\Validator::make(
            ['email' => 'invalid-email'],
            ['email' => 'required|email']
        );

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }
    });

    // --- Random error generator for testing ---

    Route::get('/error/random', function () {
        $errors = [400, 401, 403, 404, 422, 500, 502, 503];
        $randomCode = $errors[array_rand($errors)];
        abort($randomCode, "Random test error - Code: {$randomCode}");
    });

    // --- Simplified error routes with dash notation (as requested) ---

    Route::get('/error-400', function () {
        abort(400, 'Bad Request');
    });

    Route::get('/error-401', function () {
        abort(401, 'Unauthorized');
    });

    Route::get('/error-403', function () {
        abort(403, 'Forbidden');
    });

    Route::get('/error-404', function () {
        abort(404, 'Not Found');
    });

    Route::get('/error-422', function () {
        return response()->json([
            'message' => 'Validation Error',
            'errors' => [
                'email' => ['The email field is required.'],
                'password' => ['The password field must be at least 8 characters.']
            ]
        ], 422);
    });

    Route::get('/error-503', function () {
        abort(503, 'Service Unavailable');
    });

    Route::get('/random-error', function () {
        $errors = [400, 401, 403, 404, 422, 500, 503];
        $randomCode = $errors[array_rand($errors)];

        if ($randomCode === 422) {
            return response()->json([
                'message' => 'Random Validation Error',
                'errors' => [
                    'field' => ['Random validation error']
                ]
            ], 422);
        }

        $messages = [
            400 => 'Bad Request',
            401 => 'Unauthorized',
            403 => 'Forbidden',
            404 => 'Not Found',
            500 => 'Internal Server Error',
            503 => 'Service Unavailable'
        ];

        abort($randomCode, $messages[$randomCode] ?? 'Error');
    });

    // Legacy route (keeping for backward compatibility)
    Route::get('/error', function () {
        abort(500, 'Test server error');
    });

    Route::get('/slow', function () {
        sleep(2);
        return response()->json(['message' => 'Slow response']);
    });

    // Test outbound requests with Guzzle monitoring
    Route::get('/test-outbound', function () {
        $stack = HandlerStack::create();
        $stack->push(GuzzleMonitoringMiddleware::create());

        $client = new Client([
            'handler' => $stack,
            'timeout' => 15,
            'connect_timeout' => 5,
        ]);

        try {
            // Use jsonplaceholder which is more reliable
            $response = $client->get('https://jsonplaceholder.typicode.com/posts/1');
            $data = json_decode($response->getBody()->getContents(), true);

            return response()->json([
                'status' => 'success',
                'message' => 'Outbound request to jsonplaceholder completed',
                'response_status' => $response->getStatusCode(),
                'post_title' => $data['title'] ?? 'unknown',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    });

    // ====================================
    // JOB MONITORING TEST ROUTES
    // Routes for testing job/queue monitoring in SidMonitor dashboard
    // ====================================

    // Dispatch a successful job (sync)
    Route::get('/test-job', function () {
        \App\Jobs\TestMonitoringJob::dispatchSync('Test job message');

        return response()->json([
            'status' => 'success',
            'message' => 'Job dispatched and completed (sync)',
        ]);
    });

    // Dispatch a job that will fail (sync)
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

        return response()->json([
            'status' => 'success',
            'message' => 'Job completed (unexpected)',
        ]);
    });

    // Dispatch multiple jobs (sync)
    Route::get('/test-jobs-batch', function () {
        $count = (int) request('count', 5);
        $results = [];

        for ($i = 1; $i <= $count; $i++) {
            try {
                // 20% chance of failure
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

    // Test outbound to multiple services
    Route::get('/test-outbound-multi', function () {
        $stack = HandlerStack::create();
        $stack->push(GuzzleMonitoringMiddleware::create());

        $client = new Client([
            'handler' => $stack,
            'timeout' => 10,
        ]);

        $results = [];

        // Call httpbin
        try {
            $response = $client->get('https://httpbin.org/status/200');
            $results['httpbin'] = ['status' => $response->getStatusCode()];
        } catch (\Exception $e) {
            $results['httpbin'] = ['error' => $e->getMessage()];
        }

        // Call jsonplaceholder
        try {
            $response = $client->get('https://jsonplaceholder.typicode.com/posts/1');
            $results['jsonplaceholder'] = ['status' => $response->getStatusCode()];
        } catch (\Exception $e) {
            $results['jsonplaceholder'] = ['error' => $e->getMessage()];
        }

        return response()->json([
            'status' => 'success',
            'results' => $results,
        ]);
    });
});
