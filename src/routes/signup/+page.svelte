<script lang="ts">
  import { app } from '$stores/app.svelte';
  import { goto } from '$app/navigation';
  import RankInsignia from '$components/RankInsignia.svelte';
  import type { LearningTrack } from '$lib/types';

  // ── state ─────────────────────────────────────────────────────
  let step          = $state<'method' | 'profile'>('method');
  let authMethod    = $state<'google' | 'email' | 'wallet' | null>(null);
  let walletAddress = $state('');
  let email         = $state('');
  let password      = $state('');
  let shem          = $state('');
  let busy          = $state(false);
  let track         = $state<LearningTrack>('תמים');
  let submitting    = $state(false);

  // ── codename generator (wallet users) ─────────────────────────
  const TITLES  = ['חבר', 'תלמיד', 'בוחן', 'מעיין', 'מקשה', 'מחבר', 'בקי', 'חריף', 'שקדן', 'בעל-הוראה', 'בעל-עיון', 'משכיל'];
  const NAMES   = ['בן-דוד', 'בן-יואב', 'בן-גדעון', 'בן-שמשון', 'בן-כלב', 'בן-יהושע', 'בן-עקיבא', 'בן-פינחס', 'בן-עמרי', 'בן-אביעד', 'בן-נחשון', 'בן-אלעזר'];

  function walletCodename(addr: string): string {
    const hex = addr.replace('0x', '').toLowerCase();
    const b0  = parseInt(hex.slice(0, 2),  16) || 0;
    const b1  = parseInt(hex.slice(2, 4),  16) || 0;
    const suffix = hex.slice(-4).toUpperCase();
    return `${TITLES[b0 % TITLES.length]} ${NAMES[b1 % NAMES.length]} · ${suffix}`;
  }

  const tracks: { value: LearningTrack; label: string; desc: string; icon: string }[] = [
    { value: 'נגלה',   label: 'נגלה',   desc: 'גמרא, הלכה, פוסקים',       icon: '◈' },
    { value: 'חסידות', label: 'חסידות', desc: 'תניא, מאמרים, שיחות',      icon: '◆' },
    { value: 'תמים',   label: 'תמים',   desc: 'נגלה וחסידות — מסלול שלם', icon: '⬡' },
  ];

  // After a successful Firebase sign-in: existing chaverim go straight in,
  // new ones continue to the profile step.
  async function afterSignIn(defaultShem: string, method: 'google' | 'email' | 'wallet') {
    const probe = await app.probeRegistration();
    if (!probe) return;
    if (probe.isNewUser) {
      authMethod = method;
      shem = defaultShem;
      step = 'profile';
    } else {
      goto('/');
    }
  }

  async function handleGoogle() {
    busy = true;
    if (await app.signInWithGoogle()) {
      const { auth } = await import('$lib/firebase');
      await afterSignIn(auth.currentUser?.displayName ?? '', 'google');
    }
    busy = false;
  }

  async function handleEmail() {
    if (!email.trim() || !password) return;
    busy = true;
    if (await app.signUpWithEmail(email.trim(), password)) {
      await afterSignIn(email.trim().split('@')[0], 'email');
    }
    busy = false;
  }

  async function handleWallet() {
    busy = true;
    const addr = await app.connectWallet();
    if (addr) {
      walletAddress = addr;
      await afterSignIn(walletCodename(addr), 'wallet');
    }
    busy = false;
  }

  async function handleSignUp() {
    submitting = true;
    const makomId = app.mekomot[0]?.id ?? '';
    await app.signUp(shem.trim() || 'חבר', walletAddress, makomId, track);
    goto('/');
  }
</script>

<div class="fixed inset-0 overflow-y-auto flex items-center justify-center" style="background-color: var(--color-bg-primary);" dir="rtl">
  <!-- Parchment-page decorative rules -->
  <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
    <div class="absolute inset-x-0" style="top: 20%; border-top: 1px solid var(--color-border-secondary); opacity: 0.35;"></div>
    <div class="absolute inset-x-0" style="bottom: 20%; border-top: 1px solid var(--color-border-secondary); opacity: 0.35;"></div>
  </div>

  <div class="relative z-10 w-full max-w-md px-4 py-8">
    {#if step === 'method'}
      <!-- ═══ STEP 1: Sign in ═══ -->
      <div class="text-center space-y-6">
        <div class="flex justify-center">
          <RankInsignia score={5000} size="xl" />
        </div>

        <div class="space-y-3">
          <h1 class="text-3xl font-bold tracking-tight" style="color: var(--color-text-primary);">Beis</h1>
          <p class="text-sm leading-relaxed max-w-xs mx-auto" style="color: var(--color-text-secondary);">
            רשת לימוד תורני — חבורות, ביקורת עמיתים, וחיבורים מצטברים.<br/>
            התחבר כדי להצטרף.
          </p>
        </div>

        <div class="grid grid-cols-3 gap-3 text-center">
          {#each [
            { icon: '◈', label: 'חבורות מחקר', desc: 'כתיבה ופרסום' },
            { icon: '⬡', label: 'שכר ותמיכה', desc: 'הכרה אמיתית' },
            { icon: '◑', label: 'ביקורת עמיתים', desc: 'לימוד הדדי' },
          ] as f}
            <div class="rounded-xl border p-3 space-y-1" style="
              border-color: var(--color-border-primary);
              background-color: var(--color-bg-tertiary);
            ">
              <span class="text-lg block" style="color: var(--color-accent-secondary);">{f.icon}</span>
              <span class="text-[10px] font-medium block" style="color: var(--color-text-primary);">{f.label}</span>
              <span class="text-[9px] block" style="color: var(--color-text-secondary);">{f.desc}</span>
            </div>
          {/each}
        </div>

        <!-- Google -->
        <button onclick={handleGoogle} disabled={busy}
          class="w-full py-3.5 rounded-2xl text-base font-semibold border transition-colors disabled:opacity-50"
          style="
            border-color: var(--color-border-strong);
            background-color: var(--color-bg-secondary);
            color: var(--color-text-primary);
          ">
          <span class="flex items-center justify-center gap-3">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            המשך עם Google
          </span>
        </button>

        <!-- Divider -->
        <div class="flex items-center gap-3">
          <div class="flex-1 h-px" style="background-color: var(--color-border-primary);"></div>
          <span class="text-[10px] uppercase tracking-widest" style="color: var(--color-text-secondary);">או באימייל</span>
          <div class="flex-1 h-px" style="background-color: var(--color-border-primary);"></div>
        </div>

        <!-- Email -->
        <div class="space-y-2 text-right">
          <input type="email" bind:value={email} placeholder="אימייל" autocomplete="email" dir="ltr"
            class="w-full px-4 py-3 rounded-xl border text-sm"
            style="
              border-color: var(--color-border-primary);
              background-color: var(--color-bg-secondary);
              color: var(--color-text-primary);
            " />
          <input type="password" bind:value={password} placeholder="סיסמה" autocomplete="new-password" dir="ltr"
            class="w-full px-4 py-3 rounded-xl border text-sm"
            style="
              border-color: var(--color-border-primary);
              background-color: var(--color-bg-secondary);
              color: var(--color-text-primary);
            "
            onkeydown={(e) => { if (e.key === 'Enter') handleEmail(); }} />
          <button onclick={handleEmail} disabled={busy || !email.trim() || !password}
            class="w-full py-3.5 rounded-2xl text-base btn-primary disabled:opacity-50">
            {#if busy}
              <span class="flex items-center justify-center gap-2"><span class="animate-spin">◎</span> מתחבר...</span>
            {:else}
              המשך
            {/if}
          </button>
          <p class="text-[10px] text-center" style="color: var(--color-text-tertiary);">חשבון חדש ייווצר אוטומטית; אם כבר נרשמת — תחובר.</p>
        </div>

        <!-- Wallet (optional, secondary) -->
        <button onclick={handleWallet} disabled={busy}
          class="text-xs transition-colors disabled:opacity-50"
          style="color: var(--color-text-secondary);"
          onmouseenter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
          onmouseleave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}>
          ⬡ התחברות עם ארנק קריפטו (למתקדמים)
        </button>

        <button
          onclick={() => { step = 'profile'; authMethod = 'wallet'; walletAddress = '0xdev' + Math.random().toString(16).slice(2, 12); shem = walletCodename(walletAddress); }}
          class="block mx-auto text-[10px] transition-colors"
          style="color: var(--color-text-tertiary);"
          onmouseenter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          onmouseleave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
        >דלג (מצב פיתוח) →</button>
      </div>

    {:else}
      <!-- ═══ STEP 2: Profile ═══ -->
      <div class="rounded-2xl border p-8 space-y-6" style="
        border-color: var(--color-border-primary);
        background-color: var(--color-bg-secondary);
        box-shadow: var(--shadow-lg);
      ">

        <!-- Name -->
        <div class="text-center space-y-3">
          <div class="flex justify-center">
            <RankInsignia score={0} size="xl" />
          </div>
          <div class="space-y-2">
            <label for="signup-shem" class="text-[10px] uppercase tracking-widest block" style="color: var(--color-text-secondary);">שם הלימוד שלך</label>
            <input id="signup-shem" type="text" bind:value={shem} dir="rtl"
              class="w-full px-4 py-3 rounded-xl border text-center text-lg font-bold"
              style="
                border-color: var(--color-border-primary);
                background-color: var(--color-bg-tertiary);
                color: var(--color-accent-secondary);
              " />
            {#if authMethod === 'wallet' && walletAddress}
              <p class="text-[10px] font-mono" style="color: var(--color-text-tertiary);">{walletAddress.slice(0, 10)}...{walletAddress.slice(-6)}</p>
            {/if}
          </div>
        </div>

        <!-- Divider -->
        <div class="flex items-center gap-3">
          <div class="flex-1 h-px" style="background-color: var(--color-border-primary);"></div>
          <span class="text-[10px] uppercase tracking-widest" style="color: var(--color-text-secondary);">בחר מסלול</span>
          <div class="flex-1 h-px" style="background-color: var(--color-border-primary);"></div>
        </div>

        <!-- Track -->
        <div class="grid grid-cols-3 gap-2">
          {#each tracks as t}
            <button type="button" onclick={() => track = t.value}
              class="p-4 rounded-xl border text-center transition-all group"
              style="
                border-color: {track === t.value ? 'var(--color-accent-secondary)' : 'var(--color-border-primary)'};
                background-color: {track === t.value ? 'var(--color-accent-secondary-light)' : 'var(--color-bg-tertiary)'};
              "
              onmouseenter={(e) => {
                if (track !== t.value) {
                  e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                }
              }}
              onmouseleave={(e) => {
                if (track !== t.value) {
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                }
              }}>
              <span class="text-2xl block mb-2 group-hover:scale-110 transition-transform">{t.icon}</span>
              <span class="text-sm font-bold block" style="color: var(--color-text-primary);">{t.label}</span>
              <span class="text-[9px] mt-1 block leading-relaxed" style="color: var(--color-text-secondary);">{t.desc}</span>
            </button>
          {/each}
        </div>

        <!-- Enlistment bonus -->
        <div class="rounded-xl p-4 flex items-center justify-between" style="
          background-color: var(--color-bg-tertiary);
          border: 1px solid var(--color-border-primary);
        ">
          <div>
            <p class="text-xs" style="color: var(--color-text-secondary);">בונוס הצטרפות</p>
            <p class="text-lg font-bold font-mono" style="color: var(--color-accent-secondary);">50 שכר</p>
          </div>
          <div class="text-right">
            <p class="text-xs" style="color: var(--color-text-secondary);">תרומה</p>
            <p class="text-sm font-bold" style="color: var(--color-text-primary);">0</p>
          </div>
          <span class="text-3xl opacity-30">◈</span>
        </div>

        <!-- Submit -->
        <button onclick={handleSignUp} disabled={submitting || !shem.trim()}
          class="w-full py-4 rounded-xl text-base btn-primary disabled:opacity-50 disabled:cursor-wait">
          {#if submitting}
            <span class="flex items-center justify-center gap-2"><span class="animate-spin">◎</span> מצטרף...</span>
          {:else}
            הצטרף ל-Beis ←
          {/if}
        </button>

        <button onclick={() => step = 'method'}
          class="w-full text-center text-[10px] transition-colors"
          style="color: var(--color-text-secondary);"
          onmouseenter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
          onmouseleave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}>
          ← חזור
        </button>
      </div>
    {/if}
  </div>
</div>
