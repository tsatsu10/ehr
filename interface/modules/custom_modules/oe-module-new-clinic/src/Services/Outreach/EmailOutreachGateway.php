<?php

/**
 * Email outreach gateway (GAP-B B1 — email delivery adapter).
 *
 * The first real `OutreachGatewayPort` implementation: it actually sends patient
 * outreach email through OpenEMR's canonical mailer (`MyMailer`, which reads the
 * clinic's configured SMTP/mail transport). No third-party account or provider
 * decision is needed — the clinic configures mail once in Administration →
 * Globals → Notifications, and outreach uses it. The SMS channel stays stubbed
 * until a real SMS provider is wired (a separate adapter behind this same port).
 *
 * Availability gate (both must hold, else the factory falls back to the stub):
 * - `MyMailer::isConfigured()` — a mail transport is set up; AND
 * - a clinic sender email (`patient_reminder_sender_email`) is set — the real
 *   signal that patient email was deliberately configured (and the required
 *   From address). This keeps a box with no mail setup honestly on the stub.
 *
 * Privacy: one email per recipient (recipients never share a To/Cc — a patient
 * must never see another patient's address). Bulk is bounded upstream
 * (OutreachService caps the cohort at 500) and sent synchronously; moving to the
 * async `email_queue` is a future scalability step.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services\Outreach;

class EmailOutreachGateway implements OutreachGatewayPort
{
    /** True when patient email can really be sent (transport + sender set). */
    public static function isAvailable(): bool
    {
        return \MyMailer::isConfigured() && self::senderEmail() !== '';
    }

    public function isConfigured(): bool
    {
        return self::isAvailable();
    }

    /**
     * @param array<int, array{pid: int, contact: string}> $recipients
     * @return array{sent: int, failed: int, status: string, note: string}
     */
    public function send(string $channel, string $subject, string $body, array $recipients): array
    {
        if ($channel !== 'email') {
            return $this->stub('SMS delivery is not configured — the campaign was recorded but nothing was sent.');
        }
        if (!self::isAvailable()) {
            return $this->stub(
                'Email is not fully set up (needs SMTP/mail transport and a clinic sender email in '
                . 'Administration → Globals → Notifications) — the campaign was recorded but nothing was sent.'
            );
        }

        $from = self::senderEmail();
        $fromName = trim((string) ($GLOBALS['patient_reminder_sender_name'] ?? ''));
        if ($fromName === '') {
            $fromName = trim((string) ($GLOBALS['openemr_name'] ?? '')) ?: 'Clinic';
        }

        $sent = 0;
        $failed = 0;
        $mailer = new \MyMailer();
        $mailer->SMTPKeepAlive = true; // reuse one SMTP connection across recipients
        try {
            $mailer->setFrom($from, $fromName);
            if (!empty($GLOBALS['practice_return_email_path'])) {
                $mailer->addReplyTo((string) $GLOBALS['practice_return_email_path']);
            }
            $mailer->Subject = $subject;
            $mailer->isHTML(false);
            $mailer->Body = $body;

            foreach ($recipients as $recipient) {
                $addr = trim((string) ($recipient['contact'] ?? ''));
                if ($addr === '' || filter_var($addr, FILTER_VALIDATE_EMAIL) === false) {
                    $failed++;
                    continue;
                }
                try {
                    $mailer->clearAllRecipients();
                    $mailer->addAddress($addr);
                    if ($mailer->send()) {
                        $sent++;
                    } else {
                        $failed++;
                    }
                } catch (\Throwable $e) {
                    $failed++;
                    error_log('[nc-outreach] email send failed: ' . $e->getMessage());
                }
            }
        } finally {
            try {
                $mailer->smtpClose();
            } catch (\Throwable) {
                // best-effort connection close
            }
        }

        $status = $sent > 0 ? ($failed > 0 ? 'partial' : 'sent') : 'failed';
        $note = "Email: {$sent} sent" . ($failed > 0 ? ", {$failed} failed" : '') . '.';

        return ['sent' => $sent, 'failed' => $failed, 'status' => $status, 'note' => $note];
    }

    private static function senderEmail(): string
    {
        return trim((string) ($GLOBALS['patient_reminder_sender_email'] ?? ''));
    }

    /**
     * @return array{sent: int, failed: int, status: string, note: string}
     */
    private function stub(string $note): array
    {
        return ['sent' => 0, 'failed' => 0, 'status' => 'stubbed', 'note' => $note];
    }
}
