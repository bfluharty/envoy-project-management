<!-- Shared legal copy. Keep the public page and consent dialog on this single source. -->
  <article class="space-y-8 text-sm leading-6 text-surface-600-400 dark:text-white">
    <header class="space-y-4">
      <div class="space-y-1 text-sm">
        <p><strong class="text-surface-950-50">Effective Date:</strong> June 15, 2026</p>
        <p><strong class="text-surface-950-50">Last Updated:</strong> July 15, 2026</p>
      </div>

      <p>
        <strong class="text-surface-950-50">Envoy Technologies LLC</strong> (“Envoy,” “we,” “us,”
        or “our”), a South Carolina limited liability company, is committed to protecting your
        privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your
        information when you use our SaaS platform, website (hello-envoy.com), and AI
        project-scoping and marketplace services (collectively, the “Service”).
      </p>

      <p>
        Please read this policy carefully. It describes our data practices and the choices
        available to you. During onboarding, you acknowledge that you have received and reviewed
        this Privacy Policy separately from your agreement to our Terms and Conditions.
      </p>
    </header>

    <section class="space-y-4">
      <h2 class="text-xl font-semibold text-surface-950-50">
        1. INFORMATION WE COLLECT AND HOW WE COLLECT IT
      </h2>
      <p>
        We collect information that you voluntarily provide to us, data generated automatically,
        and information obtained via third-party integrations.
      </p>

      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-surface-950-50">A. Information You Provide to Us</h3>
        <ul class="list-disc space-y-2 pl-6">
          <li>
            <strong class="text-surface-950-50">Account Information:</strong> Full name, email
            address, company name, account credentials, and professional profile details.
          </li>
          <li>
            <strong class="text-surface-950-50">AI Input &amp; Scoping Data:</strong> Project
            parameters, budgets, specifications, text prompts, and chat histories utilized by our AI
            scoping tool.
          </li>
          <li>
            <strong class="text-surface-950-50">Marketplace Interactions:</strong> Communications,
            project briefs, and messages exchanged with vendors via our platform.
          </li>
          <li>
            <strong class="text-surface-950-50">Billing and Payment Data:</strong> Credit card or
            banking information processed via our third-party payment processor (Stripe). We do not
            directly store financial transaction credentials; we receive secure payment tokens and
            basic billing metadata.
          </li>
        </ul>
      </div>

      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-surface-950-50">
          B. Information Collected via Third-Party Integrations (Google &amp; Microsoft OAuth)
        </h3>
        <p>
          If you utilize our Gmail or Microsoft Outlook integration features, we request access via
          Google OAuth or Microsoft Graph API permissions. This allows us to collect:
        </p>
        <ul class="list-disc space-y-2 pl-6">
          <li>Your connected email address (Gmail or Outlook).</li>
          <li>Secure authentication and access tokens.</li>
          <li>
            Inbound and outbound message content and metadata for emails handled through Envoy to
            sync conversation threads, track delivery status, and maintain communication histories
            with marketplace vendors.
          </li>
        </ul>
      </div>

      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-surface-950-50">
          C. Information Collected Automatically
        </h3>
        <ul class="list-disc space-y-2 pl-6">
          <li>
            <strong class="text-surface-950-50">Usage, Device, and Telemetry Data:</strong> IP
            addresses, browser types, operating systems, referring URLs, specific platform pages
            viewed, dates/times of visits, and AI system performance logs.
          </li>
          <li>
            <strong class="text-surface-950-50">Cookies and Tracking:</strong> We utilize cookies,
            web beacons, and similar tracking technologies to handle secure session states, remember
            preferences, and optimize system functionality.
          </li>
        </ul>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-xl font-semibold text-surface-950-50">
        2. THIRD-PARTY EMAIL SERVICES &amp; LIMITED USE COMPLIANCE (GOOGLE &amp; MICROSOFT)
      </h2>
      <p>
        Envoy’s platform integrates with Google API services and Microsoft Graph API services to
        allow you to communicate seamlessly with project vendors.
      </p>
      <ul class="list-disc space-y-2 pl-6">
        <li>
          <strong class="text-surface-950-50">Google Limited Use Disclosure:</strong> Envoy’s use
          and transfer to any other app of information received from Google APIs will adhere to the
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy?authuser=7"
            target="_blank"
            rel="noreferrer"
            class="text-primary-500 hover:text-primary-400 underline underline-offset-2"
          >Google API Services User Data Policy</a>, including its strict
          <strong class="text-surface-950-50">Limited Use requirements</strong>.
        </li>
        <li>
          <strong class="text-surface-950-50">Microsoft Platform Compliance:</strong> Envoy’s use
          and transfer of information received from Microsoft APIs will adhere to the Microsoft
          Developer Terms and applicable commercial data safety policies, ensuring data is used
          strictly for core application functionality.
        </li>
        <li>
          <strong class="text-surface-950-50">Authorized Scopes &amp; Access:</strong>
          <ul class="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong class="text-surface-950-50">Google/Gmail Scopes Requested:</strong> openid,
              userinfo.email, userinfo.profile,
              <a
                href="https://www.googleapis.com/auth/gmail.readonly"
                class="text-primary-500 hover:text-primary-400 break-all underline underline-offset-2"
              >https://www.googleapis.com/auth/gmail.readonly</a>, and
              <a
                href="https://www.googleapis.com/auth/gmail.send"
                class="text-primary-500 hover:text-primary-400 break-all underline underline-offset-2"
              >https://www.googleapis.com/auth/gmail.send</a>.
            </li>
            <li>
              <strong class="text-surface-950-50">Microsoft/Outlook Scopes Requested:</strong>
              openid, profile, email, offline_access, User.Read, Mail.Read, and Mail.Send.
            </li>
          </ul>
        </li>
        <li>
          <strong class="text-surface-950-50">How We Use Email Access:</strong> We utilize email
          read and send scopes (<a
            href="https://www.googleapis.com/auth/gmail.send"
            class="text-primary-500 hover:text-primary-400 break-all underline underline-offset-2"
          >https://www.googleapis.com/auth/gmail.send</a>,
          <a
            href="https://www.googleapis.com/auth/gmail.readonly"
            class="text-primary-500 hover:text-primary-400 break-all underline underline-offset-2"
          >https://www.googleapis.com/auth/gmail.readonly</a>, Mail.Send, and Mail.Read) solely to
          transmit project briefs, RFPs, or updates to vendors directly on your behalf, and to
          securely ingest incoming vendor replies back into your platform timeline.
        </li>
        <li>
          <strong class="text-surface-950-50">No Human Reading:</strong> Envoy personnel do not
          read your integrated email content unless you explicitly authorize it for troubleshooting
          purposes or as required for platform security or legal compliance.
        </li>
        <li>
          <strong class="text-surface-950-50">Strict Transfer Prohibitions:</strong> We do not
          sell, rent, or lease any data obtained through Google or Microsoft APIs to third parties
          under any circumstances. We do not transfer your email data to advertising platforms,
          data brokers, or speculative data miners.
        </li>
        <li>
          <strong class="text-surface-950-50">No Generalized Model Training:</strong> Information
          received from Google, Gmail, Google Workspace, Microsoft Graph, Outlook, or another
          connected mailbox provider is never used to create, train, fine-tune, or improve a
          generalized AI model. The optional Envoy model-training preference does not change this
          exclusion.
        </li>
      </ul>
    </section>

    <section class="space-y-4">
      <h2 class="text-xl font-semibold text-surface-950-50">
        3. OPTIONAL MODEL IMPROVEMENT AND TRAINING
      </h2>
      <p>
        Envoy does not use your content for generalized model improvement or training unless you
        separately opt in. A missing preference or an unchecked control is treated as an opt-out.
        Participation is optional and does not affect your access to normal Envoy features.
      </p>
      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-surface-950-50">Eligible Envoy-native data</h3>
        <p>When you opt in, the eligible categories are:</p>
        <ul class="list-disc space-y-2 pl-6">
          <li>
            Project descriptions, requirements, constraints, budgets, goals, prompts, chat
            messages, and other project-scoping inputs entered directly into Envoy.
          </li>
          <li>
            Envoy-generated scopes, estimates, outlines, recommendations, and other outputs.
          </li>
          <li>Corrections, ratings, and explicit product or model feedback you submit.</li>
          <li>
            De-identified product-usage and model-performance signals that are not derived from a
            connected provider.
          </li>
        </ul>
        <p>
          Opting in makes all eligible historical and future data in these categories available.
          Eligibility is based on your current saved preference rather than the date on which each
          record was created.
        </p>
      </div>
      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-surface-950-50">Data that is always excluded</h3>
        <ul class="list-disc space-y-2 pl-6">
          <li>
            Connected-provider message bodies, attachments, headers, metadata, contacts, and data
            derived from Gmail, Google Workspace, Outlook, Microsoft Graph, or another mailbox.
          </li>
          <li>
            OAuth tokens, passwords, credentials, provider identifiers used only for
            authentication, and encryption material.
          </li>
          <li>Payment-card, bank-account, billing-credential, and payment-token data.</li>
          <li>
            Direct identifiers such as your name, email address, IP address, mailing address, and
            phone number unless separately de-identified under an approved process.
          </li>
          <li>
            Private communications authored by vendors or other third parties, and any data whose
            use is restricted by law, contract, provider policy, or a deletion requirement.
          </li>
        </ul>
      </div>
      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-surface-950-50">Changing your choice</h3>
        <p>
          You can change this preference at any time from the Data &amp; Privacy section of Account
          Settings. Turning it off stops your data from being included in new training-data
          extractions and, when practical, removes it from queued datasets that have not yet been
          used. Opting out does not necessarily remove the influence of data from training that has
          already completed and does not require Envoy to retrain or modify an existing model. If
          you later opt in again, all eligible historical and future data becomes eligible again.
        </p>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-xl font-semibold text-surface-950-50">
        4. TWO-SIDED MARKETPLACE &amp; DATA SHARING WITH VENDORS
      </h2>
      <p>
        To fulfill the core functionality of our marketplace, Envoy shares relevant user-generated
        project data with third-party vendors.
      </p>
      <ul class="list-disc space-y-2 pl-6">
        <li>
          <strong class="text-surface-950-50">Shared Data Profiles:</strong> When you request
          quotes or communicate with a vendor, Envoy transfers necessary information to that vendor,
          which may include your name, company name, email address, AI-generated project scopes, and
          designated budgets.
        </li>
        <li>
          <strong class="text-surface-950-50">Unverified Vendor Warning:</strong> Our marketplace
          features both verified and unverified third-party vendors. Unverified vendors are indexed
          from external platforms and have not undergone privacy or operational vetting by Envoy.
        </li>
        <li>
          <strong class="text-surface-950-50">Independent Data Controllers:</strong> Once your
          information is shared with or transferred to a vendor (verified or unverified), that
          vendor acts as an independent Data Controller of your data. Their handling of your data is
          governed strictly by their own privacy practices, which Envoy does not monitor, oversee,
          or control.
        </li>
      </ul>
    </section>

    <section class="space-y-4">
      <h2 class="text-xl font-semibold text-surface-950-50">5. THIRD-PARTY SUB-PROCESSORS</h2>
      <p>
        To securely host our platform and process specialized data requests, Envoy transfers
        specific data categories to trusted third-party sub-processors. These sub-processors are
        legally bound by contract to protect your data and are prohibited from using it for any
        purpose other than providing contracted services:
      </p>

      <div class="overflow-x-auto rounded-lg border border-surface-200-800">
        <table class="w-full min-w-160 border-collapse text-left text-sm">
          <thead class="bg-surface-100-900 text-surface-950-50">
            <tr>
              <th class="border-b border-surface-200-800 px-4 py-3 font-semibold">
                Sub-Processor Category
              </th>
              <th class="border-b border-surface-200-800 px-4 py-3 font-semibold">Purpose</th>
              <th class="border-b border-surface-200-800 px-4 py-3 font-semibold">
                Core Data Handled
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-200-800">
            <tr>
              <td class="px-4 py-3 align-top">
                <strong class="text-surface-950-50">Cloud Infrastructure Providers</strong> (e.g.,
                AWS)
              </td>
              <td class="px-4 py-3 align-top">
                Core platform hosting, databases, and backup infrastructure
              </td>
              <td class="px-4 py-3 align-top">
                All system data, account logs, and User Content
              </td>
            </tr>
            <tr>
              <td class="px-4 py-3 align-top">
                <strong class="text-surface-950-50">AI API Providers</strong> (e.g., OpenAI,
                Anthropic)
              </td>
              <td class="px-4 py-3 align-top">Processing and generation of project scopes</td>
              <td class="px-4 py-3 align-top">
                User prompts, text inputs, and scoping parameters
              </td>
            </tr>
            <tr>
              <td class="px-4 py-3 align-top">
                <strong class="text-surface-950-50">Payment Processors</strong> (Stripe)
              </td>
              <td class="px-4 py-3 align-top">
                Secure subscription billing and financial compliance
              </td>
              <td class="px-4 py-3 align-top">
                Payment methods, billing addresses, and tax details
              </td>
            </tr>
            <tr>
              <td class="px-4 py-3 align-top">
                <strong class="text-surface-950-50">Product Analytics Platforms</strong>
              </td>
              <td class="px-4 py-3 align-top">
                Monitoring application uptime and error reporting
              </td>
              <td class="px-4 py-3 align-top">
                De-identified usage logs, browser type, and device telemetry
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-xl font-semibold text-surface-950-50">
        6. DATA RETENTION, MINIMIZATION, AND SECURITY
      </h2>
      <ul class="list-disc space-y-2 pl-6">
        <li>
          <strong class="text-surface-950-50">Retention Parameters:</strong> We retain your
          personal data only as long as necessary to provide your active subscription, maintain your
          marketplace historical record, or fulfill legal obligations.
        </li>
        <li>
          <strong class="text-surface-950-50">Consent Records:</strong> We keep a current record
          of your Terms acknowledgment and model-training preference and an immutable event history
          containing the disclosure shown, versions, timestamps, request metadata, and actor. These
          records support legal and operational accountability. Account deletion may remove them in
          accordance with applicable retention, deletion, and legal obligations.
        </li>
        <li>
          <strong class="text-surface-950-50">Automated Minimization:</strong>
          <ul class="mt-2 list-disc space-y-2 pl-6">
            <li>
              <em>Gmail Interaction Logs:</em> Metadata logs regarding emails sent via the Gmail API
              are automatically deleted or fully anonymized after ninety (90) days.
            </li>
            <li>
              <em>AI Cache &amp; Context Logs:</em> Raw API interaction logs submitted to external AI
              sub-processors are set to auto-expire or be deleted within thirty (30) days, subject
              to the sub-processor's standard data safety windows.
            </li>
          </ul>
        </li>
        <li>
          <strong class="text-surface-950-50">Security Architecture:</strong> We implement robust
          administrative, technical, and physical security measures (including TLS encryption in
          transit and AES-256 encryption at rest) designed to shield your data from accidental loss
          or unauthorized breach. However, no transmission medium over the internet is completely
          infallible.
        </li>
      </ul>
    </section>

    <section class="space-y-4">
      <h2 class="text-xl font-semibold text-surface-950-50">
        7. YOUR DATA RIGHTS &amp; GLOBAL COMPLIANCE (GDPR/CCPA)
      </h2>
      <p>
        Depending on your local jurisdiction (including the European Economic Area under GDPR and
        California under the CCPA/CPRA), you possess specific, enforceable rights regarding your
        personal data:
      </p>
      <ul class="list-disc space-y-2 pl-6">
        <li>
          <strong class="text-surface-950-50">Right to Access &amp; Portability:</strong> You have
          the right to receive a copy of your personal data and AI history in a structured,
          machine-readable format.
        </li>
        <li>
          <strong class="text-surface-950-50">Right to Rectification:</strong> You can modify or
          correct inaccurate account information directly through your dashboard settings.
        </li>
        <li>
          <strong class="text-surface-950-50">Right to Erasure (“Right to be Forgotten”):</strong>
          You may request that we completely delete your personal data, past AI generation
          histories, and platform credentials.
        </li>
        <li>
          <strong class="text-surface-950-50">Right to Revoke Authorization:</strong> You may
          revoke Envoy's access to your Google/Gmail account at any time either through your Envoy
          profile configuration panel or directly via your Google Security Account Permissions
          dashboard.
        </li>
      </ul>
      <p>
        To exercise any of these privacy rights, please submit a formal request to our privacy team
        at <strong class="text-surface-950-50">contact@hello-envoy.com</strong>. We will verify your
        identity and respond within the legally mandated timeframes.
      </p>
    </section>

    <section class="space-y-4">
      <h2 class="text-xl font-semibold text-surface-950-50">
        8. CHANGES TO THIS PRIVACY POLICY
      </h2>
      <p>
        We reserve the right to modify or update this Privacy Policy at our discretion to match
        changing AI regulations or platform upgrades. We will notify you of material changes by
        updating the “Last Updated” date at the top of this document or by sending a direct
        notification to your registered system email address. When a change materially affects the
        practices for which acknowledgment is appropriate, we may ask you to acknowledge the
        revised policy in Envoy. A Privacy Policy acknowledgment does not reset or require you to
        repeat your acceptance of the Terms and Conditions.
      </p>
    </section>

    <section class="space-y-4">
      <h2 class="text-xl font-semibold text-surface-950-50">9. CONTACT INFORMATION</h2>
      <p>
        For privacy-specific inquiries, data deletion requests, or questions regarding our Google
        API data handling policies, please reach out to us at:
      </p>
      <div class="space-y-1">
        <p><strong class="text-surface-950-50">Envoy Technologies LLC</strong></p>
        <p>
          <strong class="text-surface-950-50">Email:</strong>
          <a
            href="mailto:contact@hello-envoy.com"
            class="text-primary-500 hover:text-primary-400 underline underline-offset-2"
          >contact@hello-envoy.com</a>
        </p>
        <p>
          <strong class="text-surface-950-50">Web:</strong>
          <a
            href="https://hello-envoy.com"
            class="text-primary-500 hover:text-primary-400 underline underline-offset-2"
          >hello-envoy.com</a>
        </p>
      </div>
    </section>
  </article>
