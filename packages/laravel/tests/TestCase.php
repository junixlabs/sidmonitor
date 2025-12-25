<?php

namespace JunixLabs\Observatory\Tests;

use Orchestra\Testbench\TestCase as Orchestra;
use JunixLabs\Observatory\ObservatoryServiceProvider;

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
        $app['config']->set('observatory.enabled', true);
        $app['config']->set('observatory.app_name', 'test-app');
        $app['config']->set('observatory.exporter', 'prometheus');
        $app['config']->set('observatory.prometheus.storage', 'memory');
    }
}
