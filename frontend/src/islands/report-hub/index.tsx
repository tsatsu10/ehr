import { mountIsland } from '@core/mountIsland';
import { ReportHub } from './ReportHub';
import '@islands/daily-reports/main.css';
import '@islands/bill-ops/main.css';
import '@islands/pharm-ops/main.css';
import '@islands/patient-registry/main.css';
import './main.css';

mountIsland('report-hub', ReportHub);
