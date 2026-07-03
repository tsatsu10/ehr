/**
 * @param {string} output
 * @returns {{ patientName: string, providerId: number, pcEid?: number }}
 */
function parseRecurringFixtureOutput(output) {
  const patientMatch = output.match(/patient="([^"]+)"/);
  const providerMatch = output.match(/provider=(\d+)/);
  const eidMatch = output.match(/pc_eid=(\d+)/);
  if (!patientMatch || !providerMatch) {
    throw new Error(`Could not parse recurring fixture output:\n${output}`);
  }
  return {
    patientName: patientMatch[1],
    providerId: Number(providerMatch[1]),
    pcEid: eidMatch ? Number(eidMatch[1]) : undefined,
  };
}

module.exports = {
  parseRecurringFixtureOutput,
};
