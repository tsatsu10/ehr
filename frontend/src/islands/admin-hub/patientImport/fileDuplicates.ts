/** Later occurrences of an identity already seen earlier in the same file. */
export function findInFileDuplicates(rows: Record<string, string>[]): Map<number, string> {
  const seenNameDob = new Map<string, number>();
  const seenNamePhone = new Map<string, number>();
  const seenNationalId = new Map<string, number>();
  const flagged = new Map<number, string>();

  rows.forEach((row, i) => {
    const name = `${(row.fname ?? '').trim().toLowerCase()}|${(row.lname ?? '').trim().toLowerCase()}`;
    const dob = (row.dob ?? '').trim();
    const phone = (row.phone ?? '').replace(/\D/g, '');
    const nid = (row.national_id ?? '').trim();

    if (nid !== '' && seenNationalId.has(nid)) {
      flagged.set(i, `Same national ID as row ${(seenNationalId.get(nid) ?? 0) + 2} in this file`);
      return;
    }
    if (dob !== '' && seenNameDob.has(`${name}|${dob}`)) {
      flagged.set(i, `Same name and date of birth as row ${(seenNameDob.get(`${name}|${dob}`) ?? 0) + 2} in this file`);
      return;
    }
    if (phone !== '' && seenNamePhone.has(`${name}|${phone}`)) {
      flagged.set(i, `Same name and phone as row ${(seenNamePhone.get(`${name}|${phone}`) ?? 0) + 2} in this file`);
      return;
    }

    if (nid !== '') seenNationalId.set(nid, i);
    if (dob !== '') seenNameDob.set(`${name}|${dob}`, i);
    if (phone !== '') seenNamePhone.set(`${name}|${phone}`, i);
  });

  return flagged;
}
