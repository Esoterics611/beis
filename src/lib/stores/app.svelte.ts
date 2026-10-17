// ═══════════════════════════════════════════════════════════════
// Beis — מאגר מצב גלובלי (Svelte 5 runes + Firebase)
// ═══════════════════════════════════════════════════════════════
//
// Architecture: Firebase-first.
//  • All mutations → API routes (server-side validation + atomic writes)
//  • All reads → Firestore onSnapshot listeners (real-time)
//  • Mock data used ONLY as loading placeholder while listeners connect
//  • In-memory fallback used ONLY when VITE_FIREBASE_API_KEY absent (CI/build)
// ═══════════════════════════════════════════════════════════════

import {
  MOCK_TALMIDIM,
  MOCK_GROUPS,
  MOCK_MEKOMOT,
  MOCK_MIVTZAOT,
  MOCK_MASIMOT,
  MOCK_TAFKIDIM,
  MOCK_PEER_REVIEWS,
  MOCK_DISCUSSIONS,
  MOCK_DONATIONS,
  MOCK_TREASURY,
  MOCK_ACTIVITIES,
  MOCK_MAAMARIM,
  MOCK_FARBRENGENS,
  MOCK_SEDER,
  CURRENT_USER_ID,
} from './mock-data';
import type {
  Talmid,
  ShiurGroup,
  Makom,
  Mivtza,
  Masima,
  Tafkid,
  PeerReview,
  Discussion,
  Donation,
  Treasury,
  Activity,
  ActivityType,
  Maamar,
  Farbrengen,
  SederScheduleItem,
  DashboardStats,
  MasimaStatus,
  TafkidStatus,
  LearningTrack,
  Proposal,
  PaymentStream,
  TreasuryStats,
} from '$lib/types';
import { contributionVotingWeight } from '$lib/types';
import { toast } from './toast.svelte';

// Detect if Firebase is configured
const USE_FIREBASE = typeof import.meta !== 'undefined' &&
  !!import.meta.env?.VITE_FIREBASE_API_KEY;

const now = () => new Date().toISOString();

type Unsubscribe = () => void;

class AppStore {
  // ── core data ─────────────────────────────────────────────────
  talmidim      = $state<Talmid[]>([]);
  groups        = $state<ShiurGroup[]>(MOCK_GROUPS);
  mekomot       = $state<Makom[]>(MOCK_MEKOMOT);
  mivtzaot      = $state<Mivtza[]>([]);
  masimot       = $state<Masima[]>([]);
  tafkidim      = $state<Tafkid[]>([]);
  peerReviews   = $state<PeerReview[]>([]);
  discussions   = $state<Discussion[]>([]);
  donations     = $state<Donation[]>([]);
  treasury      = $state<Treasury>(MOCK_TREASURY);
  activities    = $state<Activity[]>([]);
  maamarim      = $state<Maamar[]>(MOCK_MAAMARIM);
  farbrengens   = $state<Farbrengen[]>(MOCK_FARBRENGENS);
  sederSchedule = $state<SederScheduleItem[]>(MOCK_SEDER);

  // ── governance ────────────────────────────────────────────────
  proposals      = $state<Proposal[]>([]);
  paymentStreams  = $state<PaymentStream[]>([]);
  treasuryStats  = $state<TreasuryStats | null>(null);

  // ── UI state ──────────────────────────────────────────────────
  sidebarCollapsed = $state(false);
  currentUserId    = $state<string | null>(null);
  isAuthenticated  = $state(false);
  loading          = $state(true);
  error            = $state<string | null>(null);

  private _unsubs: Unsubscribe[] = [];

  // ── counters (in-memory mode only) ────────────────────────────
  private counters: Record<string, number> = {
    mivtza: 100, masima: 100, tafkid: 100, review: 100,
    discussion: 100, donation: 100, activity: 100, talmid: 100,
  };

  // JWT claims role — set from Firebase Auth token on login, reliable even before Firestore syncs
  currentRole = $state<'chaver' | 'mashpia' | 'admin'>('chaver');

  // ── derived ───────────────────────────────────────────────────
  currentUser = $derived(this.talmidim.find(t => t.id === this.currentUserId));
  currentMakom = $derived(
    this.currentUser ? this.mekomot.find(m => m.id === this.currentUser!.makomId) : undefined
  );
  // Use JWT claim role first (always up-to-date), fall back to the Firestore doc's role
  isMashpia = $derived(
    this.currentRole === 'mashpia' || this.currentRole === 'admin' ||
    this.currentUser?.role === 'mashpia' || this.currentUser?.role === 'admin'
  );

  stats = $derived<DashboardStats>({
    activeChaburos:       this.mivtzaot.filter(m => m.status === 'active' || m.status === 'in_progress').length,
    openChibburim:        this.masimot.filter(m => m.status === 'open' || m.status === 'in_progress').length,
    pendingSeifim:        this.tafkidim.filter(t => t.assigneeId === this.currentUserId && (t.status === 'todo' || t.status === 'in_progress')).length,
    pendingReviews:       this.masimot.filter(m => m.status === 'in_review').length,
    totalTmimDistributed: this.treasury.totalTmimDistributed,
    onlineChaverim:       this.talmidim.filter(t => t.isOnline).length,
  });

  myTafkidim = $derived(this.tafkidim.filter(t => t.assigneeId === this.currentUserId));

  // Governance derived
  activeProposals = $derived(this.proposals.filter(p => p.state === 'active'));
  myUnvotedProposals = $derived(
    this.proposals.filter(p => p.state === 'active' && (p.myVote === null || p.myVote === undefined))
  );
  myVotingPower = $derived(
    this.currentUser
      ? contributionVotingWeight(this.currentUser.contribution_score)
      : 0
  );

  networkStats = $derived({
    totalLocations:   this.mekomot.filter(m => m.status === 'active').length,
    totalChaverim:    this.talmidim.length,
    totalMivtzaot:    this.mivtzaot.filter(m => m.status !== 'draft').length,
    tmimCirculating:  this.treasury.tmimCirculating,
    totalPeerReviews: this.peerReviews.length,
  });

  // ══════════════════════════════════════════════════════════════
  // Firebase Listeners
  // ══════════════════════════════════════════════════════════════

  async startListeners(): Promise<void> {
    if (!USE_FIREBASE) {
      // No Firebase config (CI / offline dev without credentials):
      // load mock data permanently so the UI stays fully functional
      this.talmidim    = MOCK_TALMIDIM;
      this.mivtzaot    = MOCK_MIVTZAOT;
      this.masimot     = MOCK_MASIMOT;
      this.tafkidim    = MOCK_TAFKIDIM;
      this.peerReviews = MOCK_PEER_REVIEWS;
      this.discussions = MOCK_DISCUSSIONS;
      this.donations   = MOCK_DONATIONS;
      this.treasury    = MOCK_TREASURY;
      this.activities  = MOCK_ACTIVITIES;
      this.mekomot     = MOCK_MEKOMOT;
      this.currentUserId = CURRENT_USER_ID;
      this.loading = false;
      return;
    }

    // Firebase mode: show mock data as loading placeholder (replaced by first snapshot)
    this.talmidim    = MOCK_TALMIDIM;
    this.mivtzaot    = MOCK_MIVTZAOT;
    this.masimot     = MOCK_MASIMOT;
    this.tafkidim    = MOCK_TAFKIDIM;
    this.mekomot     = MOCK_MEKOMOT;
    this.treasury    = MOCK_TREASURY;

    try {
      const { db } = await import('$lib/firebase');
      const {
        collection, onSnapshot, query, orderBy, limit,
      } = await import('firebase/firestore');

      const snap = <T>(col: string, setter: (items: T[]) => void) =>
        onSnapshot(collection(db, col), s => {
          setter(s.docs.map(d => ({ id: d.id, ...d.data() }) as T));
        }, err => {
          console.error(`Firestore error [${col}]:`, err);
          this.error = `שגיאת חיבור: ${err.message}`;
        });

      this._unsubs.push(
        snap<Talmid>('talmidim',   v => { this.talmidim   = v; }),
        snap<Makom>('mekomot',     v => { this.mekomot    = v; }),
        snap<Mivtza>('mivtzaot',   v => { this.mivtzaot   = v; }),
        snap<Masima>('masimot',    v => { this.masimot    = v; }),
        snap<Tafkid>('tafkidim',   v => { this.tafkidim   = v; }),
        snap<PeerReview>('peerReviews', v => { this.peerReviews = v; }),
        snap<Discussion>('discussions', v => { this.discussions  = v; }),
        snap<Donation>('donations',    v => { this.donations     = v; }),
        onSnapshot(collection(db, 'proposals'), s => {
          this.proposals = s.docs.map(d => {
            const data = d.data();
            return { id: d.id, ...data, type: data['type'] ?? 'signal' } as Proposal;
          });
        }, err => {
          console.error('Firestore error [proposals]:', err);
          this.error = `שגיאת חיבור: ${err.message}`;
        }),
        snap<PaymentStream>('paymentStreams', v => { this.paymentStreams = v; }),

        onSnapshot(
          query(collection(db, 'activities'), orderBy('timestamp', 'desc'), limit(50)),
          s => { this.activities = s.docs.map(d => ({ id: d.id, ...d.data() }) as Activity); }
        ),

        onSnapshot(
          collection(db, 'treasury'),
          s => {
            const doc = s.docs.find(d => d.id === 'global');
            if (doc) {
              this.treasury      = doc.data() as Treasury;
              this.treasuryStats = doc.data() as TreasuryStats;
            }
          }
        ),
      );

      this.loading = false;
    } catch (e) {
      console.error('startListeners error:', e);
      this.error = 'שגיאה בהפעלת Firestore';
      // Fall back to mock data
      this.talmidim    = MOCK_TALMIDIM;
      this.mivtzaot    = MOCK_MIVTZAOT;
      this.masimot     = MOCK_MASIMOT;
      this.tafkidim    = MOCK_TAFKIDIM;
      this.loading = false;
    }
  }

  stopListeners(): void {
    this._unsubs.forEach(u => u());
    this._unsubs = [];
    // Clear live data but keep UI blank — user is signed out
    this.talmidim    = [];
    this.mivtzaot    = [];
    this.masimot     = [];
    this.tafkidim    = [];
    this.peerReviews = [];
    this.discussions = [];
    this.donations   = [];
    this.activities     = [];
    this.proposals      = [];
    this.paymentStreams  = [];
    this.treasuryStats  = null;
    this.currentUserId = null;
    this.loading = false; // don't show spinner on sign-out
  }

  // ══════════════════════════════════════════════════════════════
  // Auth Helper — wraps fetch with Firebase ID token
  // ══════════════════════════════════════════════════════════════

  private async authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    let token: string | null = null;
    if (USE_FIREBASE) {
      const { auth } = await import('$lib/firebase');
      token = (await auth.currentUser?.getIdToken()) ?? null;
    }
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // Internal helpers (in-memory mode)
  // ══════════════════════════════════════════════════════════════

  private nextId(prefix: string): string {
    this.counters[prefix] = (this.counters[prefix] || 0) + 1;
    return `${prefix}-${String(this.counters[prefix]).padStart(3, '0')}`;
  }

  private logActivity(
    type: ActivityType,
    actorId: string,
    targetId: string,
    targetTitle: string,
    description: string,
  ): void {
    const actor = this.getTalmid(actorId);
    const a: Activity = {
      id: this.nextId('activity'),
      type,
      actorId,
      actorShem: actor?.shem ?? 'מערכת',
      targetId,
      targetTitle,
      description,
      timestamp: now(),
      metadata: {},
    };
    this.activities = [a, ...this.activities];
  }

  private awardTokens(talmidId: string, base: number): number {
    const t = this.getTalmid(talmidId);
    if (!t) return 0;
    const amount = base;
    const idx = this.talmidim.findIndex(x => x.id === talmidId);
    if (idx >= 0) {
      this.talmidim[idx] = {
        ...this.talmidim[idx],
        tokenBalance:      this.talmidim[idx].tokenBalance + amount,
        totalTokensEarned: this.talmidim[idx].totalTokensEarned + amount,
      };
    }
    this.treasury = {
      ...this.treasury,
      totalTmimDistributed: this.treasury.totalTmimDistributed + amount,
      tmimCirculating:      this.treasury.tmimCirculating + amount,
    };
    return amount;
  }

  // ══════════════════════════════════════════════════════════════
  // Query helpers
  // ══════════════════════════════════════════════════════════════

  getTalmid(id: string): Talmid | undefined       { return this.talmidim.find(t => t.id === id); }
  getGroup(id: string): ShiurGroup | undefined    { return this.groups.find(g => g.id === id); }
  getMakom(id: string): Makom | undefined         { return this.mekomot.find(m => m.id === id); }
  getMivtza(id: string): Mivtza | undefined       { return this.mivtzaot.find(m => m.id === id); }
  getMasima(id: string): Masima | undefined       { return this.masimot.find(m => m.id === id); }
  getTafkid(id: string): Tafkid | undefined       { return this.tafkidim.find(t => t.id === id); }

  getMivtzaMasimot(mivtzaId: string): Masima[]      { return this.masimot.filter(m => m.chaburahId === mivtzaId); }
  getMasimaTafkidim(masimaId: string): Tafkid[]     { return this.tafkidim.filter(t => t.chibburId === masimaId); }
  getMivtzaTafkidim(mivtzaId: string): Tafkid[]     { return this.tafkidim.filter(t => t.chaburahId === mivtzaId); }
  getMasimaPeerReviews(masimaId: string): PeerReview[] { return this.peerReviews.filter(pr => pr.chibburId === masimaId); }
  getMasimaDiscussions(masimaId: string): Discussion[] { return this.discussions.filter(d => d.chibburId === masimaId); }
  getMakomTalmidim(makomId: string): Talmid[]       { return this.talmidim.filter(t => t.makomId === makomId); }

  getMivtzaEnrolled(mivtzaId: string): Talmid[] {
    const mivtza = this.getMivtza(mivtzaId);
    if (!mivtza) return [];
    return mivtza.enrolledIds.map(id => this.getTalmid(id)).filter(Boolean) as Talmid[];
  }

  getTalmidMivtzaot(talmidId: string): Mivtza[] {
    return this.mivtzaot.filter(m => m.enrolledIds.includes(talmidId));
  }

  getMivtzaProgress(mivtzaId: string): number {
    const masimot = this.getMivtzaMasimot(mivtzaId);
    if (masimot.length === 0) return 0;
    const done = masimot.filter(m => m.status === 'approved' || m.status === 'published').length;
    return Math.round((done / masimot.length) * 100);
  }

  getMasimaProgress(masimaId: string): number {
    const tafkidim = this.getMasimaTafkidim(masimaId);
    if (tafkidim.length === 0) return 0;
    const done = tafkidim.filter(t => t.status === 'approved').length;
    return Math.round((done / tafkidim.length) * 100);
  }

  // ══════════════════════════════════════════════════════════════
  // CRUD — Mivtzaot
  // ══════════════════════════════════════════════════════════════

  async addMivtza(data: Omit<Mivtza, 'id' | 'createdAt' | 'updatedAt' | 'tokensUsed' | 'chibburimCount' | 'enrolledIds'>): Promise<Mivtza> {
    if (USE_FIREBASE) {
      const res = await this.authFetch('/api/chaburot', { method: 'POST', body: JSON.stringify(data) });
      if (!res.ok) { toast.error(await res.text()); throw new Error('addMivtza failed'); }
      const mivtza = await res.json();
      toast.success(`חבורה "${data.shem}" נוצר בהצלחה`);
      return mivtza;
    }
    // In-memory fallback
    const id = this.nextId('mivtza');
    const mivtza: Mivtza = {
      ...data, id, tokensUsed: 0, chibburimCount: 0,
      enrolledIds: data.creatorId ? [data.creatorId] : [],
      createdAt: now(), updatedAt: now(),
    };
    this.mivtzaot = [...this.mivtzaot, mivtza];
    this.logActivity('chaburah_created', data.creatorId, id, data.shem, 'יצר חבורה חדשה');
    toast.success(`חבורה "${data.shem}" נוצר בהצלחה`);
    return mivtza;
  }

  async updateMivtza(id: string, data: Partial<Mivtza>): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chaburot/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success('החבורה עודכן');
      return;
    }
    const idx = this.mivtzaot.findIndex(m => m.id === id);
    if (idx < 0) { toast.error('חבורה לא נמצאה'); return; }
    this.mivtzaot[idx] = { ...this.mivtzaot[idx], ...data, updatedAt: now() };
    toast.success('החבורה עודכן');
  }

  async deleteMivtza(id: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chaburot/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success('החבורה נמחק');
      return;
    }
    const mivtza = this.getMivtza(id);
    if (!mivtza) return;
    const masimotIds = this.getMivtzaMasimot(id).map(m => m.id);
    this.tafkidim   = this.tafkidim.filter(t => !masimotIds.includes(t.chibburId));
    this.peerReviews = this.peerReviews.filter(pr => !masimotIds.includes(pr.chibburId));
    this.discussions = this.discussions.filter(d => !masimotIds.includes(d.chibburId));
    this.masimot    = this.masimot.filter(m => m.chaburahId !== id);
    this.mivtzaot   = this.mivtzaot.filter(m => m.id !== id);
    toast.success(`חבורה "${mivtza.shem}" נמחק`);
  }

  // ══════════════════════════════════════════════════════════════
  // CRUD — Masimot
  // ══════════════════════════════════════════════════════════════

  async addMasima(data: Omit<Masima, 'id' | 'createdAt' | 'updatedAt' | 'seifimCount' | 'reviewCount' | 'averageRating'>): Promise<Masima> {
    if (USE_FIREBASE) {
      const res = await this.authFetch('/api/chibburim', { method: 'POST', body: JSON.stringify(data) });
      if (!res.ok) { toast.error(await res.text()); throw new Error('addMasima failed'); }
      const masima = await res.json();
      toast.success(`חיבור "${data.shem}" נוצרה`);
      return masima;
    }
    const id = this.nextId('masima');
    const masima: Masima = { ...data, id, seifimCount: 0, reviewCount: 0, createdAt: now(), updatedAt: now() };
    this.masimot = [...this.masimot, masima];
    const mIdx = this.mivtzaot.findIndex(m => m.id === data.chaburahId);
    if (mIdx >= 0) this.mivtzaot[mIdx] = { ...this.mivtzaot[mIdx], chibburimCount: this.mivtzaot[mIdx].chibburimCount + 1, updatedAt: now() };
    this.logActivity('chibbur_opened', this.currentUserId ?? '', id, data.shem, 'פתח חיבור חדש');
    toast.success(`חיבור "${data.shem}" נוצרה`);
    return masima;
  }

  async updateMasima(id: string, data: Partial<Masima>): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chibburim/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      if (!res.ok) { toast.error(await res.text()); return; }
      return;
    }
    const idx = this.masimot.findIndex(m => m.id === id);
    if (idx < 0) { toast.error('חיבור לא נמצא'); return; }
    this.masimot[idx] = { ...this.masimot[idx], ...data, updatedAt: now() };
  }

  async assignMasima(id: string, talmidId: string, role: 'assignee' | 'reviewer' = 'assignee'): Promise<void> {
    const field = role === 'assignee' ? 'assigneeId' : 'reviewerId';
    await this.updateMasima(id, { [field]: talmidId } as Partial<Masima>);
    const name = this.getTalmid(talmidId)?.shem ?? talmidId;
    toast.success(role === 'assignee' ? `שוייך ל${name}` : `מבקר עמיתים: ${name}`);
  }

  async deleteMasima(id: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chibburim/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success('החיבור נמחקה');
      return;
    }
    const masima = this.getMasima(id);
    if (!masima) return;
    this.tafkidim   = this.tafkidim.filter(t => t.chibburId !== id);
    this.peerReviews = this.peerReviews.filter(pr => pr.chibburId !== id);
    this.discussions = this.discussions.filter(d => d.chibburId !== id);
    this.masimot    = this.masimot.filter(m => m.id !== id);
    const mIdx = this.mivtzaot.findIndex(m => m.id === masima.chaburahId);
    if (mIdx >= 0) this.mivtzaot[mIdx] = { ...this.mivtzaot[mIdx], chibburimCount: Math.max(0, this.mivtzaot[mIdx].chibburimCount - 1), updatedAt: now() };
    toast.success(`חיבור "${masima.shem}" נמחקה`);
  }

  // ── state machine — Masimot ───────────────────────────────────

  async startMasima(id: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chibburim/${id}/start`, { method: 'POST' });
      if (!res.ok) { toast.error(await res.text()); return; }
      return;
    }
    const m = this.getMasima(id);
    if (!m || m.status !== 'open') { toast.error('לא ניתן להתחיל חיבור זו'); return; }
    await this.updateMasima(id, { status: 'in_progress' as MasimaStatus });
    toast.success(`התחלת עבודה על "${m.shem}"`);
  }

  /** Autosave the working draft (serialized TipTap JSON). Returns success. */
  async saveDraft(id: string, content: string, wordCount: number): Promise<boolean> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chibburim/${id}/draft`, {
        method: 'PATCH',
        body: JSON.stringify({ content, wordCount }),
      });
      return res.ok;
    }
    const idx = this.masimot.findIndex(x => x.id === id);
    if (idx === -1) return false;
    this.masimot[idx] = { ...this.masimot[idx], draftContent: content, draftWordCount: wordCount, draftUpdatedAt: now() };
    return true;
  }

  async submitMasima(id: string, contentUrl?: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chibburim/${id}/submit`, { method: 'POST', body: JSON.stringify({ contentUrl }) });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success('החיבור הוגשה לביקורת');
      return;
    }
    const m = this.getMasima(id);
    if (!m || (m.status !== 'in_progress' && m.status !== 'revision_requested')) { toast.error('לא ניתן להגיש חיבור זו'); return; }
    const idx = this.masimot.findIndex(x => x.id === id);
    this.masimot[idx] = { ...this.masimot[idx], status: 'submitted' as MasimaStatus, contentUrl: contentUrl ?? this.masimot[idx].contentUrl, updatedAt: now() };
    this.logActivity('chibbur_completed', this.currentUserId ?? '', id, m.shem, 'הגיש חיבור');
    toast.success(`חיבור "${m.shem}" הוגשה לביקורת`);
  }

  async startReviewMasima(id: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chibburim/${id}/review/start`, { method: 'POST' });
      if (!res.ok) { toast.error(await res.text()); return; }
      return;
    }
    const m = this.getMasima(id);
    if (!m || m.status !== 'submitted') { toast.error('לא ניתן להתחיל ביקורת'); return; }
    const idx = this.masimot.findIndex(x => x.id === id);
    this.masimot[idx] = { ...this.masimot[idx], status: 'in_review' as MasimaStatus, updatedAt: now() };
    toast.info(`ביקורת התחילה: "${m.shem}"`);
  }

  async approveMasima(id: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chibburim/${id}/review/approve`, { method: 'POST' });
      if (!res.ok) { toast.error(await res.text()); return; }
      const data = await res.json();
      toast.success(
        'החיבור אושרה ✓ שכר נשלחו',
        data.txUrl ? { label: 'צפה בעסקה על Base Sepolia ↗', href: data.txUrl } : undefined,
        5000,
      );
      return;
    }
    const m = this.getMasima(id);
    if (!m || m.status !== 'in_review') { toast.error('לא ניתן לאשר חיבור זו'); return; }
    const idx = this.masimot.findIndex(x => x.id === id);
    this.masimot[idx] = { ...this.masimot[idx], status: 'approved' as MasimaStatus, updatedAt: now() };
    if (m.assigneeId) {
      const awarded = this.awardTokens(m.assigneeId, m.tokenAllocation);
      this.logActivity('tmim_distributed', this.currentUserId ?? '', id, m.shem, `חולקו ${awarded} שכר`);
    }
    this.logActivity('chibbur_completed', this.currentUserId ?? '', id, m.shem, 'אישר חיבור');
    toast.success(`חיבור "${m.shem}" אושרה`);
  }

  async requestRevisionMasima(id: string, notes?: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chibburim/${id}/review/revision`, { method: 'POST', body: JSON.stringify({ notes }) });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.info('בוקש תיקון');
      return;
    }
    const m = this.getMasima(id);
    if (!m || m.status !== 'in_review') { toast.error('לא ניתן לבקש תיקון'); return; }
    const idx = this.masimot.findIndex(x => x.id === id);
    this.masimot[idx] = { ...this.masimot[idx], status: 'revision_requested' as MasimaStatus, submissionNotes: notes ?? this.masimot[idx].submissionNotes, updatedAt: now() };
    toast.info(`בוקש תיקון: "${m.shem}"`);
  }

  async publishMasima(id: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chibburim/${id}/publish`, { method: 'POST' });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success('פורסם!');
      return;
    }
    const m = this.getMasima(id);
    if (!m || m.status !== 'approved') { toast.error('לא ניתן לפרסם חיבור זו'); return; }
    const idx = this.masimot.findIndex(x => x.id === id);
    this.masimot[idx] = { ...this.masimot[idx], status: 'published' as MasimaStatus, updatedAt: now() };
    if (m.assigneeId) {
      const tIdx = this.talmidim.findIndex(t => t.id === m.assigneeId);
      if (tIdx >= 0) this.talmidim[tIdx] = { ...this.talmidim[tIdx], papersPublished: this.talmidim[tIdx].papersPublished + 1 };
    }
    this.logActivity('paper_published', this.currentUserId ?? '', id, m.shem, 'פרסם חיבור');
    toast.success(`"${m.shem}" פורסם!`);
  }

  // ══════════════════════════════════════════════════════════════
  // CRUD — Tafkidim
  // ══════════════════════════════════════════════════════════════

  async addTafkid(data: Omit<Tafkid, 'id' | 'createdAt'>): Promise<Tafkid> {
    if (USE_FIREBASE) {
      const res = await this.authFetch('/api/seifim', { method: 'POST', body: JSON.stringify(data) });
      if (!res.ok) { toast.error(await res.text()); throw new Error('addTafkid failed'); }
      const tafkid = await res.json();
      toast.success(`שלב "${data.shem}" נוצר`);
      return tafkid;
    }
    const id = this.nextId('tafkid');
    const tafkid: Tafkid = { ...data, id, createdAt: now() };
    this.tafkidim = [...this.tafkidim, tafkid];
    const mIdx = this.masimot.findIndex(m => m.id === data.chibburId);
    if (mIdx >= 0) this.masimot[mIdx] = { ...this.masimot[mIdx], seifimCount: this.masimot[mIdx].seifimCount + 1, updatedAt: now() };
    toast.success(`שלב "${data.shem}" נוצר`);
    return tafkid;
  }

  async updateTafkid(id: string, data: Partial<Tafkid>): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/seifim/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      if (!res.ok) { toast.error(await res.text()); return; }
      return;
    }
    const idx = this.tafkidim.findIndex(t => t.id === id);
    if (idx < 0) { toast.error('שלב לא נמצא'); return; }
    this.tafkidim[idx] = { ...this.tafkidim[idx], ...data };
  }

  async deleteTafkid(id: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/seifim/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success('השלב נמחק');
      return;
    }
    const t = this.getTafkid(id);
    if (!t) return;
    this.tafkidim = this.tafkidim.filter(x => x.id !== id);
    const mIdx = this.masimot.findIndex(m => m.id === t.chibburId);
    if (mIdx >= 0) this.masimot[mIdx] = { ...this.masimot[mIdx], seifimCount: Math.max(0, this.masimot[mIdx].seifimCount - 1), updatedAt: now() };
    toast.success(`שלב "${t.shem}" נמחק`);
  }

  // ── state machine — Tafkidim ──────────────────────────────────

  async startTafkid(id: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/seifim/${id}/start`, { method: 'POST' });
      if (!res.ok) { toast.error(await res.text()); return; }
      return;
    }
    const t = this.getTafkid(id);
    if (!t || t.status !== 'todo') { toast.error('לא ניתן להתחיל שלב זה'); return; }
    const idx = this.tafkidim.findIndex(x => x.id === id);
    this.tafkidim[idx] = { ...t, status: 'in_progress' as TafkidStatus };
    toast.success(`התחלת "${t.shem}"`);
  }

  async submitTafkid(id: string, notes?: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/seifim/${id}/submit`, { method: 'POST', body: JSON.stringify({ notes }) });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success('הוגש');
      return;
    }
    const t = this.getTafkid(id);
    if (!t || t.status !== 'in_progress') { toast.error('לא ניתן להגיש שלב זה'); return; }
    const idx = this.tafkidim.findIndex(x => x.id === id);
    this.tafkidim[idx] = { ...t, status: 'submitted' as TafkidStatus, submissionNotes: notes ?? t.submissionNotes };
    this.logActivity('seif_submitted', this.currentUserId ?? '', id, t.shem, 'הגיש שלב');
    toast.success(`"${t.shem}" הוגש`);
  }

  async approveTafkid(id: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/seifim/${id}/approve`, { method: 'POST' });
      if (!res.ok) { toast.error(await res.text()); return; }
      const data = await res.json();
      toast.success(
        'השלב אושר ✓ שכר נשלחו',
        data.txUrl ? { label: 'צפה בעסקה על Base Sepolia ↗', href: data.txUrl } : undefined,
        5000,
      );
      return;
    }
    const t = this.getTafkid(id);
    if (!t || t.status !== 'submitted') { toast.error('לא ניתן לאשר שלב זה'); return; }
    const idx = this.tafkidim.findIndex(x => x.id === id);
    this.tafkidim[idx] = { ...t, status: 'approved' as TafkidStatus };
    if (t.assigneeId) {
      const awarded = this.awardTokens(t.assigneeId, t.tokenReward);
      this.logActivity('tmim_distributed', this.currentUserId ?? '', id, t.shem, `חולקו ${awarded} שכר`);
      const tIdx = this.talmidim.findIndex(x => x.id === t.assigneeId);
      if (tIdx >= 0) this.talmidim[tIdx] = { ...this.talmidim[tIdx], seifimCompleted: this.talmidim[tIdx].seifimCompleted + 1 };
    }
    this.logActivity('seif_completed', this.currentUserId ?? '', id, t.shem, 'אישר שלב');
    toast.success(`שלב "${t.shem}" אושר`);
  }

  async rejectTafkid(id: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/seifim/${id}/reject`, { method: 'POST' });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.info('הוחזר לביצוע');
      return;
    }
    const t = this.getTafkid(id);
    if (!t || t.status !== 'submitted') { toast.error('לא ניתן לדחות שלב זה'); return; }
    const idx = this.tafkidim.findIndex(x => x.id === id);
    this.tafkidim[idx] = { ...t, status: 'todo' as TafkidStatus };
    toast.info(`"${t.shem}" הוחזר לביצוע`);
  }

  // ══════════════════════════════════════════════════════════════
  // Talmidim
  // ══════════════════════════════════════════════════════════════

  async addTalmid(data: Omit<Talmid, 'id'>): Promise<Talmid> {
    if (USE_FIREBASE) {
      const res = await this.authFetch('/api/chaverim', { method: 'POST', body: JSON.stringify(data) });
      if (!res.ok) { toast.error(await res.text()); throw new Error('addTalmid failed'); }
      return res.json();
    }
    const id = this.nextId('talmid');
    const talmid: Talmid = { ...data, id };
    this.talmidim = [...this.talmidim, talmid];
    this.logActivity('chaver_enrolled', this.currentUserId ?? '', id, data.shem, 'חבר חדש הצטרף');
    toast.success(`${data.shem} הצטרף למערכת`);
    return talmid;
  }

  async updateTalmid(id: string, data: Partial<Talmid>): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chaverim/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success('הפרופיל עודכן');
      return;
    }
    const idx = this.talmidim.findIndex(t => t.id === id);
    if (idx < 0) { toast.error('חבר לא נמצא'); return; }
    this.talmidim[idx] = { ...this.talmidim[idx], ...data };
    toast.success('הפרופיל עודכן');
  }

  async promoteTalmid(id: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chaverim/${id}/promote`, { method: 'POST' });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success('קודם בהצלחה!');
      return;
    }
    const t = this.getTalmid(id);
    if (!t) { toast.error('חבר לא נמצא'); return; }
    const scoreIncrement = 5000;
    const idx = this.talmidim.findIndex(x => x.id === id);
    this.talmidim[idx] = { ...this.talmidim[idx], contribution_score: t.contribution_score + scoreIncrement };
    this.logActivity('chaver_promoted', this.currentUserId ?? '', id, t.shem, 'ניקוד תרומה עודכן');
    toast.success(`${t.shem} — ניקוד תרומה עלה!`);
  }

  // ══════════════════════════════════════════════════════════════
  // Enroll / Unenroll
  // ══════════════════════════════════════════════════════════════

  async enrollInMivtza(talmidId: string, mivtzaId: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chaburot/${mivtzaId}/enroll`, { method: 'POST', body: JSON.stringify({ talmidId }) });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success('נרשמת לחבורה');
      return;
    }
    const idx = this.mivtzaot.findIndex(m => m.id === mivtzaId);
    if (idx < 0) { toast.error('חבורה לא נמצאה'); return; }
    const mivtza = this.mivtzaot[idx];
    if (mivtza.enrolledIds.includes(talmidId)) { toast.info('כבר רשום לחבורה זו'); return; }
    this.mivtzaot[idx] = { ...mivtza, enrolledIds: [...mivtza.enrolledIds, talmidId], updatedAt: now() };
    const talmid = this.getTalmid(talmidId);
    this.logActivity('chaver_enrolled', talmidId, mivtzaId, mivtza.shem, 'הצטרף לחבורה');
    toast.success(`${talmid?.shem ?? 'חייל'} הצטרף ל"${mivtza.shem}"`);
  }

  async unenrollFromMivtza(talmidId: string, mivtzaId: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/chaburot/${mivtzaId}/unenroll`, { method: 'POST', body: JSON.stringify({ talmidId }) });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success('יצאת מהחבורה');
      return;
    }
    const idx = this.mivtzaot.findIndex(m => m.id === mivtzaId);
    if (idx < 0) return;
    const mivtza = this.mivtzaot[idx];
    this.mivtzaot[idx] = { ...mivtza, enrolledIds: mivtza.enrolledIds.filter(id => id !== talmidId), updatedAt: now() };
    toast.success('יצאת מהחבורה');
  }

  // ══════════════════════════════════════════════════════════════
  // Mivtza Applications (publication contribution requests)
  // ══════════════════════════════════════════════════════════════

  async addMivtzaApplication(mivtzaId: string, statement: string): Promise<{ id: string; status: string }> {
    const res = await this.authFetch(`/api/chaburot/${mivtzaId}/applications`, {
      method: 'POST',
      body: JSON.stringify({ statement }),
    });
    if (!res.ok) { const msg = await res.text(); toast.error(msg); throw new Error(msg); }
    toast.success('הבקשה נשלחה — ממתין לאישור המשפיע');
    return res.json();
  }

  // ══════════════════════════════════════════════════════════════
  // Peer Reviews
  // ══════════════════════════════════════════════════════════════

  async addPeerReview(data: Omit<PeerReview, 'id' | 'createdAt'>): Promise<PeerReview> {
    if (USE_FIREBASE) {
      const res = await this.authFetch('/api/reviews', { method: 'POST', body: JSON.stringify(data) });
      if (!res.ok) { toast.error(await res.text()); throw new Error('addPeerReview failed'); }
      toast.success('ביקורת הוגשה בהצלחה');
      return res.json();
    }
    const id = this.nextId('review');
    const review: PeerReview = { ...data, id, createdAt: now() };
    this.peerReviews = [...this.peerReviews, review];
    const mIdx = this.masimot.findIndex(m => m.id === data.chibburId);
    if (mIdx >= 0) {
      const allReviews = this.getMasimaPeerReviews(data.chibburId);
      this.masimot[mIdx] = {
        ...this.masimot[mIdx],
        reviewCount: allReviews.length,
        averageRating: allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length,
        updatedAt: now(),
      };
    }
    if (data.tokensEarned > 0) this.awardTokens(data.reviewerId, data.tokensEarned);
    const rIdx = this.talmidim.findIndex(t => t.id === data.reviewerId);
    if (rIdx >= 0) this.talmidim[rIdx] = { ...this.talmidim[rIdx], peerReviewsGiven: this.talmidim[rIdx].peerReviewsGiven + 1 };
    const aIdx = this.talmidim.findIndex(t => t.id === data.authorId);
    if (aIdx >= 0) this.talmidim[aIdx] = { ...this.talmidim[aIdx], peerReviewsReceived: this.talmidim[aIdx].peerReviewsReceived + 1 };
    this.logActivity('peer_review_submitted', data.reviewerId, data.chibburId, this.getMasima(data.chibburId)?.shem ?? '', 'הגיש ביקורת עמיתים');
    toast.success('ביקורת הוגשה בהצלחה');
    return review;
  }

  async acknowledgePeerReview(id: string): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch(`/api/reviews/${id}/acknowledge`, { method: 'POST' });
      if (!res.ok) { toast.error(await res.text()); return; }
      return;
    }
    const idx = this.peerReviews.findIndex(r => r.id === id);
    if (idx < 0) return;
    this.peerReviews[idx] = { ...this.peerReviews[idx], status: 'acknowledged' };
    toast.success('הביקורת נלקחה בחשבון');
  }

  // ══════════════════════════════════════════════════════════════
  // Discussions
  // ══════════════════════════════════════════════════════════════

  async addDiscussion(data: Omit<Discussion, 'id' | 'createdAt'>): Promise<Discussion> {
    if (USE_FIREBASE) {
      const res = await this.authFetch('/api/discussions', { method: 'POST', body: JSON.stringify(data) });
      if (!res.ok) { toast.error(await res.text()); throw new Error('addDiscussion failed'); }
      toast.success('תגובה נוספה');
      return res.json();
    }
    const id = this.nextId('discussion');
    const disc: Discussion = { ...data, id, createdAt: now() };
    this.discussions = [...this.discussions, disc];
    if (data.tokensEarned > 0) this.awardTokens(data.authorId, data.tokensEarned);
    toast.success('תגובה נוספה');
    return disc;
  }

  // ══════════════════════════════════════════════════════════════
  // Treasury
  // ══════════════════════════════════════════════════════════════

  async addDonation(data: Omit<Donation, 'id' | 'createdAt'>): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch('/api/donations', { method: 'POST', body: JSON.stringify(data) });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success(`תרומה של $${data.amount} התקבלה`);
      return;
    }
    const id = this.nextId('donation');
    this.donations = [...this.donations, { ...data, id, createdAt: now() }];
    this.treasury = {
      ...this.treasury,
      totalDonated:    this.treasury.totalDonated + data.amount,
      totalTmimMinted: this.treasury.totalTmimMinted + data.tmimMinted,
      tmimCirculating: this.treasury.tmimCirculating + data.tmimMinted,
      currentBalance:  this.treasury.currentBalance + data.amount,
    };
    toast.success(`תרומה של $${data.amount} התקבלה`);
  }

  async redeemTmim(talmidId: string, amount: number): Promise<void> {
    if (USE_FIREBASE) {
      const res = await this.authFetch('/api/treasury/redeem', { method: 'POST', body: JSON.stringify({ talmidId, amount }) });
      if (!res.ok) { toast.error(await res.text()); return; }
      const data = await res.json();
      const usd = (amount * 0.10).toFixed(2);
      toast.success(
        `נפדו ${amount} שכר ($${usd}) ✓`,
        data.txUrl ? { label: 'צפה בעסקה על Base Sepolia ↗', href: data.txUrl } : undefined,
        5000,
      );
      return;
    }
    const tIdx = this.talmidim.findIndex(t => t.id === talmidId);
    if (tIdx < 0) { toast.error('חבר לא נמצא'); return; }
    const t = this.talmidim[tIdx];
    if (t.tokenBalance < amount) { toast.error('אין מספיק שכר'); return; }
    this.talmidim[tIdx] = { ...t, tokenBalance: t.tokenBalance - amount };
    this.treasury = {
      ...this.treasury,
      totalTmimRedeemed: this.treasury.totalTmimRedeemed + amount,
      tmimCirculating:   this.treasury.tmimCirculating - amount,
    };
    const usd = (amount * 0.10).toFixed(2);
    toast.success(`נפדו ${amount} שכר ($${usd})`);
  }

  // ══════════════════════════════════════════════════════════════
  // UI actions
  // ══════════════════════════════════════════════════════════════

  toggleSidebar(): void { this.sidebarCollapsed = !this.sidebarCollapsed; }

  switchUser(id: string): void { this.currentUserId = id; }

  // ══════════════════════════════════════════════════════════════
  // Auth — wallet connection (SIWE)
  // ══════════════════════════════════════════════════════════════

  async connectWallet(): Promise<string | null> {
    if (USE_FIREBASE && typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const { BrowserProvider } = await import('ethers');
        const { signInWithCustomToken } = await import('firebase/auth');
        const { auth } = await import('$lib/firebase');

        const provider = new BrowserProvider((window as any).ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        const walletAddress: string = accounts[0];

        // 1. Get nonce from server
        const nonceRes = await fetch('/api/auth/nonce', {
          method: 'POST',
          body: JSON.stringify({ walletAddress }),
          headers: { 'Content-Type': 'application/json' },
        });
        if (!nonceRes.ok) { toast.error('שגיאה בקבלת nonce'); return null; }
        const { nonce } = await nonceRes.json();

        // 2. Sign nonce with wallet
        const signer = await provider.getSigner();
        const signature = await signer.signMessage(nonce);

        // 3. Verify + get custom token
        const verifyRes = await fetch('/api/auth/verify', {
          method: 'POST',
          body: JSON.stringify({ walletAddress, signature }),
          headers: { 'Content-Type': 'application/json' },
        });
        if (!verifyRes.ok) { toast.error('אימות נכשל'); return null; }
        const { customToken } = await verifyRes.json();

        // 4. Sign in with Firebase custom token
        await signInWithCustomToken(auth, customToken);

        return walletAddress;
      } catch (e: any) {
        toast.error(e?.message ?? 'שגיאת חיבור חשבון');
        return null;
      }
    }

    // Mock wallet for dev (no Firebase or no MetaMask)
    const mockAddress = '0x' + Array.from(
      { length: 40 },
      () => Math.floor(Math.random() * 16).toString(16),
    ).join('');
    return mockAddress;
  }

  // ── Primary auth: email / Google ──────────────────────────────

  async signInWithGoogle(): Promise<boolean> {
    if (!USE_FIREBASE) { toast.error('Firebase לא מוגדר'); return false; }
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const { auth } = await import('$lib/firebase');
      await signInWithPopup(auth, new GoogleAuthProvider());
      return true;
    } catch (e: any) {
      if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
        toast.error(e?.message ?? 'שגיאת התחברות');
      }
      return false;
    }
  }

  async signInWithEmail(email: string, password: string): Promise<boolean> {
    if (!USE_FIREBASE) { toast.error('Firebase לא מוגדר'); return false; }
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth } = await import('$lib/firebase');
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (e: any) {
      toast.error(e?.code === 'auth/invalid-credential' ? 'אימייל או סיסמה שגויים' : (e?.message ?? 'שגיאת התחברות'));
      return false;
    }
  }

  async signUpWithEmail(email: string, password: string): Promise<boolean> {
    if (!USE_FIREBASE) { toast.error('Firebase לא מוגדר'); return false; }
    try {
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const { auth } = await import('$lib/firebase');
      await createUserWithEmailAndPassword(auth, email, password);
      return true;
    } catch (e: any) {
      if (e?.code === 'auth/email-already-in-use') {
        // Existing account — fall through to sign-in
        return this.signInWithEmail(email, password);
      }
      toast.error(e?.code === 'auth/weak-password' ? 'סיסמה חלשה מדי (לפחות 6 תווים)' : (e?.message ?? 'שגיאת הרשמה'));
      return false;
    }
  }

  /** Check whether the signed-in Firebase user already has a chaver doc (no side effects on new users). */
  async probeRegistration(): Promise<{ isNewUser: boolean } | null> {
    const res = await this.authFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ probe: true }),
    });
    if (!res.ok) { toast.error('שגיאה בבדיקת רישום'); return null; }
    const { isNewUser } = await res.json();
    if (!isNewUser) await this.finishRegistration();
    return { isNewUser };
  }

  /** Create (or fetch) the chaver doc for the signed-in user and refresh claims. */
  async register(profile: { shem?: string; makomId?: string; track?: LearningTrack; walletAddress?: string } = {}): Promise<boolean> {
    const res = await this.authFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
    if (!res.ok) { toast.error('שגיאה ברישום'); return false; }
    const { chaver, isNewUser } = await res.json();
    await this.finishRegistration(chaver.id);
    if (isNewUser) toast.success(`ברוך הבא, ${chaver.shem}! קיבלת 50 שכר כבונוס הצטרפות`);
    return true;
  }

  /** Force-refresh the ID token so freshly stamped claims (role/chaverId) land, then sync state. */
  private async finishRegistration(chaverId?: string): Promise<void> {
    const { auth } = await import('$lib/firebase');
    await auth.currentUser?.getIdToken(true);
    const idTokenResult = await auth.currentUser?.getIdTokenResult();
    this.currentRole = (idTokenResult?.claims.role as 'chaver' | 'mashpia' | 'admin') ?? 'chaver';
    this.currentUserId = chaverId ?? (idTokenResult?.claims.chaverId as string) ?? auth.currentUser?.uid ?? null;
    this.isAuthenticated = true;
  }

  /** Attach a verified wallet to the signed-in chaver (optional linked credential). */
  async linkWallet(): Promise<boolean> {
    if (!USE_FIREBASE || typeof window === 'undefined' || !(window as any).ethereum) {
      toast.error('לא נמצא ארנק בדפדפן');
      return false;
    }
    try {
      const { BrowserProvider } = await import('ethers');
      const provider = new BrowserProvider((window as any).ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const walletAddress: string = accounts[0];

      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        body: JSON.stringify({ walletAddress }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!nonceRes.ok) { toast.error('שגיאה בקבלת nonce'); return false; }
      const { nonce } = await nonceRes.json();

      const signer = await provider.getSigner();
      const signature = await signer.signMessage(nonce);

      const res = await this.authFetch('/api/auth/link-wallet', {
        method: 'POST',
        body: JSON.stringify({ walletAddress, signature }),
      });
      if (!res.ok) { toast.error(await res.text()); return false; }
      toast.success('הארנק קושר בהצלחה');
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? 'שגיאת קישור ארנק');
      return false;
    }
  }

  async signUp(shem: string, walletAddress: string, makomId: string, track: LearningTrack): Promise<void> {
    if (USE_FIREBASE) {
      // Single registration path (email/Google/wallet alike): creates the
      // chaver doc and stamps role/chaverId claims server-side.
      await this.register({
        shem, makomId, track,
        walletAddress: walletAddress ? walletAddress.toLowerCase() : undefined,
      });
      return;
    }

    // In-memory fallback
    const talmid = await this.addTalmid({
      shem, contribution_score: 0, track, makomId,
      walletAddress, tokenBalance: 50, totalTokensEarned: 50,
      peerReviewsGiven: 0, peerReviewsReceived: 0, papersPublished: 0,
      votingPower: 0, seifimCompleted: 0,
      chavrusaId: null, shiurGroupId: null, zalId: null, avatarUrl: null,
      nirashemAt: now(), isOnline: true,
    });
    this.currentUserId = talmid.id;
    this.isAuthenticated = true;
    const localMivtza = this.mivtzaot.find(m => m.locationId === makomId && m.status === 'active');
    if (localMivtza) await this.enrollInMivtza(talmid.id, localMivtza.id);
    toast.success(`ברוך הבא, ${shem}! קיבלת 50 שכר כבונוס הצטרפות`);
  }

  // ══════════════════════════════════════════════════════════════
  // Governance
  // ══════════════════════════════════════════════════════════════

  async castVote(proposalId: string, vote: 'for' | 'against' | 'abstain'): Promise<void> {
    if (!this.currentUser) { toast.error('יש להתחבר כדי להצביע'); return; }
    if (USE_FIREBASE) {
      // Resolve the on-chain proposal ID (stored in Firestore as onChainProposalId).
      const proposal = this.proposals.find(p => p.id === proposalId);
      if (!proposal) { toast.error('הצעה לא נמצאה'); return; }
      const onChainId = proposal.onChainProposalId ?? '0';

      // Step 1: fetch a fresh EIP-712 rank attestation bound to this proposal.
      const attRes = await this.authFetch('/api/governance/attestation', {
        method: 'POST',
        body: JSON.stringify({ proposalId: onChainId }),
      });
      if (!attRes.ok) { toast.error(await attRes.text()); return; }
      const attestation = await attRes.json();

      // Step 2: submit on-chain via MetaMask (C2).
      // support: 0=For, 1=Against, 2=Abstain (mirrors ChayoleiGovernance.castVote)
      const supportMap: Record<string, number> = { for: 0, against: 1, abstain: 2 };
      const support = supportMap[vote];
      let txHash: string | null = null;

      if (typeof window !== 'undefined' && (window as unknown as { ethereum?: unknown }).ethereum) {
        try {
          const { BrowserProvider, Contract } = await import('ethers');
          const provider = new BrowserProvider(
            (window as unknown as { ethereum: unknown }).ethereum as ConstructorParameters<typeof BrowserProvider>[0],
          );
          const signer = await provider.getSigner();
          const GOVERNANCE_ABI = [
            'function castVote(uint256 proposalId, uint8 support, tuple(address voter, uint8 rankIndex, uint256 proposalId, uint256 nonce, uint256 expiry, bytes signature) att) external',
          ];
          const gov = new Contract(
            import.meta.env.VITE_GOVERNANCE_ADDRESS as string,
            GOVERNANCE_ABI,
            signer,
          );
          const att = [
            attestation.voter,
            attestation.rankIndex,
            BigInt(attestation.proposalId),
            BigInt(attestation.nonce),
            attestation.expiry,
            attestation.signature,
          ];
          const tx = await gov.castVote(BigInt(onChainId), support, att);
          toast.info('ממתין לאישור הרשת…');
          const receipt = await tx.wait();
          txHash = receipt?.hash ?? tx.hash;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('denied')) {
            toast.error('ההצבעה בוטלה על ידי המשתמש');
            return;
          }
          // Log but continue — record vote in Firestore regardless so the UI
          // reflects the intent; the on-chain tx can be replayed later.
          console.warn('[castVote] on-chain tx failed, continuing with Firestore record:', e);
        }
      }

      // Step 3: record the vote in Firestore (attestation stored for audit trail).
      const res = await this.authFetch(`/api/governance/proposals/${proposalId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote, attestation, txHash }),
      });
      if (!res.ok) { toast.error(await res.text()); return; }
      const suffix = txHash ? ` · tx: ${txHash.slice(0, 10)}…` : '';
      toast.success(`הצבעתך נרשמה${suffix}`);
      return;
    }
    // In-memory: optimistic update
    const idx = this.proposals.findIndex(p => p.id === proposalId);
    if (idx < 0) { toast.error('הצעה לא נמצאה'); return; }
    const p = this.proposals[idx];
    const power = this.myVotingPower;
    const updated = { ...p, myVote: vote } as Proposal;
    if (vote === 'for')     updated.votesFor     = p.votesFor     + power;
    if (vote === 'against') updated.votesAgainst = p.votesAgainst + power;
    if (vote === 'abstain') updated.votesAbstain = p.votesAbstain + power;
    this.proposals[idx] = updated;
    const labels: Record<string, string> = { for: 'בעד', against: 'נגד', abstain: 'נמנע' };
    toast.success(`הצבעת ${labels[vote]} עם ${power} כוח הצבעה`);
  }

  async createProposal(data: Omit<Proposal, 'id' | 'proposer' | 'votesFor' | 'votesAgainst' | 'votesAbstain' | 'state' | 'executed' | 'quorumReached' | 'snapshotBlock' | 'myVote'>): Promise<void> {
    if (!this.currentUser) { toast.error('יש להתחבר'); return; }
    if (USE_FIREBASE) {
      const res = await this.authFetch('/api/governance/proposals', {
        method: 'POST',
        body: JSON.stringify({ ...data, proposer: this.currentUser.walletAddress }),
      });
      if (!res.ok) { toast.error(await res.text()); return; }
      toast.success('ההצעה הוגשה לאישור');
      return;
    }
    // In-memory
    const id = this.nextId('proposal');
    const proposal: Proposal = {
      ...data,
      id,
      proposer: this.currentUser.walletAddress ?? '0x0000',
      votesFor: 0, votesAgainst: 0, votesAbstain: 0,
      state: 'active',
      executed: false,
      quorumReached: false,
      snapshotBlock: 0,
      myVote: null,
    };
    this.proposals = [proposal, ...this.proposals];
    toast.success('הצעה הוגשה בהצלחה');
  }

  async signOut(): Promise<void> {
    if (USE_FIREBASE) {
      const { auth } = await import('$lib/firebase');
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    }
    this.isAuthenticated = false;
    this.currentUserId = null;
    this.currentRole = 'chaver';
    this.stopListeners();
  }
}

export const app = new AppStore();
