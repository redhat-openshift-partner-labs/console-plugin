import { deleteHelmChart } from './support/chart';

export default function globalTeardown() {
  deleteHelmChart();
}
