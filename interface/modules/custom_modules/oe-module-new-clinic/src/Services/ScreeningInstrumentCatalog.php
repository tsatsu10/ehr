<?php

/**
 * Screening instrument catalog — native PHQ-9 / GAD-7 definitions + scoring.
 *
 * Single source of truth for the built-in scored screeners on the Clinical
 * Documentation Screening lens. Each instrument declares its items, response
 * options, maximum score, severity bands, and any flag rules; the same map is
 * used by the client (to render + score live) and the server (to re-score on
 * save — the client's number is never trusted).
 *
 * PHQ-9 and GAD-7 are public-domain instruments; their item wording is embedded
 * directly. Adding PHQ-2 / EPDS / AUDIT-C later is a data edit here, not new code.
 * Pure definition class — no DB, no services, no state (no crash-cycle risk).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class ScreeningInstrumentCatalog
{
    /** Built-in instrument ids that the native Screening lens offers. */
    public const INSTRUMENTS = ['phq9', 'gad7'];

    /** Standard 0–3 frequency options shared by PHQ-9 and GAD-7. */
    private const FREQUENCY_OPTIONS = [
        ['value' => 0, 'label' => 'Not at all'],
        ['value' => 1, 'label' => 'Several days'],
        ['value' => 2, 'label' => 'More than half the days'],
        ['value' => 3, 'label' => 'Nearly every day'],
    ];

    private const STEM = 'Over the last 2 weeks, how often have you been bothered by any of the following problems?';

    public function isInstrument(string $id): bool
    {
        return in_array(strtolower(trim($id)), self::INSTRUMENTS, true);
    }

    /**
     * Full definition for one instrument (items + options + bands), or null.
     *
     * @return array<string, mixed>|null
     */
    public function getInstrument(string $id): ?array
    {
        return match (strtolower(trim($id))) {
            'phq9' => $this->phq9(),
            'gad7' => $this->gad7(),
            default => null,
        };
    }

    /**
     * Re-score a set of answers server-side.
     *
     * @param array<int|string, int|string> $answers item index (1-based) => option value
     * @return array{total: int, severity: string, interpretation: string, flags: array<int, string>, answered: int, item_count: int, complete: bool}
     */
    public function score(string $id, array $answers): array
    {
        $def = $this->getInstrument($id);
        if ($def === null) {
            throw new \InvalidArgumentException('Unknown screening instrument');
        }

        $items = $def['items'];
        $maxOption = count(self::FREQUENCY_OPTIONS) - 1;
        $total = 0;
        $answered = 0;
        foreach ($items as $index => $item) {
            $key = (string) ($index + 1);
            if (!array_key_exists($key, $answers) && !array_key_exists($index + 1, $answers)) {
                continue;
            }
            $raw = (int) ($answers[$key] ?? $answers[$index + 1] ?? 0);
            if ($raw < 0 || $raw > $maxOption) {
                throw new \InvalidArgumentException('Answer out of range');
            }
            $total += $raw;
            $answered++;
        }

        $flags = [];
        foreach ($def['flag_rules'] as $rule) {
            $itemKey = (string) $rule['item'];
            $val = (int) ($answers[$itemKey] ?? $answers[(int) $rule['item']] ?? 0);
            if ($val >= $rule['min_value']) {
                $flags[] = $rule['flag'];
            }
        }

        $severity = 'minimal';
        $interpretation = '';
        foreach ($def['bands'] as $band) {
            if ($total >= $band['min'] && $total <= $band['max']) {
                $severity = $band['severity'];
                $interpretation = $band['label'];
                break;
            }
        }

        return [
            'total' => $total,
            'severity' => $severity,
            'interpretation' => $interpretation,
            'flags' => $flags,
            'answered' => $answered,
            'item_count' => count($items),
            'complete' => $answered === count($items),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function phq9(): array
    {
        return [
            'id' => 'phq9',
            'title' => 'PHQ-9',
            'subtitle' => 'Depression screen',
            'stem' => self::STEM,
            'options' => self::FREQUENCY_OPTIONS,
            'max_score' => 27,
            'items' => [
                'Little interest or pleasure in doing things',
                'Feeling down, depressed, or hopeless',
                'Trouble falling or staying asleep, or sleeping too much',
                'Feeling tired or having little energy',
                'Poor appetite or overeating',
                'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
                'Trouble concentrating on things, such as reading or watching television',
                'Moving or speaking so slowly that other people could have noticed — or the opposite, being so fidgety or restless that you have been moving a lot more than usual',
                'Thoughts that you would be better off dead, or of hurting yourself in some way',
            ],
            'bands' => [
                ['min' => 0, 'max' => 4, 'severity' => 'minimal', 'label' => 'Minimal or none'],
                ['min' => 5, 'max' => 9, 'severity' => 'mild', 'label' => 'Mild'],
                ['min' => 10, 'max' => 14, 'severity' => 'moderate', 'label' => 'Moderate'],
                ['min' => 15, 'max' => 19, 'severity' => 'moderately_severe', 'label' => 'Moderately severe'],
                ['min' => 20, 'max' => 27, 'severity' => 'severe', 'label' => 'Severe'],
            ],
            'flag_rules' => [
                [
                    'item' => 9,
                    'min_value' => 1,
                    'flag' => 'self_harm',
                    'message' => 'This person reported thoughts of self-harm. Assess safety before the patient leaves.',
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function gad7(): array
    {
        return [
            'id' => 'gad7',
            'title' => 'GAD-7',
            'subtitle' => 'Anxiety screen',
            'stem' => self::STEM,
            'options' => self::FREQUENCY_OPTIONS,
            'max_score' => 21,
            'items' => [
                'Feeling nervous, anxious, or on edge',
                'Not being able to stop or control worrying',
                'Worrying too much about different things',
                'Trouble relaxing',
                'Being so restless that it is hard to sit still',
                'Becoming easily annoyed or irritable',
                'Feeling afraid, as if something awful might happen',
            ],
            'bands' => [
                ['min' => 0, 'max' => 4, 'severity' => 'minimal', 'label' => 'Minimal or none'],
                ['min' => 5, 'max' => 9, 'severity' => 'mild', 'label' => 'Mild'],
                ['min' => 10, 'max' => 14, 'severity' => 'moderate', 'label' => 'Moderate'],
                ['min' => 15, 'max' => 21, 'severity' => 'severe', 'label' => 'Severe'],
            ],
            'flag_rules' => [],
        ];
    }
}
