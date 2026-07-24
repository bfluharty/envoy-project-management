# **PRIVACY POLICY**

**Effective Date:** June 15, 2026

**Last Updated:** July 23, 2026

**Envoy Technologies LLC** (“Envoy,” “we,” “us,” or “our”), a South Carolina limited liability company, is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our SaaS platform, website (hello-envoy.com), and AI project-scoping and marketplace services (collectively, the “Service”).

Please read this policy carefully. By accessing or using the Service, you agree to the collection and use of information in accordance with this policy.

### **1\. INFORMATION WE COLLECT AND HOW WE COLLECT IT**

We collect information that you voluntarily provide to us, data generated automatically, and information obtained via third-party integrations.

#### **A. Information You Provide to Us**

- **Account Information:** Full name, email address, company name, account credentials, and professional profile details.
- **AI Input & Scoping Data:** Project parameters, budgets, specifications, text prompts, and chat histories utilized by our AI scoping tool.
- **Marketplace Interactions:** Communications, project briefs, and messages exchanged with vendors via our platform.
- **Billing and Payment Data:** Credit card or banking information processed via our third-party payment processor (Stripe). We do not directly store financial transaction credentials; we receive secure payment tokens and basic billing metadata.

#### **B. Information Collected via Third-Party Integrations (Google & Microsoft OAuth)**

If you utilize our Gmail or Microsoft Outlook integration features, we request access via Google OAuth or Microsoft Graph API permissions. This allows us to collect:

- Your connected email address (Gmail or Outlook).
- Secure authentication and access tokens.
- Inbound and outbound message content and metadata for emails handled through Envoy to sync conversation threads, track delivery status, and maintain communication histories with marketplace vendors.

#### **C. Information Collected Automatically**

- **Usage, Device, and Telemetry Data:** IP addresses, browser types, operating systems, referring URLs, specific platform pages viewed, dates/times of visits, and AI system performance logs.
- **Cookies and Tracking:** We utilize cookies, web beacons, and similar tracking technologies to handle secure session states, remember preferences, and optimize system functionality.

#### **D. Product Feedback and Community Features**

After you sign in and complete any required privacy acknowledgment, Envoy may make a self-hosted feedback widget available. Envoy also operates a public feedback portal where published feedback can be viewed without an Envoy account. When you use these features, we process:

- Your Envoy user identifier, current name, and current email address so the feedback system can recognize you without requiring a second account or sign-in.
- Feedback posts, feature requests, bug reports, votes, comments, and screenshots or other images you choose to attach.
- Limited operational context consisting of the Envoy environment, broad page area, and application version. Envoy does not automatically send project identifiers, full page URLs, connected-mailbox content, credentials, or payment data to the feedback system.

We use this information to operate and secure the feedback service, understand and prioritize requests, investigate bugs, communicate product decisions, and improve Envoy. Published feedback and the name attributed to it may be visible to anyone on the Internet, together with its status, vote count, published comments, roadmap placement, and changelog information. Submitting feedback, voting, and commenting require an authenticated Envoy user. Some submissions may be moderated before publication, and Envoy administrators can review unpublished feedback and moderation information.

Do not include passwords, access tokens, payment information, connected-email contents, sensitive personal information, or confidential third-party information in feedback, comments, or screenshots.

### **2\. THIRD-PARTY EMAIL SERVICES & LIMITED USE COMPLIANCE (GOOGLE & MICROSOFT)**

Envoy’s platform integrates with Google API services and Microsoft Graph API services to allow you to communicate seamlessly with project vendors.

- **Google Limited Use Disclosure:** Envoy’s use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy?authuser=7), including its strict **Limited Use requirements**.
- **Microsoft Platform Compliance:** Envoy’s use and transfer of information received from Microsoft APIs will adhere to the Microsoft Developer Terms and applicable commercial data safety policies, ensuring data is used strictly for core application functionality.
- **Authorized Scopes & Access:**
  - **Google/Gmail Scopes Requested:** openid, userinfo.email, userinfo.profile, \[https://www.googleapis.com/auth/gmail.readonly\](https://www.googleapis.com/auth/gmail.readonly), and \[https://www.googleapis.com/auth/gmail.send\](https://www.googleapis.com/auth/gmail.send).
  - **Microsoft/Outlook Scopes Requested:** openid, profile, email, offline_access, User.Read, Mail.Read, and Mail.Send.
- **How We Use Email Access:** We utilize email read and send scopes (\[https://www.googleapis.com/auth/gmail.send\](https://www.googleapis.com/auth/gmail.send), \[https://www.googleapis.com/auth/gmail.readonly\](https://www.googleapis.com/auth/gmail.readonly), Mail.Send, and Mail.Read) solely to transmit project briefs, RFPs, or updates to vendors directly on your behalf, and to securely ingest incoming vendor replies back into your platform timeline.
- **No Human Reading:** Envoy personnel do not read your integrated email content unless you explicitly authorize it for troubleshooting purposes or as required for platform security or legal compliance.
- **Strict Transfer Prohibitions:** We do not sell, rent, or lease any data obtained through Google or Microsoft APIs to third parties under any circumstances. We do not transfer your email data to advertising platforms, data brokers, or speculative data miners.

### **3\. TWO-SIDED MARKETPLACE & DATA SHARING WITH VENDORS**

To fulfill the core functionality of our marketplace, Envoy shares relevant user-generated project data with third-party vendors.

- **Shared Data Profiles:** When you request quotes or communicate with a vendor, Envoy transfers necessary information to that vendor, which may include your name, company name, email address, AI-generated project scopes, and designated budgets.
- **Unverified Vendor Warning:** Our marketplace features both verified and unverified third-party vendors. Unverified vendors are indexed from external platforms and have not undergone privacy or operational vetting by Envoy.
- **Independent Data Controllers:** Once your information is shared with or transferred to a vendor (verified or unverified), that vendor acts as an independent Data Controller of your data. Their handling of your data is governed strictly by their own privacy practices, which Envoy does not monitor, oversee, or control.

### **4\. THIRD-PARTY SUB-PROCESSORS**

To securely host our platform and process specialized data requests, Envoy transfers specific data categories to trusted third-party sub-processors. These sub-processors are legally bound by contract to protect your data and are prohibited from using it for any purpose other than providing contracted services:

| Sub-Processor Category                         | Purpose                                                     | Core Data Handled                                            |
| :--------------------------------------------- | :---------------------------------------------------------- | :----------------------------------------------------------- |
| **Cloud Infrastructure Providers** (e.g., AWS) | Core platform hosting, databases, and backup infrastructure | All system data, account logs, and User Content              |
| **AI API Providers** (e.g., OpenAI, Anthropic) | Processing and generation of project scopes                 | User prompts, text inputs, and scoping parameters            |
| **Payment Processors** (Stripe)                | Secure subscription billing and financial compliance        | Payment methods, billing addresses, and tax details          |
| **Product Analytics Platforms**                | Monitoring application uptime and error reporting           | De-identified usage logs, browser type, and device telemetry |

Envoy operates its product-feedback system on AWS infrastructure using self-hosted Quackback software. Quackback Ltd. does not host or have access to data in Envoy's self-hosted deployment. Envoy has disabled Quackback telemetry and AI features for this deployment.

### **5\. DATA RETENTION, MINIMIZATION, AND SECURITY**

- **Retention Parameters:** We retain your personal data only as long as necessary to provide your active subscription, maintain your marketplace historical record, or fulfill legal obligations.
- **Feedback Retention and Deletion:** Active feedback remains available while it is useful for product planning, support, security, legal compliance, or the purposes described in this policy. Soft-deleted feedback posts are permanently removed after thirty (30) days. Feedback audit logs may be retained indefinitely for security and accountability. When a feedback user is deleted, their user record is permanently deleted, votes are removed, sessions are invalidated, and retained posts and comments are attributed to "Deleted User." Feedback text and attachments may therefore remain in anonymized form to preserve discussion continuity unless we also delete the content in response to an applicable request. Backup copies age out under Envoy's backup-retention schedule and are not used for ordinary product access.
- **Automated Minimization:** \* _Gmail Interaction Logs:_ Metadata logs regarding emails sent via the Gmail API are automatically deleted or fully anonymized after ninety (90) days.
  - _AI Cache & Context Logs:_ Raw API interaction logs submitted to external AI sub-processors are set to auto-expire or be deleted within thirty (30) days, subject to the sub-processor's standard data safety windows.
- **Security Architecture:** We implement robust administrative, technical, and physical security measures (including TLS encryption in transit and AES-256 encryption at rest) designed to shield your data from accidental loss or unauthorized breach. However, no transmission medium over the internet is completely infallible.

### **6\. YOUR DATA RIGHTS & GLOBAL COMPLIANCE (GDPR/CCPA)**

Depending on your local jurisdiction (including the European Economic Area under GDPR and California under the CCPA/CPRA), you possess specific, enforceable rights regarding your personal data:

- **Right to Access & Portability:** You have the right to receive a copy of your personal data and AI history in a structured, machine-readable format.
- **Right to Rectification:** You can modify or correct inaccurate account information directly through your dashboard settings.
- **Right to Erasure ("Right to be Forgotten"):** You may request that we completely delete your personal data, past AI generation histories, and platform credentials.
- **Right to Revoke Authorization:** You may revoke Envoy's access to your Google/Gmail account at any time either through your Envoy profile configuration panel or directly via your Google Security Account Permissions dashboard.

To exercise any of these privacy rights, please submit a formal request to our privacy team at **contact@hello-envoy.com**. We will verify your identity and respond within the legally mandated timeframes. A request may include access to or export of your feedback, correction of the identity associated with it, deletion of your feedback-system user, or deletion of specific feedback content or attachments.

### **7\. CHANGES TO THIS PRIVACY POLICY**

We reserve the right to modify or update this Privacy Policy at our discretion to match changing AI regulations or platform upgrades. We will notify you of material changes by updating the "Last Updated" date at the top of this document or by sending a direct notification to your registered system email address. Continued use of Envoy following an update implies complete acceptance of the revised practices.

### **8\. CONTACT INFORMATION**

For privacy-specific inquiries, data deletion requests, or questions regarding our Google API data handling policies, please reach out to us at:

**Envoy Technologies LLC** **Email:** contact@hello-envoy.com

**Web:** hello-envoy.com
