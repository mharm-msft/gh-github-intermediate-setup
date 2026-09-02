import { jest } from '@jest/globals'

export const existsSync = jest.fn()
export const mkdtempSync = jest.fn()
export const readFileSync = jest.fn()
export const rmSync = jest.fn()
export const writeFileSync = jest.fn()

export default {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
}
