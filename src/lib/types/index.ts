// ═══════════════════════════════════════════════════════════════
// Beis — מערכת טיפוסים
// ═══════════════════════════════════════════════════════════════

// ── מסלול לימוד (Learning Track) ────────────────────────────────
export type LearningTrack = 'נגלה' | 'חסידות' | 'תמים';

// ── מקום (Location) ──────────────────────────────────────────────
export interface Makom {
  id: string;
  shem: string;              // e.g. "ירושלים"
  transliteration: string;   // e.g. "Jerusalem"
  country: string;
  timezone: string;
  memberCount: number;
  activeChaburos: number;
  coordinatorId: string;
  status: 'active' | 'forming' | 'inactive';
  createdAt: string;
}

// ── תפקיד (Authority role) ──────────────────────────────────────
// Administrative authority (approve, publish, manage) is a role;
// contribution_score drives governance weight only — never authority.
export type Role = 'chaver' | 'mashpia' | 'admin';

// ── חבר (Member / Contributor) ──────────────────────────────────
export interface Chaver {
  id: string;
  shem: string;
  contribution_score: number;  // cumulative contribution score; drives voting weight
  role?: Role;                 // absent ⇒ 'chaver'
  track: LearningTrack;
  makomId: string;
  walletAddress?: string;
  email?: string;              // set once email/Google auth lands (ROADMAP Stage 1)
  tokenBalance: number;
  totalTokensEarned: number;
  peerReviewsGiven: number;
  peerReviewsReceived: number;
  papersPublished: number;
  votingPower: number;
  seifimCompleted: number;
  chavrusaId: string | null;
  shiurGroupId: string | null;
  zalId: string | null;
  avatarUrl: string | null;
  nirashemAt: string;
  isOnline: boolean;
}

// ── קבוצה (Shiur Group hierarchy) ───────────────────────────────
export type GroupType = 'chavrusa' | 'shiur' | 'zal' | 'yeshiva';

export interface ShiurGroup {
  id: string;
  type: GroupType;
  name: string;
  leaderId: string;
  memberIds: string[];
  parentGroupId: string | null;
  childGroupIds: string[];
}

// ── חבורה (Publication Campaign) ─────────────────────────────────
export type ChaburahType = 'course' | 'research' | 'publication' | 'chaburah';
export type ChaburahStatus = 'draft' | 'active' | 'in_progress' | 'completed' | 'archived';
export type ChaburahCategory = 'nigleh' | 'chassidus' | 'halacha' | 'machshava' | 'kabbalah';
export type PublicationType = 'digital_sefer' | 'printed_book' | 'research_journal' | 'source_anthology';

// ── מטא-נתוני פרסום (Publication metadata, optional on publication-type chaburos) ──
export type PublicationFormat = 'print' | 'ebook' | 'web_native' | 'source_anthology' | 'hybrid';
export type PublicationLicense = 'cc_by_sa' | 'cc_by_nc' | 'all_rights_reserved' | 'custom';

export interface PublicationMeta {
  titleHebrew: string;
  titleEnglish?: string;
  subtitle?: string;
  targetFormat: PublicationFormat;
  targetAudience?: string;
  targetLength?: number;       // pages or word count
  targetDeadline?: string;     // ISO date
  totalBudgetTmim?: number;
  license: PublicationLicense;
  manuscriptIpfsCid?: string;
}

export interface Chaburah {
  id: string;
  shem: string;
  description: string;
  type: ChaburahType;
  category: ChaburahCategory;
  creatorId: string;
  locationId: string;
  isGlobal: boolean;
  status: ChaburahStatus;
  tokenAllocation: number;
  tokensUsed: number;
  enrolledIds: string[];
  chibburimCount: number;
  deadline?: string;
  topics: string[];
  publicationType?: PublicationType;
  researchQuestion?: string;
  publicationMeta?: PublicationMeta;
  createdAt: string;
  updatedAt: string;
}

// ── חיבור (Assignment / Piece) ──────────────────────────────────
export type ChibburType =
  | 'lecture_notes'
  | 'research_paper'
  | 'chapter_draft'
  | 'source_analysis'
  | 'peer_review'
  | 'presentation'
  // publication-specific
  | 'translation'
  | 'original_analysis'
  | 'scholarly_footnote'
  | 'editing'
  | 'proofreading'
  | 'formatting_typesetting'
  | 'indexing'
  | 'design_layout'
  | 'source_collection';

export type ChibburStatus = 'open' | 'in_progress' | 'submitted' | 'in_review' | 'revision_requested' | 'approved' | 'published';

export interface Chibbur {
  id: string;
  shem: string;
  description: string;
  chaburahId: string;
  type: ChibburType;
  assigneeId?: string;
  reviewerId?: string;
  status: ChibburStatus;
  seifimCount: number;
  tokenAllocation: number;
  deadline?: string;
  contentUrl?: string;         // legacy external link; superseded by draftContent
  draftContent?: string;       // working draft — serialized TipTap JSON
  draftWordCount?: number;
  draftUpdatedAt?: string;
  submissionNotes?: string;
  reviewCount: number;
  averageRating?: number;
  createdAt: string;
  updatedAt: string;
}

// A frozen snapshot of the draft, taken on every submit
export interface ChibburRevision {
  id: string;
  content: string;             // serialized TipTap JSON
  wordCount: number;
  createdAt: string;
  createdBy: string;
  kind: 'submit' | 'manual';
}

// Default שכר rewards and labels per chibbur type
export const CHIBBUR_TYPE_DEFAULTS: Record<ChibburType, { baseReward: number; label: string; desc: string }> = {
  research_paper:         { baseReward: 500, label: 'מאמר מחקרי',    desc: 'מחקר מקורי עם מקורות' },
  chapter_draft:          { baseReward: 300, label: 'טיוטת פרק',     desc: 'כתיבת פרק לספר שיתופי' },
  source_analysis:        { baseReward: 200, label: 'ניתוח מקורות',  desc: 'ליקוט ועיון מקורות' },
  lecture_notes:          { baseReward: 150, label: 'סיכום שיעור',   desc: 'הכנת סיכום מובנה' },
  presentation:           { baseReward: 200, label: 'מצגת',          desc: 'הכנת הרצאה / חבורה' },
  peer_review:            { baseReward: 100, label: 'ביקורת עמיתים', desc: 'ביקורת על עבודת עמית' },
  translation:            { baseReward: 250, label: 'תרגום',         desc: 'תרגום טקסט מקורי' },
  original_analysis:      { baseReward: 400, label: 'חידוש',         desc: 'ניתוח מקורי / חידוש' },
  scholarly_footnote:     { baseReward: 80,  label: 'הערת שוליים',   desc: 'מקור מלומד עם ציטוטים' },
  editing:                { baseReward: 150, label: 'עריכה',         desc: 'עריכה ספרותית / הלכתית' },
  proofreading:           { baseReward: 80,  label: 'הגהה',          desc: 'בדיקת הגהה ודיוק' },
  formatting_typesetting: { baseReward: 120, label: 'עיצוב גופני',   desc: 'עיצוב ועימוד לדפוס' },
  indexing:               { baseReward: 100, label: 'אינדקס',        desc: 'הכנת מפתח נושאים' },
  design_layout:          { baseReward: 180, label: 'עיצוב גרפי',   desc: 'עיצוב גרפי ופריסת עמוד' },
  source_collection:      { baseReward: 120, label: 'ליקוט מקורות',  desc: 'איסוף מקורות ראשוניים' },
};

// ── בקשת הצטרפות לחבורה (Chaburah Contribution Application) ──
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface ChaburahApplication {
  id: string;
  chaburahId: string;
  applicantId: string;
  statement: string;        // ≤300 words
  status: ApplicationStatus;
  reviewedBy?: string;      // officer who approved/rejected
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

// ── סעיף (Sub-task / Step) ─────────────────────────────────────
export type SeifType = 'write' | 'review' | 'research' | 'present' | 'edit' | 'source_collection';
export type SeifStatus = 'todo' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
export type SeifPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Seif {
  id: string;
  shem: string;
  description: string;
  chibburId: string;
  chaburahId: string;
  assigneeId?: string;
  type: SeifType;
  status: SeifStatus;
  priority: SeifPriority;
  tokenReward: number;
  deadline?: string;
  submissionNotes?: string;
  createdAt: string;
}

// ── ביקורת עמיתים (Peer Review) ─────────────────────────────────
export interface PeerReview {
  id: string;
  chibburId: string;
  reviewerId: string;
  authorId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comments: string;
  suggestions: string[];
  status: 'pending' | 'submitted' | 'acknowledged';
  tokensEarned: number;
  createdAt: string;
}

// ── דיון (Discussion Thread) ─────────────────────────────────────
export interface Discussion {
  id: string;
  chibburId: string;
  authorId: string;
  parentId?: string;
  content: string;
  tokensEarned: number;
  createdAt: string;
}

// ── תרומה (Donation) ─────────────────────────────────────────────
export interface Donation {
  id: string;
  donorName: string;
  donorWallet?: string;
  amount: number;
  tmimMinted: number;
  makomId?: string;
  chaburahId?: string;
  message?: string;
  createdAt: string;
}

// ── אוצר (Treasury) ─────────────────────────────────────────────
export interface Treasury {
  totalDonated: number;
  totalTmimMinted: number;
  totalTmimDistributed: number;
  totalTmimRedeemed: number;
  currentBalance: number;
  tmimCirculating: number;
}

// ── פעילות (Activity Feed) ───────────────────────────────────────
export type ActivityType =
  | 'chaburah_created'
  | 'chibbur_opened'
  | 'chibbur_completed'
  | 'seif_completed'
  | 'seif_submitted'
  | 'chaver_promoted'
  | 'chaver_enrolled'
  | 'tmim_distributed'
  | 'farbrengen_announced'
  | 'maamar_shared'
  | 'peer_review_submitted'
  | 'paper_published';

export interface Activity {
  id: string;
  type: ActivityType;
  actorId: string;
  actorShem: string;
  targetId: string;
  targetTitle: string;
  description: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

// ── מאמר (Chassidic Discourse) ──────────────────────────────────
export interface Maamar {
  id: string;
  title: string;
  authorId: string;
  hemshech: string | null;
  hemshechNumber: number | null;
  summary: string;
  sharedAt: string;
  tags: string[];
}

// ── פארברענגען (Farbrengen Event) ──────────────────────────────
export type FarbrengenStatus = 'upcoming' | 'live' | 'completed';

export interface Farbrengen {
  id: string;
  title: string;
  description: string;
  hostId: string;
  scheduledAt: string;
  status: FarbrengenStatus;
  recordingUrl: string | null;
  attendeeIds: string[];
}

// ── סטטיסטיקות לוח המחוונים ──────────────────────────────────────
export interface DashboardStats {
  activeChaburos: number;
  openChibburim: number;
  pendingSeifim: number;
  pendingReviews: number;
  totalTmimDistributed: number;
  onlineChaverim: number;
}

// ── ניווט ─────────────────────────────────────────────────────────
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

// ── לוח זמנים יומי ──────────────────────────────────────────────
export interface SederScheduleItem {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  type: 'chassidus' | 'nigleh' | 'tefila' | 'break';
  status: 'upcoming' | 'active' | 'completed';
}

// ═══════════════════════════════════════════════════════════════
// ממשל (Governance) — Spec 2C
// ═══════════════════════════════════════════════════════════════

export type ProposalState = 'active' | 'passed' | 'failed' | 'queued' | 'executed' | 'cancelled';

// Matches BeisGovernance.sol ProposalType enum (order is load-bearing)
export const PROPOSAL_TYPES = [
  'signal',
  'chaburah_funding',
  'redemption_rate',
  'emergency_pause',
  'emergency_unpause',
  'treasury_transfer',
  'grant_role',
  'parameter_update',
  'mint_tokens',
  'monthly_cap_update',
] as const;

export type ProposalType = typeof PROPOSAL_TYPES[number];

// Maps ProposalType string → on-chain uint8 enum index
export const PROPOSAL_TYPE_CHAIN_INDEX: Record<ProposalType, number> =
  Object.fromEntries(PROPOSAL_TYPES.map((t, i) => [t, i])) as Record<ProposalType, number>;

export interface Proposal {
  id: string;
  onChainProposalId?: string;      // uint256 id from BeisGovernance.propose(), stored in Firestore
  proposer: string;                // Wallet address
  proposerChaver?: Chaver;
  type: ProposalType;
  title: string;
  description: string;
  target: string;                  // Target contract address
  callData: string;
  callDataDecoded?: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  snapshotBlock: number;
  votingStartTime: string;         // ISO timestamp
  votingEndTime: string;
  executionTime?: string;
  state: ProposalState;
  executed: boolean;
  quorumReached: boolean;
  quorumRequired: number;
  totalVotingTokens: number;
  myVote?: 'for' | 'against' | 'abstain' | null;
}

// Voting weight = floor(log2(contribution_score + 1))
export function contributionVotingWeight(score: number): number {
  return Math.floor(Math.log2(score + 1));
}

export interface VotingPowerInfo {
  tmimBalance: number;
  contributionScore: number;
  scoreWeight: number;
  totalPower: number;
  delegatedTo?: string;
  delegatedFrom: string[];
}

export interface PaymentStream {
  id: string;
  recipient: string;
  recipientChaver?: Chaver;
  totalAmount: number;
  claimedAmount: number;
  startTime: string;
  endTime: string;
  cancelled: boolean;
  claimable: number;
}

export interface TreasuryStats {
  totalDonatedUSD: number;
  tmimCirculating: number;
  tmimTotalMinted: number;
  usdcBalance: number;
  ethBalance: number;
  reserveRatio: number;
  redemptionRate: number;
  maxMonthlyMint: number;
  currentMonthMinted: number;
}

export interface DonationForm {
  amount: number;
  currency: 'ETH' | 'USDC';
  earmarkType: 'none' | 'makom' | 'chaburah';
  earmarkId?: string;
  message?: string;
}

export interface RedemptionForm {
  tmimAmount: number;
  usdcReceived: number;
  eligible: boolean;
  ineligibleReason?: string;
}

// Proposal type Hebrew labels
export const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  signal:              'הצעה עצתית (ייעוץ בלבד)',
  chaburah_funding:    'הקצאת תקציב לחבורה',
  redemption_rate:     'שינוי שער פדיון',
  emergency_pause:     'השהיית חירום',
  emergency_unpause:   'ביטול השהיה',
  treasury_transfer:   'העברה מהאוצר',
  grant_role:          'הענקת הרשאה',
  parameter_update:    'עדכון פרמטר',
  mint_tokens:         'הנפקת טוקנים',
  monthly_cap_update:  'עדכון תקרה חודשית',
};

// ── Backward-compat type aliases (removed after stores/routes are updated) ──
/** @deprecated use Chaburah */
export type Mivtza = Chaburah;
/** @deprecated use ChaburahType */
export type MivtzaType = ChaburahType;
/** @deprecated use ChaburahStatus */
export type MivtzaStatus = ChaburahStatus;
/** @deprecated use ChaburahCategory */
export type MivtzaCategory = ChaburahCategory;
/** @deprecated use Chibbur */
export type Masima = Chibbur;
/** @deprecated use ChibburType */
export type MasimaType = ChibburType;
/** @deprecated use ChibburStatus */
export type MasimaStatus = ChibburStatus;
/** @deprecated use Seif */
export type Tafkid = Seif;
/** @deprecated use SeifType */
export type TafkidType = SeifType;
/** @deprecated use SeifStatus */
export type TafkidStatus = SeifStatus;
/** @deprecated use SeifPriority */
export type TafkidPriority = SeifPriority;
/** @deprecated use Chaver */
export type Talmid = Chaver;
/** @deprecated use ChaburahApplication */
export type MivtzaApplication = ChaburahApplication;
/** @deprecated use CHIBBUR_TYPE_DEFAULTS */
export const MASIMA_TYPE_DEFAULTS = CHIBBUR_TYPE_DEFAULTS;
