<?php

namespace JunixLabs\Observatory\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use JunixLabs\Observatory\Contracts\ExporterInterface;

class MetricsController extends Controller
{
    protected ExporterInterface $exporter;

    public function __construct(ExporterInterface $exporter)
    {
        $this->exporter = $exporter;
    }

    public function index(Request $request): Response
    {
        // Check basic auth if enabled
        if (config('observatory.prometheus.auth.enabled', false)) {
            if (! $this->authenticate($request)) {
                return new Response('Unauthorized', 401, [
                    'WWW-Authenticate' => 'Basic realm="Metrics"',
                ]);
            }
        }

        $output = $this->exporter->getOutput();

        return new Response($output, 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
        ]);
    }

    protected function authenticate(Request $request): bool
    {
        $username = config('observatory.prometheus.auth.username', 'prometheus');
        $password = config('observatory.prometheus.auth.password', '');

        $providedUser = $request->getUser();
        $providedPass = $request->getPassword();

        return $providedUser === $username && $providedPass === $password;
    }
}
