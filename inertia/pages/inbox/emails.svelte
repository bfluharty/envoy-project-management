<script lang="ts">
  import Sidebar from '#components/sidebar.svelte'
  import { page } from '@inertiajs/svelte'
  import { MailIcon, InboxIcon, SendIcon, ListIcon, LayoutGridIcon } from '@lucide/svelte'

  interface Message {
    uuid: string
    subject: string
    from: string
    to: string
    body: string
    sentAt: string
    messageId?: string
    references?: string
    threadId?: string
  }

  interface Conversation {
    uuid: string
    vendorName: string
    vendorEmail: string
    messages: Message[]
  }

  type EmailRow = { conv: Conversation; msg: Message }

  type ThreadListItem =
    | { type: 'thread'; conv: Conversation }
    | { type: 'message'; conv: Conversation; msg: Message }

  const { conversations = [], hasConnections = false, syncError = null } = $props()
  const flash = $derived($page.props.flash || {})

  const threads = $derived(
    [...conversations]
      .map((conv) => ({
        conv,
        messages: [...conv.messages].sort(
          (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
        ),
      }))
      .sort(
        (a, b) =>
          new Date((b.messages[b.messages.length - 1]?.sentAt ?? 0)).getTime() -
          new Date((a.messages[a.messages.length - 1]?.sentAt ?? 0)).getTime()
      )
  )

  const threadListItems = $derived(
    threads.flatMap(({ conv, messages }) => [
      { type: 'thread' as const, conv },
      ...messages.map((msg) => ({ type: 'message' as const, conv, msg })),
    ])
  )

  function threadSubject(conv: Conversation): string {
    const first = conv.messages[0]?.subject ?? ''
    return first.replace(/^(\s*Re:\s*)+/i, '').trim() || '(no subject)'
  }

  let viewMode = $state<'by_vendor' | 'all_emails'>('all_emails')
  let selectedEmail = $state<EmailRow | null>(null)
  let replyingToConvUuid = $state<string | null>(null)
  let replyingToMessageUuid = $state<string | null>(null)
  let replyBody = $state('')
  let replySubject = $state('')
  let replyToEmail = $state('')
  let sendLoading = $state(false)
  let apiError = $state<string | null>(null)

  function parseFromHeader(from: string): string {
    const match = from.match(/<([^>]+)>/)
    if (match) return match[1].trim().toLowerCase()
    return from.trim().toLowerCase()
  }

  function fromDisplayLabel(from: string): string {
    const trimmed = (from || '').trim()
    const angle = trimmed.indexOf('<')
    if (angle > 0) {
      const name = trimmed.slice(0, angle).replace(/^["']|["']$/g, '').trim()
      if (name) return name
    }
    return trimmed || '-'
  }

  function formatDate(iso: string) {
    try {
      const d = new Date(iso)
      return d.toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  function bodyPreview(body: string, maxLen = 200) {
    if (!body) return ''
    const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return text.length <= maxLen ? text : text.slice(0, maxLen) + '...'
  }

  function reSubject(subject: string) {
    const trimmed = (subject || '').trim()
    if (!trimmed) return 'Re: (no subject)'
    if (/^re:\s/i.test(trimmed)) return trimmed
    return `Re: ${trimmed}`
  }

  function openReplyForm(conv: Conversation, msg?: Message) {
    const target = msg ?? conv.messages[conv.messages.length - 1]
    replySubject = target ? reSubject(target.subject || '') : ''
    replyBody = ''
    replyingToConvUuid = conv.uuid
    replyingToMessageUuid = target?.uuid ?? null
    replyToEmail = target ? parseFromHeader(target.from) : conv.vendorEmail
    apiError = null
  }

  function closeReplyForm() {
    replyingToConvUuid = null
    replyingToMessageUuid = null
    replyBody = ''
    replySubject = ''
    replyToEmail = ''
    apiError = null
  }

  function selectEmail(row: EmailRow | null) {
    selectedEmail = row
    apiError = null
  }

  function buildReferences(msg: Message | undefined): string | undefined {
    if (!msg?.messageId) return undefined
    if (msg.references?.trim()) return `${msg.references.trim()} ${msg.messageId}`
    return msg.messageId
  }

  async function sendReply(conv: Conversation) {
    apiError = null
    sendLoading = true

    const replyingToMsg = replyingToMessageUuid
      ? conv.messages.find((message) => message.uuid === replyingToMessageUuid)
      : undefined
    const inReplyTo = replyingToMsg?.messageId
    const references = buildReferences(replyingToMsg)
    const threadId =
      replyingToMsg?.threadId ?? conv.messages.find((message) => message.threadId)?.threadId
    const payload = {
      vendorConversationUuid: conv.uuid,
      to: replyToEmail || conv.vendorEmail,
      subject: replySubject,
      body: replyBody,
      ...(inReplyTo && { inReplyTo }),
      ...(references && { references }),
      ...(threadId && { threadId }),
    }

    try {
      const res = await fetch('/api/inbox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        apiError = typeof data.error === 'string' ? data.error : 'Failed to send reply'
        return
      }
      closeReplyForm()
      window.location.reload()
    } finally {
      sendLoading = false
    }
  }
</script>

<svelte:head>
  <title>Inbox</title>
</svelte:head>

<Sidebar>
  <div class="w-full max-w-6xl p-6 space-y-6">
    <header class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-3xl font-bold flex items-center gap-2">
          <InboxIcon class="size-8" />
          Inbox
        </h1>
        <p class="text-surface-600-400 mt-1">
          Emails from contacts synced from your connected inbox. This page syncs automatically when
          you open it.
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm text-surface-600-400 mr-1">View:</span>
        <button
          type="button"
          class="btn preset-tonal btn-sm"
          class:preset-filled-primary={viewMode === 'all_emails'}
          onclick={() => {
            viewMode = 'all_emails'
            selectedEmail = null
          }}
        >
          <ListIcon class="size-4 inline mr-1" />
          All emails
        </button>
        <button
          type="button"
          class="btn preset-tonal btn-sm"
          class:preset-filled-primary={viewMode === 'by_vendor'}
          onclick={() => {
            viewMode = 'by_vendor'
            selectedEmail = null
          }}
        >
          <LayoutGridIcon class="size-4 inline mr-1" />
          By contact
        </button>
        <a href="/inbox/settings" class="btn preset-tonal btn-sm">Manage inbox</a>
      </div>
    </header>

    {#if syncError}
      <div class="alert preset-tonal-error p-4 rounded-lg">
        <span>
          Sync failed: {syncError}. Ensure the email service is running (for example
          <code class="text-sm bg-surface-200-800 px-1 rounded">sam local start-api</code>
          in `envoy-email-service`) and <code class="text-sm bg-surface-200-800 px-1 rounded"
            >EMAIL_SERVICE_URL</code
          > is set in `.env`.
        </span>
      </div>
    {/if}

    {#if flash.error}
      <div class="alert preset-tonal-error p-4 rounded-lg">
        <span>{flash.error}</span>
      </div>
    {/if}

    {#if flash.success}
      <div
        class="alert rounded-lg border border-success-500/20 bg-success-500/10 p-4 text-surface-950 dark:border-surface-200-800 dark:bg-surface-100-900/40 dark:text-surface-50"
      >
        <span>{flash.success}</span>
      </div>
    {/if}

    {#if conversations.length === 0}
      <div class="card preset-outlined-surface-200-800 p-8 text-center text-surface-600-400">
        <MailIcon class="size-12 mx-auto mb-3 opacity-50" />
        <p>No emails yet.</p>
        {#if !hasConnections}
          <p class="text-sm mt-1">
            Connect an inbox in <a href="/inbox/settings" class="link">Settings</a> first. When
            you open this page with an inbox connected, we call the email service to sync.
          </p>
        {:else}
          <p class="text-sm mt-1">
            We synced from the email service; only emails from senders that match a contact in your
            project are shown.
          </p>
        {/if}
      </div>
    {:else if viewMode === 'all_emails'}
      <div class="flex flex-col lg:flex-row gap-6">
        <div
          class="flex-1 min-w-0 overflow-auto rounded-xl border border-surface-200-800 bg-surface-100-900/40 overflow-hidden"
        >
          <table class="table w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-surface-200-800 bg-surface-200-800/30">
                <th
                  class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-surface-600-400"
                >
                  Contact
                </th>
                <th
                  class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-surface-600-400"
                >
                  Subject
                </th>
                <th
                  class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-surface-600-400 w-28"
                >
                  From
                </th>
                <th
                  class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-surface-600-400 shrink-0 w-36"
                >
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {#each threadListItems as item (item.type === 'thread' ? item.conv.uuid : item.conv.uuid + ':' + item.msg.uuid)}
                {#if item.type === 'thread'}
                  {@const latest = item.conv.messages.length
                    ? item.conv.messages.reduce(
                        (a, m) => (new Date(m.sentAt) > new Date(a.sentAt) ? m : a),
                        item.conv.messages[0]
                      )
                    : null}
                  <tr
                    class="border-b border-surface-200-800/80 cursor-pointer transition-colors bg-surface-100-900/50 hover:bg-surface-200-800/40 first:border-t-0"
                    onclick={() => latest && selectEmail({ conv: item.conv, msg: latest })}
                  >
                    <td class="px-4 py-3.5">
                      <div class="flex items-center gap-2">
                        <span
                          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-sm font-semibold text-primary-600"
                        >
                          {(item.conv.vendorName || 'V').charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <span class="font-semibold">{item.conv.vendorName}</span>
                          <span class="block text-xs text-surface-600-400">
                            {item.conv.vendorEmail}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3.5">
                      <span class="font-medium">{threadSubject(item.conv)}</span>
                      <span class="block text-sm text-surface-600-400 mt-0.5">
                        {item.conv.messages.length} message{item.conv.messages.length === 1
                          ? ''
                          : 's'}
                      </span>
                    </td>
                    <td class="px-4 py-3.5 text-sm text-surface-600-400 w-28">-</td>
                    <td class="px-4 py-3.5 text-sm text-surface-600-400 shrink-0 w-36">
                      {latest ? formatDate(latest.sentAt) : '-'}
                    </td>
                  </tr>
                {:else}
                  <tr
                    class="border-b border-surface-200-800/60 cursor-pointer transition-colors {selectedEmail?.conv.uuid === item.conv.uuid && selectedEmail?.msg.uuid === item.msg.uuid ? 'bg-primary-500/15 ring-inset ring-1 ring-primary-500/30' : 'hover:bg-surface-200-800/30'} bg-surface-100-900/30"
                    onclick={() =>
                      selectEmail(
                        selectedEmail?.conv.uuid === item.conv.uuid &&
                          selectedEmail?.msg.uuid === item.msg.uuid
                          ? null
                          : { conv: item.conv, msg: item.msg }
                      )}
                  >
                    <td
                      class="px-4 py-2.5 pl-12 border-l-2 border-surface-200-800/80"
                      aria-hidden="true"
                    />
                    <td class="px-4 py-2.5">
                      <span class="text-sm font-medium">{item.msg.subject || '(no subject)'}</span>
                      <span class="block text-xs text-surface-600-400 truncate max-w-[240px] mt-0.5">
                        {bodyPreview(item.msg.body, 70)}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 text-sm text-surface-600-400 w-28">
                      {fromDisplayLabel(item.msg.from)}
                    </td>
                    <td class="px-4 py-2.5 text-sm text-surface-600-400 shrink-0 w-36">
                      {formatDate(item.msg.sentAt)}
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>

        {#if selectedEmail}
          <aside class="w-full lg:w-[440px] shrink-0">
            <div class="card preset-outlined-surface-200-800 overflow-hidden sticky top-4 rounded-xl">
              <div class="p-5 border-b border-surface-200-800 bg-surface-100-900/80">
                <div class="flex items-start gap-3">
                  <span
                    class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-base font-semibold text-primary-600"
                  >
                    {(selectedEmail.conv.vendorName || 'V').charAt(0).toUpperCase()}
                  </span>
                  <div class="min-w-0 flex-1">
                    <h3 class="font-semibold text-lg">{selectedEmail.conv.vendorName}</h3>
                    <p class="text-sm text-surface-600-400">{selectedEmail.conv.vendorEmail}</p>
                    <p class="mt-2 font-medium">{selectedEmail.msg.subject || '(no subject)'}</p>
                    <div
                      class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-600-400"
                    >
                      <span>{formatDate(selectedEmail.msg.sentAt)}</span>
                      <span>&middot;</span>
                      <span>From: {fromDisplayLabel(selectedEmail.msg.from)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="p-5 max-h-80 overflow-y-auto bg-surface-200-800/20">
                <p class="text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {selectedEmail.msg.body || '(no body)'}
                </p>
              </div>

              <div class="p-5 border-t border-surface-200-800 space-y-3">
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="btn preset-filled-primary"
                    onclick={() => openReplyForm(selectedEmail.conv, selectedEmail.msg)}
                  >
                    <SendIcon class="size-4 inline mr-1" />
                    Write reply
                  </button>
                </div>

                {#if replyingToConvUuid === selectedEmail.conv.uuid && replyingToMessageUuid === selectedEmail.msg.uuid}
                  <div class="space-y-3 pt-2 border-t border-surface-200-800">
                    {#if apiError}
                      <p class="text-sm text-red-500">{apiError}</p>
                    {/if}

                    <div>
                      <label class="block text-sm font-medium mb-1">To</label>
                      <input
                        type="text"
                        class="input w-full bg-surface-200-800"
                        value={replyToEmail || selectedEmail.conv.vendorEmail}
                        readonly
                      />
                    </div>

                    <div>
                      <label class="block text-sm font-medium mb-1">Subject</label>
                      <input
                        type="text"
                        class="input w-full bg-surface-200-800"
                        bind:value={replySubject}
                      />
                    </div>

                    <div>
                      <label class="block text-sm font-medium mb-1">Message</label>
                      <textarea
                        class="input w-full bg-surface-200-800 min-h-[100px]"
                        bind:value={replyBody}
                        placeholder="Type your reply..."
                      />
                    </div>

                    <div class="flex gap-2">
                      <button
                        type="button"
                        class="btn preset-filled-primary"
                        disabled={sendLoading}
                        onclick={() => sendReply(selectedEmail.conv)}
                      >
                        {sendLoading ? 'Sending...' : 'Send reply'}
                      </button>
                      <button type="button" class="btn preset-tonal" onclick={closeReplyForm}>
                        Cancel
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          </aside>
        {/if}
      </div>
    {:else}
      <div class="space-y-6">
        {#each conversations as conv (conv.uuid)}
          <section class="card preset-outlined-surface-200-800 overflow-hidden">
            <div class="p-4 border-b border-surface-200-800 bg-surface-100-900">
              <h2 class="font-semibold">{conv.vendorName}</h2>
              <p class="text-sm text-surface-600-400">{conv.vendorEmail}</p>
            </div>

            <ul class="divide-y divide-surface-200-800">
              {#each conv.messages as msg (msg.uuid)}
                <li class="p-4">
                  <div class="flex justify-between items-start gap-2 flex-wrap">
                    <span class="font-medium">{msg.subject || '(no subject)'}</span>
                    <span class="text-sm text-surface-600-400">{formatDate(msg.sentAt)}</span>
                  </div>
                  <p class="text-sm text-surface-600-400 mt-0.5">From: {msg.from} -> To: {msg.to}</p>
                  {#if msg.body}
                    <p class="mt-2 text-sm whitespace-pre-wrap break-words">
                      {bodyPreview(msg.body)}
                    </p>
                  {/if}
                  <div class="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="btn preset-tonal btn-sm"
                      onclick={() => openReplyForm(conv, msg)}
                    >
                      <SendIcon class="size-4 inline mr-1" />
                      Write reply
                    </button>
                  </div>
                </li>
              {/each}
            </ul>

            <div class="p-4 border-t border-surface-200-800 bg-surface-100-900 flex flex-wrap gap-2">
              <button type="button" class="btn preset-tonal" onclick={() => openReplyForm(conv)}>
                <SendIcon class="size-4 inline mr-1" />
                Write reply (latest)
              </button>
            </div>

            {#if replyingToConvUuid === conv.uuid}
              <div class="p-4 border-t border-surface-200-800 space-y-3">
                {#if apiError}
                  <p class="text-sm text-red-500">{apiError}</p>
                {/if}

                <div>
                  <label class="block text-sm font-medium mb-1">To</label>
                  <input
                    type="text"
                    class="input w-full bg-surface-200-800"
                    value={replyToEmail || conv.vendorEmail}
                    readonly
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-1">Subject</label>
                  <input
                    type="text"
                    class="input w-full bg-surface-200-800"
                    bind:value={replySubject}
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-1">Message</label>
                  <textarea
                    class="input w-full bg-surface-200-800 min-h-[120px]"
                    bind:value={replyBody}
                    placeholder="Type or paste your reply..."
                  />
                </div>

                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn preset-filled-primary"
                    disabled={sendLoading}
                    onclick={() => sendReply(conv)}
                  >
                    {sendLoading ? 'Sending...' : 'Send reply'}
                  </button>
                  <button type="button" class="btn preset-tonal" onclick={closeReplyForm}>
                    Cancel
                  </button>
                </div>
              </div>
            {/if}
          </section>
        {/each}
      </div>
    {/if}
  </div>
</Sidebar>
