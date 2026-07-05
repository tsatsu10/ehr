<?php

/**
 * Android SMS Gateway Client
 *
 * Sends SMS via a self-hosted Android SMS Gateway app running on a local Android
 * device on the same network. Install the free "Android SMS Gateway" app on any
 * Android phone, enable the HTTP server in the app, and point this client at the
 * phone's local IP address (e.g. http://192.168.1.100:8080).
 *
 * App: https://github.com/android-sms-gateway/android-app (open-source, free)
 * API: POST /api/v1/message  — Basic auth, JSON body
 *
 * @package   OpenEMR
 * @link      http://www.open-emr.org
 * @author    New Clinic Module
 * @copyright Copyright (c) 2026
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\FaxSMS\Controller;

use OpenEMR\Common\Crypto\CryptoGen;
use RuntimeException;

class AndroidSmsGatewayClient extends AppDispatch
{
    protected CryptoGen $crypto;
    private string $gatewayUrl;
    private string $username;
    private string $password;

    public function __construct()
    {
        if (empty($GLOBALS['oefax_enable_sms'] ?? null)) {
            throw new RuntimeException(xlt("Access denied! Module not enabled"));
        }
        $this->crypto = new CryptoGen();
        $this->credentials = $this->getCredentials();
        parent::__construct();
    }

    public function getCredentials(): mixed
    {
        $credentials = AppDispatch::getSetup();
        $this->gatewayUrl = rtrim($credentials['server'] ?? '', '/');
        $this->username   = $credentials['username'] ?? '';
        $this->password   = $credentials['password'] ?? '';
        return $credentials;
    }

    public function sendSMS($toPhone = '', $subject = '', $message = '', $from = ''): mixed
    {
        $toPhone = $toPhone ?: $this->getRequest('phone');
        $message = $message ?: $this->getRequest('comments');

        if (empty($toPhone) || empty($message)) {
            return xlt('Error: Phone number and message are required.');
        }

        if (empty($this->gatewayUrl) || empty($this->username)) {
            return xlt('Error: Android SMS Gateway not configured. Please enter the gateway URL and credentials in Setup.');
        }

        $endpoint = $this->gatewayUrl . '/api/v1/message';
        $payload  = json_encode([
            'message'      => $message,
            'phoneNumbers' => [$toPhone],
        ]);

        $authHeader = 'Basic ' . base64_encode($this->username . ':' . $this->password);
        $context = stream_context_create([
            'http' => [
                'method'        => 'POST',
                'header'        => implode("\r\n", [
                    'Content-Type: application/json',
                    'Authorization: ' . $authHeader,
                    'Content-Length: ' . strlen($payload),
                ]),
                'content'       => $payload,
                'timeout'       => 10,
                'ignore_errors' => true,
            ],
        ]);

        $response   = @file_get_contents($endpoint, false, $context);
        $statusLine = $http_response_header[0] ?? '';
        preg_match('/HTTP\/\S+ (\d+)/', $statusLine, $matches);
        $httpCode = (int)($matches[1] ?? 0);

        if ($httpCode === 200 || $httpCode === 202) {
            return xlt('Message Sent');
        }

        $detail = $response !== false ? strip_tags((string)$response) : xlt('No response from gateway. Check that the Android app is running and the device is on the same network.');
        return xlt('Error') . ': ' . text("HTTP {$httpCode} — " . $detail);
    }

    public function authenticate(array $acl = ['patients', 'appt']): int
    {
        if (empty($this->credentials)) {
            $this->credentials = $this->getCredentials();
        }
        if (empty($this->username) || empty($this->gatewayUrl)) {
            return 0;
        }
        [$s, $v] = $acl;
        return $this->verifyAcl($s, $v);
    }

    public function fetchSMSList($uiDateRangeFlag = true): false|string|null
    {
        return json_encode([xlt('Message log is not available for Android SMS Gateway.')]);
    }

    public function fetchSMSFilteredList($dateFrom, $dateTo): void
    {
    }

    public function getNotificationLog(): string
    {
        $fromDate = $this->getRequest('datefrom');
        $toDate   = $this->getRequest('dateto');

        $query = "SELECT * FROM notification_log WHERE dSentDateTime > ? AND dSentDateTime < ?";
        $res   = sqlStatement($query, [$fromDate, $toDate]);
        $html  = '';
        while ($row = sqlFetchArray($res)) {
            $adate  = $row['pc_eventDate'] . '::' . $row['pc_startTime'];
            $pinfo  = str_replace('|||', ' ', $row['patient_info']);
            $html  .= '<tr>'
                . '<td>' . text($row['pc_eid']) . '</td>'
                . '<td>' . text($row['dSentDateTime']) . '</td>'
                . '<td>' . text($adate) . '</td>'
                . '<td>' . text($pinfo) . '</td>'
                . '<td>' . text($row['message']) . '</td>'
                . '</tr>';
        }
        return $html;
    }

    public function getCallLogs(): string
    {
        return xlt('Not Implemented');
    }

    public function getUser(): bool|string
    {
        $id    = $this->getRequest('uid');
        $query = "SELECT * FROM users WHERE id = ?";
        $res   = sqlStatement($query, [$id]);
        $u     = sqlFetchArray($res) ?: [];
        return json_encode([$u['fname'] ?? '', $u['lname'] ?? '', $u['fax'] ?? '', $u['facility'] ?? '']);
    }

    public function sendFax(): string|bool
    {
        return false;
    }

    public function fetchReminderCount(): string|bool
    {
        return 0;
    }

    public function sendEmail(): mixed
    {
        return false;
    }

    protected function index()
    {
        global $pid;
        if (!$this->getSession('pid', '')) {
            $pid_s = $this->getRequest('patient_id');
            $this->setSession('pid', $pid ?: $pid_s);
        }
        if (empty($pid)) {
            $pid = $this->getSession('pid', '');
        }
        return null;
    }
}
