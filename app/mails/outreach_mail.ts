import { BaseMail } from '@adonisjs/mail'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export default class OutreachMail extends BaseMail {
  constructor(
    private to: string,
    private subjectLine: string,
    private bodyText: string
  ) {
    super()
  }

  prepare() {
    const htmlBody = `<div style="white-space: pre-wrap">${escapeHtml(this.bodyText)}</div>`
    this.message.to(this.to).subject(this.subjectLine).text(this.bodyText).html(htmlBody)
  }
}
