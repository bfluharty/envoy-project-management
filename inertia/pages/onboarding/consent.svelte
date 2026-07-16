<script lang="ts">
  import { router } from '@inertiajs/svelte'
  import { untrack } from 'svelte'
  import LegalDocumentDialog from '#components/legal/legal_document_dialog.svelte'
  import PrivacyContent from '#components/legal/privacy_content.svelte'
  import TermsContent from '#components/legal/terms_content.svelte'
  import Logo from '#components/logo.svelte'
  import PublicFooter from '#components/public_footer.svelte'
  import {
    MODEL_TRAINING_CONTROL_TEXT,
    MODEL_TRAINING_SUPPORTING_TEXT,
  } from '#constants/user_consent'

  const {
    errors: propErrors = {},
    privacyReackOnly = false,
  }: {
    termsVersion?: string
    privacyPolicyVersion?: string
    modelTrainingNoticeVersion?: string
    privacyReackOnly?: boolean
    errors?: Record<string, string | string[]>
  } = $props()

  let termsAccepted = $state(false)
  let modelTrainingOptIn = $state(false)
  let processing = $state(false)
  let logoutProcessing = $state(false)
  let errors = $state<Record<string, string | string[]>>(untrack(() => propErrors))

  function errorText(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
  }

  function submitConsent(event: SubmitEvent) {
    event.preventDefault()
    if (!termsAccepted || processing) return

    processing = true
    errors = {}

    router.post(
      '/onboarding/consent',
      { termsAccepted, modelTrainingOptIn },
      {
        onError: (responseErrors) => {
          errors = responseErrors as Record<string, string | string[]>
        },
        onFinish: () => {
          processing = false
        },
      }
    )
  }

  function signOut() {
    if (logoutProcessing) return
    logoutProcessing = true
    router.post(
      '/logout',
      {},
      {
        onFinish: () => {
          logoutProcessing = false
        },
      }
    )
  }
</script>

<svelte:head>
  <title>Complete account setup - Envoy</title>
</svelte:head>

<div class="flex min-h-dvh flex-col overflow-x-clip">
  <header
    class="flex w-full items-center justify-between border-b border-surface-200-800 bg-surface-50-950/85 px-4 py-3 backdrop-blur-md sm:px-6"
  >
    <a
      href="/"
      aria-label="Envoy home"
      class="inline-flex rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
    >
      <Logo class="size-6" />
    </a>
    <button
      type="button"
      class="btn btn-sm preset-tonal"
      disabled={logoutProcessing}
      onclick={signOut}
    >
      {logoutProcessing ? 'Signing out...' : 'Sign out'}
    </button>
  </header>

  <main class="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
    <section class="w-full max-w-2xl space-y-6">
      <header class="space-y-2 text-center">
        <p class="text-sm font-semibold uppercase tracking-wide text-primary-500">
          {privacyReackOnly ? 'Privacy update' : 'One last step'}
        </p>
        <h1 class="text-3xl font-bold sm:text-4xl">
          {privacyReackOnly ? 'Review our updated Privacy Policy' : 'Choose your data preferences'}
        </h1>
        <p class="mx-auto max-w-xl text-surface-600-400">
          {privacyReackOnly
            ? 'Please acknowledge the material Privacy Policy update before continuing.'
            : "Review Envoy's legal terms and decide whether you would like to help improve our models."}
        </p>
      </header>

      <form
        class="card space-y-6 border border-surface-200-800 bg-surface-50-950/70 p-5 shadow-lg sm:p-8"
        onsubmit={submitConsent}
      >
        {#if errorText(errors.termsAccepted) || errorText(errors.modelTrainingOptIn)}
          <aside class="rounded-lg border border-error-500/30 bg-error-500/10 p-4" role="alert">
            <p>{errorText(errors.termsAccepted) ?? errorText(errors.modelTrainingOptIn)}</p>
          </aside>
        {/if}

        <fieldset class="space-y-6" disabled={processing}>
          <legend class="sr-only">Legal and data preferences</legend>

          <div class="rounded-xl border border-surface-200-800 p-4 sm:p-5">
            <div class="flex items-start gap-3">
              <input
                id="termsAccepted"
                name="termsAccepted"
                type="checkbox"
                class="checkbox mt-1 shrink-0"
                bind:checked={termsAccepted}
                aria-labelledby="required-consent-label"
                aria-describedby={errorText(errors.termsAccepted) ? 'terms-error' : undefined}
              />
              <div
                id="required-consent-label"
                class="flex flex-wrap items-baseline gap-x-1 text-sm leading-6"
              >
                {#if !privacyReackOnly}
                  <label for="termsAccepted">I agree to Envoy's</label>
                  <LegalDocumentDialog
                    id="terms-document-dialog"
                    title="Terms and Conditions"
                    href="/terms"
                    linkText="Terms of Service"
                  >
                    <TermsContent />
                  </LegalDocumentDialog>
                  <label for="termsAccepted">and acknowledge the</label>
                {:else}
                  <label for="termsAccepted">I acknowledge the updated</label>
                {/if}
                <LegalDocumentDialog
                  id="privacy-document-dialog"
                  title="Privacy Policy"
                  href="/privacy"
                  linkText="Privacy Policy"
                >
                  <PrivacyContent />
                </LegalDocumentDialog>
                <label for="termsAccepted" class="-ml-1">.</label>
              </div>
            </div>
            {#if errorText(errors.termsAccepted)}
              <p id="terms-error" class="mt-2 pl-9 text-sm text-error-500">
                {errorText(errors.termsAccepted)}
              </p>
            {/if}
          </div>

          {#if !privacyReackOnly}
            <div class="rounded-xl border border-surface-200-800 p-4 sm:p-5">
              <div class="flex items-start gap-3">
                <input
                  id="modelTrainingOptIn"
                  name="modelTrainingOptIn"
                  type="checkbox"
                  class="checkbox mt-1 shrink-0"
                  bind:checked={modelTrainingOptIn}
                  aria-describedby="model-training-details"
                />
                <div class="space-y-2 text-sm">
                  <label for="modelTrainingOptIn" class="block font-medium leading-6">
                    {MODEL_TRAINING_CONTROL_TEXT}
                  </label>
                  <p id="model-training-details" class="text-xs leading-5 text-surface-600-400">
                    {MODEL_TRAINING_SUPPORTING_TEXT}
                  </p>
                </div>
              </div>
            </div>
          {/if}
        </fieldset>

        <button
          type="submit"
          class="btn preset-filled-primary-500 w-full disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!termsAccepted || processing}
          aria-disabled={!termsAccepted || processing}
        >
          {processing ? 'Saving preferences...' : 'Continue'}
        </button>
      </form>
    </section>
  </main>

  <PublicFooter />
</div>
