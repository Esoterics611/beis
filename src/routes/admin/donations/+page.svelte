<script lang="ts">
  import { app } from '$stores/app.svelte';
  import { auth } from '$lib/firebase';

  const ADMIN_EMAIL = 'ronnie.rendel@gmail.com';
  let isAdmin = $derived(app.currentUser?.email === ADMIN_EMAIL);

  async function getToken(): Promise<string | null> {
    return (await auth.currentUser?.getIdToken()) ?? null;
  }

  // Form state
  let form = $state({
    donor:              '',
    amount:             0,
    currency:           'cash' as 'cash' | 'check' | 'zelle' | 'venmo' | 'usdc' | 'other',
    intent:             '',
    channel:            '',
    contactEmail:       '',
    notes:              '',
    attributionConsent: true,
  });

  let submitting = $state(false);
  let successMsg = $state('');
  let errorMsg   = $state('');

  // Ledger
  type Row = { id: string; displayName: string; amount: number; currency: string; intent: string | null; tmimMinted: number; txHash: string | null; createdAt: string };
  let rows = $state<Row[]>([]);
  let loading = $state(true);

  async function fetchLedger() {
    loading = true;
    const token = await getToken();
    const res = await fetch('/api/support/donations', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) rows = await res.json();
    loading = false;
  }

  $effect(() => { if (isAdmin) fetchLedger(); });

  async function submit() {
    if (!form.donor.trim() || form.amount <= 0) return;
    submitting = true;
    errorMsg = '';
    successMsg = '';
    try {
      const token = await getToken();
      const res = await fetch('/api/support/donations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message ?? res.statusText); }
      const result = await res.json();
      successMsg = `נרשם! ${result.tmimMinted} שכר הונפקו${result.txHash ? ` · tx: ${result.txHash.slice(0, 10)}…` : ''}`;
      form.donor = ''; form.amount = 0; form.intent = ''; form.notes = ''; form.contactEmail = '';
      await fetchLedger();
    } catch (e: unknown) {
      errorMsg = e instanceof Error ? e.message : 'שגיאה';
    } finally {
      submitting = false;
    }
  }

  async function acknowledge(id: string) {
    const token = await getToken();
    const res = await fetch(`/api/support/acknowledgment/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { alert('שגיאה בהפקת אישור'); return; }
    const { text } = await res.json();
    // Open in new window for copy/print
    const w = window.open('', '_blank');
    if (w) { w.document.write(`<pre dir="rtl" style="font-family:serif;white-space:pre-wrap;padding:2rem;">${text}</pre>`); w.document.close(); }
    await fetchLedger();
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('he-IL');
</script>

{#if !isAdmin}
  <div class="page-container flex items-center justify-center" style="min-height: 60vh;">
    <div class="text-center">
      <div class="text-3xl mb-3">🔒</div>
      <p style="color: var(--color-text-secondary);">גישה מוגבלת</p>
    </div>
  </div>
{:else}
  <div class="page-container">
    <h1 class="text-2xl font-bold mb-6" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">
      ניהול תרומות
    </h1>

    <!-- Log form -->
    <div
      class="max-w-xl mb-8 space-y-4"
      style="
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        padding: 1.5rem;
      "
    >
      <h2 class="text-base font-semibold" style="color: var(--color-text-primary);">רישום תרומה ידנית</h2>

      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2 space-y-1">
          <label class="text-xs font-semibold" style="color: var(--color-text-secondary);">שם תורם</label>
          <input
            type="text" bind:value={form.donor} dir="rtl"
            style="width:100%;background:var(--color-bg-primary);border:1px solid var(--color-border-primary);border-radius:var(--radius-md);padding:0.5rem 0.75rem;font-size:0.875rem;color:var(--color-text-primary);"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs font-semibold" style="color: var(--color-text-secondary);">סכום (USD)</label>
          <input
            type="number" bind:value={form.amount} min="0" step="1"
            style="width:100%;background:var(--color-bg-primary);border:1px solid var(--color-border-primary);border-radius:var(--radius-md);padding:0.5rem 0.75rem;font-size:0.875rem;color:var(--color-text-primary);"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs font-semibold" style="color: var(--color-text-secondary);">אמצעי תשלום</label>
          <select
            bind:value={form.currency}
            style="width:100%;background:var(--color-bg-primary);border:1px solid var(--color-border-primary);border-radius:var(--radius-md);padding:0.5rem 0.75rem;font-size:0.875rem;color:var(--color-text-primary);"
          >
            {#each (['cash','check','zelle','venmo','usdc','other'] as const) as c}
              <option value={c}>{c}</option>
            {/each}
          </select>
        </div>

        <div class="col-span-2 space-y-1">
          <label class="text-xs font-semibold" style="color: var(--color-text-secondary);">ייעוד (אופציונלי)</label>
          <input
            type="text" bind:value={form.intent} dir="rtl" placeholder="לדוגמה: ספר המאמרים"
            style="width:100%;background:var(--color-bg-primary);border:1px solid var(--color-border-primary);border-radius:var(--radius-md);padding:0.5rem 0.75rem;font-size:0.875rem;color:var(--color-text-primary);"
          />
        </div>

        <div class="col-span-2 space-y-1">
          <label class="text-xs font-semibold" style="color: var(--color-text-secondary);">דוא"ל (לאישור)</label>
          <input
            type="email" bind:value={form.contactEmail} dir="ltr"
            style="width:100%;background:var(--color-bg-primary);border:1px solid var(--color-border-primary);border-radius:var(--radius-md);padding:0.5rem 0.75rem;font-size:0.875rem;color:var(--color-text-primary);"
          />
        </div>

        <div class="col-span-2 space-y-1">
          <label class="text-xs font-semibold" style="color: var(--color-text-secondary);">הערות</label>
          <textarea
            bind:value={form.notes} dir="rtl" rows="2"
            style="width:100%;background:var(--color-bg-primary);border:1px solid var(--color-border-primary);border-radius:var(--radius-md);padding:0.5rem 0.75rem;font-size:0.875rem;color:var(--color-text-primary);resize:vertical;"
          ></textarea>
        </div>

        <div class="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="consent" bind:checked={form.attributionConsent} />
          <label for="consent" class="text-xs" style="color: var(--color-text-secondary);">
            התורם הסכים לפרסום שמו ברשימת התורמים
          </label>
        </div>
      </div>

      {#if successMsg}
        <p class="text-sm" style="color: var(--color-status-success);">{successMsg}</p>
      {/if}
      {#if errorMsg}
        <p class="text-sm" style="color: var(--color-status-error);">{errorMsg}</p>
      {/if}

      <div class="flex justify-end">
        <button
          onclick={submit}
          disabled={submitting || !form.donor.trim() || form.amount <= 0}
          class="px-5 py-2 text-sm font-semibold"
          style="
            background: var(--color-accent-primary);
            color: var(--color-text-inverse);
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            opacity: {submitting || !form.donor.trim() || form.amount <= 0 ? 0.5 : 1};
          "
        >{submitting ? 'שומר...' : 'רשום תרומה'}</button>
      </div>
    </div>

    <!-- Ledger table -->
    <h2 class="text-base font-semibold mb-3" style="color: var(--color-text-primary);">תרומות שהתקבלו</h2>

    {#if loading}
      <p style="color: var(--color-text-tertiary);">טוען...</p>
    {:else if rows.length === 0}
      <p style="color: var(--color-text-tertiary);">אין תרומות עדיין.</p>
    {:else}
      <div style="overflow-x:auto;border:1px solid var(--color-border-primary);border-radius:var(--radius-lg);background:var(--color-bg-secondary);">
        <table class="w-full text-sm" style="border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--color-border-primary);">
              {#each ['תאריך','שם','סכום','אמצעי','ייעוד','שכר','עסקה','פעולה'] as col}
                <th class="text-right px-4 py-3 text-xs font-semibold" style="color:var(--color-text-secondary);">{col}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each rows as r}
              <tr style="border-bottom:1px solid var(--color-border-secondary);">
                <td class="px-4 py-2.5 text-xs" style="color:var(--color-text-tertiary);">{fmtDate(r.createdAt)}</td>
                <td class="px-4 py-2.5 text-sm" style="color:var(--color-text-primary);">{r.displayName}</td>
                <td class="px-4 py-2.5 text-sm font-mono" style="color:var(--color-status-success);">{fmt(r.amount)}</td>
                <td class="px-4 py-2.5 text-xs" style="color:var(--color-text-secondary);">{r.currency}</td>
                <td class="px-4 py-2.5 text-xs" style="color:var(--color-text-tertiary);">{r.intent ?? '—'}</td>
                <td class="px-4 py-2.5 text-xs font-mono" style="color:var(--color-text-secondary);">{r.tmimMinted}</td>
                <td class="px-4 py-2.5 text-xs">
                  {#if r.txHash}
                    <a
                      href="https://sepolia.basescan.org/tx/{r.txHash}"
                      target="_blank"
                      rel="noopener"
                      style="color:var(--color-accent-primary);"
                    >{r.txHash.slice(0, 8)}…</a>
                  {:else}
                    <span style="color:var(--color-text-tertiary);">—</span>
                  {/if}
                </td>
                <td class="px-4 py-2.5">
                  <button
                    onclick={() => acknowledge(r.id)}
                    class="text-xs px-2 py-1"
                    style="
                      background: none;
                      border: 1px solid var(--color-border-primary);
                      border-radius: var(--radius-sm);
                      color: var(--color-text-secondary);
                      cursor: pointer;
                    "
                  >אישור</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
{/if}
