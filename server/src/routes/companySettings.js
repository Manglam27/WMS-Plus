import express from 'express'
import multer from 'multer'
import path from 'path'
import CompanySettings from '../models/CompanySettings.js'
import { protect, requireRole } from '../middleware/auth.js'
import { ensureDir, uploadsRoot } from '../uploads.js'

const router = express.Router()

const companyUploadsDir = path.join(uploadsRoot(), 'company')
ensureDir(companyUploadsDir)

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, companyUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const safeExt = ext && ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png'
    cb(null, `company-logo-${Date.now()}${safeExt}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)
    cb(ok ? null : new Error('Invalid image type'), ok)
  },
})

async function getOrCreateSettings() {
  let settings = await CompanySettings.findOne().sort({ createdAt: 1 })
  if (!settings) settings = await CompanySettings.create({})
  return settings
}

router.get('/', protect, async (req, res) => {
  try {
    const settings = await getOrCreateSettings()
    res.json(settings)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

router.put('/', protect, requireRole('admin'), upload.single('logo'), async (req, res) => {
  try {
    const settings = await getOrCreateSettings()
    const body = req.body || {}

    settings.companyName = String(body.companyName || '').trim()
    settings.addressLine1 = String(body.addressLine1 || '').trim()
    settings.addressLine2 = String(body.addressLine2 || '').trim()
    settings.city = String(body.city || '').trim()
    settings.state = String(body.state || '').trim()
    settings.zipCode = String(body.zipCode || '').trim()
    settings.phone = String(body.phone || '').trim()
    settings.email = String(body.email || '').trim()
    settings.website = String(body.website || '').trim()
    settings.enableSalesTax = String(body.enableSalesTax ?? 'true') === 'true'
    settings.salesTaxPercent = Math.max(0, Number(body.salesTaxPercent) || 0)
    settings.salesTaxLabel = String(body.salesTaxLabel || 'Sales Tax').trim() || 'Sales Tax'
    settings.invoiceDisclosure = String(body.invoiceDisclosure || '').trim()
    settings.invoiceTerms = String(body.invoiceTerms || '').trim()
    const stateTaxRulesRaw = body.stateTaxRules
    let stateTaxRules = []
    if (stateTaxRulesRaw) {
      try {
        const parsed = JSON.parse(String(stateTaxRulesRaw))
        if (Array.isArray(parsed)) {
          stateTaxRules = parsed
            .map((r) => ({
              stateCode: String(r?.stateCode || '').trim().toUpperCase(),
              taxPercent: Math.max(0, Number(r?.taxPercent) || 0),
              minAmount: Math.max(0, Number(r?.minAmount) || 0),
              maxAmount: r?.maxAmount === '' || r?.maxAmount == null ? null : Math.max(0, Number(r.maxAmount) || 0),
              isActive: r?.isActive !== false,
            }))
            .filter((r) => r.stateCode)
        }
      } catch {
        stateTaxRules = []
      }
    }
    settings.stateTaxRules = stateTaxRules

    if (req.file?.filename) {
      settings.logoFileName = req.file.filename
    }

    await settings.save()
    res.json(settings)
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('invalid image type')) {
      return res.status(400).json({ message: 'Invalid image type (PNG/JPG/WEBP only)' })
    }
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
