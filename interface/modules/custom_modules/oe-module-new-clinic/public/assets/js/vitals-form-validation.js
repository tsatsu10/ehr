(function (window) {
    'use strict';

    function parseNumber(value) {
        if (value === '' || value === null || value === undefined) {
            return null;
        }
        var num = parseFloat(String(value));
        return Number.isNaN(num) ? NaN : num;
    }

    function createValidator(rules) {
        rules = rules || {};
        var fields = rules.fields || {};
        var required = rules.required || [];

        function validateField(name, value) {
            var def = fields[name];
            if (!def) {
                return null;
            }

            var trimmed = String(value || '').trim();
            var isRequired = required.indexOf(name) !== -1 || !!def.required;

            if (trimmed === '') {
                if (isRequired) {
                    return { level: 'error', message: def.label + ' is required' };
                }
                return null;
            }

            var num = parseNumber(trimmed);
            if (Number.isNaN(num)) {
                return { level: 'error', message: def.label + ' must be numeric' };
            }

            if (num < def.min || num > def.max) {
                return {
                    level: 'error',
                    message: def.label + ' must be between ' + def.min + ' and ' + def.max
                };
            }

            if (def.warn_min !== undefined && (num < def.warn_min || num > def.warn_max)) {
                return {
                    level: 'warning',
                    message: def.warn_message || (def.label + ' outside normal range')
                };
            }

            return { level: 'ok' };
        }

        function applyFieldFeedback(input, result) {
            if (!input) {
                return;
            }

            var group = input.closest('.form-group');
            if (!group) {
                return;
            }

            var feedback = group.querySelector('.nc-vitals-feedback');
            input.classList.remove('is-invalid', 'nc-vitals-warning');

            if (!result || result.level === 'ok') {
                if (feedback) {
                    feedback.textContent = '';
                    feedback.className = 'nc-vitals-feedback';
                }
                return;
            }

            if (!feedback) {
                return;
            }

            if (result.level === 'error') {
                input.classList.add('is-invalid');
                feedback.textContent = result.message;
                feedback.className = 'nc-vitals-feedback invalid-feedback d-block';
                return;
            }

            input.classList.add('nc-vitals-warning');
            feedback.textContent = result.message;
            feedback.className = 'nc-vitals-feedback nc-vitals-feedback--warning d-block';
        }

        function validateAll(form) {
            var fieldErrors = {};
            var fieldWarnings = {};
            var messages = [];

            Object.keys(fields).forEach(function (name) {
                var input = form.querySelector('[name="' + name + '"]');
                var result = validateField(name, input ? input.value : '');
                if (!result || result.level === 'ok') {
                    return;
                }
                if (result.level === 'error') {
                    fieldErrors[name] = result.message;
                    messages.push(result.message);
                } else if (result.level === 'warning') {
                    fieldWarnings[name] = result.message;
                }
            });

            return {
                valid: messages.length === 0,
                fieldErrors: fieldErrors,
                fieldWarnings: fieldWarnings,
                messages: messages
            };
        }

        function applyAllFeedback(form, result) {
            Object.keys(fields).forEach(function (name) {
                var input = form.querySelector('[name="' + name + '"]');
                var message = result.fieldErrors[name] || result.fieldWarnings[name] || null;
                if (message) {
                    applyFieldFeedback(input, {
                        level: result.fieldErrors[name] ? 'error' : 'warning',
                        message: message
                    });
                } else {
                    applyFieldFeedback(input, validateField(name, input ? input.value : ''));
                }
            });
        }

        function focusFirstInvalid(form) {
            var first = form.querySelector('.is-invalid');
            if (first) {
                first.focus();
                first.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }

        return {
            fields: fields,
            required: required,
            validateField: validateField,
            validateAll: validateAll,
            applyFieldFeedback: applyFieldFeedback,
            applyAllFeedback: applyAllFeedback,
            focusFirstInvalid: focusFirstInvalid
        };
    }

    window.NewClinicVitalsForm = {
        createValidator: createValidator
    };
})(window);
