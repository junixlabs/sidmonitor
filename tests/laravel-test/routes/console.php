<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Test artisan command for scheduled task monitoring
Artisan::command('test:scheduled-task', function () {
    $this->info('Scheduled task started...');
    usleep(200000); // 200ms
    $this->info('Scheduled task completed.');
})->purpose('Test command for Observatory scheduled task monitoring');

Artisan::command('test:scheduled-task-fail', function () {
    $this->info('Failing scheduled task started...');
    usleep(100000); // 100ms
    throw new \RuntimeException('Scheduled task intentionally failed');
})->purpose('Test failing scheduled task');

// Register scheduled tasks for testing
Schedule::command('test:scheduled-task')
    ->everyMinute()
    ->withoutOverlapping()
    ->description('Observatory test task - runs every minute');

Schedule::command('inspire')
    ->everyFiveMinutes()
    ->description('Inspirational quote - every 5 minutes');
