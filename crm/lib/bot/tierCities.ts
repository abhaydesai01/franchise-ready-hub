/** Tier-1 / tier-2 / tier-3 city lists for targetLocation scoring (India-focused). */

const TIER1 = new Set(
  [
    'mumbai',
    'delhi',
    'bangalore',
    'bengaluru',
    'hyderabad',
    'ahmedabad',
    'chennai',
    'kolkata',
    'pune',
    'surat',
    'jaipur',
    'lucknow',
    'kanpur',
    'nagpur',
    'indore',
    'thane',
    'bhopal',
    'visakhapatnam',
    'vadodara',
    'ghaziabad',
    'ludhiana',
    'gurgaon',
    'gurugram',
    'noida',
    'faridabad',
  ].map((s) => s.toLowerCase()),
);

const TIER2 = new Set(
  [
    'coimbatore',
    'kochi',
    'mysore',
    'mysuru',
    'chandigarh',
    'jaipur',
    'nashik',
    'rajkot',
    'varanasi',
    'agra',
    'meerut',
    'ranchi',
    'jodhpur',
    'guwahati',
    'patna',
    'bhubaneswar',
    'dehradun',
    'amritsar',
  ].map((s) => s.toLowerCase()),
);

export function tierForLocationText(raw: string): 1 | 2 | 3 {
  const t = raw.trim().toLowerCase();
  if (!t) return 3;
  const tokens = t.split(/[\s,]+/).filter(Boolean);
  for (const tok of tokens) {
    const key = tok.replace(/[^a-z]/g, '');
    if (!key) continue;
    if (TIER1.has(key)) return 1;
  }
  for (const tok of tokens) {
    const key = tok.replace(/[^a-z]/g, '');
    if (TIER2.has(key)) return 2;
  }
  return 3;
}
