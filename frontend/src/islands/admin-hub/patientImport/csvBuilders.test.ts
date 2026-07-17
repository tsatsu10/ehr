import { describe, expect, it } from 'vitest';
import { buildReportCsv, buildTemplateCsv } from './csvBuilders';

describe('csv builders', () => {
  it('template has the documented headers and 2 example rows', () => {
    const lines = buildTemplateCsv().trim().split('\n');
    expect(lines[0]).toBe('first_name,last_name,middle_name,sex,date_of_birth,age,phone,address,old_clinic_number,national_id');
    expect(lines).toHaveLength(3);
  });

  it('report quotes fields containing commas', () => {
    const csv = buildReportCsv([
      { row_number: 4, status: 'error', reason: 'Bad, very bad', name: 'A B', pid: null },
    ]);
    expect(csv).toContain('"Bad, very bad"');
  });
});
