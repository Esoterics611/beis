<script lang="ts">
  import { href } from '$lib/utils/nav';
  import { app } from '$stores/app.svelte';
  import { formatTmim, formatDate } from '$lib/utils/format';
  import TokenDisplay from '$components/TokenDisplay.svelte';
  import TreasuryStatsCard from '$lib/components/TreasuryStatsCard.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let treasury      = $derived(app.treasury);
  let stats         = $derived(app.treasuryStats);
  let donations     = $derived([...app.donations].sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
  let streams       = $derived(app.paymentStreams.filter(s => !s.cancelled));

  let mivtzaAllocation = $derived(
    app.mivtzaot
      .filter(m => m.status !== 'archived' && m.tokensUsed > 0)
      .sort((a,b) => b.tokensUsed - a.tokensUsed)
  );
  let maxUsed = $derived(Math.max(...mivtzaAllocation.map(m => m.tokensUsed), 1));

  function tmimToUsd(amount: number): string {
    const rate = stats?.redemptionRate ?? 0.10;
    return `$${(amount * rate).toFixed(0)}`;
  }

  // ── Donation form ────────────────────────────────────────────
  let showDonateForm = $state(false);
  let donorName      = $state('');
  let donateAmount   = $state(100);
  let donateCurrency = $state<'ETH'|'USDC'>('USDC');
  let donateMessage  = $state('');

  function handleDonate() {
    if (!donorName.trim() || donateAmount < 1) return;
    const tmimMinted = donateAmount * 10;
    app.addDonation({
      donorName: donorName.trim(),
      donorWallet: '0x' + Math.random().toString(16).slice(2, 12),
      amount: donateAmount,
      tmimMinted,
      message: donateMessage.trim() || undefined,
    });
    showDonateForm = false;
    donorName = '';
    donateAmount = 100;
    donateMessage = '';
  }

  // ── Redemption calculator ────────────────────────────────────
  let redeemAmount   = $state(0);
  let redemptionRate = $derived(stats?.redemptionRate ?? 0.10);
  let usdcReceived   = $derived(redeemAmount * redemptionRate);
  let redeemEligible = $derived(
    !!app.currentUser &&
    app.currentUser.tokenBalance >= redeemAmount &&
    redeemAmount > 0
  );
</script>

<div class="page-container space-y-8">
  <!-- Page header -->
  <div>
    <h1 class="text-2xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">אוצר</h1>
    <p class="text-sm mt-0.5" style="color: var(--color-text-secondary);">ניהול הקרן הקהילתית — תרומות, שכר ופדיון</p>
  </div>

  <!-- Treasury stats (from Firebase treasury/global) -->
  {#if stats}
    <TreasuryStatsCard />
  {:else}
    <!-- Fallback to legacy treasury object -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {#each [
        { label: 'סה"כ תרומות', value: `$${treasury.totalDonated.toLocaleString()}`, color: 'var(--color-accent-secondary)' },
        { label: 'שכר הונפקו', value: formatTmim(treasury.totalTmimMinted), color: 'var(--color-accent-primary)' },
        { label: 'שכר במחזור', value: formatTmim(treasury.tmimCirculating), color: 'var(--color-accent-primary)' },
        { label: 'שכר נפדה', value: formatTmim(treasury.totalTmimRedeemed), color: 'var(--color-status-success)' },
      ] as stat}
        <div
          class="text-center space-y-1"
          style="
            background-color: var(--color-bg-secondary);
            border: 1px solid var(--color-border-primary);
            border-radius: var(--radius-lg);
            padding: 1.25rem;
          "
        >
          <div class="text-xl font-bold" style="color: {stat.color}; font-family: var(--font-mono);">{stat.value}</div>
          <div class="text-[11px]" style="color: var(--color-text-tertiary);">{stat.label}</div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Balance + allocation row -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Current balance -->
    <div
      class="space-y-4"
      style="
        background-color: var(--color-bg-secondary);
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        padding: 1.5rem;
      "
    >
      <h3 class="text-xs font-semibold uppercase tracking-widest" style="color: var(--color-text-secondary);">יתרת קופה</h3>
      <div class="flex items-center justify-between">
        <div>
          <span class="text-4xl font-bold" style="color: var(--color-accent-secondary); font-family: var(--font-mono);">${treasury.currentBalance.toLocaleString()}</span>
          <p class="text-xs mt-1" style="color: var(--color-text-tertiary);">זמין לחלוקה ופדיון</p>
        </div>
        <div class="text-right space-y-2 text-xs">
          <div>
            <span class="block" style="color: var(--color-text-tertiary);">חולק</span>
            <span class="font-mono font-semibold" style="color: var(--color-accent-primary);">{formatTmim(treasury.totalTmimDistributed)}</span>
          </div>
          <div>
            <span class="block" style="color: var(--color-text-tertiary);">נפדה</span>
            <span class="font-mono font-semibold" style="color: var(--color-status-success);">{formatTmim(treasury.totalTmimRedeemed)} ({tmimToUsd(treasury.totalTmimRedeemed)})</span>
          </div>
        </div>
      </div>

      <!-- Redemption rate callout -->
      <div class="callout space-y-1">
        <p class="text-xs font-semibold" style="color: var(--color-text-secondary);">שיעור פדיון נוכחי</p>
        <p class="text-sm font-mono font-bold" style="color: var(--color-accent-primary);">1 שכר = ${redemptionRate.toFixed(2)} USD</p>
        <p class="text-[10px]" style="color: var(--color-text-tertiary);">שיעור מינימלי — עשוי לעלות עם גדילת הקרן. משתנה ע"י הצבעת ממשל.</p>
      </div>

      <!-- Wallet -->
      <div
        style="
          background-color: var(--color-bg-tertiary);
          border: 1px solid var(--color-border-secondary);
          border-radius: var(--radius-md);
          padding: 0.75rem;
        "
      >
        <p class="text-xs font-semibold mb-1" style="color: var(--color-accent-secondary);">תמוך בBeis</p>
        <p class="text-[11px] font-mono break-all" style="color: var(--color-text-primary);">0x1234...5678 (ETH/USDC · Base Sepolia)</p>
        <p class="text-[10px] mt-1" style="color: var(--color-text-tertiary);">כל תרומה מנפיקה שכר לאוצר הרשת</p>
      </div>
    </div>

    <!-- Allocation by mivtza -->
    <div
      class="space-y-4"
      style="
        background-color: var(--color-bg-secondary);
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        padding: 1.5rem;
      "
    >
      <h3 class="text-xs font-semibold uppercase tracking-widest" style="color: var(--color-text-secondary);">חלוקת שכר לחבורות</h3>
      <div class="space-y-3">
        {#each mivtzaAllocation as mivtza}
          {@const pct = Math.round((mivtza.tokensUsed / maxUsed) * 100)}
          <div class="space-y-1">
            <div class="flex items-center justify-between text-xs">
              <a
                href={href(`/chaburot/${mivtza.id}`)}
                style="color: var(--color-text-primary); text-decoration: none;"
                onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-accent-secondary)'; }}
                onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; }}
              >{mivtza.shem}</a>
              <span class="font-mono font-semibold" style="color: var(--color-accent-secondary);">{formatTmim(mivtza.tokensUsed)}</span>
            </div>
            <div class="h-1.5 rounded-full overflow-hidden" style="background-color: var(--color-bg-tertiary);">
              <div class="h-full rounded-full transition-all" style="width: {pct}%; background-color: var(--color-accent-secondary);"></div>
            </div>
            <div class="flex justify-between text-[9px]" style="color: var(--color-text-tertiary);">
              <span>שומש: {formatTmim(mivtza.tokensUsed)}</span>
              <span>תקציב: {formatTmim(mivtza.tokenAllocation)}</span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Donate button / form -->
  {#if !showDonateForm}
    <button
      onclick={() => showDonateForm = true}
      class="w-full py-3 text-sm font-semibold transition-colors duration-150"
      style="
        border: 1px solid var(--color-accent-secondary);
        border-radius: var(--radius-lg);
        background-color: transparent;
        color: var(--color-accent-secondary);
        cursor: pointer;
      "
      onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.08)'; }}
      onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >+ תרום לאוצר</button>
  {:else}
    <div
      class="space-y-4"
      style="
        background-color: var(--color-bg-secondary);
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        padding: 1.5rem;
      "
    >
      <h3 class="text-sm font-semibold" style="color: var(--color-text-primary);">תרומה חדשה</h3>
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <label class="text-xs font-semibold" style="color: var(--color-text-secondary);" for="donor">שם התורם</label>
          <input id="donor" type="text" bind:value={donorName} dir="rtl"
            style="width: 100%; background-color: var(--color-bg-primary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); padding: 0.5rem 0.75rem; font-size: 0.875rem; color: var(--color-text-primary);" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold" style="color: var(--color-text-secondary);" for="donate-amount">סכום (USD)</label>
          <input id="donate-amount" type="number" bind:value={donateAmount} min="1"
            style="width: 100%; background-color: var(--color-bg-primary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); padding: 0.5rem 0.75rem; font-size: 0.875rem; color: var(--color-text-primary);" />
        </div>
      </div>
      <!-- Currency toggle -->
      <div class="flex gap-2">
        {#each (['USDC', 'ETH'] as const) as cur}
          <button
            onclick={() => donateCurrency = cur}
            class="flex-1 py-2 text-xs font-semibold transition-colors duration-150"
            style="
              border: 1px solid {donateCurrency === cur ? 'var(--color-accent-primary)' : 'var(--color-border-primary)'};
              border-radius: var(--radius-sm);
              background-color: {donateCurrency === cur ? 'rgba(27,79,114,0.08)' : 'transparent'};
              color: {donateCurrency === cur ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)'};
              cursor: pointer;
            "
          >{cur}</button>
        {/each}
      </div>
      <div class="space-y-1">
        <label class="text-xs font-semibold" style="color: var(--color-text-secondary);" for="donate-msg">הודעה (אופציונלי)</label>
        <input id="donate-msg" type="text" bind:value={donateMessage} dir="rtl"
          style="width: 100%; background-color: var(--color-bg-primary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); padding: 0.5rem 0.75rem; font-size: 0.875rem; color: var(--color-text-primary);" />
      </div>
      {#if donateAmount > 0}
        <p class="text-xs text-center" style="color: var(--color-text-tertiary);">
          תרומה של <span style="color: var(--color-accent-secondary); font-family: var(--font-mono);">${donateAmount}</span>
          תנפיק <span style="color: var(--color-accent-secondary); font-family: var(--font-mono);">{donateAmount * 10} שכר</span> לאוצר
        </p>
      {/if}
      <div class="flex gap-3 justify-end">
        <button
          onclick={() => showDonateForm = false}
          class="px-4 py-2 text-sm"
          style="background: none; border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); color: var(--color-text-secondary); cursor: pointer;"
        >ביטול</button>
        <button
          onclick={handleDonate}
          disabled={!donorName.trim() || donateAmount < 1}
          class="px-5 py-2 text-sm font-semibold"
          style="
            background-color: var(--color-accent-secondary);
            color: var(--color-text-inverse);
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            opacity: {!donorName.trim() || donateAmount < 1 ? 0.5 : 1};
          "
        >תרום</button>
      </div>
    </div>
  {/if}

  <!-- Redemption calculator -->
  <div
    class="space-y-4"
    style="
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border-primary);
      border-radius: var(--radius-xl);
      padding: 1.5rem;
    "
  >
    <h3 class="text-sm font-semibold" style="color: var(--color-text-primary);">פדיון שכר</h3>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
      <div class="space-y-1">
        <label class="text-xs font-semibold" style="color: var(--color-text-secondary);" for="redeem-amount">כמות שכר לפדיון</label>
        <input
          id="redeem-amount"
          type="number"
          bind:value={redeemAmount}
          min="0"
          max={app.currentUser?.tokenBalance ?? 0}
          style="width: 100%; background-color: var(--color-bg-primary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); padding: 0.5rem 0.75rem; font-size: 0.875rem; color: var(--color-text-primary);"
        />
        {#if app.currentUser}
          <span class="text-[11px]" style="color: var(--color-text-tertiary);">יתרה: {formatTmim(app.currentUser.tokenBalance)} שכר</span>
        {/if}
      </div>
      <div
        class="text-center py-4"
        style="
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-lg);
        "
      >
        <div class="text-2xl font-bold" style="color: var(--color-status-success); font-family: var(--font-mono);">
          ${usdcReceived.toFixed(2)}
        </div>
        <div class="text-xs mt-1" style="color: var(--color-text-tertiary);">USDC לקבלה</div>
      </div>
      <button
        onclick={() => app.currentUser && app.redeemTmim(app.currentUser.id, redeemAmount)}
        disabled={!redeemEligible}
        class="w-full py-2.5 text-sm font-semibold transition-colors duration-150"
        style="
          background-color: var(--color-status-success);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          opacity: {redeemEligible ? 1 : 0.4};
        "
      >פדה שכר</button>
    </div>
    {#if !app.currentUser}
      <p class="text-xs" style="color: var(--color-text-tertiary);">יש להתחבר כדי לפדות שכר</p>
    {/if}
  </div>

  <!-- Payment Streams -->
  {#if streams.length > 0}
    <div
      class="space-y-3"
      style="
        background-color: var(--color-bg-secondary);
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        padding: 1.5rem;
      "
    >
      <h3 class="text-sm font-semibold" style="color: var(--color-text-primary);">תשלומים זורמים</h3>
      <div class="space-y-3">
        {#each streams as stream}
          {@const recipient = stream.recipientChaver ?? app.talmidim.find(t => t.walletAddress === stream.recipient)}
          {@const elapsed = Math.max(0, new Date().getTime() - new Date(stream.startTime).getTime())}
          {@const total  = Math.max(1, new Date(stream.endTime).getTime() - new Date(stream.startTime).getTime())}
          {@const streamPct = Math.min(100, Math.round((elapsed / total) * 100))}
          <div
            class="space-y-2 p-4"
            style="
              background-color: var(--color-bg-tertiary);
              border-radius: var(--radius-lg);
              border: 1px solid var(--color-border-secondary);
            "
          >
            <div class="flex items-center justify-between text-xs">
              <span style="color: var(--color-text-primary); font-weight: 600;">
                {recipient ? recipient.shem : stream.recipient.slice(0,8) + '…'}
              </span>
              <span style="color: var(--color-accent-primary); font-family: var(--font-mono);">
                {formatTmim(stream.claimable)} שכר לתביעה
              </span>
            </div>
            <div class="h-1.5 rounded-full overflow-hidden" style="background-color: var(--color-bg-secondary);">
              <div class="h-full rounded-full transition-all" style="width: {streamPct}%; background-color: var(--color-accent-primary);"></div>
            </div>
            <div class="flex justify-between text-[11px]" style="color: var(--color-text-tertiary);">
              <span>תביע: {formatTmim(stream.claimedAmount)} / {formatTmim(stream.totalAmount)}</span>
              <span>{formatDate(stream.startTime)} → {formatDate(stream.endTime)}</span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Recent donations -->
  <div
    style="
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border-primary);
      border-radius: var(--radius-xl);
      overflow: hidden;
    "
  >
    <div class="px-5 py-3" style="border-bottom: 1px solid var(--color-border-primary);">
      <h3 class="text-sm font-semibold" style="color: var(--color-text-primary);">תרומות אחרונות</h3>
    </div>
    <div style="divide-y: 1px solid var(--color-border-secondary);">
      {#each donations as don}
        {@const mivtza = don.chaburahId ? app.getMivtza(don.chaburahId) : null}
        {@const makom  = don.makomId  ? app.getMakom(don.makomId)   : null}
        <div
          class="px-5 py-4 flex items-start gap-4"
          style="border-bottom: 1px solid var(--color-border-secondary);"
        >
          <div
            class="w-10 h-10 flex items-center justify-center flex-shrink-0"
            style="
              background-color: var(--color-bg-tertiary);
              border: 1px solid var(--color-border-primary);
              border-radius: var(--radius-md);
              color: var(--color-accent-secondary);
            "
          >{don.donorWallet ? '⬡' : '₪'}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5 flex-wrap">
              <span class="text-sm font-semibold" style="color: var(--color-text-primary);">{don.donorName}</span>
              {#if makom}
                <span class="badge" style="background-color: var(--color-bg-tertiary); color: var(--color-text-secondary);">→ {makom.shem}</span>
              {:else if mivtza}
                <span class="badge" style="background-color: rgba(125,108,63,0.1); color: var(--color-accent-secondary);">→ {mivtza.shem}</span>
              {:else}
                <span class="badge" style="background-color: var(--color-bg-tertiary); color: var(--color-text-tertiary);">קרן כללית</span>
              {/if}
            </div>
            {#if don.message}
              <p class="text-xs italic" style="color: var(--color-text-secondary);">{don.message}</p>
            {/if}
            <span class="text-[10px]" style="color: var(--color-text-tertiary);">{formatDate(don.createdAt)}</span>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-sm font-bold" style="color: var(--color-accent-secondary); font-family: var(--font-mono);">${don.amount.toLocaleString()}</div>
            <div class="text-[10px]" style="color: var(--color-text-tertiary);">{formatTmim(don.tmimMinted)} שכר</div>
          </div>
        </div>
      {:else}
        <div class="px-5 py-8 text-center text-sm" style="color: var(--color-text-tertiary);">אין תרומות עדיין</div>
      {/each}
    </div>
  </div>
</div>
