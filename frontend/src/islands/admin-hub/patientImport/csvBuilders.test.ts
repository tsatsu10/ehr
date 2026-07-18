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

  it('neutralizes a name that looks like a spreadsheet formula', () => {
    const csv = buildReportCsv([
      { row_number: 5, status: 'ok', reason: '', name: '=SUM(A1)', pid: null },
    ]);
    expect(csv).toContain("'=SUM(A1)");
  });

  it('neutralizes +, -, and @ leading cells too', () => {
    const csv = buildReportCsv([
      { row_number: 6, status: 'ok', reason: '', name: '+1234', pid: null },
      { row_number: 7, status: 'ok', reason: '', name: '-1234', pid: null },
      { row_number: 8, status: 'ok', reason: '', name: '@cmd', pid: null },
    ]);
    expect(csv).toContain("'+1234");
    expect(csv).toContain("'-1234");
    expect(csv).toContain("'@cmd");
  });
});
