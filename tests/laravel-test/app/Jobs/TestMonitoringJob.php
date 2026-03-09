<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class TestMonitoringJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public string $message;
    public bool $shouldFail;

    public function __construct(string $message = 'Hello', bool $shouldFail = false)
    {
        $this->message = $message;
        $this->shouldFail = $shouldFail;
    }

    public function handle(): void
    {
        Log::info("TestMonitoringJob: Processing message - {$this->message}");

        // Simulate some work
        usleep(100000); // 100ms

        if ($this->shouldFail) {
            throw new \Exception("Job intentionally failed: {$this->message}");
        }

        Log::info("TestMonitoringJob: Completed - {$this->message}");
    }
}
