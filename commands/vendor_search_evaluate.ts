import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import app from '@adonisjs/core/services/app'
import VendorSearchService from '#services/vendor_search_service'

const POSTAL_CODE = '23831'
const TOP_RESULT_LIMIT = 10

type EvaluationCase = {
  id: string
  query: string
  categoryIds: string[]
  goldQuery: string
  relevanceTerms: string[]
  wrongProviderTerms: string[]
}

type CategoryVerificationCase = {
  categoryId: string
  query: string
}

type PlaceSummary = {
  text: string
  categoryLabels: string[]
}

function firstString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function summarizePlace(value: unknown): PlaceSummary | null {
  if (!value || typeof value !== 'object') return null
  const place = value as Record<string, unknown>
  const categoryLabels = Array.isArray(place.categories)
    ? place.categories
        .map((category) => {
          if (!category || typeof category !== 'object') return ''
          const record = category as Record<string, unknown>
          return firstString(record.name) || firstString(record.short_name)
        })
        .filter(Boolean)
    : []
  const name = firstString(place.name)
  return {
    text: `${name} ${categoryLabels.join(' ')}`.toLowerCase(),
    categoryLabels,
  }
}

function countMatching(results: PlaceSummary[], terms: string[], limit: number) {
  const normalizedTerms = terms.map((term) => term.toLowerCase())
  return results
    .slice(0, limit)
    .filter(({ text }) => normalizedTerms.some((term) => text.includes(term))).length
}

export default class VendorSearchEvaluate extends BaseCommand {
  static commandName = 'vendor-search:evaluate'
  static description =
    'Compare query-only, mapped-category, and gold Foursquare vendor searches near 23831'
  static options: CommandOptions = {
    startApp: true,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  async run() {
    const fixturePath = app.makePath('resources/vendor_search_evaluation_cases.json')
    const cases = JSON.parse(await readFile(fixturePath, 'utf8')) as EvaluationCase[]
    const categoryFixturePath = app.makePath(
      'resources/vendor_search_category_verification_cases.json'
    )
    const categoryCases = JSON.parse(
      await readFile(categoryFixturePath, 'utf8')
    ) as CategoryVerificationCase[]
    const evaluations: Array<Record<string, unknown>> = []
    const categoryVerifications: Array<Record<string, unknown>> = []

    for (const evaluationCase of cases) {
      const variants = [
        { mode: 'query_only', query: evaluationCase.query, categoryIds: [] as string[] },
        {
          mode: 'deterministic_mapping',
          query: evaluationCase.query,
          categoryIds: evaluationCase.categoryIds,
        },
        {
          mode: 'gold',
          query: evaluationCase.goldQuery,
          categoryIds: evaluationCase.categoryIds,
        },
      ]

      for (const variant of variants) {
        try {
          const rawResults = await VendorSearchService.searchPlaces(
            variant.query,
            POSTAL_CODE,
            variant.categoryIds
          )
          const results = rawResults
            .map(summarizePlace)
            .filter((result): result is PlaceSummary => !!result)
            .slice(0, TOP_RESULT_LIMIT)
          const categoryLabels = [
            ...new Set(results.flatMap((result) => result.categoryLabels)),
          ].slice(0, 12)
          evaluations.push({
            caseId: evaluationCase.id,
            mode: variant.mode,
            query: variant.query,
            categoryIds: variant.categoryIds,
            resultCount: rawResults.length,
            relevantTopFive: countMatching(results, evaluationCase.relevanceTerms, 5),
            relevantTopTen: countMatching(results, evaluationCase.relevanceTerms, 10),
            wrongProviderTopTen: countMatching(results, evaluationCase.wrongProviderTerms, 10),
            returnedCategoryLabels: categoryLabels,
          })
        } catch (error) {
          evaluations.push({
            caseId: evaluationCase.id,
            mode: variant.mode,
            query: variant.query,
            categoryIds: variant.categoryIds,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    for (const categoryCase of categoryCases) {
      try {
        const rawResults = await VendorSearchService.searchPlaces(categoryCase.query, POSTAL_CODE, [
          categoryCase.categoryId,
        ])
        const returnedCategoryLabels = [
          ...new Set(
            rawResults
              .map(summarizePlace)
              .filter((result): result is PlaceSummary => !!result)
              .flatMap((result) => result.categoryLabels)
          ),
        ].slice(0, 12)
        categoryVerifications.push({
          categoryId: categoryCase.categoryId,
          query: categoryCase.query,
          requestAccepted: true,
          resultCount: rawResults.length,
          returnedCategoryLabels,
        })
      } catch (error) {
        categoryVerifications.push({
          categoryId: categoryCase.categoryId,
          query: categoryCase.query,
          requestAccepted: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const successful = evaluations.filter((evaluation) => !evaluation.error)
    const summary = {
      postalCode: POSTAL_CODE,
      apiVersion: '2025-06-17',
      caseCount: cases.length,
      requestCount: evaluations.length,
      failedRequestCount: evaluations.length - successful.length,
      categoryVerificationCount: categoryVerifications.length,
      categoryVerificationFailureCount: categoryVerifications.filter(
        (verification) => !verification.requestAccepted
      ).length,
      categoryVerificationEmptyCount: categoryVerifications.filter(
        (verification) => verification.resultCount === 0
      ).length,
      emptyResultRate:
        successful.filter((evaluation) => evaluation.resultCount === 0).length / successful.length,
      averageRelevantTopFive:
        successful.reduce(
          (total, evaluation) => total + Number(evaluation.relevantTopFive ?? 0),
          0
        ) / successful.length,
      averageWrongProviderTopTen:
        successful.reduce(
          (total, evaluation) => total + Number(evaluation.wrongProviderTopTen ?? 0),
          0
        ) / successful.length,
    }

    const reportPath = app.makePath('test-results/vendor-search-live-evaluation.json')
    await mkdir(dirname(reportPath), { recursive: true })
    await writeFile(
      reportPath,
      `${JSON.stringify({ summary, evaluations, categoryVerifications }, null, 2)}\n`,
      'utf8'
    )
    this.logger.info(`Vendor search evaluation complete: ${JSON.stringify(summary)}`)
    this.logger.info(`Detailed report: ${reportPath}`)
  }
}
