/** English texts, one file per area of the interface, merged into a single lookup table. */
import common from './common';
import setup from './setup';
import rounds from './rounds';
import analysis from './analysis';
import partB from './partB';

export const EN: Record<string, string> = { ...common, ...setup, ...rounds, ...analysis, ...partB };
