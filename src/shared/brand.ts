/** CORTEX (کورتکس) name and mark, as plain data so the reports and expert files can use them without the interface code. */
export const BRAND = { name: 'CORTEX', nameFa: 'کورتکس', version: '2.0' };

/** The mark as an SVG string, also used for the favicon and the expert questionnaires. */
export const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="cx-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b4ff0"/><stop offset="1" stop-color="#12b5a6"/></linearGradient></defs>' +
  '<rect width="64" height="64" rx="15" fill="url(#cx-g)"/>' +
  '<g fill="none" stroke="#fff" stroke-linecap="round"><path d="M45.6 16.4a22 22 0 1 0 0 31.2" stroke-width="5"/><path d="M40.5 23.5a12 12 0 1 0 0 17" stroke-width="4.2" stroke-opacity=".8"/></g>' +
  '<circle cx="32" cy="32" r="4.2" fill="#fff"/><circle cx="48.5" cy="32" r="3" fill="#fff" fill-opacity=".9"/><path d="M36.5 32h9" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-opacity=".9"/></svg>';
