import fs from 'fs'
import path from 'path'

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

export function uploadsRoot() {
  return path.resolve(process.cwd(), 'uploads')
}

