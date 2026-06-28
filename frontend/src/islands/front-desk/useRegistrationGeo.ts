import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';

export interface GeoOption {
  code: string;
  label: string;
}

let regionsCache: GeoOption[] | null = null;

export function useRegistrationGeo(
  ajaxUrl: string,
  csrfToken: string,
  regionCode: string,
  districtCode: string,
  onRegionChange: (code: string) => void,
) {
  const [regions, setRegions] = useState<GeoOption[]>(regionsCache ?? []);
  const [districts, setDistricts] = useState<GeoOption[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  useEffect(() => {
    if (regionsCache) {
      setRegions(regionsCache);
      return;
    }

    void oeFetch<{ regions: GeoOption[] }>('admin.geo.regions', {
      ajaxUrl,
      csrfToken,
      params: { country: 'GH' },
    }).then((data) => {
      regionsCache = data.regions ?? [];
      setRegions(regionsCache);
    }).catch(() => setRegions([]));
  }, [ajaxUrl, csrfToken]);

  const loadDistricts = useCallback(async (region: string, selectedDistrict = '') => {
    if (!region) {
      setDistricts([]);
      return;
    }

    setLoadingDistricts(true);
    try {
      const data = await oeFetch<{ districts: GeoOption[] }>('admin.geo.districts', {
        ajaxUrl,
        csrfToken,
        params: { region_code: region },
      });
      setDistricts(data.districts ?? []);
      if (selectedDistrict && !(data.districts ?? []).some((d) => d.code === selectedDistrict)) {
        setDistricts((prev) => [...prev, { code: selectedDistrict, label: `${selectedDistrict} (legacy)` }]);
      }
    } catch {
      setDistricts([]);
    } finally {
      setLoadingDistricts(false);
    }
  }, [ajaxUrl, csrfToken]);

  useEffect(() => {
    if (regionCode) {
      void loadDistricts(regionCode, districtCode);
    } else {
      setDistricts([]);
    }
  // districtCode is intentionally omitted — selecting a district must not refetch the list
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionCode, loadDistricts]);

  const handleRegionChange = (code: string) => {
    onRegionChange(code);
    void loadDistricts(code, '');
  };

  return { regions, districts, loadingDistricts, handleRegionChange };
}
