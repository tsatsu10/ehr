(function (window) {
    'use strict';

    var regionsCache = null;
    var lastDupResult = { level: 'none', candidates: [] };

    function postJson(url, body) {
        return window.NewClinicUI.postJson(url, body);
    }

    function getJson(url) {
        return window.NewClinicUI.getJson(url);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function selectOptions(options) {
        return options.map(function (opt) {
            return '<option value="' + escapeHtml(opt) + '">' + escapeHtml(opt) + '</option>';
        }).join('');
    }

    function ensureSelectValue(select, value) {
        if (!select || !value) {
            return;
        }
        var found = [].some.call(select.options, function (option) {
            return option.value === value;
        });
        if (!found) {
            var legacyOption = document.createElement('option');
            legacyOption.value = value;
            legacyOption.textContent = value + ' (legacy)';
            select.appendChild(legacyOption);
        }
        select.value = value;
    }

    var SECTION_FIELDS = {
        1: ['fname', 'lname', 'mname', 'sex', 'phone_cell', 'DOB'],
        2: ['street', 'region_code', 'district_code', 'landmark', 'national_id', 'emergency_contact', 'email'],
        3: ['allergies_documented'],
        4: ['nhis_number']
    };

    function updateSectionCheckmarks(formRoot, missing) {
        var missingSet = {};
        (missing || []).forEach(function (key) { missingSet[key] = true; });
        [1, 2, 3, 4].forEach(function (num) {
            var header = formRoot.querySelector('[data-target="#nc-reg-section-' + num + '"]');
            if (!header) {
                return;
            }
            var keys = SECTION_FIELDS[num] || [];
            var complete = keys.length > 0 && keys.every(function (key) { return !missingSet[key]; });
            var mark = header.querySelector('.nc-section-check');
            if (!mark) {
                mark = document.createElement('span');
                mark.className = 'nc-section-check ml-2 text-success';
                header.appendChild(mark);
            }
            mark.textContent = complete ? '✓' : '';
        });
    }

    function parseSearchQuery(query) {
        var trimmed = String(query || '').trim();
        if (!trimmed) {
            return { fname: '', lname: '', phone: '' };
        }
        var digitCount = (trimmed.replace(/\s+/g, '').match(/\d/g) || []).length;
        if (digitCount / trimmed.replace(/\s+/g, '').length >= 0.7) {
            return { fname: '', lname: '', phone: trimmed };
        }
        var parts = trimmed.split(/\s+/);
        if (parts.length === 1) {
            return { fname: '', lname: parts[0], phone: '' };
        }
        return { fname: parts[0], lname: parts.slice(1).join(' '), phone: '' };
    }

    function renderDupPanel(container, dup, onUseExisting) {
        if (!container) {
            return;
        }
        lastDupResult = dup || { level: 'none', candidates: [] };
        if (!dup || dup.level === 'none') {
            container.innerHTML = '';
            container.classList.add('d-none');
            return;
        }

        var candidates = (dup.candidates || []).map(function (c) {
            return '<li class="mb-1"><button type="button" class="btn btn-link btn-sm p-0 nc-use-existing-patient" data-pid="' +
                escapeHtml(c.pid) + '">' + escapeHtml(c.display_name) + ' · MRN ' + escapeHtml(c.pubpid) +
                ' (score ' + escapeHtml(c.score) + ')</button></li>';
        }).join('');

        var alertClass = dup.level === 'block' ? 'alert-danger' : 'alert-warning';
        container.innerHTML =
            '<div class="alert ' + alertClass + ' py-2 mb-2">' +
            '<strong>' + escapeHtml(dup.level === 'block' ? 'Likely match found' : 'Possible duplicate') + '</strong>' +
            '<ul class="mb-2 pl-3">' + candidates + '</ul>' +
            (dup.level === 'warn'
                ? '<label class="mb-0"><input type="checkbox" id="nc-dup-confirm"> Different patient — confirmed</label>'
                : '<div class="form-group mb-0"><label>Override reason</label>' +
                '<input type="text" class="form-control form-control-sm" id="nc-dup-override-reason" maxlength="255">' +
                '<label class="mt-2 mb-0"><input type="checkbox" id="nc-dup-override"> Create despite duplicate (lead only)</label></div>') +
            '</div>';
        container.classList.remove('d-none');
        container.querySelectorAll('.nc-use-existing-patient').forEach(function (btn) {
            btn.addEventListener('click', function () {
                onUseExisting(parseInt(btn.dataset.pid, 10));
            });
        });
    }

    function loadRegions(ajaxUrl) {
        if (regionsCache) {
            return Promise.resolve(regionsCache);
        }
        return getJson(ajaxUrl + '?action=admin.geo.regions&country=GH').then(function (result) {
            var payload = result.payload;
            regionsCache = (payload.success && payload.data) ? payload.data.regions || [] : [];
            return regionsCache;
        });
    }

    function loadDistricts(ajaxUrl, regionCode) {
        return getJson(ajaxUrl + '?action=admin.geo.districts&region_code=' + encodeURIComponent(regionCode))
            .then(function (result) {
                var payload = result.payload;
                return (payload.success && payload.data) ? payload.data.districts || [] : [];
            });
    }

    function collectSection(formRoot, section) {
        if (section === 1) {
            return {
                fname: formRoot.querySelector('#nc-reg-fname').value.trim(),
                lname: formRoot.querySelector('#nc-reg-lname').value.trim(),
                mname: formRoot.querySelector('#nc-reg-mname').value.trim(),
                sex: formRoot.querySelector('#nc-reg-sex').value,
                phone: formRoot.querySelector('#nc-reg-phone').value.trim(),
                no_phone: formRoot.querySelector('#nc-reg-no-phone').checked,
                reach_contact_name: formRoot.querySelector('#nc-reg-reach-name').value.trim(),
                reach_contact_phone: formRoot.querySelector('#nc-reg-reach-phone').value.trim(),
                reach_contact_relationship: formRoot.querySelector('#nc-reg-reach-relationship').value.trim(),
                DOB: formRoot.querySelector('#nc-reg-dob-s1').value,
                age_years: formRoot.querySelector('#nc-reg-age').value
                    ? parseInt(formRoot.querySelector('#nc-reg-age').value, 10) : null,
                national_id: formRoot.querySelector('#nc-reg-national-id').value.trim()
            };
        }
        if (section === 2) {
            return {
                street: formRoot.querySelector('#nc-reg-street').value.trim(),
                landmark: formRoot.querySelector('#nc-reg-landmark').value.trim(),
                nationality: formRoot.querySelector('#nc-reg-nationality').value.trim(),
                region_code: formRoot.querySelector('#nc-reg-region').value,
                district_code: formRoot.querySelector('#nc-reg-district').value,
                place_of_birth: formRoot.querySelector('#nc-reg-place-of-birth').value.trim(),
                tribe: formRoot.querySelector('#nc-reg-tribe').value.trim(),
                national_id: formRoot.querySelector('#nc-reg-national-id').value.trim(),
                phone_home: formRoot.querySelector('#nc-reg-phone-home').value.trim(),
                email: formRoot.querySelector('#nc-reg-email').value.trim(),
                emergency_contact_name: formRoot.querySelector('#nc-reg-ec-name').value.trim(),
                emergency_contact_phone: formRoot.querySelector('#nc-reg-ec-phone').value.trim()
            };
        }
        if (section === 3) {
            return {
                blood_group: formRoot.querySelector('#nc-reg-blood').value,
                allergies_none_known: formRoot.querySelector('#nc-reg-nkda').checked,
                allergies_unknown: formRoot.querySelector('#nc-reg-allergies-unknown').checked,
                allergies: formRoot.querySelector('#nc-reg-allergies').value.trim(),
                chronic_conditions: formRoot.querySelector('#nc-reg-chronic').value.trim(),
                pregnancy_status: formRoot.querySelector('#nc-reg-pregnancy').value,
                disability_flag: formRoot.querySelector('#nc-reg-disability').checked,
                religion: formRoot.querySelector('#nc-reg-religion').value.trim(),
                race: formRoot.querySelector('#nc-reg-race').value.trim(),
                education_level: formRoot.querySelector('#nc-reg-education-level').value.trim(),
                occupation: formRoot.querySelector('#nc-reg-occupation').value.trim()
            };
        }
        return {
            insurance_type: formRoot.querySelector('#nc-reg-insurance-type').value,
            nhis_number: formRoot.querySelector('#nc-reg-nhis').value.trim(),
            nhis_expiry: formRoot.querySelector('#nc-reg-nhis-expiry').value,
            private_insurer: formRoot.querySelector('#nc-reg-private-insurer').value.trim(),
            private_policy: formRoot.querySelector('#nc-reg-private-policy').value.trim()
        };
    }

    function fillForm(formRoot, data) {
        if (!data) {
            return;
        }
        var s1 = data.section_1 || {};
        var s2 = data.section_2 || {};
        var s3 = data.section_3 || {};
        var s4 = data.section_4 || {};

        formRoot.querySelector('#nc-reg-fname').value = s1.fname || '';
        formRoot.querySelector('#nc-reg-lname').value = s1.lname || '';
        formRoot.querySelector('#nc-reg-mname').value = s1.mname || '';
        formRoot.querySelector('#nc-reg-sex').value = s1.sex || '';
        formRoot.querySelector('#nc-reg-phone').value = s1.phone || '';
        formRoot.querySelector('#nc-reg-no-phone').checked = !!s1.no_phone;
        formRoot.querySelector('#nc-reg-reach-name').value = s1.reach_contact_name || '';
        formRoot.querySelector('#nc-reg-reach-phone').value = s1.reach_contact_phone || '';
        formRoot.querySelector('#nc-reg-reach-relationship').value = s1.reach_contact_relationship || '';
        formRoot.querySelector('#nc-reg-age').value = s1.age_years != null ? s1.age_years : '';
        formRoot.querySelector('#nc-reg-dob-s1').value = s1.DOB && s1.DOB !== '0000-00-00' ? s1.DOB : '';
        formRoot.querySelector('#nc-reg-national-id').value = s1.national_id || s2.national_id || '';
        toggleNoPhone(formRoot);

        formRoot.querySelector('#nc-reg-street').value = s2.street || '';
        formRoot.querySelector('#nc-reg-landmark').value = s2.landmark || '';
        formRoot.querySelector('#nc-reg-nationality').value = s2.nationality || '';
        formRoot.querySelector('#nc-reg-place-of-birth').value = s2.place_of_birth || '';
        formRoot.querySelector('#nc-reg-tribe').value = s2.tribe || '';
        formRoot.querySelector('#nc-reg-phone-home').value = s2.phone_home || '';
        formRoot.querySelector('#nc-reg-email').value = s2.email || '';
        formRoot.querySelector('#nc-reg-ec-name').value = s2.emergency_contact_name || '';
        formRoot.querySelector('#nc-reg-ec-phone').value = s2.emergency_contact_phone || '';

        formRoot.querySelector('#nc-reg-blood').value = s3.blood_group || '';
        formRoot.querySelector('#nc-reg-nkda').checked = !!s3.allergies_none_known;
        formRoot.querySelector('#nc-reg-allergies-unknown').checked = !!s3.allergies_unknown;
        formRoot.querySelector('#nc-reg-allergies').value = (s3.allergies || []).join(', ');
        formRoot.querySelector('#nc-reg-chronic').value = (s3.chronic_conditions || []).join(', ');
        formRoot.querySelector('#nc-reg-pregnancy').value = s3.pregnancy_status || '';
        formRoot.querySelector('#nc-reg-disability').checked = !!s3.disability_flag;
        formRoot.querySelector('#nc-reg-religion').value = s3.religion || '';
        ensureSelectValue(formRoot.querySelector('#nc-reg-race'), s3.race || '');
        formRoot.querySelector('#nc-reg-education-level').value = s3.education_level || '';
        formRoot.querySelector('#nc-reg-occupation').value = s3.occupation || '';

        formRoot.querySelector('#nc-reg-insurance-type').value = s4.insurance_type || 'cash';
        var insuranceNote = formRoot.querySelector('#nc-reg-insurance-effective');
        if (insuranceNote && s4.insurance_label) {
            insuranceNote.textContent = 'Effective billing: ' + s4.insurance_label;
        }
        formRoot.querySelector('#nc-reg-nhis').value = s4.nhis_number || '';
        formRoot.querySelector('#nc-reg-nhis-expiry').value = s4.nhis_expiry || '';
        formRoot.querySelector('#nc-reg-private-insurer').value = s4.private_insurer || '';
        formRoot.querySelector('#nc-reg-private-policy').value = s4.private_policy || '';

        togglePregnancy(formRoot);
        toggleInsurancePanels(formRoot);
        toggleAllergyFields(formRoot);
    }

    function toggleAllergyFields(formRoot) {
        var nkda = formRoot.querySelector('#nc-reg-nkda').checked;
        var unknown = formRoot.querySelector('#nc-reg-allergies-unknown').checked;
        var allergiesInput = formRoot.querySelector('#nc-reg-allergies');
        var locked = nkda || unknown;

        if (allergiesInput) {
            allergiesInput.disabled = locked;
            if (locked) {
                allergiesInput.value = '';
            }
        }
    }

    function toggleNoPhone(formRoot) {
        var noPhone = formRoot.querySelector('#nc-reg-no-phone').checked;
        var phoneInput = formRoot.querySelector('#nc-reg-phone');
        var reachWrap = formRoot.querySelector('#nc-reg-reach-contact-wrap');
        if (phoneInput) {
            phoneInput.disabled = noPhone;
            if (noPhone) {
                phoneInput.value = '';
            }
        }
        if (reachWrap) {
            reachWrap.classList.toggle('d-none', !noPhone);
        }
    }

    function togglePregnancy(formRoot) {
        var wrap = formRoot.querySelector('#nc-reg-pregnancy-wrap');
        var sex = formRoot.querySelector('#nc-reg-sex').value;
        if (wrap) {
            wrap.classList.toggle('d-none', sex !== 'Female');
        }
    }

    function toggleInsurancePanels(formRoot) {
        var type = formRoot.querySelector('#nc-reg-insurance-type').value;
        formRoot.querySelector('#nc-reg-nhis-wrap').classList.toggle('d-none', type !== 'nhis');
        formRoot.querySelector('#nc-reg-private-wrap').classList.toggle('d-none', type !== 'private');
    }

    function bindGeo(formRoot, ajaxUrl, selectedRegion, selectedDistrict) {
        if (formRoot.dataset.geoBound === '1') {
            var regionSelect = formRoot.querySelector('#nc-reg-region');
            var districtSelect = formRoot.querySelector('#nc-reg-district');
            if (selectedRegion && regionSelect) {
                regionSelect.value = selectedRegion;
                populateDistricts(ajaxUrl, selectedRegion, districtSelect, selectedDistrict || '');
            }
            return;
        }
        formRoot.dataset.geoBound = '1';

        var regionSelect = formRoot.querySelector('#nc-reg-region');
        var districtSelect = formRoot.querySelector('#nc-reg-district');

        loadRegions(ajaxUrl).then(function (regions) {
            regionSelect.innerHTML = '<option value="">Select region</option>' +
                regions.map(function (r) {
                    return '<option value="' + escapeHtml(r.code) + '">' + escapeHtml(r.label) + '</option>';
                }).join('');
            if (selectedRegion) {
                regionSelect.value = selectedRegion;
                populateDistricts(ajaxUrl, regionSelect.value, districtSelect, selectedDistrict);
            }
        });

        regionSelect.addEventListener('change', function () {
            districtSelect.innerHTML = '<option value="">Select district</option>';
            districtSelect.disabled = true;
            if (regionSelect.value) {
                populateDistricts(ajaxUrl, regionSelect.value, districtSelect, '');
            }
        });
    }

    function populateDistricts(ajaxUrl, regionCode, districtSelect, selectedDistrict) {
        loadDistricts(ajaxUrl, regionCode).then(function (districts) {
            districtSelect.innerHTML = '<option value="">Select district</option>' +
                districts.map(function (d) {
                    return '<option value="' + escapeHtml(d.code) + '">' + escapeHtml(d.label) + '</option>';
                }).join('');
            districtSelect.disabled = false;
            if (selectedDistrict) {
                districtSelect.value = selectedDistrict;
            }
        });
    }

    function renderFormHtml(title) {
        return '<div class="nc-registration-form" id="nc-registration-form">' +
            '<div class="d-flex justify-content-between align-items-center mb-2">' +
            '<h4 class="mb-0">' + escapeHtml(title) + '</h4>' +
            '<span class="badge badge-secondary" id="nc-reg-completion">—</span></div>' +
            '<div id="nc-dup-panel" class="d-none"></div>' +
            '<div class="accordion" id="nc-reg-accordion">' +
            sectionCard(1, 'Basic info', basicFields()) +
            sectionCard(2, 'Contact & identity', contactFields()) +
            sectionCard(3, 'Clinical & demographics', clinicalFields()) +
            sectionCard(4, 'Admin & insurance', insuranceFields()) +
            '</div>' +
            '<div class="alert alert-danger d-none mt-2" id="nc-reg-error"></div>' +
            '<div class="alert alert-success d-none mt-2" id="nc-reg-success"></div>' +
            '<div class="d-flex flex-wrap mt-3">' +
            '<button type="button" class="btn btn-primary mr-2 mb-2" id="nc-reg-save">Save</button>' +
            '<button type="button" class="btn btn-success mr-2 mb-2" id="nc-reg-save-start">Save & Start visit</button>' +
            '<button type="button" class="btn btn-outline-secondary mb-2" id="nc-reg-cancel">Cancel</button>' +
            '</div></div>';
    }

    function sectionCard(num, label, body) {
        return '<div class="card mb-2"><div class="card-header" data-toggle="collapse" data-target="#nc-reg-section-' + num + '">' +
            'Section ' + num + ': ' + escapeHtml(label) + '</div>' +
            '<div id="nc-reg-section-' + num + '" class="collapse' + (num === 1 ? ' show' : '') + '" data-parent="#nc-reg-accordion">' +
            '<div class="card-body">' + body +
            '<button type="button" class="btn btn-sm btn-outline-primary nc-reg-save-section" data-section="' + num + '">Save section ' + num + '</button>' +
            '</div></div></div>';
    }

    function basicFields() {
        return '<div class="form-row">' +
            '<div class="form-group col-md-4"><label>First name</label><input class="form-control" id="nc-reg-fname"></div>' +
            '<div class="form-group col-md-4"><label>Last name</label><input class="form-control" id="nc-reg-lname"></div>' +
            '<div class="form-group col-md-4"><label>Middle name</label><input class="form-control" id="nc-reg-mname"></div>' +
            '</div><div class="form-row">' +
            '<div class="form-group col-md-4"><label>Sex</label><select class="form-control" id="nc-reg-sex">' +
            '<option value="">Select</option><option value="Female">Female</option><option value="Male">Male</option>' +
            '<option value="UNK">Unknown</option></select></div>' +
            '<div class="form-group col-md-4"><label>Date of birth</label><input type="date" class="form-control" id="nc-reg-dob-s1"></div>' +
            '<div class="form-group col-md-4"><label>Or estimated age</label><input type="number" min="0" max="130" class="form-control" id="nc-reg-age"></div>' +
            '</div><div class="form-group"><label>Personal phone</label><input class="form-control" id="nc-reg-phone"></div>' +
            '<div class="form-group form-check"><input type="checkbox" class="form-check-input" id="nc-reg-no-phone">' +
            '<label class="form-check-label" for="nc-reg-no-phone">Patient has no personal phone</label></div>' +
            '<small class="form-text text-muted mb-2">If checked, add who we can call to reach the patient (e.g. neighbour). Emergency contact is separate in Section 2.</small>' +
            '<div id="nc-reg-reach-contact-wrap" class="d-none border rounded p-2 mb-2 bg-light">' +
            '<div class="form-row"><div class="form-group col-md-4"><label>Reach contact name</label>' +
            '<input class="form-control" id="nc-reg-reach-name" placeholder="e.g. Kwame (neighbour)"></div>' +
            '<div class="form-group col-md-4"><label>Reach contact phone</label><input class="form-control" id="nc-reg-reach-phone"></div>' +
            '<div class="form-group col-md-4"><label>Relationship</label><select class="form-control" id="nc-reg-reach-relationship">' +
            '<option value="">—</option><option value="neighbor">Neighbour</option><option value="parent">Parent</option>' +
            '<option value="spouse">Spouse</option><option value="guardian">Guardian</option>' +
            '<option value="relative">Relative</option><option value="other">Other</option></select></div></div></div>' +
            '<div class="form-group"><label>National ID</label><input class="form-control" id="nc-reg-national-id">' +
            '<small class="form-text text-muted">Ghana Card or national ID — used for duplicate check at registration.</small></div>';
    }

    function contactFields() {
        return '<div class="form-group"><label>Address</label><textarea class="form-control" id="nc-reg-street" rows="2"></textarea></div>' +
            '<div class="form-row"><div class="form-group col-md-4"><label>Landmark</label><input class="form-control" id="nc-reg-landmark"></div>' +
            '<div class="form-group col-md-4"><label>Region</label><select class="form-control" id="nc-reg-region"><option value="">Select region</option></select></div>' +
            '<div class="form-group col-md-4"><label>District</label><select class="form-control" id="nc-reg-district" disabled><option value="">Select district</option></select></div></div>' +
            '<div class="form-row"><div class="form-group col-md-4"><label>Nationality</label><input class="form-control" id="nc-reg-nationality" placeholder="e.g. Ghanaian"></div>' +
            '<div class="form-group col-md-4"><label>Place of birth</label><input class="form-control" id="nc-reg-place-of-birth"></div>' +
            '<div class="form-group col-md-4"><label>Tribe</label><input class="form-control" id="nc-reg-tribe">' +
            '<small class="form-text text-muted">Ethnic or cultural group (e.g. Akan, Ewe).</small></div></div>' +
            '<div class="form-row"><div class="form-group col-md-6"><label>Additional phone</label><input class="form-control" id="nc-reg-phone-home"></div></div>' +
            '<div class="form-group"><label>Email</label><input type="email" class="form-control" id="nc-reg-email"></div>' +
            '<p class="text-muted small mb-2">Emergency contact is for crises and may be a different person than the reach contact in Section 1.</p>' +
            '<div class="form-row"><div class="form-group col-md-6"><label>Emergency contact name</label><input class="form-control" id="nc-reg-ec-name"></div>' +
            '<div class="form-group col-md-6"><label>Emergency contact phone</label><input class="form-control" id="nc-reg-ec-phone"></div></div>';
    }

    function clinicalFields() {
        var educationLevels = [
            'Never went to school',
            'Primary school',
            'Finished high school',
            'Learned a trade / Technical certificate',
            'Some college or university',
            'University degree',
            "Higher university degree (Master's or PhD)"
        ];
        var religions = [
            'Christianity', 'Islam', 'Traditional African religion', 'Hinduism', 'Buddhism',
            'Other', 'None', 'Unknown'
        ];
        var races = [
            'Black', 'African', 'White', 'Asian', 'Mixed / Multiracial', 'Other', 'Unknown'
        ];

        return '<div class="form-group"><label>Blood group</label><select class="form-control" id="nc-reg-blood">' +
            '<option value="">—</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option>' +
            '<option>AB+</option><option>AB-</option><option>O+</option><option>O-</option><option>Unknown</option></select></div>' +
            '<div class="form-group form-check"><input type="checkbox" class="form-check-input" id="nc-reg-nkda">' +
            '<label class="form-check-label" for="nc-reg-nkda">None known (NKDA)</label></div>' +
            '<div class="form-group form-check"><input type="checkbox" class="form-check-input" id="nc-reg-allergies-unknown">' +
            '<label class="form-check-label" for="nc-reg-allergies-unknown">Allergies unknown (patient unsure)</label></div>' +
            '<div class="form-group"><label>Allergies (comma-separated)</label><input class="form-control nc-tag-input" id="nc-reg-allergies"></div>' +
            '<div class="form-group"><label>Chronic conditions (comma-separated)</label><input class="form-control nc-tag-input" id="nc-reg-chronic"></div>' +
            '<div class="form-group d-none" id="nc-reg-pregnancy-wrap"><label>Pregnancy status</label><select class="form-control" id="nc-reg-pregnancy">' +
            '<option value="">—</option><option>Not pregnant</option><option>Pregnant</option><option>Unknown</option></select></div>' +
            '<div class="form-group form-check"><input type="checkbox" class="form-check-input" id="nc-reg-disability">' +
            '<label class="form-check-label" for="nc-reg-disability">Disability flag</label></div>' +
            '<div class="form-row"><div class="form-group col-md-6"><label>Religion</label>' +
            '<select class="form-control" id="nc-reg-religion"><option value="">—</option>' + selectOptions(religions) + '</select></div>' +
            '<div class="form-group col-md-6"><label>Race</label>' +
            '<select class="form-control" id="nc-reg-race"><option value="">—</option>' + selectOptions(races) + '</select>' +
            '<small class="form-text text-muted">Self-reported category for reporting; separate from tribe in Section 2.</small></div></div>' +
            '<div class="form-row"><div class="form-group col-md-6"><label>Highest education level</label>' +
            '<select class="form-control" id="nc-reg-education-level"><option value="">—</option>' +
            selectOptions(educationLevels) + '</select></div>' +
            '<div class="form-group col-md-6"><label>Occupation</label><input class="form-control" id="nc-reg-occupation"></div></div>';
    }

    function insuranceFields() {
        return '<div class="form-group"><label>Insurance type</label><select class="form-control" id="nc-reg-insurance-type">' +
            '<option value="cash">Cash</option><option value="nhis">NHIS</option><option value="private">Private</option></select>' +
            '<small class="form-text text-muted" id="nc-reg-insurance-effective"></small></div>' +
            '<div id="nc-reg-nhis-wrap" class="d-none"><div class="form-row"><div class="form-group col-md-6"><label>NHIS number</label>' +
            '<input class="form-control" id="nc-reg-nhis"></div><div class="form-group col-md-6"><label>NHIS expiry</label>' +
            '<input type="date" class="form-control" id="nc-reg-nhis-expiry"></div></div></div>' +
            '<div id="nc-reg-private-wrap" class="d-none"><div class="form-row"><div class="form-group col-md-6"><label>Private insurer</label>' +
            '<input class="form-control" id="nc-reg-private-insurer"></div><div class="form-group col-md-6"><label>Policy number</label>' +
            '<input class="form-control" id="nc-reg-private-policy"></div></div></div>';
    }

    function render(previewPane, options) {
        var state = {
            pid: options.pid || null,
            dirty: false,
            ajaxUrl: options.ajaxUrl,
            csrfToken: options.csrfToken
        };

        previewPane.innerHTML = renderFormHtml(
            options.mode === 'chart' ? 'Patient profile' : (options.pid ? 'Edit profile' : 'Register patient')
        );
        var formRoot = previewPane.querySelector('#nc-registration-form');
        var errorEl = formRoot.querySelector('#nc-reg-error');
        var successEl = formRoot.querySelector('#nc-reg-success');
        var dupPanel = formRoot.querySelector('#nc-dup-panel');

        if (options.mode === 'chart') {
            var saveStartBtn = formRoot.querySelector('#nc-reg-save-start');
            if (saveStartBtn) {
                saveStartBtn.classList.add('d-none');
            }
        }

        bindGeo(formRoot, state.ajaxUrl, '', '');
        formRoot.querySelector('#nc-reg-sex').addEventListener('change', function () { togglePregnancy(formRoot); });
        formRoot.querySelector('#nc-reg-insurance-type').addEventListener('change', function () { toggleInsurancePanels(formRoot); });
        formRoot.querySelector('#nc-reg-no-phone').addEventListener('change', function () { toggleNoPhone(formRoot); });
        formRoot.querySelector('#nc-reg-nkda').addEventListener('change', function () {
            if (formRoot.querySelector('#nc-reg-nkda').checked) {
                formRoot.querySelector('#nc-reg-allergies-unknown').checked = false;
            } else if (formRoot.querySelector('#nc-reg-allergies').value.trim() === ''
                && !formRoot.querySelector('#nc-reg-allergies-unknown').checked
                && !window.confirm('No allergies listed. Continue without documenting allergies?')) {
                formRoot.querySelector('#nc-reg-nkda').checked = true;
            }
            toggleAllergyFields(formRoot);
        });
        formRoot.querySelector('#nc-reg-allergies-unknown').addEventListener('change', function () {
            if (formRoot.querySelector('#nc-reg-allergies-unknown').checked) {
                formRoot.querySelector('#nc-reg-nkda').checked = false;
            }
            toggleAllergyFields(formRoot);
        });
        toggleNoPhone(formRoot);

        formRoot.addEventListener('input', function () { state.dirty = true; });
        formRoot.addEventListener('change', function () { state.dirty = true; });

        if (options.prefill) {
            var parsed = parseSearchQuery(options.prefill);
            formRoot.querySelector('#nc-reg-fname').value = parsed.fname;
            formRoot.querySelector('#nc-reg-lname').value = parsed.lname;
            formRoot.querySelector('#nc-reg-phone').value = parsed.phone;
        }

        function showError(msg) {
            errorEl.textContent = msg;
            errorEl.classList.remove('d-none');
            successEl.classList.add('d-none');
        }

        function showSuccess(msg) {
            successEl.textContent = msg;
            successEl.classList.remove('d-none');
            errorEl.classList.add('d-none');
        }

        function updateCompletion(score, missing) {
            var badge = formRoot.querySelector('#nc-reg-completion');
            if (badge && score !== undefined) {
                badge.textContent = score + '% complete';
            }
            updateSectionCheckmarks(formRoot, missing);
        }

        function reloadFormData() {
            if (!state.pid) {
                return Promise.resolve();
            }
            return postJson(state.ajaxUrl + '?action=patients.registration.get', {
                pid: state.pid,
                csrf_token_form: state.csrfToken
            }).then(function (result) {
                if (!result.payload.success) {
                    return;
                }
                fillForm(formRoot, result.payload.data);
                bindGeo(
                    formRoot,
                    state.ajaxUrl,
                    (result.payload.data.section_2 || {}).region_code,
                    (result.payload.data.section_2 || {}).district_code
                );
                updateCompletion(
                    (result.payload.data.completion || {}).score,
                    (result.payload.data.completion || {}).missing
                );
            });
        }

        function getActiveSection() {
            var open = formRoot.querySelector('.collapse.show[id^="nc-reg-section-"]');
            if (open && open.id) {
                return parseInt(open.id.replace('nc-reg-section-', ''), 10) || 1;
            }
            return state.pid ? 1 : 1;
        }

        function runDupCheck() {
            var values = collectSection(formRoot, 1);
            if (values.no_phone) {
                values.phone = values.reach_contact_phone;
            }
            postJson(state.ajaxUrl + '?action=patients.dup_check', Object.assign({}, values, {
                national_id: formRoot.querySelector('#nc-reg-national-id').value.trim(),
                exclude_pid: state.pid || 0,
                csrf_token_form: state.csrfToken
            })).then(function (result) {
                if (result.payload.success) {
                    renderDupPanel(dupPanel, result.payload.data, function (pid) {
                        state.dirty = false;
                        if (typeof options.onUseExisting === 'function') {
                            options.onUseExisting(pid);
                        }
                    });
                }
            }).catch(function () {
                renderDupPanel(dupPanel, { level: 'none', candidates: [] }, function () {});
            });
        }

        ['#nc-reg-fname', '#nc-reg-lname', '#nc-reg-sex', '#nc-reg-dob-s1', '#nc-reg-age', '#nc-reg-phone',
            '#nc-reg-national-id', '#nc-reg-reach-phone', '#nc-reg-reach-name']
            .forEach(function (sel) {
                var el = formRoot.querySelector(sel);
                if (el) {
                    el.addEventListener('input', runDupCheck);
                    el.addEventListener('change', runDupCheck);
                }
            });
        runDupCheck();

        function saveSection(section, startAfter) {
            errorEl.classList.add('d-none');
            var patient = collectSection(formRoot, section);
            if (section === 1 && patient.no_phone) {
                if (!patient.reach_contact_name || !patient.reach_contact_phone || !patient.reach_contact_relationship) {
                    showError('Reach contact name, phone, and relationship are required when patient has no personal phone.');
                    return;
                }
            }
            if (section === 3 && patient.allergies_none_known && patient.allergies_unknown) {
                showError('Choose either no known allergies or allergies unknown, not both.');
                return;
            }
            var dupPayload = {
                dup_confirm: !!(formRoot.querySelector('#nc-dup-confirm') && formRoot.querySelector('#nc-dup-confirm').checked),
                dup_override: !!(formRoot.querySelector('#nc-dup-override') && formRoot.querySelector('#nc-dup-override').checked),
                dup_override_reason: formRoot.querySelector('#nc-dup-override-reason')
                    ? formRoot.querySelector('#nc-dup-override-reason').value.trim() : ''
            };

            var action = state.pid ? 'patients.update' : 'patients.create';
            var body = Object.assign({
                section: section,
                patient: patient,
                csrf_token_form: state.csrfToken,
                national_id: patient.national_id || formRoot.querySelector('#nc-reg-national-id').value.trim(),
                no_phone: patient.no_phone
            }, dupPayload);

            if (state.pid) {
                body.pid = state.pid;
            }

            if (!state.pid && section !== 1) {
                showError('Save Section 1 first to create the patient.');
                return;
            }

            if (!state.pid && lastDupResult.level === 'block' && !dupPayload.dup_override) {
                showError('Likely duplicate — use existing patient or override with reason.');
                return;
            }
            if (!state.pid && lastDupResult.level === 'warn' && !dupPayload.dup_confirm) {
                showError('Confirm this is a different patient before saving.');
                return;
            }

            postJson(state.ajaxUrl + '?action=' + action, body).then(function (result) {
                if (!result.payload.success) {
                    showError(result.payload.message || 'Save failed');
                    return;
                }
                state.pid = result.payload.data.pid;
                state.dirty = false;
                updateCompletion(
                    result.payload.data.completion_score,
                    result.payload.data.completion_missing
                );
                showSuccess('Section ' + section + ' saved.');
                reloadFormData().then(function () {
                    if (startAfter && typeof options.onSaved === 'function') {
                        options.onSaved(state.pid, true);
                    }
                });
            }).catch(function () {
                showError('Save failed — network or server error.');
            });
        }

        formRoot.querySelectorAll('.nc-reg-save-section').forEach(function (btn) {
            btn.addEventListener('click', function () {
                saveSection(parseInt(btn.dataset.section, 10), false);
            });
        });
        formRoot.querySelector('#nc-reg-save').addEventListener('click', function () {
            saveSection(getActiveSection(), false);
        });
        formRoot.querySelector('#nc-reg-save-start').addEventListener('click', function () {
            saveSection(1, true);
        });
        formRoot.querySelector('#nc-reg-cancel').addEventListener('click', function () {
            if (state.dirty && !window.confirm('Discard unsaved registration changes?')) {
                return;
            }
            state.dirty = false;
            if (typeof options.onCancel === 'function') {
                options.onCancel();
            }
        });

        if (state.pid) {
            postJson(state.ajaxUrl + '?action=patients.registration.get', {
                pid: state.pid,
                csrf_token_form: state.csrfToken
            }).then(function (result) {
                if (!result.payload.success) {
                    showError(result.payload.message || 'Could not load patient');
                    return;
                }
                fillForm(formRoot, result.payload.data);
                bindGeo(
                    formRoot,
                    state.ajaxUrl,
                    (result.payload.data.section_2 || {}).region_code,
                    (result.payload.data.section_2 || {}).district_code
                );
                updateCompletion(
                    (result.payload.data.completion || {}).score,
                    (result.payload.data.completion || {}).missing
                );
            }).catch(function () {
                showError('Could not load patient — network or server error.');
            });
        }

        return {
            isDirty: function () { return state.dirty; },
            confirmDiscard: function () {
                if (!state.dirty) {
                    return true;
                }
                return window.confirm('Discard registration changes and switch patient?');
            }
        };
    }

    window.NewClinicRegistrationForm = { render: render };
})(window);
