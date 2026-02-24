<script lang="ts">
  import Sidebar from '#components/sidebar.svelte'
  import { page } from '@inertiajs/svelte'
  import { MailIcon, InboxIcon, SendIcon, SparklesIcon } from '@lucide/svelte'

  interface Message {
    uuid: string
    subject: string
    from: string
    to: string
    body: string
    sentAt: string
  }

  interface Conversation {
    uuid: string
    vendorName: string
    vendorEmail: string
    messages: Message[]
  }

  const { conversations = [] } = $props()
  const flash = $derived($page.props.flash || {})

  let replyingToConvUuid = $state<string | null>(null)
  let replyBody = $state('')
  let replySubject = $state('')
  let suggestLoading = $state<string | null>(null)
  let sendLoading = $state(false)
  let apiError = $state<string | null>(null)

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
    return text.length <= maxLen ? text : text.slice(0, maxLen) + '…'
  }

  function reSubject(subject: string) {
    const s = (subject || '').trim()
    if (!s) return 'Re: (no subject)'
    if (/^re:\s/i.test(s)) return s
    return `Re: ${s}`
  }

  function buildThreadContext(conv: Conversation, excludeLast = true) {
    const messages = conv.messages
    const end = excludeLast && messages.length > 1 ? messages.length - 1 : messages.length
    return messages
      .slice(0, end)
      .map((msg) => {
        return `From: ${msg.from}\nSubject: ${msg.subject || '(no subject)'}\n${bodyPreview(msg.body, 500)}\n---`
      })
      .join('\n\n')
  }

  async function suggestReply(conv: Conversation) {
    const last = conv.messages[conv.messages.length - 1]
    if (!last) return
    apiError = null
    suggestLoading = conv.uuid
    const toArr = last.to ? last.to.split(',').map((e) => e.trim()).filter(Boolean) : []
    if (toArr.length === 0) toArr.push(conv.vendorEmail)
    try {
      const res = await fetch('/api/inbox/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: last.subject || '',
          body: (last.body || '').replace(/<[^>]+>/g, ' ').trim(),
          from: last.from,
          to: toArr,
          date: last.sentAt,
          threadContext: buildThreadContext(conv) || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        apiError = data.error || 'Failed to generate reply'
        return
      }
      const parts = [
        data.emailResponse?.greeting,
        data.emailResponse?.body,
        data.emailResponse?.closing,
        data.emailResponse?.signature,
      ].filter(Boolean)
      replyBody = parts.join('\n\n')
      replySubject = reSubject(last.subject || '')
      replyingToConvUuid = conv.uuid
    } finally {
      suggestLoading = null
    }
  }

  function openReplyForm(conv: Conversation) {
    const last = conv.messages[conv.messages.length - 1]
    replySubject = last ? reSubject(last.subject || '') : ''
    replyBody = ''
    replyingToConvUuid = conv.uuid
    apiError = null
  }

  function closeReplyForm() {
    replyingToConvUuid = null
    replyBody = ''
    replySubject = ''
    apiError = null
  }

  async function sendReply(conv: Conversation) {
    apiError = null
    sendLoading = true
    try {
      const res = await fetch('/api/inbox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          vendorConversationUuid: conv.uuid,
          to: conv.vendorEmail,
          subject: replySubject,
          body: replyBody,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        apiError = data.error || 'Failed to send reply'
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
  <title>Vendor emails – Inbox</title>
</svelte:head>

<Sidebar>
  <div class="w-full max-w-4xl p-6 space-y-6">
    <header class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-3xl font-bold flex items-center gap-2">
          <InboxIcon class="size-8" />
          Vendor emails
        </h1>
        <p class="text-surface-600-400 mt-1">
          Emails from vendors synced from your connected inbox. Run <code class="text-sm bg-surface-200-800 px-1 rounded">node ace inbox:sync</code> to fetch new messages.
        </p>
      </div>
      <a href="/inbox/settings" class="btn preset-tonal">Manage inbox</a>
    </header>

    {#if flash.error}
      <div class="alert preset-tonal-error p-4 rounded-lg">
        <span>{flash.error}</span>
      </div>
    {/if}
    {#if flash.success}
      <div class="alert preset-tonal-success p-4 rounded-lg">
        <span>{flash.success}</span>
      </div>
    {/if}

    {#if conversations.length === 0}
      <div class="card preset-outlined-surface-200-800 p-8 text-center text-surface-600-400">
        <MailIcon class="size-12 mx-auto mb-3 opacity-50" />
        <p>No vendor emails yet.</p>
        <p class="text-sm mt-1">Connect an inbox in Settings, then run <code class="bg-surface-200-800 px-1 rounded">node ace inbox:sync</code> to pull emails from vendors.</p>
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
                  <p class="text-sm text-surface-600-400 mt-0.5">
                    From: {msg.from} → To: {msg.to}
                  </p>
                  {#if msg.body}
                    <p class="mt-2 text-sm whitespace-pre-wrap break-words">{bodyPreview(msg.body)}</p>
                  {/if}
                </li>
              {/each}
            </ul>
            <div class="p-4 border-t border-surface-200-800 bg-surface-100-900 flex flex-wrap gap-2">
              <button
                type="button"
                class="btn preset-filled-primary"
                disabled={suggestLoading !== null}
                onclick={() => suggestReply(conv)}
              >
                {#if suggestLoading === conv.uuid}
                  <span class="animate-pulse">Generating…</span>
                {:else}
                  <SparklesIcon class="size-4 inline mr-1" />
                  Suggest reply (AI)
                {/if}
              </button>
              <button
                type="button"
                class="btn preset-tonal"
                onclick={() => openReplyForm(conv)}
              >
                <SendIcon class="size-4 inline mr-1" />
                Write reply
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
                    value={conv.vendorEmail}
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
                    placeholder="Type or paste your reply…"
                  />
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn preset-filled-primary"
                    disabled={sendLoading}
                    onclick={() => sendReply(conv)}
                  >
                    {sendLoading ? 'Sending…' : 'Send reply'}
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
