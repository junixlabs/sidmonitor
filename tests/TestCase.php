<?php

namespace JunixLabs\Observatory\Tests;

use JunixLabs\Observatory\ObservatoryServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;

class TestCase extends Orchestra
{
    protected function getPackageProviders($app): array
    {
        return [
            ObservatoryServiceProvider::class,
        ];
    }

    protected function getEnvironmentSetUp($app): void
    {
        // Set app key for encryption (required by Laravel)
        $app['config']->set('app.key', 'base64:' . base64_encode(random_bytes(32)));

        // Observatory config
        $app['config']->set('observatory.enabled', true);
        $app['config']->set('observatory.app_name', 'test-app');
        $app['config']->set('observatory.exporter', 'prometheus');
        $app['config']->set('observatory.prometheus.storage', 'memory');
    }

    protected function defineRoutes($router): void
    {
        // Register observatory routes for testing
        $router->get('/metrics', [\JunixLabs\Observatory\Http\Controllers\MetricsController::class, 'index'])
            ->name('observatory.metrics');
    }
}
