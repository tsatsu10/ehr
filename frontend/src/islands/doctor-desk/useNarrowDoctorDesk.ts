import { useEffect, useState } from 'react';

const NARROW_DESK_QUERY = '(max-width: 1023px)';

export function useNarrowDoctorDesk(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_DESK_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(NARROW_DESK_QUERY);
    const update = () => setNarrow(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return narrow;
}
