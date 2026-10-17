<script lang="ts">
  import { page } from '$app/stores';
  import { app } from '$stores/app.svelte';
  import { formatTmim, formatDeadline, formatMasimaType } from '$lib/utils/format';
  import ProgressBar from '$components/ProgressBar.svelte';
  import StatusBadge from '$components/StatusBadge.svelte';
  import TalmidAvatar from '$components/TalmidAvatar.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import PeerReviewCard from '$components/PeerReviewCard.svelte';
  import DiscussionThread from '$components/DiscussionThread.svelte';
  import ConfirmDialog from '$components/ConfirmDialog.svelte';
  import ChibburEditor from '$components/editor/ChibburEditor.svelte';

  let id = $derived($page.params.id ?? '');
  let masima = $derived(app.getMasima(id));
  let mivtza = $derived(masima ? app.getMivtza(masima.chaburahId) : null);
  let assignee = $derived(masima?.assigneeId ? app.getTalmid(masima.assigneeId) : null);
  let reviewer = $derived(masima?.reviewerId ? app.getTalmid(masima.reviewerId) : null);
  let tafkidim = $derived(masima ? app.getMasimaTafkidim(masima.id) : []);
  let peerReviews = $derived(masima ? app.getMasimaPeerReviews(masima.id) : []);
  let progress = $derived(masima ? app.getMasimaProgress(masima.id) : 0);
  let currentUser = $derived(app.currentUser);
  let isAssignee = $derived(masima?.assigneeId === currentUser?.id);
  let canEditDraft = $derived(
    !!masima && isAssignee && ['open', 'in_progress', 'revision_requested'].includes(masima.status)
  );

  // ── submit modal ───────────────────────────────────────────────
  let showSubmitModal = $state(false);
  let submitUrl = $state('');

  function handleSubmitMasima() {
    if (!masima) return;
    app.submitMasima(masima.id, submitUrl || undefined);
    showSubmitModal = false;
    submitUrl = '';
  }

  // ── revision notes modal ───────────────────────────────────────
  let showRevisionModal = $state(false);
  let revisionNotes = $state('');

  function handleRequestRevision() {
    if (!masima) return;
    app.requestRevisionMasima(masima.id, revisionNotes || undefined);
    showRevisionModal = false;
    revisionNotes = '';
  }

  // ── peer review form ───────────────────────────────────────────
  let showReviewForm = $state(false);
  let reviewRating = $state<1|2|3|4|5>(3);
  let reviewComments = $state('');
  let reviewSuggestions = $state<string[]>([]);
  let newSuggestion = $state('');

  function addSuggestion() {
    if (newSuggestion.trim()) {
      reviewSuggestions = [...reviewSuggestions, newSuggestion.trim()];
      newSuggestion = '';
    }
  }

  function removeSuggestion(idx: number) {
    reviewSuggestions = reviewSuggestions.filter((_, i) => i !== idx);
  }

  function handleSubmitReview() {
    if (!masima || !currentUser || !reviewComments.trim()) return;
    app.addPeerReview({
      chibburId: masima.id,
      reviewerId: currentUser.id,
      authorId: masima.assigneeId ?? '',
      rating: reviewRating,
      comments: reviewComments.trim(),
      suggestions: reviewSuggestions,
      status: 'submitted',
      tokensEarned: 15,
    });
    showReviewForm = false;
    reviewComments = '';
    reviewSuggestions = [];
    reviewRating = 3;
  }

  // ── assign ────────────────────────────────────────────────────
  let showAssignDropdown = $state(false);
  function closeAssign(e: MouseEvent) { if (showAssignDropdown) showAssignDropdown = false; }
  let canSelfAssign = $derived(
    masima && currentUser &&
    !masima.assigneeId &&
    (masima.status === 'open')
  );

  let canReview = $derived(
    masima && currentUser &&
    masima.assigneeId !== currentUser.id &&
    (masima.status === 'submitted' || masima.status === 'in_review')
  );

  // ── delete confirm ─────────────────────────────────────────────
  let showDeleteConfirm = $state(false);

  const tStatus: Record<string,string> = { todo:'○', in_progress:'◐', submitted:'◑', approved:'●', rejected:'✕' };
  const priColors: Record<string,string> = {
    low: 'var(--color-text-tertiary)',
    medium: 'var(--color-accent-primary)',
    high: 'var(--color-status-warning)',
    critical: 'var(--color-status-error)',
  };
</script>

{#if masima && mivtza}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="page-container space-y-6" onclick={closeAssign}>
  <!-- ניווט -->
  <div class="flex items-center gap-2 text-xs" style="color: var(--color-text-tertiary);">
    <a href="/chaburot" style="color: var(--color-text-tertiary); text-decoration: none;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-accent-secondary)'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}>חבורות</a>
    <span>/</span>
    <a href="/chaburot/{mivtza.id}" style="color: var(--color-text-tertiary); text-decoration: none;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-accent-secondary)'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}>{mivtza.shem}</a>
    <span>/</span>
    <span style="color: var(--color-text-primary);">{masima.shem}</span>
  </div>

  <!-- כרטיס ראשי -->
  <div
    class="p-6"
    style="
      border: 1px solid var(--color-border-primary);
      border-radius: var(--radius-xl);
      background-color: var(--color-bg-secondary);
    "
  >
    <div class="flex items-start justify-between gap-6 flex-wrap">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3 mb-2 flex-wrap">
          <h2 class="text-xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">{masima.shem}</h2>
          <StatusBadge status={masima.status} size="md" />
          <span class="badge" style="background-color: var(--color-bg-tertiary); color: var(--color-text-secondary);">{formatMasimaType(masima.type)}</span>
        </div>
        <p class="text-sm mb-4" style="color: var(--color-text-secondary);">{masima.description}</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-xs">
          <div>
            <span class="block mb-1" style="color: var(--color-text-tertiary);">חבורה</span>
            <a href="/chaburot/{mivtza.id}" style="color: var(--color-accent-secondary); text-decoration: none;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}>{mivtza.shem}</a>
          </div>
          <div>
            <span class="block mb-1" style="color: var(--color-text-tertiary);">חבר משויך</span>
            {#if assignee}
              <div class="flex items-center gap-1">
                <TalmidAvatar shem={assignee.shem} score={assignee.contribution_score} isOnline={assignee.isOnline} size="sm" />
                <a href="/anash/{assignee.id}" style="color: var(--color-text-primary); text-decoration: none;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-accent-secondary)'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; }}>{assignee.shem}</a>
              </div>
            {:else}
              <span style="color: var(--color-text-tertiary);">לא שוייך</span>
            {/if}
          </div>
          <div>
            <span class="block mb-1" style="color: var(--color-text-tertiary);">מבקר עמיתים</span>
            {#if reviewer}
              <a href="/anash/{reviewer.id}" style="color: var(--color-accent-primary); text-decoration: none;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}>{reviewer.shem}</a>
            {:else}
              <span style="color: var(--color-text-tertiary);">לא שוייך</span>
            {/if}
          </div>
          <div>
            <span class="block mb-1" style="color: var(--color-text-tertiary);">תקציב</span>
            <span class="font-mono font-semibold" style="color: var(--color-accent-secondary);">{formatTmim(masima.tokenAllocation)}</span>
          </div>
        </div>
        {#if masima.deadline}
          {@const dl = formatDeadline(masima.deadline)}
          <div class="flex items-center gap-2 text-xs mb-4" style="color: {dl.urgent ? 'var(--color-status-error)' : 'var(--color-text-tertiary)'};">
            <span>מועד סיום:</span><span>{dl.text}</span>
          </div>
        {/if}
        <div class="flex items-center gap-3">
          <span class="text-xs" style="color: var(--color-text-tertiary);">{tafkidim.filter(t=>t.status==='approved').length}/{tafkidim.length} שלבים</span>
          <div class="flex-1"><ProgressBar value={progress} color="primary" showLabel size="md" /></div>
        </div>
      </div>

      <!-- כפתורי פעולה -->
      <div class="flex flex-col gap-2 flex-shrink-0">
        {#if masima.status === 'open'}
          {#if isAssignee}
            <button
              onclick={() => app.startMasima(masima!.id)}
              class="px-4 py-2 text-sm font-medium transition-colors duration-150"
              style="background-color: rgba(27,79,114,0.1); border: 1px solid rgba(27,79,114,0.3); border-radius: var(--radius-md); color: var(--color-accent-primary); cursor: pointer;"
            >התחל עבודה</button>
          {/if}
        {:else if masima.status === 'in_progress'}
          {#if isAssignee}
            <button
              onclick={() => showSubmitModal = true}
              class="px-4 py-2 text-sm font-medium transition-colors duration-150"
              style="background-color: rgba(124,58,237,0.1); border: 1px solid rgba(124,58,237,0.3); border-radius: var(--radius-md); color: #7c3aed; cursor: pointer;"
            >הגש למשפיע</button>
          {/if}
        {:else if masima.status === 'submitted'}
          {#if app.isMashpia}
            <button
              onclick={() => app.startReviewMasima(masima!.id)}
              class="px-4 py-2 text-sm font-medium transition-colors duration-150"
              style="background-color: rgba(27,79,114,0.1); border: 1px solid rgba(27,79,114,0.3); border-radius: var(--radius-md); color: var(--color-accent-primary); cursor: pointer;"
            >התחל ביקורת</button>
          {/if}
        {:else if masima.status === 'revision_requested'}
          <div
            class="px-4 py-2 text-sm text-center"
            style="background-color: rgba(146,64,14,0.08); border: 1px solid rgba(146,64,14,0.3); border-radius: var(--radius-md); color: var(--color-status-warning);"
          >↺ נדרש תיקון</div>
          {#if isAssignee}
            <button
              onclick={() => showSubmitModal = true}
              class="px-4 py-2 text-sm font-medium transition-colors duration-150"
              style="background-color: rgba(27,79,114,0.1); border: 1px solid rgba(27,79,114,0.3); border-radius: var(--radius-md); color: var(--color-accent-primary); cursor: pointer;"
            >הגש מחדש</button>
          {/if}
        {:else if masima.status === 'in_review'}
          {#if app.isMashpia}
            <button
              onclick={() => app.approveMasima(masima!.id)}
              class="px-4 py-2 text-sm font-medium transition-colors duration-150"
              style="background-color: rgba(30,111,80,0.1); border: 1px solid rgba(30,111,80,0.3); border-radius: var(--radius-md); color: var(--color-status-success); cursor: pointer;"
            >אשר ✓</button>
            <button
              onclick={() => showRevisionModal = true}
              class="px-4 py-2 text-sm font-medium transition-colors duration-150"
              style="background-color: rgba(146,64,14,0.1); border: 1px solid rgba(146,64,14,0.3); border-radius: var(--radius-md); color: var(--color-status-warning); cursor: pointer;"
            >בקש תיקון</button>
          {/if}
        {:else if masima.status === 'approved'}
          <div
            class="px-4 py-2 text-sm text-center"
            style="background-color: rgba(30,111,80,0.08); border: 1px solid rgba(30,111,80,0.3); border-radius: var(--radius-md); color: var(--color-status-success);"
          >● אושר</div>
          {#if app.isMashpia}
            <button
              onclick={() => app.publishMasima(masima!.id)}
              class="px-4 py-2 text-sm font-medium transition-colors duration-150"
              style="background-color: rgba(125,108,63,0.1); border: 1px solid rgba(125,108,63,0.3); border-radius: var(--radius-md); color: var(--color-accent-secondary); cursor: pointer;"
            >✦ פרסם</button>
          {/if}
        {:else if masima.status === 'published'}
          <div
            class="px-4 py-2 text-sm text-center"
            style="background-color: rgba(125,108,63,0.08); border: 1px solid rgba(125,108,63,0.3); border-radius: var(--radius-md); color: var(--color-accent-secondary);"
          >✦ פורסם</div>
        {/if}

        {#if canSelfAssign}
          <button
            onclick={() => app.assignMasima(masima!.id, currentUser!.id)}
            class="px-4 py-2 text-sm font-medium transition-colors duration-150"
            style="background-color: rgba(125,108,63,0.1); border: 1px solid rgba(125,108,63,0.3); border-radius: var(--radius-md); color: var(--color-accent-secondary); cursor: pointer;"
          >⬡ שייך אותי</button>
        {/if}

        {#if app.isMashpia && masima.status === 'open'}
          <div class="relative">
            <button
              onclick={(e) => { e.stopPropagation(); showAssignDropdown = !showAssignDropdown; }}
              class="w-full px-4 py-2 text-xs text-right transition-colors duration-150"
              style="
                background-color: var(--color-bg-tertiary);
                border: 1px solid var(--color-border-primary);
                border-radius: var(--radius-md);
                color: var(--color-text-secondary);
                cursor: pointer;
              "
            >{masima.assigneeId ? '↺ שנה שיוך' : '+ שייך חבר'}</button>
            {#if showAssignDropdown}
              <div
                class="absolute left-0 top-full mt-1 w-48 z-10 overflow-hidden"
                style="
                  border: 1px solid var(--color-border-primary);
                  border-radius: var(--radius-xl);
                  background-color: var(--color-bg-secondary);
                  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                "
              >
                {#each app.talmidim as t}
                  <button
                    onclick={() => { app.assignMasima(masima!.id, t.id); showAssignDropdown = false; }}
                    class="w-full px-3 py-2 text-right text-sm flex items-center justify-between gap-2 transition-colors duration-100"
                    style="background: none; border: none; cursor: pointer; color: var(--color-text-primary);"
                    onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                    onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <span>{t.shem}</span>
                    {#if t.id === masima.assigneeId}<span class="text-xs" style="color: var(--color-accent-secondary);">✓</span>{/if}
                  </button>
                {/each}
                <div style="border-top: 1px solid var(--color-border-primary);" class="px-3 py-1">
                  <p class="text-[10px] uppercase tracking-wide py-1" style="color: var(--color-text-tertiary);">מבקר עמיתים</p>
                </div>
                {#each app.talmidim.filter(t => t.id !== masima.assigneeId) as t}
                  <button
                    onclick={() => { app.assignMasima(masima!.id, t.id, 'reviewer'); showAssignDropdown = false; }}
                    class="w-full px-3 py-2 text-right text-sm flex items-center justify-between gap-2 transition-colors duration-100"
                    style="background: none; border: none; cursor: pointer; color: var(--color-text-tertiary);"
                    onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-accent-primary)'; }}
                    onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}
                  >
                    <span>{t.shem}</span>
                    {#if t.id === masima.reviewerId}<span class="text-xs" style="color: var(--color-accent-primary);">✓</span>{/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        {#if app.isMashpia && (masima.status === 'open' || masima.status === 'in_progress')}
          <button
            onclick={() => showDeleteConfirm = true}
            class="px-4 py-2 text-xs transition-colors duration-150"
            style="background-color: rgba(185,28,28,0.08); border: 1px solid rgba(185,28,28,0.2); border-radius: var(--radius-md); color: var(--color-status-error); cursor: pointer;"
          >מחק</button>
        {/if}
      </div>
    </div>

    <!-- הגשה -->
    {#if masima.contentUrl}
      <div class="mt-4 p-3" style="background-color: rgba(27,79,114,0.06); border: 1px solid rgba(27,79,114,0.2); border-radius: var(--radius-md);">
        <p class="text-xs font-medium mb-1" style="color: var(--color-accent-primary);">קישור לתוכן:</p>
        <a href={masima.contentUrl} class="text-sm" style="color: var(--color-accent-primary);" target="_blank" rel="noopener">{masima.contentUrl}</a>
      </div>
    {/if}
    {#if masima.submissionNotes}
      <div class="mt-3 p-3" style="background-color: rgba(124,58,237,0.06); border: 1px solid rgba(124,58,237,0.2); border-radius: var(--radius-md);">
        <p class="text-xs font-medium mb-1" style="color: #7c3aed;">הערות הגשה:</p>
        <p class="text-sm" style="color: var(--color-text-primary);">{masima.submissionNotes}</p>
      </div>
    {/if}
  </div>

  <!-- כתיבה — טיוטת החיבור -->
  {#if canEditDraft || masima.draftContent}
    <div>
      <div class="flex items-center justify-between mb-3 px-1">
        <h3 class="text-xs uppercase tracking-wider" style="color: var(--color-text-tertiary);">
          {canEditDraft ? 'כתיבה' : 'טיוטה'}
        </h3>
        {#if masima.draftUpdatedAt}
          <span class="text-[10px]" style="color: var(--color-text-tertiary);">
            עודכן {new Date(masima.draftUpdatedAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        {/if}
      </div>
      {#key masima.id}
        <ChibburEditor
          initialContent={masima.draftContent ?? null}
          editable={canEditDraft}
          onSave={(content, wc) => app.saveDraft(id, content, wc)}
        />
      {/key}
    </div>
  {/if}

  <!-- שלבים -->
  <div>
    <div class="flex items-center justify-between mb-3 px-1">
      <h3 class="text-xs uppercase tracking-wider" style="color: var(--color-text-tertiary);">שלבים ({tafkidim.length})</h3>
      {#if app.isMashpia}
        <a
          href="/seifim/new?chibburId={masima.id}"
          class="text-xs transition-colors duration-150"
          style="color: var(--color-accent-secondary); text-decoration: none;"
          onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
          onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
        >+ שלב חדש</a>
      {/if}
    </div>
    <div
      style="
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        background-color: var(--color-bg-secondary);
        overflow: hidden;
      "
    >
      {#each tafkidim as t}
        {@const a = t.assigneeId ? app.getTalmid(t.assigneeId) : null}
        {@const dl = t.deadline ? formatDeadline(t.deadline) : null}
        <div class="flex items-center gap-4 px-6 py-4" style="border-bottom: 1px solid var(--color-border-secondary);">
          <div class="w-1.5 h-8 rounded-full flex-shrink-0" style="background-color: {priColors[t.priority] ?? 'var(--color-text-tertiary)'};"></div>
          <span class="w-5 text-center flex-shrink-0" style="color: var(--color-text-tertiary);">{tStatus[t.status] ?? '○'}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium" style="color: var(--color-text-primary);">{t.shem}</p>
            <p class="text-xs" style="color: var(--color-text-tertiary);">{t.description}</p>
          </div>
          {#if a}
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <TalmidAvatar shem={a.shem} score={a.contribution_score} isOnline={a.isOnline} size="sm" />
              <span class="text-xs" style="color: var(--color-text-secondary);">{a.shem}</span>
            </div>
          {/if}
          <StatusBadge status={t.status} />
          <span class="text-xs font-mono font-semibold flex-shrink-0" style="color: var(--color-accent-secondary);">{formatTmim(t.tokenReward)}</span>
          {#if dl}
            <span class="text-[10px] flex-shrink-0" style="color: {dl.urgent ? 'var(--color-status-error)' : 'var(--color-text-tertiary)'};">{dl.text}</span>
          {/if}
          {#if t.status === 'todo' && t.assigneeId === currentUser?.id}
            <button
              onclick={() => app.startTafkid(t.id)}
              class="px-3 py-1 text-xs flex-shrink-0 transition-colors duration-150"
              style="background-color: rgba(27,79,114,0.1); border: 1px solid rgba(27,79,114,0.3); border-radius: var(--radius-sm); color: var(--color-accent-primary); cursor: pointer;"
            >התחל</button>
          {:else if t.status === 'in_progress' && t.assigneeId === currentUser?.id}
            <button
              onclick={() => app.submitTafkid(t.id)}
              class="px-3 py-1 text-xs flex-shrink-0 transition-colors duration-150"
              style="background-color: rgba(124,58,237,0.1); border: 1px solid rgba(124,58,237,0.3); border-radius: var(--radius-sm); color: #7c3aed; cursor: pointer;"
            >הגש</button>
          {:else if t.status === 'submitted' && app.isMashpia}
            <button
              onclick={() => app.approveTafkid(t.id)}
              class="px-3 py-1 text-xs flex-shrink-0 transition-colors duration-150"
              style="background-color: rgba(30,111,80,0.1); border: 1px solid rgba(30,111,80,0.3); border-radius: var(--radius-sm); color: var(--color-status-success); cursor: pointer;"
            >אשר</button>
          {/if}
        </div>
      {:else}
        <EmptyState icon="▸" title="אין שלבים בחיבור זו" />
      {/each}
    </div>
  </div>

  <!-- ביקורות עמיתים -->
  <div>
    <div class="flex items-center justify-between mb-3 px-1">
      <h3 class="text-xs uppercase tracking-wider" style="color: var(--color-text-tertiary);">
        ביקורות עמיתים ({peerReviews.length})
        {#if masima.averageRating}
          <span class="mr-2 font-semibold" style="color: var(--color-accent-secondary);">★ {masima.averageRating.toFixed(1)}</span>
        {/if}
      </h3>
    </div>
    {#if canReview}
      <div class="mb-4">
        {#if !showReviewForm}
          <button
            onclick={() => showReviewForm = true}
            class="px-4 py-2 text-sm font-medium transition-colors duration-150"
            style="background-color: rgba(124,58,237,0.1); border: 1px solid rgba(124,58,237,0.3); border-radius: var(--radius-md); color: #7c3aed; cursor: pointer;"
          >+ הוסף ביקורת</button>
        {:else}
          <div
            class="p-5 space-y-4"
            style="border: 1px solid rgba(124,58,237,0.3); border-radius: var(--radius-xl); background-color: var(--color-bg-secondary);"
          >
            <h4 class="text-sm font-semibold" style="color: var(--color-text-primary);">ביקורת עמיתים חדשה</h4>
            <!-- דירוג -->
            <div class="space-y-1.5">
              <span class="text-xs" style="color: var(--color-text-tertiary);">דירוג</span>
              <div class="flex gap-1">
                {#each [1,2,3,4,5] as star}
                  <button
                    type="button"
                    onclick={() => reviewRating = star as 1|2|3|4|5}
                    class="text-xl transition-colors"
                    style="color: {star <= reviewRating ? 'var(--color-accent-secondary)' : 'var(--color-border-primary)'}; background: none; border: none; cursor: pointer;"
                  >★</button>
                {/each}
              </div>
            </div>
            <!-- הערות -->
            <div class="space-y-1.5">
              <label class="text-xs" style="color: var(--color-text-tertiary);" for="review-comments">הערות</label>
              <textarea
                id="review-comments"
                rows="3"
                bind:value={reviewComments}
                style="
                  width: 100%;
                  padding: 0.625rem 1rem;
                  border: 1px solid var(--color-border-primary);
                  border-radius: var(--radius-md);
                  background-color: var(--color-bg-primary);
                  color: var(--color-text-primary);
                  font-size: 0.875rem;
                  font-family: var(--font-hebrew);
                  outline: none;
                  resize: none;
                "
                placeholder="כתוב הערות על העבודה..."
                dir="rtl"
              ></textarea>
            </div>
            <!-- הצעות -->
            <div class="space-y-1.5">
              <span class="text-xs" style="color: var(--color-text-tertiary);">הצעות לשיפור</span>
              {#each reviewSuggestions as s, i}
                <div class="flex items-center gap-2">
                  <span class="text-xs flex-1 px-3 py-1" style="background-color: var(--color-bg-tertiary); border-radius: var(--radius-sm); color: var(--color-text-primary);">{s}</span>
                  <button onclick={() => removeSuggestion(i)} class="text-xs" style="color: var(--color-status-error); background: none; border: none; cursor: pointer;">✕</button>
                </div>
              {/each}
              <div class="flex gap-2">
                <input
                  type="text"
                  bind:value={newSuggestion}
                  class="flex-1 px-3 py-1.5 text-xs"
                  style="border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); background-color: var(--color-bg-primary); color: var(--color-text-primary); outline: none;"
                  placeholder="הצעה..."
                  dir="rtl"
                  onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSuggestion(); }}}
                />
                <button
                  type="button"
                  onclick={addSuggestion}
                  class="px-3 py-1.5 text-xs transition-colors duration-100"
                  style="border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); color: var(--color-text-secondary); background: none; cursor: pointer;"
                >+</button>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                onclick={handleSubmitReview}
                disabled={!reviewComments.trim()}
                class="px-4 py-2 text-sm font-medium transition-colors duration-150"
                style="background-color: rgba(124,58,237,0.15); border: 1px solid rgba(124,58,237,0.4); border-radius: var(--radius-md); color: #7c3aed; cursor: pointer;"
              >שלח ביקורת</button>
              <button
                onclick={() => showReviewForm = false}
                class="px-4 py-2 text-sm transition-colors duration-150"
                style="border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); color: var(--color-text-secondary); background: none; cursor: pointer;"
              >ביטול</button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
    {#if peerReviews.length > 0}
      <div class="grid gap-4 md:grid-cols-2">
        {#each peerReviews as review}
          <PeerReviewCard {review} />
        {/each}
      </div>
    {:else if !canReview}
      <div
        class="p-6 text-center"
        style="border: 1px solid var(--color-border-primary); border-radius: var(--radius-xl); background-color: var(--color-bg-secondary);"
      >
        <p class="text-sm" style="color: var(--color-text-tertiary);">אין ביקורות עמיתים עדיין</p>
      </div>
    {/if}
  </div>

  <!-- דיון -->
  <div
    class="p-6"
    style="border: 1px solid var(--color-border-primary); border-radius: var(--radius-xl); background-color: var(--color-bg-secondary);"
  >
    <DiscussionThread masimaId={masima.id} />
  </div>
</div>
{:else}
  <div class="page-container">
    <EmptyState icon="⎇" title="חיבור לא נמצא" />
  </div>
{/if}

<!-- Submit Modal -->
{#if showSubmitModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[90] flex items-center justify-center p-4" dir="rtl">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick={() => showSubmitModal = false}></div>
    <div
      class="relative z-10 w-full max-w-md p-6 space-y-4"
      style="border: 1px solid var(--color-border-primary); border-radius: var(--radius-2xl); background-color: var(--color-bg-secondary); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);"
    >
      <h3 class="text-lg font-semibold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">הגשת חיבור</h3>
      {#if masima?.draftContent}
        <p class="text-xs" style="color: var(--color-text-secondary);">
          הטיוטה הנוכחית ({masima.draftWordCount?.toLocaleString() ?? '—'} מילים) תוגש לביקורת ותישמר כגרסה.
        </p>
      {/if}
      <div class="space-y-1.5">
        <label class="text-xs" style="color: var(--color-text-tertiary);" for="submit-url">קישור חיצוני (אופציונלי)</label>
        <input
          id="submit-url"
          type="url"
          bind:value={submitUrl}
          style="width: 100%; padding: 0.625rem 1rem; border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); background-color: var(--color-bg-primary); color: var(--color-text-primary); font-size: 0.875rem; outline: none;"
          placeholder="https://..."
          dir="ltr"
        />
      </div>
      <div class="flex gap-3 justify-end">
        <button
          onclick={() => showSubmitModal = false}
          class="px-4 py-2 text-sm transition-colors duration-150"
          style="border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); color: var(--color-text-secondary); background: none; cursor: pointer;"
        >ביטול</button>
        <button
          onclick={handleSubmitMasima}
          class="px-4 py-2 text-sm font-medium transition-colors duration-150"
          style="background-color: rgba(124,58,237,0.15); border: 1px solid rgba(124,58,237,0.4); border-radius: var(--radius-md); color: #7c3aed; cursor: pointer;"
        >הגש</button>
      </div>
    </div>
  </div>
{/if}

<!-- Revision Notes Modal -->
{#if showRevisionModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[90] flex items-center justify-center p-4" dir="rtl">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick={() => showRevisionModal = false}></div>
    <div
      class="relative z-10 w-full max-w-md p-6 space-y-4"
      style="border: 1px solid var(--color-border-primary); border-radius: var(--radius-2xl); background-color: var(--color-bg-secondary); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);"
    >
      <h3 class="text-lg font-semibold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">בקשת תיקון</h3>
      <div class="space-y-1.5">
        <label class="text-xs" style="color: var(--color-text-tertiary);" for="revision-notes">הערות לחבר</label>
        <textarea
          id="revision-notes"
          rows="3"
          bind:value={revisionNotes}
          style="width: 100%; padding: 0.625rem 1rem; border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); background-color: var(--color-bg-primary); color: var(--color-text-primary); font-size: 0.875rem; font-family: var(--font-hebrew); outline: none; resize: none;"
          placeholder="פרט מה נדרש לתקן..."
          dir="rtl"
        ></textarea>
      </div>
      <div class="flex gap-3 justify-end">
        <button
          onclick={() => showRevisionModal = false}
          class="px-4 py-2 text-sm transition-colors duration-150"
          style="border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); color: var(--color-text-secondary); background: none; cursor: pointer;"
        >ביטול</button>
        <button
          onclick={handleRequestRevision}
          class="px-4 py-2 text-sm font-medium transition-colors duration-150"
          style="background-color: rgba(146,64,14,0.15); border: 1px solid rgba(146,64,14,0.4); border-radius: var(--radius-md); color: var(--color-status-warning); cursor: pointer;"
        >שלח</button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirm -->
<ConfirmDialog
  open={showDeleteConfirm}
  title="מחיקת חיבור"
  message="האם למחוק את '{masima?.shem ?? ''}'? כל השלבים והביקורות יימחקו. פעולה זו אינה הפיכה."
  confirmLabel="מחק"
  destructive={true}
  onconfirm={() => { if (masima) { app.deleteMasima(masima.id); window.location.href = '/chibburim'; } }}
  oncancel={() => showDeleteConfirm = false}
/>
