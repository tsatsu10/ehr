(function (window) {
    'use strict';

    function parseNumber(value) {
        if (value === '' || value === null || value === undefined) {
            return null;
        }
        var num = parseFloat(String(value));
        return Number.isNaN(num) ? NaN : num;
    }

    function normalizeQualitative(value) {
        return String(value || '').trim().toLowerCase();
    }

    /**
     * @param {object} rules
     * @returns {object}
     */
    function createValidator(rules) {
        rules = rules || {};
        var bySeq = rules.rules_by_seq || {};

        function ruleForSeq(seq) {
            return bySeq[String(seq)] || { type: 'text', label: 'Result', min_length: 1 };
        }

        function evaluateValue(seq, value, draft) {
            var rule = ruleForSeq(seq);
            var label = rule.procedure_name || rule.label || 'Result';
            var trimmed = String(value || '').trim();
            var type = rule.type || 'text';

            if (trimmed === '') {
                if (draft) {
                    return { level: 'ok', suggestedAbnormal: null, normalizedValue: '' };
                }
                return {
                    level: 'error',
                    message: label + ' result is required',
                    suggestedAbnormal: null,
                    normalizedValue: ''
                };
            }

            if (type === 'numeric') {
                var num = parseNumber(trimmed);
                if (Number.isNaN(num)) {
                    return {
                        level: 'error',
                        message: label + ' must be numeric',
                        suggestedAbnormal: null,
                        normalizedValue: null
                    };
                }
                if (num < rule.min || num > rule.max) {
                    return {
                        level: 'error',
                        message: label + ' must be between ' + rule.min + ' and ' + rule.max,
                        suggestedAbnormal: null,
                        normalizedValue: String(num)
                    };
                }
                if (rule.warn_min !== undefined && (num < rule.warn_min || num > rule.warn_max)) {
                    return {
                        level: 'warning',
                        message: num < rule.warn_min
                            ? label + ' below reference range'
                            : label + ' above reference range',
                        suggestedAbnormal: num < rule.warn_min ? 'low' : 'high',
                        normalizedValue: String(num)
                    };
                }
                return { level: 'ok', suggestedAbnormal: null, normalizedValue: String(num) };
            }

            if (type === 'qualitative') {
                var normalized = normalizeQualitative(trimmed);
                var allowed = (rule.allowed || []).map(normalizeQualitative);
                if (allowed.length && allowed.indexOf(normalized) === -1) {
                    return {
                        level: 'error',
                        message: label + ' must be one of: ' + allowed.join(', '),
                        suggestedAbnormal: null,
                        normalizedValue: null
                    };
                }
                var abnormalValues = (rule.abnormal_values || []).map(normalizeQualitative);
                var suggested = abnormalValues.indexOf(normalized) !== -1
                    ? (rule.abnormal_flag || 'yes')
                    : null;
                return {
                    level: suggested ? 'warning' : 'ok',
                    message: suggested ? label + ' is positive — review before release' : '',
                    suggestedAbnormal: suggested,
                    normalizedValue: normalized
                };
            }

            if (trimmed.length < (rule.min_length || 1)) {
                return {
                    level: 'error',
                    message: label + ' result is required',
                    suggestedAbnormal: null,
                    normalizedValue: trimmed
                };
            }

            var warning = null;
            var warnSubstrings = rule.warn_substrings || [];
            if (warnSubstrings.length) {
                var lower = trimmed.toLowerCase();
                warnSubstrings.forEach(function (needle) {
                    if (!warning && lower.indexOf(String(needle).toLowerCase()) !== -1) {
                        warning = rule.warn_message || (label + ' may be abnormal');
                    }
                });
            }

            return {
                level: warning ? 'warning' : 'ok',
                message: warning || '',
                suggestedAbnormal: null,
                normalizedValue: trimmed
            };
        }

        function applyFieldFeedback(lineEl, result) {
            if (!lineEl) {
                return;
            }
            var input = lineEl.querySelector('[data-field="result"]');
            if (!input) {
                return;
            }
            var group = input.closest('.form-group');
            if (!group) {
                return;
            }
            var feedback = group.querySelector('.nc-labops-feedback');
            input.classList.remove('is-invalid', 'nc-labops-warning');

            if (!result || result.level === 'ok') {
                if (feedback) {
                    feedback.textContent = '';
                    feedback.className = 'nc-labops-feedback';
                }
                return;
            }

            if (!feedback) {
                return;
            }

            if (result.level === 'error') {
                input.classList.add('is-invalid');
                feedback.textContent = result.message;
                feedback.className = 'nc-labops-feedback invalid-feedback d-block';
                return;
            }

            input.classList.add('nc-labops-warning');
            feedback.textContent = result.message;
            feedback.className = 'nc-labops-feedback nc-labops-feedback--warning d-block';
        }

        function applyDefaults(lineEl, seq) {
            var rule = ruleForSeq(seq);
            if (!lineEl || !rule) {
                return;
            }
            var unitsInput = lineEl.querySelector('[data-field="units"]');
            var rangeInput = lineEl.querySelector('[data-field="range"]');
            if (unitsInput && !String(unitsInput.value || '').trim() && rule.units) {
                unitsInput.value = rule.units;
            }
            if (rangeInput && !String(rangeInput.value || '').trim() && rule.reference_range) {
                rangeInput.value = rule.reference_range;
            }
        }

        function suggestAbnormal(lineEl, seq, value) {
            var result = evaluateValue(seq, value, true);
            if (!lineEl || !result.suggestedAbnormal) {
                return;
            }
            var abnormalSelect = lineEl.querySelector('[data-field="abnormal"]');
            if (abnormalSelect && !String(abnormalSelect.value || '').trim()) {
                abnormalSelect.value = result.suggestedAbnormal;
            }
        }

        function validateLine(lineEl, draft) {
            var seqInput = lineEl.querySelector('[data-field="procedure_order_seq"]');
            var resultInput = lineEl.querySelector('[data-field="result"]');
            if (!seqInput || !resultInput) {
                return { level: 'ok' };
            }
            var seq = parseInt(seqInput.value, 10);
            return evaluateValue(seq, resultInput.value, draft);
        }

        function validateAll(drawerBody, draft) {
            var fieldErrors = {};
            var fieldWarnings = {};
            var messages = [];

            if (!drawerBody) {
                return { valid: true, fieldErrors: {}, fieldWarnings: {}, messages: [] };
            }

            drawerBody.querySelectorAll('.oe-nc-labops-line').forEach(function (lineEl) {
                var seqInput = lineEl.querySelector('[data-field="procedure_order_seq"]');
                if (!seqInput) {
                    return;
                }
                var seq = parseInt(seqInput.value, 10);
                var fieldKey = 'line_' + seq + '_result';
                var check = validateLine(lineEl, draft);
                applyFieldFeedback(lineEl, check);

                if (check.level === 'error') {
                    fieldErrors[fieldKey] = check.message;
                    messages.push(check.message);
                } else if (check.level === 'warning' && check.message) {
                    fieldWarnings[fieldKey] = check.message;
                }
            });

            return {
                valid: messages.length === 0,
                fieldErrors: fieldErrors,
                fieldWarnings: fieldWarnings,
                messages: messages
            };
        }

        function applyServerFieldErrors(drawerBody, fieldErrors, fieldWarnings) {
            if (!drawerBody) {
                return;
            }
            drawerBody.querySelectorAll('.oe-nc-labops-line').forEach(function (lineEl) {
                var seqInput = lineEl.querySelector('[data-field="procedure_order_seq"]');
                if (!seqInput) {
                    return;
                }
                var fieldKey = 'line_' + parseInt(seqInput.value, 10) + '_result';
                var message = fieldErrors[fieldKey] || fieldWarnings[fieldKey] || null;
                if (message) {
                    applyFieldFeedback(lineEl, {
                        level: fieldErrors[fieldKey] ? 'error' : 'warning',
                        message: message
                    });
                }
            });
        }

        function focusFirstInvalid(drawerBody) {
            if (!drawerBody) {
                return;
            }
            var first = drawerBody.querySelector('.is-invalid');
            if (first) {
                first.focus();
                first.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }

        return {
            bySeq: bySeq,
            evaluateValue: evaluateValue,
            validateLine: validateLine,
            validateAll: validateAll,
            applyFieldFeedback: applyFieldFeedback,
            applyDefaults: applyDefaults,
            suggestAbnormal: suggestAbnormal,
            applyServerFieldErrors: applyServerFieldErrors,
            focusFirstInvalid: focusFirstInvalid
        };
    }

    window.NewClinicLabResultForm = {
        createValidator: createValidator
    };
}(window));
