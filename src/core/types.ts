/**
 * Data model of a research project.
 *
 * Everything the researcher creates or the app records lives in one serialisable `Project` object,
 * except expert identities (names, contact details, notes). Those are kept in a separate store and
 * exported as a separate "key file", as the proposal's ethics section requires (DECISIONS C1).
 */

export type Id = string;
/** ISO date (YYYY-MM-DD) or full ISO timestamp. */
export type ISODate = string;

// ---------------------------------------------------------------------------------------------
// Rating scale (Part A) and the "cannot judge" answer
// ---------------------------------------------------------------------------------------------

/** Marker for «توانایی قضاوت ندارم». Not a valid response: excluded from every denominator. */
export const CJ = 'CJ' as const;
/** A Delphi answer: an integer on the scale, "cannot judge", or `null` (no answer). */
export type RatingValue = number | typeof CJ | null;

/** One interpretation band of the rating scale, inclusive on both ends (e.g. 7–9 «حیاتی»). */
export interface Band {
  id: Id;
  label: string;
  from: number;
  to: number;
}

export interface RatingScale {
  min: number;
  max: number;
  /** Ordered bottom → top. The consensus rule reads only the first and the last band. */
  bands: Band[];
  allowCannotJudge: boolean;
  cannotJudgeLabel: string;
}

// ---------------------------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------------------------

export interface Domain {
  id: Id;
  name: string;
  /** Short label printed on every coloured mark so colour is never the only signal (e.g. «ج»). */
  shortLabel: string;
  color: string;
  /** Inclusion criterion text shown on the expert form (proposal ۸–۴ ج ۱). */
  inclusionCriteria: string;
  /** Optional minimum years of experience; experts below it get a warning (DECISIONS P5). */
  minYears: number | null;
}

export type RoundKey = 'r1' | 'r2' | 'pugh';
export type RoundState = 'none' | 'invited' | 'consented' | 'responded' | 'withdrew';

export interface RoundStatus {
  state: RoundState;
  date: ISODate | null;
}

export interface Expert {
  id: Id;
  /** Anonymous code (E01…). The only identifier that ever leaves the researcher's private view. */
  code: string;
  domainId: Id;
  yearsExperience: number | null;
  activityType: string;
  consentDate: ISODate | null;
  /** Inactive experts get no new invitations; their data is kept. */
  active: boolean;
  status: Record<RoundKey, RoundStatus>;
  /** Withdrew AND objected to the use of earlier answers → all their data is left out of every analysis (DECISIONS P2). */
  excludeAllData: boolean;
  /** «معیارهای ورود احراز شد» (DECISIONS P5). */
  inclusionMet: boolean | null;
}

/** Private identity of an expert. Never part of the project file or any output except the key file. */
export interface ExpertIdentity {
  name: string;
  contact: string;
  notes: string;
}

// ---------------------------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------------------------

export interface SemanticGroup {
  id: Id;
  name: string;
}

export type ParamSource = 'literature' | 'patent' | 'both';
export type ParamOrigin = 'initial' | 'round2';

export interface Parameter {
  id: Id;
  code: string;
  name: string;
  groupId: Id;
  /** «الزام طراحی» paired with the parameter. */
  requirement: string;
  explanation: string;
  /** Reported numeric range, free text (optional). */
  range: string;
  source: ParamSource;
  /** 'initial' = Phase 1 list (rated in both rounds); 'round2' = added from round-1 open answers. */
  origin: ParamOrigin;
}

// ---------------------------------------------------------------------------------------------
// Delphi responses
// ---------------------------------------------------------------------------------------------

/** Hierarchical point allocation (روش توزیع امتیاز). A blank is `null` or absent. */
export interface Allocation {
  groupPoints: Record<Id, number | null>;
  paramPoints: Record<Id, number | null>;
}

export type ResponseSource = 'file' | 'manual' | 'sheet';

export interface DelphiResponse {
  expertId: Id;
  round: 'r1' | 'r2';
  /** paramId → answer */
  ratings: Record<Id, RatingValue>;
  /** groupId → free text (round 1: proposals of new parameters or comments) */
  openTexts: Record<Id, string>;
  /** Round 2 only. */
  allocation: Allocation | null;
  consent: { given: boolean; at: ISODate | null };
  source: ResponseSource;
  receivedAt: ISODate;
}

/** Coding of one open answer (one expert × one group). */
export interface OpenCoding {
  /** `${expertId}|${groupId}` */
  key: string;
  candidateIds: Id[];
  /** Existing parameters the answer supports or comments on (creates nothing new). */
  paramIds: Id[];
  commentOnly: boolean;
  /** Text used in every export (identifying details removed); `null` = same as the original. */
  displayText: string | null;
  note: string;
}

/** A candidate new parameter built from open answers. */
export interface Candidate {
  id: Id;
  label: string;
  /** Synonym merge: this candidate's support counts towards `mergedInto`. */
  mergedInto: Id | null;
  /** Manual override of the 20 % rule (logged with a reason). `null` = follow the rule. */
  override: 'add' | 'reject' | null;
  overrideReason: string;
  /** Parameter created from this candidate for round 2. */
  paramId: Id | null;
}

// ---------------------------------------------------------------------------------------------
// Part B
// ---------------------------------------------------------------------------------------------

export type PughSymbol = '+' | '-' | 'S';

export interface Concept {
  id: Id;
  code: string;
  name: string;
  /** Data URL of the sketch image, or null. */
  sketch: string | null;
  description: string;
  feasible: boolean;
}

export interface ScreeningRater {
  id: Id;
  label: string;
}

/** raterId → conceptId → paramId → symbol */
export type ScreeningVotes = Record<Id, Record<Id, Record<Id, PughSymbol | null>>>;

export interface ScreeningRun {
  /** Run 1: chosen by the researcher (simplest concept). Run 2: derived from run 1 (the best). */
  datumId: Id | null;
  votes: ScreeningVotes;
  /** Run 1 only: the researcher's choice among tied best concepts. */
  bestChoice: Id | null;
}

export interface ForwardOverride {
  forward: boolean;
  reason: string;
}

export interface Screening {
  mode: 'single' | 'team';
  raters: ScreeningRater[];
  /** Rows of the matrix; `null` = the retained Delphi parameters. */
  paramIds: Id[] | null;
  run1: ScreeningRun;
  run2: ScreeningRun;
  /** Manual forwarding decisions, each with a mandatory reason. */
  overrides: Record<Id, ForwardOverride>;
  /** Choice among concepts tied at the 4-concept cutoff. */
  cutoffChoice: Id[] | null;
}

export interface WeightedColumn {
  paramId: Id;
  weight: number;
}

/** Blinding for one expert's scoring file: random code per concept and a random order. */
export interface BlindingKey {
  seed: number;
  codes: Record<Id, string>;
  order: Id[];
}

/** raterId → conceptId → paramId → 1–5 or null */
export type WeightedScores = Record<Id, Record<Id, Record<Id, number | null>>>;

export interface WeightedMatrix {
  mode: 'single' | 'panel';
  columns: WeightedColumn[];
  /** Rows; `null` = the concepts forwarded by screening. */
  conceptIds: Id[] | null;
  /** Raters (expert ids); `null` = round-2 respondents. */
  raterIds: Id[] | null;
  scores: WeightedScores;
  blinding: Record<Id, BlindingKey>;
  /** Snapshot of the Part A weights at the last "send to Part B". */
  sentWeights: { at: ISODate; weights: Record<Id, number> } | null;
}

// ---------------------------------------------------------------------------------------------
// Settings, history, project
// ---------------------------------------------------------------------------------------------

export interface ConsensusThresholds {
  /** ≥ this % of valid answers in the top band … */
  retainTopMin: number;
  /** … and ≤ this % in the bottom band → retain («حفظ»). */
  retainBottomMax: number;
  /** ≥ this % in the bottom band … */
  removeBottomMin: number;
  /** … and ≤ this % in the top band → remove («حذف»). */
  removeTopMax: number;
}

export interface PanelSettings {
  target: number;
  targetPerDomain: number;
  acceptableMin: number;
  acceptableMax: number;
  minTotal: number;
  minPerDomain: number;
}

export interface RoundSchedule {
  opens: ISODate | null;
  deadline: ISODate | null;
  reminders: ISODate[];
  extendedTo: ISODate | null;
}

export interface Settings {
  consensus: ConsensusThresholds;
  /** New-parameter threshold: % of round-1 respondents (default 20). */
  candidatePct: number;
  panel: PanelSettings;
  schedule: Record<RoundKey, RoundSchedule>;
  sensitivity: {
    /** Trigger: gap between the top two < this % of the scale range (default 10). */
    pctOfRange: number;
    /** One-at-a-time change of each weight, as a fraction (default 0.2 = ±20 %). */
    step: number;
    /** Run even when the trigger is not met (labelled supplementary). */
    alwaysRun: boolean;
  };
  /** Part B 5-level value scale labels (1 → 5). */
  valueLabels: string[];
  /** Edges of the experience ranges for the panel description, e.g. [5,10,15,20]. */
  experienceEdges: number[];
  /** Consent page shown at the start of every expert file. */
  consentText: string;
  /** Pugh screening: at most this many concepts go forward (default 4) … */
  maxForward: number;
  /** … and at least this many (default 2). */
  minForward: number;
}

export interface ChangeLogEntry {
  id: Id;
  at: ISODate;
  action: string;
  detail: string;
  reason: string;
}

/** Settings frozen when the first round-1 response arrives; later changes are reported as deviations (DECISIONS C3). */
export interface SettingsSnapshot {
  at: ISODate;
  scale: RatingScale;
  consensus: ConsensusThresholds;
  candidatePct: number;
}

export interface Project {
  schema: 'delphi-pugh/project';
  version: 1;
  id: Id;
  title: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  settings: Settings;
  scale: RatingScale;
  domains: Domain[];
  experts: Expert[];
  groups: SemanticGroup[];
  params: Parameter[];
  responses: { r1: Record<Id, DelphiResponse>; r2: Record<Id, DelphiResponse> };
  /** Round-2 invitees; `null` = round-1 respondents who have not withdrawn. */
  r2Invited: Id[] | null;
  codings: Record<string, OpenCoding>;
  candidates: Candidate[];
  concepts: Concept[];
  screening: Screening;
  weighted: WeightedMatrix;
  captions: Record<string, string>;
  settingsSnapshot: SettingsSnapshot | null;
  changeLog: ChangeLogEntry[];
  /** Highest expert number ever issued, so a deleted expert's code is never reused (DECISIONS D-06). */
  expertCodeCounter: number;
}
