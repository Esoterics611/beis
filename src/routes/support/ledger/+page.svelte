<script lang="ts">
  type Row = {
    id: string;
    displayName: string;
    amount: number;
    currency: string;
    intent: string | null;
    tmimMinted: number;
    txHash: string | null;
    createdAt: string;
  };

  let rows = $state<Row[]>([]);
  let loading = $state(true);
  let totalRaised = $derived(rows.reduce((s, r) => s + r.amount, 0));
  let totalTmim   = $derived(rows.reduce((s, r) => s + r.tmimMinted, 0));

  $effect(() => {
    fetch('/api/support/donations')
      .then(r => r.json())
      .then((data: Row[]) => { rows = data; loading = false; })
      .catch(() => { loading = false; });
  });

  const fmtUSD  = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('he-IL');
</script>

<div class="page-container">
  <!-- Header -->
  <div class="mb-6">
    <a href="/support" class="text-sm" style="color: var(--color-accent-primary);">← חזרה לדף התמיכה</a>
    <h1 class="text-2xl font-bold mt-2" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">
      ספר התורמים
    </h1>
    <p class="text-sm mt-0.5" style="color: var(--color-text-secondary);">
      כל התרומות שהתקבלו לפרויקט פרסום ספרי הקדש
    </p>
  </div>

  <!-- Totals -->
  {#if !loading && rows.length > 0}
    <div class="grid grid-cols-2 gap-4 mb-6" style="max-width: 28rem;">
      <div
        style="
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border-primary);
          border-radius: var(--radius-lg);
          padding: 1rem;
          text-align: center;
        "
      >
        <div class="text-xl font-bold" style="color: var(--color-status-success);">{fmtUSD(totalRaised)}</div>
        <div class="text-xs mt-0.5" style="color: var(--color-text-tertiary);">סה"כ גויס</div>
      </div>
      <div
        style="
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border-primary);
          border-radius: var(--radius-lg);
          padding: 1rem;
          text-align: center;
        "
      >
        <div class="text-xl font-bold" style="color: var(--color-accent-primary);">{totalTmim.toLocaleString()}</div>
        <div class="text-xs mt-0.5" style="color: var(--color-text-tertiary);">שכר הונפקו</div>
      </div>
    </div>
  {/if}

  <!-- Table -->
  {#if loading}
    <p style="color: var(--color-text-tertiary);">טוען...</p>
  {:else if rows.length === 0}
    <p style="color: var(--color-text-tertiary);">אין תרומות עדיין. היו הראשונים לתרום!</p>
  {:else}
    <div style="overflow-x:auto;border:1px solid var(--color-border-primary);border-radius:var(--radius-lg);background:var(--color-bg-secondary);">
      <table class="w-full text-sm" style="border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid var(--color-border-primary);">
            {#each ['תאריך','שם','סכום','ייעוד','שכר','עסקה'] as col}
              <th class="text-right px-4 py-3 text-xs font-semibold" style="color:var(--color-text-secondary);">{col}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as r}
            <tr
              style="border-bottom:1px solid var(--color-border-secondary);"
              onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
              onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <td class="px-4 py-2.5 text-xs" style="color:var(--color-text-tertiary);">{fmtDate(r.createdAt)}</td>
              <td class="px-4 py-2.5" style="color:var(--color-text-primary);">{r.displayName}</td>
              <td class="px-4 py-2.5 font-mono font-semibold" style="color:var(--color-status-success);">{fmtUSD(r.amount)}</td>
              <td class="px-4 py-2.5 text-xs" style="color:var(--color-text-secondary);">{r.intent ?? '—'}</td>
              <td class="px-4 py-2.5 text-xs font-mono" style="color:var(--color-text-tertiary);">{r.tmimMinted}</td>
              <td class="px-4 py-2.5 text-xs">
                {#if r.txHash}
                  <a
                    href="https://sepolia.basescan.org/tx/{r.txHash}"
                    target="_blank"
                    rel="noopener"
                    style="color:var(--color-accent-primary); font-family:monospace;"
                  >{r.txHash.slice(0, 8)}…</a>
                {:else}
                  <span style="color:var(--color-text-tertiary);">—</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <p class="text-xs mt-6" style="color: var(--color-text-tertiary); line-height: 1.6;">
    שמות תורמים מוצגים בהסכמת התורם בלבד. שמות שאינם מאושרים מוצגים כ"אנונימי".
    שכר הם אסימוני ממשל פנימיים ואינם בעלי ערך פיננסי.
  </p>
</div>
