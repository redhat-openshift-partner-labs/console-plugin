import { installHelmChart } from './support/chart';

export default function globalSetup() {
  installHelmChart();
}
