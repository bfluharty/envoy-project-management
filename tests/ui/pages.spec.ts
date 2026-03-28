import { test, expect } from '@playwright/test'
import { login, goToProject } from './helpers.js'

test('landing page', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('Welcome to Envoy')
  await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible()
})

test('login page', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('h2')).toContainText('Sign in to your account')
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('register page', async ({ page }) => {
  await page.goto('/register')
  await expect(page.locator('h2')).toContainText('Create your account')
  await expect(page.getByLabel('Full Name')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
})

test('dashboard page', async ({ page }) => {
  await login(page)
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible()
})

test('project page - convo tab', async ({ page }) => {
  await login(page)
  await goToProject(page)
  await expect(page.getByPlaceholder('Type your message...')).toBeVisible()
})
