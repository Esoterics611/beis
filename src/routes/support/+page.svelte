<script lang="ts">
  import { href } from '$lib/utils/nav';
  import { app } from '$stores/app.svelte';

  // Publication campaign goals
  const campaigns = [
    {
      id: 'sefer-hamaamarim',
      title: 'ספר המאמרים תרס"ב',
      description: 'פרסום דיגיטלי ומודפס של מאמרי הרבי הרש"ב — מהדורה מדעית עם ביאורים ומפתחות.',
      goal: 50_000,
      raised: 0,      // will be populated from ledger data
    },
    {
      id: 'likutei-biurim',
      title: 'ליקוטי ביאורים',
      description: 'קובץ ביאורים על ספר התניא — נושאי כלים מחידושי תלמידינו בסדר לימוד יומי.',
      goal: 50_000,
      raised: 0,
    },
  ] as const;

  let ledger: { id: string; displayName: string; amount: number; currency: string; createdAt: string }[] = $state([]);
  let ledgerLoading = $state(true);
  let totalRaised = $derived(ledger.reduce((s, d) => s + d.amount, 0));

  $effect(() => {
    app.publicDonations()
      .then((rows: typeof ledger) => { ledger = rows; ledgerLoading = false; })
      .catch(() => { ledgerLoading = false; });
  });

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const pct = (raised: number, goal: number) => Math.min(100, Math.round((raised / goal) * 100));
</script>

<div class="page-container" style="max-width: 56rem; margin: 0 auto;">

  <!-- Hero -->
  <div class="text-center mb-12" style="padding: 3rem 1rem;">
    <div class="text-4xl mb-3">📖</div>
    <h1 class="text-3xl font-bold mb-3" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">
      תמכו בפרסום ספרי הקדש
    </h1>
    <p class="text-base max-w-2xl mx-auto" style="color: var(--color-text-secondary); line-height: 1.75;">
      Beis מתמסרים להפצת תורת חב"ד דרך פרסום ספרים מדעיים, מאגרי מקורות ותוכן דיגיטלי.
      כל תרומה מאפשרת לתלמידינו לחקור, לכתוב ולהנגיש תורה לעולם הרחב.
    </p>
    <a
      href={href(`/support/ledger`)}
      class="text-sm mt-4 inline-block"
      style="color: var(--color-accent-primary); text-decoration: underline;"
    >ראו את כל התורמים ←</a>
  </div>

  <!-- Campaign cards -->
  <div class="grid gap-6 mb-12" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
    {#each campaigns as c}
      {@const raised = ledger.filter(d => d.currency !== 'other').reduce((s, d) => s + d.amount, 0) / campaigns.length}
      {@const p = pct(raised, c.goal)}
      <div
        style="
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border-primary);
          border-radius: var(--radius-xl);
          padding: 1.5rem;
        "
      >
        <h2 class="text-lg font-bold mb-2" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">{c.title}</h2>
        <p class="text-sm mb-4" style="color: var(--color-text-secondary); line-height: 1.6;">{c.description}</p>

        <!-- Thermometer -->
        <div class="mb-3">
          <div class="flex justify-between text-xs mb-1" style="color: var(--color-text-tertiary);">
            <span>{fmt(raised)} גויס</span>
            <span>מטרה: {fmt(c.goal)}</span>
          </div>
          <div style="height: 8px; background: var(--color-bg-tertiary); border-radius: 4px; overflow: hidden;">
            <div
              style="
                height: 100%;
                width: {p}%;
                background-color: var(--color-accent-secondary);
                border-radius: 4px;
                transition: width 0.4s ease;
              "
            ></div>
          </div>
          <p class="text-xs mt-1" style="color: var(--color-text-tertiary);">{p}% מהמטרה</p>
        </div>
      </div>
    {/each}
  </div>

  <!-- How to give -->
  <div
    style="
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border-primary);
      border-radius: var(--radius-xl);
      padding: 2rem;
      margin-bottom: 2rem;
    "
  >
    <h2 class="text-xl font-bold mb-6 text-center" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">
      כיצד לתרום
    </h2>

    <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
      {#each [
        { icon: '💵', label: 'מזומן / צ׳ק', detail: 'בקשו פרטים בדוא"ל' },
        { icon: '⚡', label: 'Zelle', detail: 'ronnie.rendel@gmail.com' },
        { icon: '📱', label: 'Venmo', detail: '@chayolei-beis-dovid' },
        { icon: '🔷', label: 'USDC (Base)', detail: 'חשבון: בקשו כתובת' },
      ] as method}
        <div
          style="
            background: var(--color-bg-primary);
            border: 1px solid var(--color-border-secondary);
            border-radius: var(--radius-lg);
            padding: 1rem;
            text-align: center;
          "
        >
          <div class="text-2xl mb-1">{method.icon}</div>
          <div class="text-sm font-semibold mb-0.5" style="color: var(--color-text-primary);">{method.label}</div>
          <div class="text-xs" style="color: var(--color-text-tertiary);">{method.detail}</div>
        </div>
      {/each}
    </div>

    <p class="text-center text-sm mt-6" style="color: var(--color-text-tertiary);">
      לפרטים נוספים פנו אלינו בכתובת
      <a href="mailto:ronnie.rendel@gmail.com" style="color: var(--color-accent-primary);">ronnie.rendel@gmail.com</a>
    </p>
  </div>

  <!-- Legal disclaimer -->
  <div
    class="text-xs text-center"
    style="
      color: var(--color-text-tertiary);
      border-top: 1px solid var(--color-border-secondary);
      padding-top: 1.5rem;
      margin-top: 1.5rem;
      line-height: 1.6;
    "
  >
    <strong>הערה:</strong> Beis אינו ארגון עמותה הפטור ממס (501(c)(3)).
    תרומות אינן ניתנות לניכוי מס. אישור תרומה אינו מהווה קבלה לצרכי מס.
  </div>
</div>
